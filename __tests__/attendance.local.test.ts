/**
 * Opt-in integration test against a LOCAL Laravel server (never part of a normal `npm test` run).
 *
 *   php artisan serve --host=127.0.0.1 --port=8000        (in D:/next_lms_erp)
 *   LOCAL_API_BASE_URL=http://127.0.0.1:8000 LOCAL_API_TOKEN=<jwt> npx jest attendance.local
 *   optional: LOCAL_STUDENT_ID (default 0), LOCAL_SUB_INSTITUTE_ID (default 0), LOCAL_SYEAR (default 2026)
 *
 * It only reads, and it refuses any base URL that is not loopback, so it can never reach production.
 * Use id 0 (matches no rows) unless the database has been confirmed safe for a named test student.
 */
const base = process.env.LOCAL_API_BASE_URL ?? '';
const token = process.env.LOCAL_API_TOKEN ?? '';
const loopback = /^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base);
const enabled = !!base && !!token;

if (enabled && !loopback) {
  throw new Error(`LOCAL_API_BASE_URL must be a loopback address (got ${base}). Refusing to run.`);
}

const suite = enabled ? describe : describe.skip;

// The database behind the local server is remote, so a call can take longer than jest's 5 s default.
jest.setTimeout(30_000);

suite('studentAttendanceAPI against the local server (read-only)', () => {
  let fetchStudentAttendance: () => Promise<import('../src/api/student').StudentAttendance>;

  beforeAll(() => {
    // jest-expo replaces fetch with a stub, so make real HTTP calls through Node's http module.
    (global as { fetch: unknown }).fetch = (url: string, init: { method?: string; headers?: Record<string, string>; body?: string } = {}) =>
      new Promise((resolve, reject) => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const http = require('http') as typeof import('http');
        const req = http.request(url, { method: init.method ?? 'GET', headers: init.headers }, (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (c: Buffer) => chunks.push(c));
          res.on('end', () => {
            const text = Buffer.concat(chunks).toString('utf8');
            resolve({ status: res.statusCode ?? 0, text: () => Promise.resolve(text) });
          });
        });
        req.on('error', reject);
        if (init.body) req.write(init.body);
        req.end();
      });
    process.env.EXPO_PUBLIC_API_BASE_URL = base;
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { configureApi } = require('../src/api/client');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      ({ fetchStudentAttendance } = require('../src/api/student'));
      configureApi({
        getSession: () => ({
          token,
          subInstituteId: process.env.LOCAL_SUB_INSTITUTE_ID ?? '0',
          syear: process.env.LOCAL_SYEAR ?? '2026',
          userId: process.env.LOCAL_STUDENT_ID ?? '0',
          userProfileId: 0,
          userProfileName: 'Student',
          isStudent: true,
        }),
        onUnauthorized: () => {},
      });
    });
  });

  it('returns the success envelope parsed into attendance + calendar lists', async () => {
    const r = await fetchStudentAttendance();
    expect(Array.isArray(r.attendance)).toBe(true);
    expect(Array.isArray(r.holiday)).toBe(true);
    expect(Array.isArray(r.event)).toBe(true);
    expect(Array.isArray(r.vacation)).toBe(true);
  });
});
