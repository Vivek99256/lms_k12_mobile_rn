import { configureApi, SessionContext } from '../src/api/client';
import { fetchFeeSummary, parseFeeSummary } from '../src/api/student';

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
const ok = (response: Record<string, unknown>) => ({ response, message: 'Sucsess', status: '1' });

beforeEach(() => {
  fetchMock.mockReset();
  onUnauthorized.mockReset();
  (global as { fetch: unknown }).fetch = fetchMock;
  configureApi({ getSession: () => student, onUnauthorized });
});

const sentForm = () => new URLSearchParams(fetchMock.mock.calls[0][1].body);
const IDENTITY_KEYS = ['admin_id', 'student_id', 'sub_institute_id', 'syear', 'teacher_id', 'token', 'type', 'user_id', 'user_profile_id', 'user_profile_name'];

describe('fetchFeeSummary - request', () => {
  it('posts fees/PaidUnpaid form-encoded with the session identity and nothing else', async () => {
    fetchMock.mockReturnValue(respond(200, ok({ student_id: 123, breack_off_amount: 1000, paid_amount: 400, unpaid_amount: 600 })));
    await fetchFeeSummary();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://dev.triz.co.in/fees/PaidUnpaid');
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    expect(init.headers.Authorization).toBe('Bearer jwt-student');
    expect([...sentForm().keys()].sort()).toEqual(IDENTITY_KEYS);
    expect(sentForm().get('student_id')).toBe('123');
    expect(sentForm().get('sub_institute_id')).toBe('7');
    expect(sentForm().get('syear')).toBe('2026');
  });

  it('only ever requests fees/PaidUnpaid (never the detail, pending, receipt or online-receipt endpoints)', async () => {
    fetchMock.mockReturnValue(respond(200, ok({ breack_off_amount: 1, paid_amount: 0, unpaid_amount: 1 })));
    await fetchFeeSummary();
    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(urls).toEqual(['https://dev.triz.co.in/fees/PaidUnpaid']);
    for (const bad of ['studentFeesDetailAPI', 'pending_fees', 'ajax_PDF_FeesReceipt', 'get_online_receipt']) {
      expect(urls.some((u) => u.includes(bad))).toBe(false);
    }
  });

  it('cannot be pointed at another student: the identity comes from the session', async () => {
    fetchMock.mockReturnValue(respond(200, ok({ breack_off_amount: 1, paid_amount: 0, unpaid_amount: 1 })));
    await (fetchFeeSummary as unknown as (x: unknown) => Promise<unknown>)({ student_id: 999 });
    expect(sentForm().get('student_id')).toBe('123');
  });
});

describe('fetchFeeSummary - success', () => {
  it('reads the three amounts from response (numbers or decimal strings)', async () => {
    fetchMock.mockReturnValue(respond(200, ok({ student_id: 123, breack_off_amount: '125000', paid_amount: 80000.5, unpaid_amount: '44999.50' })));
    expect(await fetchFeeSummary()).toEqual({ total: 125000, paid: 80000.5, unpaid: 44999.5 });
  });

  it('accepts text/html content (legacy PHP) and a negative balance', async () => {
    fetchMock.mockReturnValue(respond(200, JSON.stringify(ok({ breack_off_amount: 1000, paid_amount: 1500, unpaid_amount: -500 }))));
    expect(await fetchFeeSummary()).toEqual({ total: 1000, paid: 1500, unpaid: -500 });
  });

  it('keeps zeros that really are zero', async () => {
    fetchMock.mockReturnValue(respond(200, ok({ breack_off_amount: 0, paid_amount: 0, unpaid_amount: 0 })));
    expect(await fetchFeeSummary()).toEqual({ total: 0, paid: 0, unpaid: 0 });
  });
});

