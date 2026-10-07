import { configureApi, SessionContext } from '../src/api/client';
import { fetchResultFiles } from '../src/api/student';

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

describe('fetchResultFiles - request', () => {
  it('posts uploadResultAPI form-encoded with the session identity and nothing else (authenticated)', async () => {
    fetchMock.mockReturnValue(respond(200, ok([])));
    await fetchResultFiles();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://dev.triz.co.in/uploadResultAPI');
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    expect(init.headers.Authorization).toBe('Bearer jwt-student');
    expect([...sentForm().keys()].sort()).toEqual(IDENTITY_KEYS);
    expect(sentForm().get('token')).toBe('jwt-student');
    expect(sentForm().get('student_id')).toBe('123');
    expect(sentForm().get('sub_institute_id')).toBe('7');
    expect(sentForm().get('syear')).toBe('2026');
    expect(sentForm().get('type')).toBe('API');
  });

  it('cannot be pointed at another student: the identity comes from the session', async () => {
    fetchMock.mockReturnValue(respond(200, ok([])));
    await (fetchResultFiles as unknown as (x: unknown) => Promise<unknown>)({ student_id: 999, syear: '1999' });
    expect(sentForm().get('student_id')).toBe('123');
    expect(sentForm().get('syear')).toBe('2026');
  });

  it('only ever requests uploadResultAPI (never the unsafe result endpoints)', async () => {
    fetchMock.mockReturnValue(respond(200, ok([])));
    await fetchResultFiles();
    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(urls).toEqual(['https://dev.triz.co.in/uploadResultAPI']);
    for (const bad of ['studentResultPDFAPI', 'all-results', 'cbse-1t5-result', 'current_result', 'current-result', 'get_wrtreportAPI']) {
      expect(urls.some((u) => u.includes(bad))).toBe(false);
    }
  });
});

describe('fetchResultFiles - success', () => {
  it('maps term_name and file_name; nulls become empty text; ids become text', async () => {
    fetchMock.mockReturnValue(
      respond(
        200,
        ok([
          { id: 5, syear: '2026', sub_institute_id: 7, student_id: 123, term_name: 'Term 1', file_name: 'https://erp.triz.co.in/storage/upload_result/a.pdf' },
          { id: '6', term_name: null, file_name: '' },
          { id: 7, term_name: 'Term 3', file_name: null },
        ]),
      ),
    );
    expect(await fetchResultFiles()).toEqual([
      { id: '5', term: 'Term 1', file: 'https://erp.triz.co.in/storage/upload_result/a.pdf' },
      { id: '6', term: '', file: '' },
      { id: '7', term: 'Term 3', file: '' },
    ]);
  });

  it('empty list; missing, null or non-list data are an empty list, never a crash', async () => {
    for (const data of [[], undefined, null, {}, 'x', 5]) {
      fetchMock.mockReturnValue(respond(200, data === undefined ? { status: 1, message: 'Success' } : ok(data)));
      expect(await fetchResultFiles()).toEqual([]);
    }
  });

  it('skips non-object rows', async () => {
    fetchMock.mockReturnValue(respond(200, ok([null, 3, 'x', { id: 1, term_name: 'T', file_name: '' }])));
    expect(await fetchResultFiles()).toEqual([{ id: '1', term: 'T', file: '' }]);
  });

  it('reads the JSON the legacy PHP serves as text/html', async () => {
    fetchMock.mockReturnValue(respond(200, JSON.stringify(ok([{ id: 1, term_name: 'T', file_name: '' }]))));
    expect(await fetchResultFiles()).toHaveLength(1);
  });
});

describe('fetchResultFiles - errors', () => {
  it('401 is unauthorized (sign-out hook fires)', async () => {
    fetchMock.mockReturnValue(respond(401, { status: '2', message: 'JWT token is required.', data: [] }));
    await expect(fetchResultFiles()).rejects.toMatchObject({ kind: 'unauthorized', status: 401 });
    expect(onUnauthorized).toHaveBeenCalled();
  });

  it('HTTP 200 with status "2" is unauthorized', async () => {
    fetchMock.mockReturnValue(respond(200, { status: '2', message: 'Token Auth Failed', data: [] }));
    await expect(fetchResultFiles()).rejects.toMatchObject({ kind: 'unauthorized' });
  });

  it('"Parameter Missing" (status 0) is a validation error carrying the message', async () => {
    fetchMock.mockReturnValue(respond(200, { status: 0, message: 'Parameter Missing' }));
    await expect(fetchResultFiles()).rejects.toMatchObject({ kind: 'validation', message: 'Parameter Missing' });
  });

  it('500 HTML, 419 and a network failure surface as errors', async () => {
    fetchMock.mockReturnValue(respond(500, '<html>Server Error</html>'));
    await expect(fetchResultFiles()).rejects.toMatchObject({ kind: 'server', status: 500 });
    fetchMock.mockReturnValue(respond(419, '<html>Page Expired</html>'));
    await expect(fetchResultFiles()).rejects.toMatchObject({ kind: 'server', status: 419 });
    fetchMock.mockReturnValue(Promise.reject(new TypeError('Network request failed')));
    await expect(fetchResultFiles()).rejects.toMatchObject({ kind: 'network' });
  });
});
