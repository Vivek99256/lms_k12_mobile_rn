/**
 * Opt-in integration test for S8a (my discussions) against a LOCAL Laravel server (not part of a normal `npm test` run).
 *
 *   php artisan serve --host=127.0.0.1 --port=8000        (in D:/next_lms_erp)
 *   LOCAL_API_BASE_URL=http://127.0.0.1:8000
 *   LOCAL_DASHBOARD_TOKEN=<jwt for a NON-EXISTENT student id on a real tenant>
 *   LOCAL_DASHBOARD_STUDENT_ID=999999999  LOCAL_DASHBOARD_TENANT=1
 *   LOCAL_UNKNOWN_TENANT_TOKEN=<jwt for student 999999999 on tenant 999999999>
 *   npx jest studentDiscussions.local
 *
 * Q16 (strict): no real row may be retrieved, even a public one. Therefore:
 *  - the list is requested only with mine=1, which the server scopes to the (non-existent) caller; the test asserts every
 *    request carries mine=1 and asserts only COUNTS (never prints or inspects a body);
 *  - the detail is requested only for a non-existent id;
 *  - the tenant / public feed is never requested, and no write, Learn-content or legacy LMS endpoint is contacted.
 * If a result were ever non-empty the test fails on a count and nothing is printed.
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

type Student = typeof import('../src/api/student');
type Client = typeof import('../src/api/client');

const FORBIDDEN = ['studentContentAPI', 'studentSubjectAPI', 'studentSocialCollabrativeAPI', 'studentVirtualClassroomAPI', 'studentPortfolioAPI', 'studentLeaderBoardAPI', 'studentQuestionPaper', 'studentAssessment', '/comments', 'lms-chapter', 'lms-courses', 'leaderboard'];

(enabled ? describe : describe.skip)('S8a discussions against the local server (synthetic ids, mine=1 only)', () => {
  let student: Student;
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
      student = require('../src/api/student');
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

  it('mine=1 for a non-existent student: no discussions (only the count is asserted)', async () => {
    synthetic();
    fetchSpy.mockClear();
    const rows = await student.fetchMyDiscussions();
    expect(rows.length).toBe(0);
    const urls = fetchSpy.mock.calls.map((c) => new URL(String(c[0])));
    expect(urls.length).toBeGreaterThan(0);
    for (const u of urls) {
      expect(u.pathname).toBe('/api/lms/social-collaborative');
      expect(u.searchParams.get('mine')).toBe('1');
      expect(u.searchParams.has('token')).toBe(false);
    }
  });

  it('a non-existent discussion id is a 404 "This discussion is not available."', async () => {
    synthetic();
    await expect(student.fetchDiscussion('999999999')).rejects.toMatchObject({ kind: 'server', status: 404, message: 'This discussion is not available.' });
  });

  it('a tenant with no current academic year is a 422 "Academic Term Date Expired"', async () => {
    synthetic({ token: unknownTenantToken, subInstituteId: 999999999 });
    await expect(student.fetchMyDiscussions()).rejects.toMatchObject({ kind: 'validation', status: 422, message: 'Academic Term Date Expired' });
  });

  it('a bad token is unauthorized', async () => {
    synthetic({ token: 'bad.token.value' });
    await expect(student.fetchMyDiscussions()).rejects.toMatchObject({ kind: 'unauthorized' });
    await expect(student.fetchDiscussion('1')).rejects.toMatchObject({ kind: 'unauthorized' });
  });

  it('only GET requests to the two social-collaborative paths are made - never the public feed, a write, or any Learn / legacy LMS endpoint', async () => {
    synthetic();
    fetchSpy.mockClear();
    await student.fetchMyDiscussions();
    await student.fetchDiscussion('999999999').catch(() => undefined);
    const calls = fetchSpy.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    for (const c of calls) {
      const u = String(c[0]);
      expect((c[1] as { method: string }).method).toBe('GET');
      expect(u).toContain('/api/lms/social-collaborative');
      for (const bad of FORBIDDEN) expect(u).not.toContain(bad);
    }
    // the only request without mine=1 is the detail of a non-existent id
    const withoutMine = calls.filter((c) => new URL(String(c[0])).searchParams.get('mine') !== '1').map((c) => new URL(String(c[0])).pathname);
    expect(withoutMine).toEqual(['/api/lms/social-collaborative/999999999']);
  });
});
