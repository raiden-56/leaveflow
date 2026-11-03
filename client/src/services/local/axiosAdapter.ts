import { AxiosError, AxiosHeaders, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { handle, type LocalRequest } from './localServer';

function toQuery(params: unknown, url: string): Record<string, string> {
  const out: Record<string, string> = {};
  const qIndex = url.indexOf('?');
  if (qIndex >= 0) new URLSearchParams(url.slice(qIndex + 1)).forEach((v, k) => (out[k] = v));
  if (params && typeof params === 'object') {
    for (const [k, v] of Object.entries(params as Record<string, unknown>)) {
      if (v !== undefined && v !== null) out[k] = String(v);
    }
  }
  return out;
}

async function toRequest(config: InternalAxiosRequestConfig): Promise<LocalRequest> {
  const url = config.url ?? '';
  const path = url.split('?')[0].replace(/^\/api/, '') || '/';
  let body: unknown = config.data;
  let file: LocalRequest['file'];
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    const f = config.data.get('file');
    if (f instanceof File) file = { originalname: f.name, buffer: await f.arrayBuffer(), size: f.size, mimetype: f.type };
    body = {};
  } else if (typeof config.data === 'string' && config.data) {
    try {
      body = JSON.parse(config.data);
    } catch {
      body = config.data;
    }
  }
  return { method: config.method ?? 'get', path, query: toQuery(config.params, url), body, file };
}

/** Axios adapter that answers requests from the in-browser API (static build). */
export async function browserAdapter(config: InternalAxiosRequestConfig): Promise<AxiosResponse> {
  const local = await handle(await toRequest(config));
  let data: unknown = local.body;
  if (config.responseType === 'blob' && data instanceof Uint8Array) {
    data = new Blob([data as BlobPart], { type: local.headers['content-type'] ?? 'application/octet-stream' });
  }
  const response: AxiosResponse = {
    data,
    status: local.status,
    statusText: String(local.status),
    headers: new AxiosHeaders(local.headers),
    config,
    request: {},
  };
  if (local.status >= 400) {
    throw new AxiosError(`Request failed with status code ${local.status}`, local.status >= 500 ? 'ERR_BAD_RESPONSE' : 'ERR_BAD_REQUEST', config, {}, response);
  }
  return response;
}
