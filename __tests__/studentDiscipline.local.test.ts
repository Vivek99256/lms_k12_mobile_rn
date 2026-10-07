/**
 * Opt-in integration test for S9c (Student Discipline) against a LOCAL Laravel server (not part of a normal `npm test` run).
 *
 *   php artisan serve --host=127.0.0.1 --port=8000        (in D:/next_lms_erp)
 *   LOCAL_API_BASE_URL=http://127.0.0.1:8000
 *   LOCAL_DASHBOARD_TOKEN=<jwt for a NON-EXISTENT student id on a real tenant>
 *   LOCAL_DASHBOARD_STUDENT_ID=999999999  LOCAL_DASHBOARD_TENANT=1
 *   npx jest studentDiscipline.local
 *
 * Q16 (strict): the endpoint filters by the caller's own student id, so a non-existent student can only get an empty list.
 * The test asserts the COUNT only and never prints or inspects a body; if the list were ever non-empty it fails on the count
 * and nothing is shown. No staff, entry or write route is contacted.
 */
import { installNodeFetch } from './helpers/nodeFetch';

const base = process.env.LOCAL_API_BASE_URL ?? '';
const token = process.env.LOCAL_DASHBOARD_TOKEN ?? '';
const enabled = !!base && !!token;
const loopback = /^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base);

if (enabled && !loopback) {
  throw new Error(`LOCAL_API_BASE_URL must be a loopback address (got ${base}). Refusing to run.`);
}

jest.setTimeout(30_000); // the database behind the local server is remote

type Student = typeof import('../src/api/student');
type Client = typeof import('../src/api/client');

(enabled ? describe : describe.skip)('S9c discipline against the local server (synthetic id, counts only)', () => {
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

  it('a non-existent student has no discipline notes (only the count is asserted)', async () => {
    synthetic();
    fetchSpy.mockClear();
    const rows = await student.fetchDiscipline();
    expect(rows.length).toBe(0);
  });

  it('a bad token is an unauthorized error', async () => {
    synthetic({ token: 'bad.token.value' });
    await expect(student.fetchDiscipline()).rejects.toMatchObject({ kind: 'unauthorized' });
  });

  it('only POST studentDisciplineAPI is requested, with the Bearer token, type=API and the session student - no staff, entry or write route', async () => {
    synthetic();
    fetchSpy.mockClear();
    await student.fetchDiscipline();
    const calls = fetchSpy.mock.calls;
    expect(calls.length).toBe(1);
    const url = String(calls[0][0]);
    const init = calls[0][1] as { method: string; headers: Record<string, string>; body: string };
    expect(url).toContain('/studentDisciplineAPI');
    for (const bad of ['student-care', 'add_teacherStudentDiscipline', 'dicipline/', 'front_desk', 'add_', 'update', 'delete']) expect(url).not.toContain(bad);
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toMatch(/^Bearer /);
    const form = new URLSearchParams(init.body);
    expect(form.get('type')).toBe('API');
    expect(form.get('student_id')).toBe(process.env.LOCAL_DASHBOARD_STUDENT_ID ?? '999999999');
  });
});
