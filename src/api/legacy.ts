import { api, LegacyFields, RequestOptions } from './client';
import { Envelope } from './envelope';

type Opts = Omit<RequestOptions, 'legacy' | 'query' | 'body'>;

/**
 * Calls for the ERP's legacy endpoints (bare paths like `studentAttendanceAPI`).
 * Identity, tenant, token and encoding are handled by the client (`legacyFields`); a screen passes only
 * the endpoint's own fields, as strings/numbers/booleans.
 */
export const legacy = {
  get: <T = unknown>(path: string, fields?: LegacyFields, o?: Opts): Promise<Envelope<T>> =>
    api.get<T>(path, { ...o, legacy: true, query: fields as RequestOptions['query'] }),
  post: <T = unknown>(path: string, fields?: LegacyFields, o?: Opts): Promise<Envelope<T>> =>
    api.post<T>(path, { ...o, legacy: true, body: fields }),
};
