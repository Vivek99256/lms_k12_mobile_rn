/**
 * Opt-in integration test for S3 against a LOCAL Laravel server (not part of a normal `npm test` run).
 *
 *   php artisan serve --host=127.0.0.1 --port=8000        (in D:/next_lms_erp)
 *   LOCAL_API_BASE_URL=http://127.0.0.1:8000
 *   LOCAL_API_TOKEN=<jwt for a NON-EXISTENT student, id 0, tenant 0>
 *   npx jest studentSchedule.local
 *
 * Read-only, loopback only, synthetic ids only: no real student data is ever requested (Q16).
 */
import { installNodeFetch } from './helpers/nodeFetch';

const base = process.env.LOCAL_API_BASE_URL ?? '';
const token = process.env.LOCAL_API_TOKEN ?? '';
const enabled = !!base && !!token;
const loopback = /^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base);

if (enabled && !loopback) {
  throw new Error(`LOCAL_API_BASE_URL must be a loopback address (got ${base}). Refusing to run.`);
}

jest.setTimeout(30_000); // the database behind the local server is remote

type Student = typeof import('../src/api/student');
type Client = typeof import('../src/api/client');

(enabled ? describe : describe.skip)('S3 endpoints against the local server (synthetic ids, read-only)', () => {
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

  const synthetic = (over: Partial<import('../src/api/client').SessionContext> = {}) => {
    session = { token, subInstituteId: 0, syear: '2026', userId: 0, userProfileId: 0, userProfileName: 'Student', isStudent: true, ...over };
  };

  it('timetable: success with an empty list for a non-existent student (the grouped SQL runs without error)', async () => {
    synthetic();
    expect(await student.fetchTimetable()).toEqual([]);
  });

  it('exam schedule: success with an empty list for a non-existent student', async () => {
    synthetic();
    expect(await student.fetchExamSchedule()).toEqual([]);
  });

  it('a bad token is an unauthorized error on both', async () => {
    synthetic({ token: 'bad.token.value' });
    await expect(student.fetchTimetable()).rejects.toMatchObject({ kind: 'unauthorized' });
    await expect(student.fetchExamSchedule()).rejects.toMatchObject({ kind: 'unauthorized' });
  });

  it('a session without a school year gets the server\'s "Parameter Missing" as a validation error on both', async () => {
    synthetic({ syear: '' });
    await expect(student.fetchTimetable()).rejects.toMatchObject({ kind: 'validation', message: 'Parameter Missing' });
    await expect(student.fetchExamSchedule()).rejects.toMatchObject({ kind: 'validation', message: 'Parameter Missing' });
  });
});
