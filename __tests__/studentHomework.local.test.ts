/**
 * Opt-in integration test for S4a against a LOCAL Laravel server (not part of a normal `npm test` run).
 *
 *   php artisan serve --host=127.0.0.1 --port=8000        (in D:/next_lms_erp)
 *   LOCAL_API_BASE_URL=http://127.0.0.1:8000
 *   LOCAL_DASHBOARD_TOKEN=<jwt for a NON-EXISTENT student id on a real tenant>   (api.session rejects id/tenant 0)
 *   LOCAL_DASHBOARD_STUDENT_ID=999999999  LOCAL_DASHBOARD_TENANT=1
 *   optional: LOCAL_UNKNOWN_TENANT_TOKEN=<jwt for student 999999999 on tenant 999999999>
 *   npx jest studentHomework.local
 *
 * Read-only, loopback only, synthetic ids only: no real student data is ever requested (Q16).
 */
import { installNodeFetch } from './helpers/nodeFetch';

const base = process.env.LOCAL_API_BASE_URL ?? '';
const token = process.env.LOCAL_DASHBOARD_TOKEN ?? '';
const unknownTenantToken = process.env.LOCAL_UNKNOWN_TENANT_TOKEN ?? '';
const enabled = !!base && !!token;
const loopback = /^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base);

if (enabled && !loopback) {
  throw new Error(`LOCAL_API_BASE_URL must be a loopback address (got ${base}). Refusing to run.`);
}

jest.setTimeout(30_000); // the database behind the local server is remote

type Student = typeof import('../src/api/student');
type Client = typeof import('../src/api/client');

(enabled ? describe : describe.skip)('S4a endpoints against the local server (synthetic ids, read-only)', () => {
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

  it('list: success with an empty list for a non-existent student (token-bound my-submissions)', async () => {
    synthetic();
    expect(await student.fetchHomeworkList()).toEqual([]);
  });

  it('detail: a homework that does not exist is a 404 "Homework not found"', async () => {
    synthetic();
    await expect(student.fetchHomeworkDetail('1')).rejects.toMatchObject({ kind: 'server', status: 404, message: 'Homework not found' });
    await expect(student.fetchHomeworkDetail('999999999')).rejects.toMatchObject({ kind: 'server', status: 404 });
  });

  it('a bad token is an unauthorized error on both', async () => {
    synthetic({ token: 'bad.token.value' });
    await expect(student.fetchHomeworkList()).rejects.toMatchObject({ kind: 'unauthorized' });
    await expect(student.fetchHomeworkDetail('1')).rejects.toMatchObject({ kind: 'unauthorized' });
  });

  it('detail: an id that is not plain digits is refused by the app before any request is made', async () => {
    synthetic();
    fetchSpy.mockClear();
    await expect(student.fetchHomeworkDetail('abc')).rejects.toMatchObject({ kind: 'validation' });
    await expect(student.fetchHomeworkDetail('1/2')).rejects.toMatchObject({ kind: 'validation' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  (unknownTenantToken ? it : it.skip)('a tenant without a current academic year gets the server message as a validation error', async () => {
    synthetic({ token: unknownTenantToken, subInstituteId: 999999999 });
    await expect(student.fetchHomeworkList()).rejects.toMatchObject({ kind: 'validation', message: 'Academic Term Date Expired' });
  });

  it('the legacy studentHomeworkAssignmentAPI is never requested by these calls', async () => {
    synthetic();
    fetchSpy.mockClear();
    await student.fetchHomeworkList();
    const urls = fetchSpy.mock.calls.map((c) => String(c[0]));
    expect(urls.length).toBe(1);
    expect(urls[0]).toContain('/api/lms-homework/my-submissions');
    expect(urls.some((u) => u.includes('studentHomeworkAssignmentAPI'))).toBe(false);
  });
});
