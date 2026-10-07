/**
 * Opt-in integration test for S13 (own profile) against a LOCAL Laravel server (not part of a normal `npm test` run).
 *
 *   php artisan serve --host=127.0.0.1 --port=8000        (in D:/next_lms_erp)
 *   LOCAL_API_BASE_URL=http://127.0.0.1:8000
 *   LOCAL_DASHBOARD_TOKEN=<jwt for a NON-EXISTENT user id on a real tenant>
 *   LOCAL_DASHBOARD_STUDENT_ID=999999999  LOCAL_DASHBOARD_TENANT=1
 *   LOCAL_UNKNOWN_TENANT_TOKEN=<jwt for user 999999999 on tenant 999999999>
 *   npx jest ownProfile.local
 *
 * Q16 (strict): the endpoint can only look up the TOKEN's own id, which does not exist, so the only possible outcome is
 * 404 "Profile not found.". The test asserts statuses and URL shape only and never prints or inspects a response body.
 */
import { installNodeFetch } from './helpers/nodeFetch';

const base = process.env.LOCAL_API_BASE_URL ?? '';
const token = process.env.LOCAL_DASHBOARD_TOKEN ?? '';
const unknownTenantToken = process.env.LOCAL_UNKNOWN_TENANT_TOKEN ?? '';
const enabled = !!base && !!token && !!unknownTenantToken;
const loopback = /^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base);

if (enabled && !loopback) {
  throw new Error(`LOCAL_API_BASE_URL must be a loopback address (got ${base}). Refusing to run.`);
}

jest.setTimeout(60_000); // the database behind the local server is remote

type Profile = typeof import('../src/api/profile');
type Client = typeof import('../src/api/client');

(enabled ? describe : describe.skip)('S13 own-profile against the local server (non-existent user, statuses only)', () => {
  let profile: Profile;
  let client: Client;
  let session: import('../src/api/client').SessionContext;
  let fetchSpy: jest.SpyInstance;

  beforeAll(() => {
    installNodeFetch();
    fetchSpy = jest.spyOn(globalThis as unknown as { fetch: () => unknown }, 'fetch');
    process.env.EXPO_PUBLIC_API_BASE_URL = base;
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      client = require('../src/api/client');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      profile = require('../src/api/profile');
    });
    client.configureApi({ getSession: () => session, onUnauthorized: () => {} });
  });

  const synthetic = (over: Partial<import('../src/api/client').SessionContext> = {}) => {
    session = {
      token,
      subInstituteId: process.env.LOCAL_DASHBOARD_TENANT ?? '1',
      syear: '2026',
      userId: process.env.LOCAL_DASHBOARD_STUDENT_ID ?? '999999999',
      userProfileId: 1,
      userProfileName: 'Student',
      isStudent: true,
      ...over,
    };
  };

  it('a non-existent user has no profile: 404 "Profile not found."', async () => {
    synthetic();
    await expect(profile.fetchOwnProfile()).rejects.toMatchObject({ kind: 'server', status: 404 });
  });

  it('a tenant with no current academic year is a 422 "Academic Term Date Expired"', async () => {
    synthetic({ token: unknownTenantToken, subInstituteId: 999999999 });
    await expect(profile.fetchOwnProfile()).rejects.toMatchObject({ kind: 'validation', status: 422, message: 'Academic Term Date Expired' });
  });

  it('a bad token is unauthorized', async () => {
    synthetic({ token: 'bad.token.value' });
    await expect(profile.fetchOwnProfile()).rejects.toMatchObject({ kind: 'unauthorized' });
  });

  it('every request is a bare GET to /api/own-profile: the JWT only in the Authorization header, no query string, no id, no body', async () => {
    synthetic();
    fetchSpy.mockClear();
    await profile.fetchOwnProfile().catch(() => undefined);
    const calls = fetchSpy.mock.calls;
    expect(calls.length).toBe(1);
    const u = new URL(String(calls[0][0]));
    const init = calls[0][1] as { method: string; headers: Record<string, string>; body?: string };
    expect(u.pathname).toBe('/api/own-profile');
    expect(u.search).toBe('');
    expect(String(calls[0][0])).not.toContain(token);
    expect(init.method).toBe('GET');
    expect(init.body).toBeUndefined();
    expect(init.headers.Authorization).toBe(`Bearer ${token}`);
  });
});
