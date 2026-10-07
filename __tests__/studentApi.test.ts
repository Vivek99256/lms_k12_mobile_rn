import { configureApi, SessionContext } from '../src/api/client';
import { fetchStudentAttendance, parseAttendance } from '../src/api/student';

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
const respond = (status: number, body: unknown) =>
  Promise.resolve({ status, text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)) } as Response);

beforeEach(() => {
  fetchMock.mockReset();
  (global as { fetch: unknown }).fetch = fetchMock;
  configureApi({ getSession: () => student, onUnauthorized: jest.fn() });
});

// Shape verified on the local Laravel server and from studentAttendanceController.php:683-688.
const success = {
  status: 1,
  message: 'Success',
  data: {
    attendance_data: [
      { attendance_date: '2026-10-05', attendance_code: 'P' },
      { attendance_date: '2026-10-06', attendance_code: 'A' },
    ],
    calendar_data: {
      holiday: [{ school_date: '2026-10-02', title: 'Gandhi Jayanti', description: 'Holiday', event_type: 'holiday' }],
      event: [],
      vacation: [],
    },
  },
};

describe('fetchStudentAttendance', () => {
  it('POSTs studentAttendanceAPI with the signed-in student as identity and nothing else', async () => {
    fetchMock.mockReturnValue(respond(200, success));
    await fetchStudentAttendance();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://dev.triz.co.in/studentAttendanceAPI');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer jwt-student');
    const form = new URLSearchParams(init.body);
    expect(form.get('student_id')).toBe('123');
    expect(form.get('sub_institute_id')).toBe('7');
    expect(form.get('syear')).toBe('2026');
    expect(form.get('type')).toBe('API');
    expect(form.has('mobile_no')).toBe(false); // the backend ignores it; the Flutter app's extra field is not copied
  });

  it('maps the success body', async () => {
    fetchMock.mockReturnValue(respond(200, success));
    const r = await fetchStudentAttendance();
    expect(r.attendance).toEqual(success.data.attendance_data);
    expect(r.holiday).toEqual(success.data.calendar_data.holiday);
    expect(r.event).toEqual([]);
    expect(r.vacation).toEqual([]);
  });

  it('works when the server serves the JSON as text/html (text-first parsing)', async () => {
    fetchMock.mockReturnValue(respond(200, JSON.stringify(success)));
    expect((await fetchStudentAttendance()).attendance).toHaveLength(2);
  });

  it('turns "Parameter Missing" (HTTP 200, status 0) into a validation error', async () => {
    fetchMock.mockReturnValue(respond(200, { status: 0, message: 'Parameter Missing' }));
    await expect(fetchStudentAttendance()).rejects.toMatchObject({ kind: 'validation', message: 'Parameter Missing' });
  });

  it('turns a 401 into an unauthorized error', async () => {
    fetchMock.mockReturnValue(respond(401, { status: '2', message: 'Token Auth Failed', data: [] }));
    await expect(fetchStudentAttendance()).rejects.toMatchObject({ kind: 'unauthorized' });
  });

  it('surfaces a 419 as the server-address message', async () => {
    fetchMock.mockReturnValue(respond(419, '<html>Page Expired</html>'));
    await expect(fetchStudentAttendance()).rejects.toMatchObject({ status: 419 });
  });
});

describe('parseAttendance', () => {
  it('tolerates missing or malformed arrays', () => {
    const empty = { attendance: [], holiday: [], event: [], vacation: [] };
    expect(parseAttendance(undefined)).toEqual(empty);
    expect(parseAttendance([])).toEqual(empty);
    expect(parseAttendance({ attendance_data: 'x', calendar_data: null })).toEqual(empty);
    expect(parseAttendance({ attendance_data: [], calendar_data: { holiday: {}, event: 5 } })).toEqual(empty);
  });

  it('keeps only object rows and stringifies fields (nulls become empty strings)', () => {
    const r = parseAttendance({
      attendance_data: [null, 3, { attendance_date: '2026-10-05', attendance_code: null }, { attendance_date: '2026-10-06', attendance_code: 'p' }],
      calendar_data: { holiday: [{ school_date: '2026-10-02', title: null, description: 7, event_type: 'holiday' }] },
    });
    expect(r.attendance).toEqual([
      { attendance_date: '2026-10-05', attendance_code: '' },
      { attendance_date: '2026-10-06', attendance_code: 'p' },
    ]);
    expect(r.holiday).toEqual([{ school_date: '2026-10-02', title: '', description: '7', event_type: 'holiday' }]);
  });
});
