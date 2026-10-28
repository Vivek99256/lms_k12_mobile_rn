import { configureApi, SessionContext } from '../src/api/client';
import { fetchOwnProfile } from '../src/api/profile';

jest.mock('../src/config/env', () => ({ env: { apiBaseUrl: 'https://dev.triz.co.in', appEnv: 'test', erpHosts: [] } }));

const session: SessionContext = {
  token: 'jwt-secret-value',
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
  configureApi({ getSession: () => session, onUnauthorized });
});

const good = { success: true, message: 'Profile fetched successfully.', data: { id: 123, full_name: 'Asha Patel', email: 'asha@example.com', mobile: '9876543210', birthdate: '2012-05-17', join_year: 2019, address: '12 Park Road', image: 'a.jpg', user_profile: 'Student', school_name: 'X School' } };

describe('fetchOwnProfile - bearerOnly, no id', () => {
  it('is a plain GET to api/own-profile with the JWT in the Authorization header only', async () => {
    fetchMock.mockReturnValue(respond(200, good));
    await fetchOwnProfile();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('https://dev.triz.co.in/api/own-profile');
    expect(init.method).toBe('GET');
    expect(init.body).toBeUndefined();
    expect(init.headers.Authorization).toBe('Bearer jwt-secret-value');
    expect(String(url)).not.toContain('jwt-secret-value');
  });

  it('adds NO query parameter at all: no token, no user / student / staff id, not even the tenant or year', async () => {
    fetchMock.mockReturnValue(respond(200, good));
    await fetchOwnProfile();
    const u = new URL(String(fetchMock.mock.calls[0][0]));
    expect([...u.searchParams.keys()]).toEqual([]);
    expect(u.search).toBe('');
  });

  it('cannot be given an id: extra arguments change nothing', async () => {
    fetchMock.mockReturnValue(respond(200, good));
    await (fetchOwnProfile as unknown as (x: unknown) => Promise<unknown>)({ user_id: 999, student_id: 999, id: 999 });
    expect(new URL(String(fetchMock.mock.calls[0][0])).search).toBe('');
    expect(fetchMock.mock.calls[0][1].body).toBeUndefined();
    expect(fetchOwnProfile.length).toBe(0);
  });

  it('only that one URL is ever requested', async () => {
    fetchMock.mockReturnValue(respond(200, good));
    await fetchOwnProfile();
    expect(fetchMock.mock.calls.map((c) => String(c[0]))).toEqual(['https://dev.triz.co.in/api/own-profile']);
  });
});

describe('fetchOwnProfile - mapping', () => {
  it('reads only full_name, email, mobile, birthdate, join_year and address (numbers become text)', async () => {
    fetchMock.mockReturnValue(respond(200, good));
    const out = await fetchOwnProfile();
    expect(out).toEqual({ fullName: 'Asha Patel', email: 'asha@example.com', mobile: '9876543210', birthdate: '2012-05-17', joinYear: '2019', address: '12 Park Road' });
  });

  it('never carries the server id, image, role or school', async () => {
    fetchMock.mockReturnValue(respond(200, good));
    const out = await fetchOwnProfile();
    expect(Object.keys(out).sort()).toEqual(['address', 'birthdate', 'email', 'fullName', 'joinYear', 'mobile']);
    expect(JSON.stringify(out)).not.toMatch(/a\.jpg|X School|"Student"|123/);
  });

  it('nulls and missing fields become empty text; a missing or odd data object gives an empty record (which the identity check then rejects)', async () => {
    fetchMock.mockReturnValue(respond(200, { success: true, data: { full_name: null, email: null } }));
    expect(await fetchOwnProfile()).toEqual({ fullName: '', email: '', mobile: '', birthdate: '', joinYear: '', address: '' });
    for (const body of [{ success: true, data: null }, { success: true }, { success: true, data: 'x' }, { success: true, data: [] }]) {
      fetchMock.mockReturnValue(respond(200, body));
      expect(await fetchOwnProfile()).toEqual({ fullName: '', email: '', mobile: '', birthdate: '', joinYear: '', address: '' });
    }
  });
});

describe('fetchOwnProfile - errors', () => {
  it('401 is unauthorized (sign-out hook fires)', async () => {
    fetchMock.mockReturnValue(respond(401, { success: false, message: 'JWT token is required.' }));
    await expect(fetchOwnProfile()).rejects.toMatchObject({ kind: 'unauthorized', status: 401 });
    expect(onUnauthorized).toHaveBeenCalled();
  });

  it('404 "Profile not found." is a server error carrying the status', async () => {
    fetchMock.mockReturnValue(respond(404, { success: false, message: 'Profile not found.', data: null }));
    await expect(fetchOwnProfile()).rejects.toMatchObject({ kind: 'server', status: 404, message: 'Profile not found.' });
  });

  it('422 "Academic Term Date Expired" (no current academic year) is a validation error with the server message', async () => {
    fetchMock.mockReturnValue(respond(422, { success: false, message: 'Academic Term Date Expired', data: null, errors: null }));
    await expect(fetchOwnProfile()).rejects.toMatchObject({ kind: 'validation', status: 422, message: 'Academic Term Date Expired' });
  });

  it('500 HTML, 419 and network failures surface as errors', async () => {
    fetchMock.mockReturnValue(respond(500, '<html>Server Error</html>'));
    await expect(fetchOwnProfile()).rejects.toMatchObject({ kind: 'server', status: 500 });
    fetchMock.mockReturnValue(respond(419, '<html>Page Expired</html>'));
    await expect(fetchOwnProfile()).rejects.toMatchObject({ kind: 'server', status: 419 });
    fetchMock.mockReturnValue(Promise.reject(new TypeError('Network request failed')));
    await expect(fetchOwnProfile()).rejects.toMatchObject({ kind: 'network' });
  });
});

describe('GET calls keep the token out of the URL by default (pinned)', () => {
  it('another module\'s GET sends the token in the header only unless it opts in with bearerOnly: false', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { api } = require('../src/api/client') as typeof import('../src/api/client');
    fetchMock.mockReturnValue(respond(200, { success: true, data: [] }));
    await api.get('api/other');
    expect(new URL(String(fetchMock.mock.calls[0][0])).searchParams.has('token')).toBe(false);
    await api.get('api/other', { bearerOnly: false });
    expect(new URL(String(fetchMock.mock.calls[1][0])).searchParams.get('token')).toBe('jwt-secret-value');
  });
});
