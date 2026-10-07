import { env } from '../config/env';
import { ApiError } from './errors';
import { Envelope, normalizeEnvelope } from './envelope';

export type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface SessionContext {
  token: string | null;
  subInstituteId?: number | string | null;
  syear?: string | null;
}

export interface RequestOptions {
  query?: Record<string, string | number | undefined | null>;
  body?: Record<string, unknown>;
  /** Do not trigger the global sign-out on 401 (used by login: 401 = wrong password). */
  skipAuthHandling?: boolean;
  /** Add the ERP's type=API&sub_institute_id=&syear= convention. Default true. */
  withSession?: boolean;
  timeoutMs?: number;
}

const TIMEOUT_MS = 30_000;

type Hooks = {
  getSession: () => SessionContext;
  onUnauthorized: () => void;
  /** 403: the user's rights may have changed server-side, so the menu should be re-read. */
  onForbidden?: () => void;
};

let hooks: Hooks = { getSession: () => ({ token: null }), onUnauthorized: () => {} };

/** Wired once from the auth store, so the API layer has no import cycle with it. */
export function configureApi(h: Hooks) {
  hooks = h;
}

function buildUrl(path: string, query: Record<string, string>): string {
  const abs = /^https?:\/\//i.test(path);
  if (!abs && !env.apiBaseUrl) throw new ApiError('config', 'The app is missing EXPO_PUBLIC_API_BASE_URL.');
  const url = abs ? path : `${env.apiBaseUrl}/${path.replace(/^\/+/, '')}`;
  const qs = new URLSearchParams(query).toString();
  if (!qs) return url;
  return url + (url.includes('?') ? '&' : '?') + qs;
}

export async function request<T = unknown>(
  method: Method,
  path: string,
  opts: RequestOptions = {},
): Promise<Envelope<T>> {
  const session = hooks.getSession();
  const common: Record<string, string> = {};
  if (opts.withSession !== false) {
    common.type = 'API';
    if (session.subInstituteId != null) common.sub_institute_id = String(session.subInstituteId);
    if (session.syear) common.syear = session.syear;
  }
  const query: Record<string, string> = { ...common };
  for (const [k, v] of Object.entries(opts.query ?? {})) if (v != null) query[k] = String(v);

  const headers: Record<string, string> = { Accept: 'application/json', 'Content-Type': 'application/json' };
  // Sent as a bearer header AND `token`: the legacy api.session/JwtToken path looks for either.
  if (session.token) {
    headers.Authorization = `Bearer ${session.token}`;
    if (method === 'GET') query.token = session.token;
  }
  const body =
    method === 'GET'
      ? undefined
      : JSON.stringify({ ...common, ...(session.token ? { token: session.token } : {}), ...opts.body });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(buildUrl(path, query), { method, headers, body, signal: controller.signal });
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if ((e as Error)?.name === 'AbortError') throw new ApiError('timeout', 'The server took too long to respond. Try again.');
    throw new ApiError('network', 'We could not reach the server. Check your connection and try again.');
  } finally {
    clearTimeout(timer);
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    if (res.status === 401 || res.status === 403) json = {};
    else throw new ApiError('server', 'The server returned an unexpected response.', res.status);
  }

  try {
    return normalizeEnvelope<T>(json, res.status);
  } catch (e) {
    if (e instanceof ApiError && e.kind === 'unauthorized' && !opts.skipAuthHandling) hooks.onUnauthorized();
    if (e instanceof ApiError && e.kind === 'forbidden') hooks.onForbidden?.();
    throw e;
  }
}

export const api = {
  get: <T = unknown>(path: string, o?: RequestOptions) => request<T>('GET', path, o),
  post: <T = unknown>(path: string, o?: RequestOptions) => request<T>('POST', path, o),
  put: <T = unknown>(path: string, o?: RequestOptions) => request<T>('PUT', path, o),
  patch: <T = unknown>(path: string, o?: RequestOptions) => request<T>('PATCH', path, o),
  delete: <T = unknown>(path: string, o?: RequestOptions) => request<T>('DELETE', path, o),
};

/**
 * The ERP's summary routes are mostly POST, a few GET (the web proxy hides which).
 * Try POST first and fall back on 404/405, as the Flutter app does.
 */
export async function callAuto<T = unknown>(
  endpoint: string,
  extra: Record<string, unknown> = {},
): Promise<Envelope<T>> {
  const path = /^https?:\/\//i.test(endpoint) ? endpoint : `api/${endpoint.replace(/^\/+/, '')}`;
  try {
    return await request<T>('POST', path, { body: extra });
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 405)) {
      return request<T>('GET', path, { query: extra as Record<string, string> });
    }
    throw e;
  }
}
