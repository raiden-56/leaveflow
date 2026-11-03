import type { Request, Response } from 'express';
import { createServices, type Container } from '@server/config/services';
import { apiRoutes, type RouteDef } from '@server/routes/definitions';
import { authenticate, authorize } from '@server/middleware/auth';
import { buildSeed } from '@server/seed/seedData';
import { toErrorResponse } from '@server/utils/errors';
import { BrowserAuthService } from './browserAuth';
import { BrowserStore } from './browserStore';

/**
 * Runs the LeaveFlow REST API inside the browser for the static GitHub Pages
 * build. It mounts the SAME route table, middleware, controllers, services and
 * Excel repositories as the Node server — only the storage (BrowserStore) and
 * the auth provider differ. The frontend still talks to it through Axios.
 */

const SESSION_KEY = 'leaveflow.session';
const ATTACHMENT_KEY = 'leaveflow.attachments';

export interface LocalRequest {
  method: string;
  path: string;
  query: Record<string, string>;
  body: unknown;
  file?: { originalname: string; buffer: ArrayBuffer; size: number; mimetype: string };
}

export interface LocalResponse {
  status: number;
  headers: Record<string, string>;
  body: unknown;
}

interface CompiledRoute extends RouteDef {
  regex: RegExp;
  keys: string[];
}

const config = {
  authCookieName: 'lf_token',
  isProduction: false,
  isTest: false,
  dataProvider: 'excel (browser storage)',
  uploadDir: '',
};

let ready: Promise<{ container: Container; store: BrowserStore; routes: CompiledRoute[] }> | null = null;

function compile(route: RouteDef): CompiledRoute {
  const keys: string[] = [];
  const pattern = route.path.replace(/:([A-Za-z]+)/g, (_, k: string) => {
    keys.push(k);
    return '([^/]+)';
  });
  return { ...route, regex: new RegExp(`^${pattern}$`), keys };
}

function boot() {
  ready ??= (async () => {
    const store = new BrowserStore();
    store.init(() => buildSeed(new Date()));
    const container = createServices({ store, config, createAuth: (deps, audit) => new BrowserAuthService(deps, audit) });
    // Time-based workflow (reminders, auto-complete, overdue) runs on each visit.
    await container.lifecycle.run().catch(() => undefined);
    return { container, store, routes: apiRoutes(container).map(compile) };
  })();
  return ready;
}

function session(): string | undefined {
  try {
    return localStorage.getItem(SESSION_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

function setSession(token: string | null): void {
  try {
    if (token) localStorage.setItem(SESSION_KEY, token);
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

function saveAttachment(name: string, dataUrl: string): void {
  try {
    const all = JSON.parse(localStorage.getItem(ATTACHMENT_KEY) ?? '{}') as Record<string, string>;
    all[name] = dataUrl;
    localStorage.setItem(ATTACHMENT_KEY, JSON.stringify(all));
  } catch {
    /* attachments are best-effort in the browser demo */
  }
}

function toDataUrl(buffer: ArrayBuffer, mimetype: string): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(new Blob([buffer], { type: mimetype || 'application/octet-stream' }));
  });
}

/** A minimal Express-compatible response object. */
function createResponse() {
  const state: LocalResponse = { status: 200, headers: {}, body: undefined };
  const res = {
    status(code: number) {
      state.status = code;
      return res;
    },
    json(body: unknown) {
      state.body = body;
      state.headers['content-type'] = 'application/json';
      return res;
    },
    send(body: unknown) {
      state.body = body;
      return res;
    },
    end(body?: unknown) {
      if (body !== undefined) state.body = body;
      return res;
    },
    setHeader(name: string, value: string) {
      state.headers[name.toLowerCase()] = value;
      return res;
    },
    cookie(name: string, value: string) {
      if (name === config.authCookieName) setSession(value);
      return res;
    },
    clearCookie(name: string) {
      if (name === config.authCookieName) setSession(null);
      return res;
    },
  };
  return { res, state };
}

async function runMiddleware(mw: (req: Request, res: Response, next: (err?: unknown) => void) => unknown, req: Request, res: Response) {
  await new Promise<void>((resolve, reject) => {
    try {
      Promise.resolve(mw(req, res, (err?: unknown) => (err ? reject(err) : resolve()))).catch(reject);
    } catch (err) {
      reject(err);
    }
  });
}

export async function handle(request: LocalRequest): Promise<LocalResponse> {
  const { container, routes } = await boot();
  const method = request.method.toLowerCase();
  let match: { route: CompiledRoute; params: Record<string, string> } | null = null;
  for (const route of routes) {
    if (route.method !== method) continue;
    const m = route.regex.exec(request.path);
    if (m) {
      match = { route, params: Object.fromEntries(route.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])) };
      break;
    }
  }
  if (!match) {
    return { status: 404, headers: {}, body: { error: { code: 'NOT_FOUND', message: `Route ${request.method} ${request.path} not found` } } };
  }

  const token = session();
  const req = {
    method: request.method.toUpperCase(),
    path: request.path,
    originalUrl: request.path,
    params: match.params,
    query: request.query,
    body: request.body ?? {},
    headers: {},
    cookies: token ? { [config.authCookieName]: token } : {},
    file: request.file
      ? { ...request.file, filename: `${Date.now()}-${request.file.originalname}`.replace(/[^\w.-]/g, '_') }
      : undefined,
  } as unknown as Request;
  const { res, state } = createResponse();

  try {
    const route = match.route;
    if (!route.public) await runMiddleware(authenticate(container) as never, req, res as unknown as Response);
    if (route.roles) await runMiddleware(authorize(...route.roles) as never, req, res as unknown as Response);
    if (route.upload === 'attachment') {
      const f = request.file;
      if (!f) throw Object.assign(new Error('No file uploaded'), { name: 'MulterError' });
      if (f.size > 1024 * 1024) throw Object.assign(new Error('Attachments are limited to 1 MB in the browser demo'), { name: 'MulterError' });
    }
    await route.handler(req, res as unknown as Response);
    if (route.upload === 'attachment' && request.file && state.body && typeof state.body === 'object') {
      // No file server on GitHub Pages: keep the document inline as a data URL.
      const dataUrl = await toDataUrl(request.file.buffer, request.file.mimetype);
      const body = state.body as { attachmentName: string; attachmentUrl: string };
      saveAttachment(body.attachmentUrl, dataUrl);
      state.body = { ...body, attachmentUrl: dataUrl };
    }
    return state;
  } catch (err) {
    const mapped = toErrorResponse(err);
    if (mapped) return { status: mapped.status, headers: {}, body: mapped.body };
    console.error('[LeaveFlow browser API]', err);
    return { status: 500, headers: {}, body: { error: { code: 'INTERNAL_ERROR', message: (err as Error)?.message ?? 'Something went wrong' } } };
  }
}

/** Wipes the browser workbook and recreates the demo data. */
export async function resetDemoData(): Promise<void> {
  const { store } = await boot();
  store.reset(() => buildSeed(new Date()));
  setSession(null);
}
