import axios, { AxiosError, type AxiosRequestConfig } from 'axios';
import type { ApiErrorBody } from '@leaveflow/shared';

/**
 * The single HTTP client. Authentication uses an httpOnly cookie set by the API,
 * so no token is ever stored in JS-accessible storage.
 */
export const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  withCredentials: true,
  timeout: 30_000,
});

/**
 * Static demo build (GitHub Pages): no server is available, so requests are
 * answered by the same API code running in the browser (services/local).
 */
export const isBrowserDemo = import.meta.env.VITE_DATA_MODE === 'browser';
if (isBrowserDemo) {
  http.defaults.adapter = async (config) => (await import('../local/axiosAdapter')).browserAdapter(config);
}

export interface ApiError {
  status: number;
  code: string;
  message: string;
  details?: unknown;
}

let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

export function toApiError(err: unknown): ApiError {
  if (axios.isAxiosError(err)) {
    const e = err as AxiosError<ApiErrorBody>;
    const body = e.response?.data;
    if (body && typeof body === 'object' && 'error' in body) {
      return { status: e.response!.status, code: body.error.code, message: body.error.message, details: body.error.details };
    }
    if (e.code === 'ECONNABORTED') return { status: 0, code: 'TIMEOUT', message: 'The server took too long to respond' };
    if (!e.response) return { status: 0, code: 'NETWORK', message: 'Cannot reach the LeaveFlow server. Is the API running?' };
    return { status: e.response.status, code: 'HTTP_ERROR', message: e.message };
  }
  return { status: 0, code: 'UNKNOWN', message: (err as Error)?.message ?? 'Unexpected error' };
}

http.interceptors.response.use(
  (r) => r,
  (err) => {
    const apiError = toApiError(err);
    const url = (err as AxiosError).config?.url ?? '';
    if (apiError.status === 401 && !url.includes('/auth/')) onUnauthorized?.();
    return Promise.reject(apiError);
  },
);

export async function request<T>(config: AxiosRequestConfig): Promise<T> {
  const res = await http.request<T>(config);
  return res.data;
}

/** Downloads a server-generated file (Excel exports) using the authenticated session. */
export async function downloadFile(url: string, params?: Record<string, unknown>, fallbackName = 'export.xlsx'): Promise<void> {
  const res = await http.get<Blob>(url, { params, responseType: 'blob' });
  const disposition = String(res.headers['content-disposition'] ?? '');
  const match = /filename="?([^"]+)"?/.exec(disposition);
  const href = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = href;
  a.download = match?.[1] ?? fallbackName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}
