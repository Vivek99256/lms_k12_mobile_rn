import { api, callAuto, configureApi } from '../src/api/client';
import { ApiError } from '../src/api/errors';

jest.mock('../src/config/env', () => ({ env: { apiBaseUrl: 'https://erp.test', appEnv: 'test', erpHosts: [] } }));

// The client reads the body as text (legacy endpoints answer JSON as text/html).
const respond = (status: number, body: unknown) =>
  Promise.resolve({
    status,
    text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
  } as Response);

let onUnauthorized: jest.Mock;
const fetchMock = jest.fn();

beforeEach(() => {
  onUnauthorized = jest.fn();
  fetchMock.mockReset();
  (global as { fetch: unknown }).fetch = fetchMock;
  configureApi({
    getSession: () => ({ token: 'tok', subInstituteId: 7, syear: '2026' }),
    onUnauthorized,
  });
});

describe('api client', () => {
  it('sends the bearer token and ERP common params', async () => {
    fetchMock.mockReturnValue(respond(200, { status: '1', data: [] }));
    await api.get('api/x');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('https://erp.test/api/x?');
    expect(url).toContain('sub_institute_id=7');
    expect(url).toContain('type=API');
    expect(init.headers.Authorization).toBe('Bearer tok');
  });

  it('signs out on 401 and on a status 2 body', async () => {
    fetchMock.mockReturnValueOnce(respond(401, {}));
    await expect(api.get('api/x')).rejects.toMatchObject({ kind: 'unauthorized' });
    fetchMock.mockReturnValueOnce(respond(200, { status: '2' }));
    await expect(api.get('api/x')).rejects.toMatchObject({ kind: 'unauthorized' });
    expect(onUnauthorized).toHaveBeenCalledTimes(2);
  });

  it('does not sign out when skipAuthHandling is set (login)', async () => {
    fetchMock.mockReturnValue(respond(401, { status: 0, message: 'Invalid User Id And Password' }));
    await expect(api.post('api/api-login', { skipAuthHandling: true })).rejects.toThrow('Invalid User Id And Password');
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('reports network failures distinctly', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));
    const e = (await api.get('api/x').catch((x) => x)) as ApiError;
    expect(e.kind).toBe('network');
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('callAuto falls back to GET when POST is 405', async () => {
    fetchMock.mockReturnValueOnce(respond(405, {})).mockReturnValueOnce(respond(200, { status: 1, data: { ok: 1 } }));
    const res = await callAuto('thing/summary');
    expect(res.data).toEqual({ ok: 1 });
    expect(fetchMock.mock.calls[1][1].method).toBe('GET');
  });
});
