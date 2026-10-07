import { ApiError } from './errors';

/**
 * The Laravel backend has several response envelopes:
 *   legacy mobile   {status:'0'|'1'|'2', message, data}   ('2' = token failure, HTTP 200)
 *   ApiLogin        {status:0|1, message, ...}
 *   rights/lms      {status_code:0|1|2, message, errors, data}
 *   guards          {success:false, message, data:null, errors:null}
 * This collapses them into one result, or throws a typed ApiError.
 */
export interface Envelope<T = unknown> {
  message: string;
  data: T;
  /** The whole decoded body, for endpoints that put payload beside `data`. */
  raw: Record<string, unknown>;
}

const str = (v: unknown, fallback: string) => (typeof v === 'string' && v.trim() ? v : fallback);

function fieldErrors(errors: unknown): Record<string, string[]> | undefined {
  if (!errors || typeof errors !== 'object' || Array.isArray(errors)) return undefined;
  const out: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(errors as Record<string, unknown>)) {
    out[k] = Array.isArray(v) ? v.map(String) : [String(v)];
  }
  return out;
}

export function normalizeEnvelope<T = unknown>(body: unknown, httpStatus: number): Envelope<T> {
  const raw: Record<string, unknown> =
    body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : { data: body };
  const message = str(raw.message, '');

  if (httpStatus === 401) throw new ApiError('unauthorized', message || 'Your session has expired. Please sign in again.', 401);
  if (httpStatus === 403) throw new ApiError('forbidden', message || 'You do not have access to this.', 403);
  // Laravel's CSRF check on a host that is not on the ERP's exempt list: a server-address problem, not a session one.
  if (httpStatus === 419) throw new ApiError('server', "The server rejected the request. Check the app's server address.", 419);
  if (httpStatus === 422) throw new ApiError('validation', message || 'Please check the entered details.', 422, fieldErrors(raw.errors));
  if (httpStatus >= 500) throw new ApiError('server', 'The server had a problem. Please try again shortly.', httpStatus);
  if (httpStatus >= 400) throw new ApiError('server', message || `Request failed (${httpStatus}).`, httpStatus);

  const legacy = raw.status != null ? String(raw.status) : undefined;
  const code = raw.status_code != null ? String(raw.status_code) : undefined;

  // '2' means "token failure" in both the legacy and the status_code envelopes.
  if (legacy === '2' || code === '2') {
    throw new ApiError('unauthorized', message || 'Your session has expired. Please sign in again.', httpStatus);
  }
  if (legacy === '0' || code === '0' || raw.success === false) {
    // Legacy validators put the message in `message` or `response`; surface a string.
    const detail = typeof raw.message === 'string' ? raw.message : typeof raw.response === 'string' ? raw.response : '';
    throw new ApiError('validation', detail || 'Could not complete that request.', httpStatus, fieldErrors(raw.errors));
  }

  // Legacy controllers answer a failed validation with HTTP 200 and only `{response:{field:[msg]}}`.
  // (A body that also carries a status key is left alone: e.g. status '1' + response is a success.)
  if (legacy === undefined && code === undefined && raw.success === undefined && raw.data === undefined) {
    const errs = fieldErrors(raw.response);
    if (errs) {
      const first = Object.values(errs).flat()[0];
      throw new ApiError('validation', message || first || 'Please check the entered details.', httpStatus, errs);
    }
  }

  return { message, data: (raw.data ?? raw) as T, raw };
}
