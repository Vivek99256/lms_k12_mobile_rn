import { api, configureApi, SessionContext } from '../src/api/client';

jest.mock('../src/config/env', () => ({ env: { apiBaseUrl: 'https://dev.triz.co.in', appEnv: 'test', erpHosts: [] } }));

const session: SessionContext = { token: 'jwt-secret', subInstituteId: 7, syear: '2026', userId: 123, userProfileId: 3, userProfileName: 'Student', isStudent: true };
const fetchMock = jest.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ status: 200, text: () => Promise.resolve(JSON.stringify({ success: true, data: [] })) } as Response);
  (global as { fetch: unknown }).fetch = fetchMock;
  configureApi({ getSession: () => session, onUnauthorized: jest.fn() });
});

describe('bearerOnly (opt-in; F1\'s default is unchanged)', () => {
  it('by default a GET sends the token in the Authorization header only, never in the URL', async () => {
    await api.get('api/x');
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).not.toContain('jwt-secret');
    expect(new URL(String(url)).searchParams.has('token')).toBe(false);
    expect(init.headers.Authorization).toBe('Bearer jwt-secret');
  });

  it('bearerOnly: false is the explicit opt-in for an endpoint that insists on ?token=', async () => {
    await api.get('api/x', { bearerOnly: false });
    expect(new URL(String(fetchMock.mock.calls[0][0])).searchParams.get('token')).toBe('jwt-secret');
  });

  it('with bearerOnly the token is in the Authorization header only, and the rest of the request is unchanged', async () => {
    await api.get('api/x', { query: { a: 1 }, bearerOnly: true });
    const [url, init] = fetchMock.mock.calls[0];
    const u = new URL(String(url));
    expect(String(url)).not.toContain('jwt-secret');
    expect(u.searchParams.has('token')).toBe(false);
    expect(u.searchParams.get('a')).toBe('1');
    expect(u.searchParams.get('type')).toBe('API');
    expect(u.searchParams.get('sub_institute_id')).toBe('7');
    expect(init.headers.Authorization).toBe('Bearer jwt-secret');
    expect(init.method).toBe('GET');
  });

  it('bearerOnly does not change POST bodies', async () => {
    await api.post('api/x', { body: { b: 2 }, bearerOnly: true });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.token).toBe('jwt-secret');
    expect(body.b).toBe(2);
  });
});
