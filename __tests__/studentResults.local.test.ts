/**
 * Opt-in integration test for S5a against a LOCAL Laravel server (not part of a normal `npm test` run).
 *
 *   php artisan serve --host=127.0.0.1 --port=8000        (in D:/next_lms_erp)
 *   LOCAL_API_BASE_URL=http://127.0.0.1:8000
 *   LOCAL_DASHBOARD_TOKEN=<jwt for a NON-EXISTENT student id on a real tenant>
 *   LOCAL_DASHBOARD_STUDENT_ID=999999999  LOCAL_DASHBOARD_TENANT=1
 *   npx jest studentResults.local
 *
 * Read-only, loopback only, synthetic ids only: no real student or result data is ever requested (Q16).
 * uploadResultAPI only reads rows for the given ids; a non-existent student has none, so no file is touched.
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

(enabled ? describe : describe.skip)('S5a result files against the local server (synthetic ids, read-only)', () => {
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

  it('a non-existent student has no result files: an empty list', async () => {
    synthetic();
    fetchSpy.mockClear();
    expect(await student.fetchResultFiles()).toEqual([]);
    const urls = fetchSpy.mock.calls.map((c) => String(c[0]));
    expect(urls.length).toBe(1);
    expect(urls[0]).toContain('/uploadResultAPI');
  });

  it('a bad token is an unauthorized error', async () => {
    synthetic({ token: 'bad.token.value' });
    await expect(student.fetchResultFiles()).rejects.toMatchObject({ kind: 'unauthorized' });
  });

  it('only uploadResultAPI is ever requested - none of the unsafe result endpoints', async () => {
    synthetic();
    fetchSpy.mockClear();
    await student.fetchResultFiles();
    const urls = fetchSpy.mock.calls.map((c) => String(c[0]));
    for (const bad of ['studentResultPDFAPI', 'all-results', 'cbse-1t5-result', 'current_result', 'current-result', 'get_wrtreportAPI']) {
      expect(urls.some((u) => u.includes(bad))).toBe(false);
    }
  });
});
