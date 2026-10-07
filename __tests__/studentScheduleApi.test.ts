import { configureApi, SessionContext } from '../src/api/client';
import { fetchExamSchedule, fetchTimetable } from '../src/api/student';

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

const sentForm = () => new URLSearchParams(fetchMock.mock.calls[0][1].body);
const sentUrl = () => fetchMock.mock.calls[0][0] as string;
const sentInit = () => fetchMock.mock.calls[0][1];
/** Exactly the legacy identity block F1 builds, and nothing else. */
const IDENTITY_KEYS = ['admin_id', 'student_id', 'sub_institute_id', 'syear', 'teacher_id', 'token', 'type', 'user_id', 'user_profile_id', 'user_profile_name'];

describe('fetchTimetable', () => {
  const body = {
    status: 1,
    message: 'Success',
    data: [
      { week_day: 'Mon', standard_name: '7', subject_name: 'Maths', teacher_name: 'Mrs Shah', period_name: 'Period 1', start_time: '09:00:00', end_time: '09:45:00', studentbatch: null, batch_name: null, batch_id: null, period_id: 1 },
      { week_day: null, standard_name: '7', subject_name: 'Sanskrit,French', teacher_name: 'Mr A,Mrs B', period_name: null, start_time: null, end_time: null, studentbatch: '2', batch_name: 'B1', batch_id: 2, period_id: null },
    ],
  };

  it('posts studentTimetableAPI form-encoded with the session identity and nothing else', async () => {
    fetchMock.mockReturnValue(respond(200, body));
    await fetchTimetable();
    expect(sentUrl()).toBe('https://dev.triz.co.in/studentTimetableAPI');
    expect(sentInit().method).toBe('POST');
    expect(sentInit().headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    expect(sentInit().headers.Authorization).toBe('Bearer jwt-student');
    expect([...sentForm().keys()].sort()).toEqual(IDENTITY_KEYS);
    expect(sentForm().get('student_id')).toBe('123');
    expect(sentForm().get('syear')).toBe('2026');
  });

  it('maps the fields, turning null into empty text and keeping GROUP_CONCAT text untouched', async () => {
    fetchMock.mockReturnValue(respond(200, body));
    expect(await fetchTimetable()).toEqual([
      { weekDay: 'Mon', periodId: '1', periodName: 'Period 1', startTime: '09:00:00', endTime: '09:45:00', subject: 'Maths', teacher: 'Mrs Shah' },
      { weekDay: '', periodId: '', periodName: '', startTime: '', endTime: '', subject: 'Sanskrit,French', teacher: 'Mr A,Mrs B' },
    ]);
  });

  it('an empty list is a normal result; a missing or malformed data field gives an empty list', async () => {
    fetchMock.mockReturnValue(respond(200, { status: 1, message: 'Success', data: [] }));
    expect(await fetchTimetable()).toEqual([]);
    fetchMock.mockReturnValue(respond(200, { status: 1, message: 'Success' }));
    expect(await fetchTimetable()).toEqual([]);
    fetchMock.mockReturnValue(respond(200, { status: 1, data: 'oops' }));
    expect(await fetchTimetable()).toEqual([]);
  });

  it('keeps only object rows', async () => {
    fetchMock.mockReturnValue(respond(200, { status: 1, data: [null, 5, 'x', { week_day: 'Tue', subject_name: 'Art' }] }));
    const r = await fetchTimetable();
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ weekDay: 'Tue', subject: 'Art' });
  });

  it('accepts JSON served as text/html', async () => {
    fetchMock.mockReturnValue(respond(200, JSON.stringify(body)));
    expect(await fetchTimetable()).toHaveLength(2);
  });

  it('maps the failures: "Parameter Missing", 401, 419, HTTP 500, an HTML page', async () => {
    fetchMock.mockReturnValueOnce(respond(200, { status: 0, message: 'Parameter Missing' }));
    await expect(fetchTimetable()).rejects.toMatchObject({ kind: 'validation', message: 'Parameter Missing' });
    fetchMock.mockReturnValueOnce(respond(401, { status: '2', message: 'Token Auth Failed', data: [] }));
    await expect(fetchTimetable()).rejects.toMatchObject({ kind: 'unauthorized' });
    fetchMock.mockReturnValueOnce(respond(419, '<html>Page Expired</html>'));
    await expect(fetchTimetable()).rejects.toMatchObject({ kind: 'server', status: 419 });
    fetchMock.mockReturnValueOnce(respond(500, { message: 'boom' }));
    await expect(fetchTimetable()).rejects.toMatchObject({ kind: 'server', status: 500 });
    fetchMock.mockReturnValueOnce(respond(200, '<br /><b>Warning</b>'));
    await expect(fetchTimetable()).rejects.toMatchObject({ kind: 'server' });
  });
});

describe('fetchExamSchedule', () => {
  const body = {
    status: 1,
    message: 'Success',
    data: [
      { title: 'Midterm', date_: '2026-10-20', file_name: 'https://erp.triz.co.in/storage/exam_schedule/mid.pdf' },
      { title: 'Quiz', date_: '2026-09-15', file_name: '' },
    ],
  };

  it('posts studentExamScheduleAPI form-encoded with the session identity and nothing else', async () => {
    fetchMock.mockReturnValue(respond(200, body));
    await fetchExamSchedule();
    expect(sentUrl()).toBe('https://dev.triz.co.in/studentExamScheduleAPI');
    expect(sentInit().headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    expect([...sentForm().keys()].sort()).toEqual(IDENTITY_KEYS);
    expect(sentForm().get('student_id')).toBe('123');
  });

  it('maps title, date and file; null fields become empty text', async () => {
    fetchMock.mockReturnValue(respond(200, { status: 1, data: [...body.data, { title: null, date_: null, file_name: null }] }));
    expect(await fetchExamSchedule()).toEqual([
      { title: 'Midterm', date: '2026-10-20', file: 'https://erp.triz.co.in/storage/exam_schedule/mid.pdf' },
      { title: 'Quiz', date: '2026-09-15', file: '' },
      { title: '', date: '', file: '' },
    ]);
  });

  it('empty and malformed data give an empty list', async () => {
    fetchMock.mockReturnValue(respond(200, { status: 1, message: 'Success', data: [] }));
    expect(await fetchExamSchedule()).toEqual([]);
    fetchMock.mockReturnValue(respond(200, { status: 1 }));
    expect(await fetchExamSchedule()).toEqual([]);
  });

  it('maps the failures: "Parameter Missing", 401, 419, HTTP 500', async () => {
    fetchMock.mockReturnValueOnce(respond(200, { status: 0, message: 'Parameter Missing' }));
    await expect(fetchExamSchedule()).rejects.toMatchObject({ kind: 'validation' });
    fetchMock.mockReturnValueOnce(respond(401, { status: '2', message: 'JWT token is required.', data: [] }));
    await expect(fetchExamSchedule()).rejects.toMatchObject({ kind: 'unauthorized' });
    fetchMock.mockReturnValueOnce(respond(419, ''));
    await expect(fetchExamSchedule()).rejects.toMatchObject({ status: 419 });
    fetchMock.mockReturnValueOnce(respond(500, '<html>Server Error</html>'));
    await expect(fetchExamSchedule()).rejects.toMatchObject({ kind: 'server', status: 500 });
  });
});
