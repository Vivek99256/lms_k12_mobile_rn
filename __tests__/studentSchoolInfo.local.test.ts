/**
 * Opt-in integration test for S10 (school information and galleries) against a LOCAL Laravel server
 * (not part of a normal `npm test` run).
 *
 *   php artisan serve --host=127.0.0.1 --port=8000        (in D:/next_lms_erp)
 *   LOCAL_API_BASE_URL=http://127.0.0.1:8000
 *   LOCAL_DASHBOARD_TOKEN=<jwt for a NON-EXISTENT student id on a real tenant>
 *   LOCAL_DASHBOARD_STUDENT_ID=999999999  LOCAL_DASHBOARD_TENANT=1
 *   LOCAL_UNKNOWN_TENANT_TOKEN=<jwt for student 999999999 on tenant 999999999>   (school pages use a NON-EXISTENT tenant)
 *   npx jest studentSchoolInfo.local
 *
 * Read-only, loopback only, synthetic ids only: no real student data and no real school content is ever requested (Q16).
 * The classwork endpoint (front_desk/send_attachment/create) and every staff / write route are never contacted - asserted.
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

const FORBIDDEN = ['send_attachment', 'classwork', 'front_desk', 'front-desk', 'TeacherFetchData', 'get_admin', 'add_admin', 'school_detail', 'add_', 'delete', 'update'];

(enabled ? describe : describe.skip)('S10 read endpoints against the local server (synthetic ids, read-only)', () => {
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

  it('a non-existent TENANT has no school pages: an empty list for every page (so no real school content is read)', async () => {
    synthetic({ token: unknownTenantToken, subInstituteId: 999999999 });
    for (const action of ['About Us', 'Principal Desk', 'School Information', 'Achievement', 'School Timing', 'Rules', 'Facility', 'Academic Activity', 'Reach Us']) {
      expect(await student.fetchSchoolDetail(action)).toEqual([]);
    }
  });

  it('a non-existent student has no albums: the servers "No Data Found" becomes an empty list for both kinds', async () => {
    synthetic();
    expect(await student.fetchGallery('Photo')).toEqual([]);
    expect(await student.fetchGallery('Video')).toEqual([]);
  });

  it('a bad token is an unauthorized error on each', async () => {
    synthetic({ token: 'bad.token.value' });
    await expect(student.fetchSchoolDetail('About Us')).rejects.toMatchObject({ kind: 'unauthorized' });
    await expect(student.fetchGallery('Photo')).rejects.toMatchObject({ kind: 'unauthorized' });
    await expect(student.fetchGallery('Video')).rejects.toMatchObject({ kind: 'unauthorized' });
  });

  it('only the two read paths are requested, each with the Bearer token, type=API and the fixed action - never the classwork endpoint or any staff route', async () => {
    synthetic();
    fetchSpy.mockClear();
    await student.fetchGallery('Photo');
    await student.fetchGallery('Video');
    synthetic({ token: unknownTenantToken, subInstituteId: 999999999 });
    await student.fetchSchoolDetail('Rules');
    const calls = fetchSpy.mock.calls;
    const urls = calls.map((c) => String(c[0]));
    expect(urls).toHaveLength(3);
    expect(urls[0]).toContain('/studentPhotoVideoGalleryAPI');
    expect(urls[1]).toContain('/studentPhotoVideoGalleryAPI');
    expect(urls[2]).toContain('/schoolDetailAPI');
    for (const bad of FORBIDDEN) expect(urls.some((u) => u.includes(bad))).toBe(false);
    const actions = calls.map((c) => new URLSearchParams((c[1] as { body: string }).body).get('action'));
    expect(actions).toEqual(['Photo', 'Video', 'Rules']);
    for (const c of calls) {
      const init = c[1] as { headers: Record<string, string>; body: string };
      expect(init.headers.Authorization).toMatch(/^Bearer /);
      expect(new URLSearchParams(init.body).get('type')).toBe('API');
    }
  });
});
