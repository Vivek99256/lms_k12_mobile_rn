import { ApiError } from './errors';
import { Envelope, normalizeEnvelope } from './envelope';
import { resolveUrl } from './url';

export type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface SessionContext {
  token: string | null;
  subInstituteId?: number | string | null;
  syear?: string | null;
  /** Signed-in user (tbluser.id for staff, tblstudent.id for students). Needed for the legacy identity block. */
  userId?: number | string | null;
  userProfileId?: number | string | null;
  userProfileName?: string | null;
  isStudent?: boolean;
}

/** Values a screen may add to a legacy request. Arrays/objects must be flattened by the caller. */
export type LegacyFields = Record<string, string | number | boolean | null | undefined>;

export interface RequestOptions {
  query?: Record<string, string | number | undefined | null>;
  body?: Record<string, unknown>;
  /** Do not trigger the global sign-out on 401 (used by login: 401 = wrong password). */
  skipAuthHandling?: boolean;
  /** Add the ERP's type=API&sub_institute_id=&syear= convention. Default true. */
  withSession?: boolean;
  /** GET only: send the token in the Authorization header alone, not repeated as `?token=` in the URL (api.session endpoints read the header). Default true: the URL never carries the token. Pass `bearerOnly: false` only for an endpoint that insists on `?token=`. */
  bearerOnly?: boolean;
  /**
   * Call an ERP legacy endpoint (bare path such as `studentAttendanceAPI`): sends the identity block
   * (`legacyFields`) form-encoded, with the bearer header. `query` and `body` entries are merged in as
   * extra fields, subject to the override rules in `legacyFields`.
   */
  legacy?: boolean;
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

/** The tenant and the caller's role can never be chosen by a screen. */
const PINNED = new Set(['token', 'sub_institute_id', 'type', 'user_profile_id', 'user_profile_name']);
/** Ids that name "who is acting / who is being looked at". Fixed to the user's own id for students. */
const ACTING_IDS = ['user_id', 'teacher_id', 'admin_id', 'student_id'] as const;

/**
 * The fields the ERP's legacy endpoints read (names as in the Flutter app's LegacyApi and the
 * controllers). Everything comes from the session; `extra` may add endpoint fields and `syear`, but:
 *  - token, sub_institute_id, type, user_profile_id, user_profile_name are never overridable;
 *  - user_id / teacher_id / admin_id / student_id are overridable only for a staff session
 *    (`isStudent === false`); a student, or an unknown role, always sends their own id.
 */
export function legacyFields(session: SessionContext, extra: LegacyFields = {}): Record<string, string> {
  const fields: Record<string, string> = {};
  if (session.token) fields.token = session.token;
  if (session.subInstituteId != null) fields.sub_institute_id = String(session.subInstituteId);
  if (session.syear) fields.syear = session.syear;
  if (session.userId != null) for (const k of ACTING_IDS) fields[k] = String(session.userId);
  if (session.userProfileId != null) fields.user_profile_id = String(session.userProfileId);
  if (session.userProfileName) fields.user_profile_name = session.userProfileName;
  fields.type = 'API';

  const staff = session.isStudent === false;
  for (const [k, v] of Object.entries(extra)) {
    if (v == null || PINNED.has(k)) continue;
    if (!staff && (ACTING_IDS as readonly string[]).includes(k)) continue;
    fields[k] = String(v);
  }
  return fields;
}

function buildUrl(path: string, query: Record<string, string>): string {
  const url = resolveUrl(path);
  const qs = new URLSearchParams(query).toString();
  if (!qs) return url;
  return url + (url.includes('?') ? '&' : '?') + qs;
}

/**
 * Reads the body as text and parses it, whatever the Content-Type: the legacy PHP endpoints answer
 * JSON with `text/html`. Returns undefined when the body is not JSON.
 */
async function readJson(res: Response): Promise<unknown> {
  let raw: unknown;
  try {
    raw = await res.text();
  } catch {
    return undefined;
  }
  if (typeof raw !== 'string') return undefined;
  const text = raw.replace(/^﻿/, '').trim();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export async function request<T = unknown>(
  method: Method,
  path: string,
  opts: RequestOptions = {},
): Promise<Envelope<T>> {
  const session = hooks.getSession();
  const headers: Record<string, string> = { Accept: 'application/json' };
  const query: Record<string, string> = {};
  let body: string | undefined;

  if (opts.legacy) {
    const extra: LegacyFields = {};
    for (const [k, v] of Object.entries({ ...(opts.query ?? {}), ...(opts.body ?? {}) })) {
      if (v == null) continue;
      if (typeof v === 'object') throw new ApiError('config', `Legacy field "${k}" must be a string, number or boolean.`);
      extra[k] = v as string | number | boolean;
    }
    const fields = legacyFields(session, extra);
    if (method === 'GET') Object.assign(query, fields);
    else {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      body = new URLSearchParams(fields).toString();
    }
    // Some legacy controllers read the payload from the header only, others from `token`: send both.
    if (session.token) headers.Authorization = `Bearer ${session.token}`;
  } else {
    const common: Record<string, string> = {};
    if (opts.withSession !== false) {
      common.type = 'API';
      if (session.subInstituteId != null) common.sub_institute_id = String(session.subInstituteId);
      if (session.syear) common.syear = session.syear;
    }
    Object.assign(query, common);
    for (const [k, v] of Object.entries(opts.query ?? {})) if (v != null) query[k] = String(v);

    headers['Content-Type'] = 'application/json';
    // Sent as a bearer header AND `token`: the legacy api.session/JwtToken path looks for either.
    if (session.token) {
      headers.Authorization = `Bearer ${session.token}`;
      // The header is enough (the server now reads it everywhere); a token in the URL ends up in access logs.
      if (method === 'GET' && opts.bearerOnly === false) query.token = session.token;
    }
    body =
      method === 'GET'
        ? undefined
        : JSON.stringify({ ...common, ...(session.token ? { token: session.token } : {}), ...opts.body });
  }

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

  let json = await readJson(res);
  if (json === undefined) {
    // 401/403 may have an empty body; 419 (CSRF host rule) answers with an HTML page.
    if (res.status === 401 || res.status === 403 || res.status === 419) json = {};
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
