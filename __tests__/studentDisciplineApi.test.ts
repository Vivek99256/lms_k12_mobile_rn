import { configureApi, SessionContext } from '../src/api/client';
import { fetchDiscipline } from '../src/api/student';

jest.mock('../src/config/env', () => ({ env: { apiBaseUrl: 'https://dev.triz.co.in', appEnv: 'test', erpHosts: [] } }));

const student: SessionContext = {
  token: 'jwt-student',
  subInstituteId: 7,
  syear: '2026',
  userId: 123,
  userProfileId: 3,
  userProfileName: 'Student',
  isStudent: true,
};

const fetchMock = jest.fn();
const onUnauthorized = jest.fn();
const respond = (status: number, body: unknown) =>
  Promise.resolve({ status, text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)) } as Response);

beforeEach(() => {
  fetchMock.mockReset();
  onUnauthorized.mockReset();
  (global as { fetch: unknown }).fetch = fetchMock;
  configureApi({ getSession: () => student, onUnauthorized });
});

const sentForm = () => new URLSearchParams(fetchMock.mock.calls[0][1].body);
const IDENTITY_KEYS = ['admin_id', 'student_id', 'sub_institute_id', 'syear', 'teacher_id', 'token', 'type', 'user_id', 'user_profile_id', 'user_profile_name'];
const ok = (data: unknown) => ({ status: 1, message: 'Success', data });

describe('fetchDiscipline', () => {
  it('is an authenticated, form-encoded legacy call: identity block only, type=API, session student', async () => {
    fetchMock.mockReturnValue(respond(200, ok([])));
    await fetchDiscipline();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://dev.triz.co.in/studentDisciplineAPI');
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    expect(init.headers.Authorization).toBe('Bearer jwt-student');
    expect([...sentForm().keys()].sort()).toEqual(IDENTITY_KEYS);
    expect(sentForm().get('type')).toBe('API');
    expect(sentForm().get('student_id')).toBe('123');
    expect(sentForm().get('syear')).toBe('2026');
  });

  it('cannot be pointed at another student; only its own URL is requested - never a staff, entry or write route', async () => {
    fetchMock.mockReturnValue(respond(200, ok([])));
    await (fetchDiscipline as unknown as (x: unknown) => Promise<unknown>)({ student_id: 999, syear: '1999' });
    expect(sentForm().get('student_id')).toBe('123');
    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(urls).toEqual(['https://dev.triz.co.in/studentDisciplineAPI']);
    for (const bad of ['student-care', 'add_teacherStudentDiscipline', 'dicipline/', 'front_desk', 'store', 'update', 'delete', 'add_']) expect(urls.some((u) => u.includes(bad))).toBe(false);
  });

  it('maps the server\'s aliases exactly: discipline, message, discipline_date, flag - and nothing else', async () => {
    fetchMock.mockReturnValue(
      respond(200, ok([{ discipline: 'Bad', message: 'Late to class', discipline_date: '2026-03-02', flag: -1, id: 5, student_id: 123, created_by: 9, teacher_name: 'Mrs Shah' }, { discipline: null, message: null, discipline_date: null, flag: null }])),
    );
    const out = await fetchDiscipline();
    expect(out).toEqual([
      { type: 'Bad', message: 'Late to class', date: '2026-03-02', flag: '-1' },
      { type: '', message: '', date: '', flag: '' },
    ]);
    expect(JSON.stringify(out)).not.toMatch(/Shah|created_by|student_id/);
  });

  it('non-list or missing data is an empty list; non-object rows are skipped', async () => {
    for (const data of [undefined, null, {}, 'x', 5]) {
      fetchMock.mockReturnValue(respond(200, data === undefined ? { status: 1, message: 'Success' } : ok(data)));
      expect(await fetchDiscipline()).toEqual([]);
    }
    fetchMock.mockReturnValue(respond(200, ok([null, 3, 'x'])));
    expect(await fetchDiscipline()).toEqual([]);
  });

  it('"Parameter Missing" is a validation error', async () => {
    fetchMock.mockReturnValue(respond(200, { status: 0, message: 'Parameter Missing' }));
    await expect(fetchDiscipline()).rejects.toMatchObject({ kind: 'validation', message: 'Parameter Missing' });
  });

  it('401 and HTTP 200 status "2" are unauthorized (sign-out hook fires)', async () => {
    fetchMock.mockReturnValue(respond(401, { status: '2', message: 'JWT token is required.', data: [] }));
    await expect(fetchDiscipline()).rejects.toMatchObject({ kind: 'unauthorized', status: 401 });
    expect(onUnauthorized).toHaveBeenCalled();
    fetchMock.mockReturnValue(respond(200, { status: '2', message: 'Token Auth Failed', data: [] }));
    await expect(fetchDiscipline()).rejects.toMatchObject({ kind: 'unauthorized' });
  });

  it('500 HTML, 419 and network failures surface as errors', async () => {
    fetchMock.mockReturnValue(respond(500, '<html>Server Error</html>'));
    await expect(fetchDiscipline()).rejects.toMatchObject({ kind: 'server', status: 500 });
    fetchMock.mockReturnValue(respond(419, '<html>Page Expired</html>'));
    await expect(fetchDiscipline()).rejects.toMatchObject({ kind: 'server', status: 419 });
    fetchMock.mockReturnValue(Promise.reject(new TypeError('Network request failed')));
    await expect(fetchDiscipline()).rejects.toMatchObject({ kind: 'network' });
  });
});
