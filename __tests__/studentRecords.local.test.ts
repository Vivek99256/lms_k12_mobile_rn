/**
 * Opt-in integration test for S9 (my records) against a LOCAL Laravel server (not part of a normal `npm test` run).
 *
 *   php artisan serve --host=127.0.0.1 --port=8000        (in D:/next_lms_erp)
 *   LOCAL_API_BASE_URL=http://127.0.0.1:8000
 *   LOCAL_DASHBOARD_TOKEN=<jwt for a NON-EXISTENT student id on a real tenant>
 *   LOCAL_DASHBOARD_STUDENT_ID=999999999  LOCAL_DASHBOARD_TENANT=1
 *   npx jest studentRecords.local
 *
 * Read-only, loopback only, synthetic ids only: no real student, health or certificate data is ever requested (Q16).
 * No write endpoint and neither of the two broken endpoints (hostel, document_details) is contacted - asserted below.
 */
import { installNodeFetch } from './helpers/nodeFetch';

const base = process.env.LOCAL_API_BASE_URL ?? '';
const token = process.env.LOCAL_DASHBOARD_TOKEN ?? '';
const enabled = !!base && !!token;
const loopback = /^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base);

if (enabled && !loopback) {
  throw new Error(`LOCAL_API_BASE_URL must be a loopback address (got ${base}). Refusing to run.`);
}

jest.setTimeout(60_000); // the database behind the local server is remote

type Student = typeof import('../src/api/student');
type Client = typeof import('../src/api/client');

const PATHS = ['/studentHWAPI', '/studentVaccinationAPI', '/studentHealthAPI', '/studentInfirmaryAPI', '/consentListAPI', '/studentTransportAPI', '/studentCertificateAPI'];
const FORBIDDEN = ['studentHostelAllocationAPI', 'document_details', 'student-care', 'student-infirmary', 'consent/', 'front_desk', 'add_', 'delete', 'update'];

(enabled ? describe : describe.skip)('S9 read endpoints against the local server (synthetic ids, read-only)', () => {
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

  const fetchers = () => [
    student.fetchHeightWeight,
    student.fetchVaccinations,
    student.fetchHealthRecords,
    student.fetchInfirmaryRecords,
    student.fetchConsents,
    student.fetchTransport,
    student.fetchCertificates,
  ];

  it('a non-existent student has no records of any kind: seven empty lists', async () => {
    synthetic();
    for (const f of fetchers()) expect(await f()).toEqual([]);
  });

  it('a bad token is an unauthorized error on every one (the JWT is checked on each call)', async () => {
    synthetic({ token: 'bad.token.value' });
    for (const f of fetchers()) await expect(f()).rejects.toMatchObject({ kind: 'unauthorized' });
  });

  it('only the seven read paths are requested - never the broken, staff or write endpoints - each with the Bearer token and type=API', async () => {
    synthetic();
    fetchSpy.mockClear();
    for (const f of fetchers()) await f();
    const calls = fetchSpy.mock.calls;
    const urls = calls.map((c) => String(c[0]));
    expect(urls).toHaveLength(7);
    PATHS.forEach((p, i) => expect(urls[i]).toContain(p));
    for (const bad of FORBIDDEN) expect(urls.some((u) => u.includes(bad))).toBe(false);
    for (const c of calls) {
      const init = c[1] as { headers: Record<string, string>; body: string };
      expect(init.headers.Authorization).toBe(`Bearer ${token}`);
      expect(new URLSearchParams(init.body).get('type')).toBe('API');
    }
  });
});
