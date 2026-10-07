import { configureApi, SessionContext } from '../src/api/client';
import { fetchGallery, fetchSchoolDetail } from '../src/api/student';

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
const NEVER = ['send_attachment', 'classwork', 'front_desk', 'front-desk', 'TeacherFetchData', 'get_admin', 'add_admin', 'photo_video_gallary/', 'school_detail', 'add_', 'update', 'delete', 'store', 'upload'];

const CALLS = [
  ['fetchSchoolDetail', () => fetchSchoolDetail('About Us'), 'schoolDetailAPI', 'About Us'],
  ['fetchGallery(Photo)', () => fetchGallery('Photo'), 'studentPhotoVideoGalleryAPI', 'Photo'],
  ['fetchGallery(Video)', () => fetchGallery('Video'), 'studentPhotoVideoGalleryAPI', 'Video'],
] as const;

describe.each(CALLS)('%s', (_name, call, path, action) => {
  it('is an authenticated, form-encoded legacy call: the identity block plus only the fixed `action`, type=API', async () => {
    fetchMock.mockReturnValue(respond(200, ok([])));
    await call();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`https://dev.triz.co.in/${path}`);
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    expect(init.headers.Authorization).toBe('Bearer jwt-student');
    expect([...sentForm().keys()].sort()).toEqual([...IDENTITY_KEYS, 'action'].sort());
    expect(sentForm().get('action')).toBe(action);
    expect(sentForm().get('type')).toBe('API');
    expect(sentForm().get('token')).toBe('jwt-student');
    expect(sentForm().get('student_id')).toBe('123');
    expect(sentForm().get('sub_institute_id')).toBe('7');
    expect(sentForm().get('syear')).toBe('2026');
  });

  it('only its own read URL is requested - never the classwork endpoint or any staff / write route', async () => {
    fetchMock.mockReturnValue(respond(200, ok([])));
    await call();
    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(urls).toEqual([`https://dev.triz.co.in/${path}`]);
    for (const bad of NEVER) expect(urls.some((u) => u.includes(bad))).toBe(false);
  });

  it('401 and HTTP 200 status "2" are unauthorized (sign-out hook fires)', async () => {
    fetchMock.mockReturnValue(respond(401, { status: '2', message: 'JWT token is required.', data: [] }));
    await expect(call()).rejects.toMatchObject({ kind: 'unauthorized', status: 401 });
    expect(onUnauthorized).toHaveBeenCalled();
    fetchMock.mockReturnValue(respond(200, { status: '2', message: 'Token Auth Failed', data: [] }));
    await expect(call()).rejects.toMatchObject({ kind: 'unauthorized' });
  });

  it('"Parameter Missing" is a validation error; 500 HTML, 419 and network failures are errors', async () => {
    fetchMock.mockReturnValue(respond(200, { status: 0, message: 'Parameter Missing' }));
    await expect(call()).rejects.toMatchObject({ kind: 'validation', message: 'Parameter Missing' });
    fetchMock.mockReturnValue(respond(500, '<html>Server Error</html>'));
    await expect(call()).rejects.toMatchObject({ kind: 'server', status: 500 });
    fetchMock.mockReturnValue(respond(419, '<html>Page Expired</html>'));
    await expect(call()).rejects.toMatchObject({ kind: 'server', status: 419 });
    fetchMock.mockReturnValue(Promise.reject(new TypeError('Network request failed')));
    await expect(call()).rejects.toMatchObject({ kind: 'network' });
  });
});

