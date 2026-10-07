/**
 * Opt-in integration test for S1 against a LOCAL Laravel server (not part of a normal `npm test` run).
 *
 *   php artisan serve --host=127.0.0.1 --port=8000        (in D:/next_lms_erp)
 *   LOCAL_API_BASE_URL=http://127.0.0.1:8000
 *   LOCAL_API_TOKEN=<jwt for a NON-EXISTENT student, id 0, tenant 0>          legacy endpoints
 *   LOCAL_DASHBOARD_TOKEN=<jwt for a NON-EXISTENT student id on a real tenant> dashboard (api.session rejects id/tenant 0)
 *   LOCAL_DASHBOARD_STUDENT_ID=999999999  LOCAL_DASHBOARD_TENANT=1
 *   npx jest studentHome.local
 *
 * Read-only, loopback only, synthetic ids only: no real student data is ever requested (Q16).
 */
import { installNodeFetch } from './helpers/nodeFetch';

const base = process.env.LOCAL_API_BASE_URL ?? '';
const token = process.env.LOCAL_API_TOKEN ?? '';
const dashToken = process.env.LOCAL_DASHBOARD_TOKEN ?? '';
const enabled = !!base && !!token && !!dashToken;
const loopback = /^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base);

if (enabled && !loopback) {
  throw new Error(`LOCAL_API_BASE_URL must be a loopback address (got ${base}). Refusing to run.`);
}

jest.setTimeout(30_000); // the database behind the local server is remote

type Student = typeof import('../src/api/student');
type Client = typeof import('../src/api/client');

(enabled ? describe : describe.skip)('S1 endpoints against the local server (synthetic ids, read-only)', () => {
  let student: Student;
  let client: Client;
  let session: import('../src/api/client').SessionContext;

  beforeAll(() => {
    installNodeFetch();
    process.env.EXPO_PUBLIC_API_BASE_URL = base;
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      client = require('../src/api/client');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      student = require('../src/api/student');
    });
    client.configureApi({ getSession: () => session, onUnauthorized: () => {} });
  });

  const legacySession = () => {
    session = { token, subInstituteId: 0, syear: '2026', userId: 0, userProfileId: 0, userProfileName: 'Student', isStudent: true };
  };

  it('notification hub: success with an empty list (mobile_no 0 is accepted)', async () => {
    legacySession();
    expect(await student.fetchNotifications()).toEqual([]);
  });

  it('academic calendar and holiday list: success with empty lists', async () => {
    legacySession();
    expect(await student.fetchStudentCalendar()).toEqual([]);
    expect(await student.fetchStudentCalendar('holiday')).toEqual([]);
  });

  it('circulars: a student with no enrollment gives the documented HTTP 500 (form-encoded request reaches the lookup)', async () => {
    legacySession();
    for (const kind of ['Circular', 'Event'] as const) {
      await expect(student.fetchCirculars(kind)).rejects.toMatchObject({ kind: 'server', status: 500 });
    }
  });

  it('dashboard: a non-existent student on a real tenant gets the empty summary', async () => {
    session = {
      token: dashToken,
      subInstituteId: process.env.LOCAL_DASHBOARD_TENANT ?? '1',
      syear: '2026',
      userId: process.env.LOCAL_DASHBOARD_STUDENT_ID ?? '999999999',
      userProfileId: 1,
      userProfileName: 'Student',
      isStudent: true,
    };
    const d = await student.fetchStudentDashboard();
    expect(d.enrollment).toBeNull();
    expect(d.summary).toEqual({ totalSubjects: 0, pendingHomework: 0, pendingAssignments: 0 });
    expect(d.pendingHomework).toEqual([]);
    expect(d.tasks.map((t) => t.label)).toEqual(['Homework done', 'Homework pending', 'Assignments submitted', 'Assignments pending']);
  });

  it('dashboard: a bad token is an unauthorized error', async () => {
    session = { token: 'bad.token.value', subInstituteId: 1, syear: '2026', userId: 999999999, userProfileId: 1, userProfileName: 'Student', isStudent: true };
    await expect(student.fetchStudentDashboard()).rejects.toMatchObject({ kind: 'unauthorized' });
  });
});
