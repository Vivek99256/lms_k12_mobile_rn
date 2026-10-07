/**
 * Opt-in integration test for S7 (subject teachers, leave applications, messages) against a LOCAL Laravel server
 * (not part of a normal `npm test` run).
 *
 *   php artisan serve --host=127.0.0.1 --port=8000        (in D:/next_lms_erp)
 *   LOCAL_API_BASE_URL=http://127.0.0.1:8000
 *   LOCAL_DASHBOARD_TOKEN=<jwt for a NON-EXISTENT student id on a real tenant>
 *   LOCAL_DASHBOARD_STUDENT_ID=999999999  LOCAL_DASHBOARD_TENANT=1
 *   npx jest studentLeaveComm.local
 *
 * Read-only, loopback only, synthetic ids only: no real student, leave or message data is ever requested (Q16).
 * No write endpoint is contacted - the test asserts that.
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

const FORBIDDEN = ['add_leave_application', 'add_communicationAPI', 'teacherLeaveApplication', 'teacherParentcommunication', 'get_admin', 'add_admin', 'front_desk', 'api/leave', 'hrms'];

(enabled ? describe : describe.skip)('S7 read endpoints against the local server (synthetic ids, read-only)', () => {
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

  it('a non-existent student has no leave applications: an empty list', async () => {
    synthetic();
    expect(await student.fetchLeaveApplications()).toEqual([]);
  });

  it('a non-existent student has no messages (status_code envelope): an empty list', async () => {
    synthetic();
    expect(await student.fetchParentMessages()).toEqual([]);
  });

  it('a student with no enrolment has no subject teachers: the server\'s "Wrong Parameters" becomes an empty list', async () => {
    synthetic();
    expect(await student.fetchSubjectTeachers()).toEqual([]);
  });

  it('a bad token is an unauthorized error on each (the app always sends type=API, so the JWT check runs)', async () => {
    synthetic({ token: 'bad.token.value' });
    await expect(student.fetchLeaveApplications()).rejects.toMatchObject({ kind: 'unauthorized' });
    await expect(student.fetchParentMessages()).rejects.toMatchObject({ kind: 'unauthorized' });
    await expect(student.fetchSubjectTeachers()).rejects.toMatchObject({ kind: 'unauthorized' });
  });

  it('only the three read paths are ever requested - no write, staff, admin, front_desk or HR endpoint', async () => {
    synthetic();
    fetchSpy.mockClear();
    await student.fetchLeaveApplications();
    await student.fetchParentMessages();
    await student.fetchSubjectTeachers();
    const urls = fetchSpy.mock.calls.map((c) => String(c[0]));
    expect(urls).toHaveLength(3);
    expect(urls[0]).toContain('/studentLeaveApplicationAPI');
    expect(urls[1]).toContain('/studentParentcommunicationListAPI');
    expect(urls[2]).toContain('/studentTeacherListAPI');
    for (const bad of FORBIDDEN) expect(urls.some((u) => u.includes(bad))).toBe(false);
  });

  it('every request carries type=API and the Bearer token', async () => {
    synthetic();
    fetchSpy.mockClear();
    await student.fetchLeaveApplications();
    const init = fetchSpy.mock.calls[0][1] as { headers: Record<string, string>; body: string };
    expect(init.headers.Authorization).toBe(`Bearer ${token}`);
    expect(new URLSearchParams(init.body).get('type')).toBe('API');
  });
});