describe('fetchSchoolDetail - the backend field behaviour is preserved', () => {
  it('`title` carries the page type and `description` the HTML content (the server swaps its aliases)', async () => {
    fetchMock.mockReturnValue(respond(200, ok([{ title: 'About Us', description: '<p>Welcome</p>' }, { title: 'About Us', description: '<p>More</p>' }])));
    expect(await fetchSchoolDetail('About Us')).toEqual([
      { type: 'About Us', content: '<p>Welcome</p>' },
      { type: 'About Us', content: '<p>More</p>' },
    ]);
  });

  it('missing or null fields stay empty - no content is invented', async () => {
    fetchMock.mockReturnValue(respond(200, ok([{ title: null }, { description: null }, {}])));
    expect(await fetchSchoolDetail('Rules')).toEqual([
      { type: '', content: '' },
      { type: '', content: '' },
      { type: '', content: '' },
    ]);
  });

  it('empty list, non-list or missing data -> empty list; non-object rows skipped', async () => {
    for (const data of [undefined, null, {}, 'x', 5, []]) {
      fetchMock.mockReturnValue(respond(200, data === undefined ? { status: 1, message: 'Success' } : ok(data)));
      expect(await fetchSchoolDetail('Rules')).toEqual([]);
    }
    fetchMock.mockReturnValue(respond(200, ok([null, 3, 'x'])));
    expect(await fetchSchoolDetail('Rules')).toEqual([]);
  });

  it('a student cannot change the action through the call (it is the caller\'s fixed text, tenant and ids stay the session\'s)', async () => {
    fetchMock.mockReturnValue(respond(200, ok([])));
    await (fetchSchoolDetail as unknown as (a: string, x: unknown) => Promise<unknown>)('Rules', { sub_institute_id: 999, student_id: 999 });
    expect(sentForm().get('sub_institute_id')).toBe('7');
    expect(sentForm().get('student_id')).toBe('123');
  });
});

describe('fetchGallery', () => {
  const item = (album: string, title: string) => ({ album_title: album, title, file_name: 'https://erp.triz.co.in/storage/photo_video_gallary/a.jpg', date_: '2026-03-01', ai: 'Active', type: 'Photo' });

  it('reads the object keyed by album title', async () => {
    fetchMock.mockReturnValue(respond(200, ok({ 'Sports Day': [item('Sports Day', 'a'), item('Sports Day', 'b')], Trip: [item('Trip', 'c')] })));
    const out = await fetchGallery('Photo');
    expect(out.map((i) => `${i.album}/${i.title}`)).toEqual(['Sports Day/a', 'Sports Day/b', 'Trip/c']);
    expect(out[0]).toEqual({ album: 'Sports Day', title: 'a', file: 'https://erp.triz.co.in/storage/photo_video_gallary/a.jpg', date: '2026-03-01', type: 'Photo' });
  });

  it('reads the numeric-key array shape (album titles 0, 1, 2 …)', async () => {
    fetchMock.mockReturnValue(respond(200, ok([[item('0', 'a')], [item('1', 'b')]])));
    expect((await fetchGallery('Photo')).map((i) => i.album)).toEqual(['0', '1']);
  });

  it('"No Data Found" is an empty list; other validation messages stay errors', async () => {
    fetchMock.mockReturnValue(respond(200, { status: 0, message: 'No Data Found' }));
    expect(await fetchGallery('Video')).toEqual([]);
    fetchMock.mockReturnValue(respond(200, { status: 0, message: 'Parameter Missing' }));
    await expect(fetchGallery('Video')).rejects.toMatchObject({ kind: 'validation', message: 'Parameter Missing' });
  });

  it('empty data, no data key and junk -> empty list', async () => {
    for (const body of [ok({}), ok([]), ok(null), { status: 1, message: 'Success' }, ok('x')]) {
      fetchMock.mockReturnValue(respond(200, body));
      expect(await fetchGallery('Photo')).toEqual([]);
    }
  });

  it('the student comes from the session even if a caller passes another', async () => {
    fetchMock.mockReturnValue(respond(200, ok({})));
    await (fetchGallery as unknown as (k: string, x: unknown) => Promise<unknown>)('Photo', { student_id: 999 });
    expect(sentForm().get('student_id')).toBe('123');
  });
});
