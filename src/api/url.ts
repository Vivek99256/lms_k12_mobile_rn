import { env } from '../config/env';
import { ApiError } from './errors';

/** Used when EXPO_PUBLIC_ERP_HOSTS is not set. */
export const DEFAULT_ERP_HOSTS = ['erp.triz.co.in', 'dev.triz.co.in'];

// scheme://authority + the rest (path, query, fragment). Parsed by hand: React Native's URL is incomplete.
const ABSOLUTE = /^(https?):\/\/([^/?#]*)([^]*)$/i;

function parseAbsolute(url: string): { authority: string; rest: string } | null {
  const m = ABSOLUTE.exec(url);
  if (!m) return null;
  const authority = m[2].toLowerCase();
  // user:pass@host tricks (https://erp.triz.co.in@evil.com) are never accepted.
  if (!authority || authority.includes('@')) return null;
  return { authority, rest: m[3] };
}

function erpHosts(): string[] {
  const configured = env.erpHosts ?? [];
  return configured.length ? configured : DEFAULT_ERP_HOSTS;
}

function blocked(): ApiError {
  return new ApiError('config', 'Blocked a request to an unknown server.');
}

/**
 * Turns an endpoint into the URL that is actually requested.
 *  - relative path               -> API base + path
 *  - absolute, host = API base   -> API base + its path/query
 *  - absolute, host in ERP list  -> API base + its path/query (so a dev build never calls production)
 *  - any other absolute URL      -> rejected: the bearer token must never reach an unknown server
 * Endpoint URLs come from database rows (menu tiles), so they are not trusted.
 */
export function resolveUrl(pathOrUrl: string): string {
  const base = env.apiBaseUrl;
  if (!/^https?:\/\//i.test(pathOrUrl)) {
    if (!base) throw new ApiError('config', 'The app is missing EXPO_PUBLIC_API_BASE_URL.');
    return `${base}/${pathOrUrl.replace(/^\/+/, '')}`;
  }

  if (!base) throw new ApiError('config', 'The app is missing EXPO_PUBLIC_API_BASE_URL.');
  const target = parseAbsolute(pathOrUrl);
  const own = parseAbsolute(base);
  if (!target || !own) throw blocked();

  if (target.authority !== own.authority && !erpHosts().includes(target.authority)) throw blocked();

  const rest = target.rest;
  if (!rest) return base;
  return rest.startsWith('/') ? base + rest : `${base}/${rest}`;
}
