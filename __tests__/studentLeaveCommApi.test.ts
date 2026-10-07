import { configureApi, SessionContext } from '../src/api/client';
import { fetchLeaveApplications, fetchParentMessages, fetchSubjectTeachers } from '../src/api/student';

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
const okCode = (data: unknown) => ({ status_code: 1, message: 'Success', data });

const FETCHERS = [
  ['fetchSubjectTeachers', fetchSubjectTeachers, 'studentTeacherListAPI', ok],
  ['fetchLeaveApplications', fetchLeaveApplications, 'studentLeaveApplicationAPI', ok],
  ['fetchParentMessages', fetchParentMessages, 'studentParentcommunicationListAPI', okCode],
] as const;

const WRITE_AND_STAFF = [
  'add_leave_application',
  'add_communicationAPI',
  'teacherLeaveApplication',
  'teacherParentcommunication',
  'get_admin',
  'add_admin',
  'front_desk',
  'api/leave',
  'hrms',
];

describe.each(FETCHERS)('%s - request', (_name, fn, path, envelope) => {
  it('is an authenticated, form-encoded legacy call with the session identity and type=API, and nothing else', async () => {
    fetchMock.mockReturnValue(respond(200, envelope([])));
    await fn();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`https://dev.triz.co.in/${path}`);
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    expect(init.headers.Authorization).toBe('Bearer jwt-student');
    expect([...sentForm().keys()].sort()).toEqual(IDENTITY_KEYS);
    expect(sentForm().get('type')).toBe('API');
    expect(sentForm().get('token')).toBe('jwt-student');
    expect(sentForm().get('student_id')).toBe('123');
    expect(sentForm().get('sub_institute_id')).toBe('7');
    expect(sentForm().get('syear')).toBe('2026');
  });

  it('cannot be pointed at another student; no write, staff, admin, front_desk or HR URL is ever requested', async () => {
    fetchMock.mockReturnValue(respond(200, envelope([])));
    await (fn as unknown as (x: unknown) => Promise<unknown>)({ student_id: 999, syear: '1999' });
    expect(sentForm().get('student_id')).toBe('123');
    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(urls).toEqual([`https://dev.triz.co.in/${path}`]);
    for (const bad of WRITE_AND_STAFF) expect(urls.some((u) => u.includes(bad))).toBe(false);
  });

  it('non-list or missing data is an empty list; non-object rows are skipped', async () => {
    for (const data of [undefined, null, {}, 'x', 5]) {
      fetchMock.mockReturnValue(respond(200, data === undefined ? { status: 1, status_code: 1, message: 'Success' } : envelope(data)));
      expect(await fn()).toEqual([]);
    }
    fetchMock.mockReturnValue(respond(200, envelope([null, 3, 'x'])));
    expect(await fn()).toEqual([]);
  });

  it('401 and HTTP 200 status "2" are unauthorized (sign-out hook fires)', async () => {
    fetchMock.mockReturnValue(respond(401, { status: '2', message: 'JWT token is required.', data: [] }));
    await expect(fn()).rejects.toMatchObject({ kind: 'unauthorized', status: 401 });
    expect(onUnauthorized).toHaveBeenCalled();
    fetchMock.mockReturnValue(respond(200, { status: '2', message: 'Token Auth Failed', data: [] }));
    await expect(fn()).rejects.toMatchObject({ kind: 'unauthorized' });
  });

  it('500 HTML, 419 and network failures surface as errors', async () => {
    fetchMock.mockReturnValue(respond(500, '<html>Server Error</html>'));
    await expect(fn()).rejects.toMatchObject({ kind: 'server', status: 500 });
    fetchMock.mockReturnValue(respond(419, '<html>Page Expired</html>'));
    await expect(fn()).rejects.toMatchObject({ kind: 'server', status: 419 });
    fetchMock.mockReturnValue(Promise.reject(new TypeError('Network request failed')));
    await expect(fn()).rejects.toMatchObject({ kind: 'network' });
  });

  it('reads JSON served as text/html', async () => {
    fetchMock.mockReturnValue(respond(200, JSON.stringify(envelope([]))));
    expect(await fn()).toEqual([]);
  });
});