describe('parseFeeSummary - unreadable amounts are an error, never zero', () => {
  const bad = [
    ['missing response', { status: '1' }],
    ['response is a string', { response: 'x', status: '1' }],
    ['missing amount', { response: { breack_off_amount: 1, paid_amount: 0 } }],
    ['null amount', { response: { breack_off_amount: 1, paid_amount: null, unpaid_amount: 1 } }],
    ['empty string', { response: { breack_off_amount: '', paid_amount: 0, unpaid_amount: 0 } }],
    ['text', { response: { breack_off_amount: 'abc', paid_amount: 0, unpaid_amount: 0 } }],
    ['comma grouped text', { response: { breack_off_amount: '1,000', paid_amount: 0, unpaid_amount: 1000 } }],
    ['boolean', { response: { breack_off_amount: true, paid_amount: 0, unpaid_amount: 0 } }],
    ['array', { response: { breack_off_amount: [5], paid_amount: 0, unpaid_amount: 0 } }],
    ['absurdly large', { response: { breack_off_amount: 1e15, paid_amount: 0, unpaid_amount: 1e15 } }],
  ] as const;
  it.each(bad)('%s', (_name, body) => {
    expect(() => parseFeeSummary(body)).toThrow('The fees summary has an unexpected format.');
  });
  it('null / non-object input', () => {
    expect(() => parseFeeSummary(null)).toThrow();
    expect(() => parseFeeSummary('x')).toThrow();
  });
});

describe('fetchFeeSummary - no data and errors', () => {
  it('"Data Not Found." (no fee structure or year mapping) is a null result, whichever sub-error the server names', async () => {
    fetchMock.mockReturnValue(respond(200, { response: { bf_error: ['No Breackoff Found.'] }, status: '0', message: 'Data Not Found.' }));
    expect(await fetchFeeSummary()).toBeNull();
    fetchMock.mockReturnValue(respond(200, { response: { year_error: ['Maping Year Error.'] }, status: '0', message: 'Data Not Found.' }));
    expect(await fetchFeeSummary()).toBeNull();
  });

  it('other validation messages are NOT treated as "no data"', async () => {
    fetchMock.mockReturnValue(respond(200, { response: '', status: '0', message: { student_id: ['The student id field is required.'] } }));
    await expect(fetchFeeSummary()).rejects.toMatchObject({ kind: 'validation' });
  });

  it('a missing academic year (422) is a validation error carrying the server message', async () => {
    fetchMock.mockReturnValue(respond(422, { success: false, message: 'Academic Term Date Expired' }));
    await expect(fetchFeeSummary()).rejects.toMatchObject({ kind: 'validation', status: 422, message: 'Academic Term Date Expired' });
  });

  it('401 is unauthorized', async () => {
    fetchMock.mockReturnValue(respond(401, { success: false, message: 'JWT token is required.' }));
    await expect(fetchFeeSummary()).rejects.toMatchObject({ kind: 'unauthorized', status: 401 });
  });

  it('HTTP 200 with status "2" is unauthorized', async () => {
    fetchMock.mockReturnValue(respond(200, { status: '2', message: 'Token expired' }));
    await expect(fetchFeeSummary()).rejects.toMatchObject({ kind: 'unauthorized' });
  });

  it('the known backend defect (HTTP 500, HTML body) is a server error with no amounts', async () => {
    fetchMock.mockReturnValue(respond(500, '<html><body>Server Error</body></html>'));
    await expect(fetchFeeSummary()).rejects.toMatchObject({ kind: 'server', status: 500 });
  });

  it('419 and a network failure surface as errors', async () => {
    fetchMock.mockReturnValue(respond(419, '<html>Page Expired</html>'));
    await expect(fetchFeeSummary()).rejects.toMatchObject({ kind: 'server', status: 419 });
    fetchMock.mockReturnValue(Promise.reject(new TypeError('Network request failed')));
    await expect(fetchFeeSummary()).rejects.toMatchObject({ kind: 'network' });
  });

  it('a request is made once - no automatic retry inside the fetcher', async () => {
    fetchMock.mockReturnValue(respond(500, 'x'));
    await expect(fetchFeeSummary()).rejects.toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