describe('fetchSubjectTeachers', () => {
  it('keeps only name and subjects: the mobile number and image URL are dropped', async () => {
    fetchMock.mockReturnValue(
      respond(200, ok([{ teacher_name: 'Mrs Shah', image: 'https://erp.triz.co.in/storage/user/a.png', mobile: '9876543210', subject_name: 'Maths,Science' }])),
    );
    const out = await fetchSubjectTeachers();
    expect(out).toEqual([{ name: 'Mrs Shah', subjects: 'Maths,Science' }]);
    expect(JSON.stringify(out)).not.toContain('9876543210');
    expect(JSON.stringify(out)).not.toContain('png');
  });

  it('"Wrong Parameters" (no enrolment) is an empty list; other validation messages stay errors', async () => {
    fetchMock.mockReturnValue(respond(200, { status: 0, message: 'Wrong Parameters' }));
    expect(await fetchSubjectTeachers()).toEqual([]);
    fetchMock.mockReturnValue(respond(200, { status: 0, message: 'Parameter Missing' }));
    await expect(fetchSubjectTeachers()).rejects.toMatchObject({ kind: 'validation', message: 'Parameter Missing' });
  });

  it('nulls become empty text', async () => {
    fetchMock.mockReturnValue(respond(200, ok([{ teacher_name: null, subject_name: null }])));
    expect(await fetchSubjectTeachers()).toEqual([{ name: '', subjects: '' }]);
  });
});

describe('fetchLeaveApplications', () => {
  it('maps the row fields as text, keeping the server order', async () => {
    fetchMock.mockReturnValue(
      respond(
        200,
        ok([
          {
            title: 'Sick',
            message: 'Fever',
            files: 'https://erp.triz.co.in/storage/leave_application/a.pdf',
            apply_date: '05-10-2026 09:30:00',
            from_date: '2026-10-06',
            to_date: '2026-10-08',
            status: 'Approved',
            reply: 'Get well',
            reply_by: 'Mrs Shah',
            reply_on: '06-10-2026 11:00:00',
          },
          { title: 'Trip', message: null, files: '', apply_date: '01-10-2026 08:00:00', from_date: '2026-10-02', to_date: '2026-10-02', status: null, reply: null, reply_by: '', reply_on: null },
        ]),
      ),
    );
    expect(await fetchLeaveApplications()).toEqual([
      {
        title: 'Sick',
        message: 'Fever',
        file: 'https://erp.triz.co.in/storage/leave_application/a.pdf',
        appliedOn: '05-10-2026 09:30:00',
        fromDate: '2026-10-06',
        toDate: '2026-10-08',
        status: 'Approved',
        reply: 'Get well',
        replyBy: 'Mrs Shah',
        replyOn: '06-10-2026 11:00:00',
      },
      { title: 'Trip', message: '', file: '', appliedOn: '01-10-2026 08:00:00', fromDate: '2026-10-02', toDate: '2026-10-02', status: '', reply: '', replyBy: '', replyOn: '' },
    ]);
  });

  it('"Parameter Missing" (status 0) is a validation error', async () => {
    fetchMock.mockReturnValue(respond(200, { status: 0, message: 'Parameter Missing' }));
    await expect(fetchLeaveApplications()).rejects.toMatchObject({ kind: 'validation', message: 'Parameter Missing' });
  });
});

describe('fetchParentMessages - the status_code envelope', () => {
  it('parses {status_code:1, data:[…]} and maps the fields', async () => {
    fetchMock.mockReturnValue(
      respond(200, okCode([{ title: 'Bus', message: 'Timing?', created_at: '2026-10-05 09:30:00', reply: 'Confirmed', reply_on: '06-10-2026', reply_by: 'Mr Rao' }, { title: 'Fees', message: 'Q', created_at: '2026-10-04 10:00:00', reply: null, reply_on: null, reply_by: null }])),
    );
    expect(await fetchParentMessages()).toEqual([
      { title: 'Bus', message: 'Timing?', createdAt: '2026-10-05 09:30:00', reply: 'Confirmed', replyOn: '06-10-2026', replyBy: 'Mr Rao' },
      { title: 'Fees', message: 'Q', createdAt: '2026-10-04 10:00:00', reply: '', replyOn: '', replyBy: '' },
    ]);
  });

  it('{status_code:0, "Parameter Missing"} is a validation error', async () => {
    fetchMock.mockReturnValue(respond(200, { status_code: 0, message: 'Parameter Missing' }));
    await expect(fetchParentMessages()).rejects.toMatchObject({ kind: 'validation', message: 'Parameter Missing' });
  });

  it('{status_code:"2"} is unauthorized', async () => {
    fetchMock.mockReturnValue(respond(200, { status_code: '2', message: 'Token Auth Failed' }));
    await expect(fetchParentMessages()).rejects.toMatchObject({ kind: 'unauthorized' });
  });

  it('never contacts add_communicationAPI', async () => {
    fetchMock.mockReturnValue(respond(200, okCode([])));
    await fetchParentMessages();
    expect(fetchMock.mock.calls.map((c) => String(c[0])).some((u) => u.includes('add_communicationAPI'))).toBe(false);
  });
});
