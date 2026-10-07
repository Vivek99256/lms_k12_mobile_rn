import { configureApi, SessionContext } from '../src/api/client';
import {
  fetchCirculars,
  fetchNotifications,
  fetchStudentCalendar,
  fetchStudentDashboard,
  parseDashboard,
} from '../src/api/student';

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

describe('fetchStudentCalendar', () => {
  const rows = [
    { school_date: '2026-10-02', title: 'Gandhi Jayanti', description: 'Holiday', event_type: 'holiday' },
    { school_date: null, title: null, description: null, event_type: null }, // the all-NULL row of an enrollment with no events
  ];

  it('posts studentCalenderAPI form-encoded with the identity block and no action for the full calendar', async () => {
    fetchMock.mockReturnValue(respond(200, { status: 1, message: 'Success', data: rows }));
    const r = await fetchStudentCalendar();
    expect(sentUrl()).toBe('https://dev.triz.co.in/studentCalenderAPI');
    expect(sentInit().headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    expect(sentForm().get('student_id')).toBe('123');
    expect(sentForm().has('action')).toBe(false);
    expect(r).toHaveLength(2);
    expect(r[1]).toEqual({ school_date: '', title: '', description: '', event_type: '' }); // NULLs become empty strings; the model drops the row
  });

  it("sends action=holiday for the holiday list", async () => {
    fetchMock.mockReturnValue(respond(200, { status: 1, data: [] }));
    await fetchStudentCalendar('holiday');
    expect(sentForm().get('action')).toBe('holiday');
  });

  it('tolerates a missing or malformed data field', async () => {
    fetchMock.mockReturnValue(respond(200, { status: 1, message: 'Success' }));
    expect(await fetchStudentCalendar()).toEqual([]);
  });
});

describe('fetchNotifications', () => {
  const body = {
    status: 1,
    message: 'Success',
    data: [
      {
        ID: 9,
        NOTIFICATION_TYPE: 'Homework',
        STUDENT_ID: 123,
        Status: 'Unread',
        NOTIFICATION_DESCRIPTION: 'New homework in Maths',
        NOTIFICATION_DATE: '07-10-2026',
        image: 'https://127.0.0.1/storage/student/homework.png',
        side_image: 'https://127.0.0.1/storage/student/homework_side.png',
        color_code: '#e3cf0c',
      },
    ],
  };

  it('sends the constant mobile_no 0 (S1-D2), never a phone number, plus the identity block', async () => {
    fetchMock.mockReturnValue(respond(200, body));
    await fetchNotifications();
    expect(sentUrl()).toBe('https://dev.triz.co.in/notificationHubAPI');
    expect(sentForm().get('mobile_no')).toBe('0');
    expect(sentForm().get('student_id')).toBe('123');
    expect(sentForm().get('syear')).toBe('2026');
  });

  it('keeps only id, type, description and date: image URLs and the unexplained Status are not read (S1-D3)', async () => {
    fetchMock.mockReturnValue(respond(200, body));
    const r = await fetchNotifications();
    expect(r).toEqual([{ id: '9', type: 'Homework', description: 'New homework in Maths', date: '07-10-2026' }]);
    expect(JSON.stringify(r)).not.toContain('png');
  });

  it('maps "Parameter Missing" to a validation error', async () => {
    fetchMock.mockReturnValue(respond(200, { status: 0, message: 'Parameter Missing' }));
    await expect(fetchNotifications()).rejects.toMatchObject({ kind: 'validation', message: 'Parameter Missing' });
  });

  it('an empty list is a normal result', async () => {
    fetchMock.mockReturnValue(respond(200, { status: 1, message: 'Success', data: [] }));
    expect(await fetchNotifications()).toEqual([]);
  });
});

describe('fetchCirculars', () => {
  const body = {
    status: 1,
    message: 'Success',
    data: [{ id: 5, title: 'Sports day', message: 'Bring shoes', date_: '07-10-2026', file_name: 'https://erp.triz.co.in/storage/circular/a.pdf', circular_type: 'Circular', standard_id: 7 }],
  };

  it('posts form-encoded (the controller reads $_REQUEST) with the exact stored type names', async () => {
    fetchMock.mockReturnValue(respond(200, body));
    await fetchCirculars('Circular');
    expect(sentUrl()).toBe('https://dev.triz.co.in/circular/fetchData');
    expect(sentInit().headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    expect(sentForm().get('action')).toBe('Circular');
    fetchMock.mockClear();
    fetchMock.mockReturnValue(respond(200, body));
    await fetchCirculars('Event');
    expect(sentForm().get('action')).toBe('Event');
  });

  it('maps rows to id, title, message, date and attachment', async () => {
    fetchMock.mockReturnValue(respond(200, body));
    expect(await fetchCirculars('Circular')).toEqual([
      { id: '5', title: 'Sports day', message: 'Bring shoes', date: '07-10-2026', attachment: 'https://erp.triz.co.in/storage/circular/a.pdf' },
    ]);
  });

  it('an HTTP 500 (student with no enrollment) is a server error with status 500', async () => {
    fetchMock.mockReturnValue(respond(500, { message: 'Undefined array key 0', exception: 'ErrorException' }));
    await expect(fetchCirculars('Circular')).rejects.toMatchObject({ kind: 'server', status: 500 });
  });

  it('an HTML 500 page is also a server error', async () => {
    fetchMock.mockReturnValue(respond(500, '<html><body>Server Error</body></html>'));
    await expect(fetchCirculars('Event')).rejects.toMatchObject({ kind: 'server', status: 500 });
  });

  it('a validation failure whose message is an object does not crash', async () => {
    fetchMock.mockReturnValue(respond(200, { status: '0', message: { action: ['The action field is required.'] }, data: [] }));
    await expect(fetchCirculars('Circular')).rejects.toMatchObject({ kind: 'validation' });
  });
});

describe('fetchStudentDashboard', () => {
  const body = {
    status: '1',
    message: 'Success',
    summary: { total_subjects: 2, pending_homework: 1, pending_assignments: 0 },
    enrollment: { syear: '2026', standard_id: 7, standard_name: '7', section_id: 1, section_name: 'A' },
    my_subjects: [{ id: 3, subject_code: 'M', subject_name: 'Maths', short_name: 'M', subject_type: 'x' }],
    pending_homework: [{ id: 11, title: 'Fractions', subject_id: 3, date: '2026-10-01', submission_date: '2026-10-09' }],
    pending_assignments: [],
    recent_circulars: [{ id: 5, title: 'Sports day', date_: '2026-10-06' }],
    task_status: [{ label: 'Homework done', value: 4 }, { label: 'Homework pending', value: 1 }],
    achievements: [],
  };

  it('is a token-bound JSON call with nothing user-supplied: no student id, no legacy block', async () => {
    fetchMock.mockReturnValue(respond(200, body));
    await fetchStudentDashboard();
    expect(sentUrl()).toContain('https://dev.triz.co.in/api/student-dashboard/summary');
    expect(sentInit().method).toBe('POST');
    expect(sentInit().headers.Authorization).toBe('Bearer jwt-student');
    const sent = JSON.parse(sentInit().body);
    expect('student_id' in sent).toBe(false);
    expect('user_id' in sent).toBe(false);
  });

  it('reads the top-level payload (the response has no data key)', async () => {
    fetchMock.mockReturnValue(respond(200, body));
    const d = await fetchStudentDashboard();
    expect(d.summary).toEqual({ totalSubjects: 2, pendingHomework: 1, pendingAssignments: 0 });
    expect(d.enrollment).toEqual({ syear: '2026', standardName: '7', sectionName: 'A' });
    expect(d.pendingHomework).toEqual([{ id: '11', title: 'Fractions', subjectId: '3', date: '2026-10-01', dueDate: '2026-10-09' }]);
    expect(d.circulars).toEqual([{ id: '5', title: 'Sports day', date: '2026-10-06' }]);
    expect(d.subjects).toEqual([{ id: '3', name: 'Maths' }]);
    expect(d.tasks).toHaveLength(2);
  });

  it('maps the failures seen on the local server: 403 non-student, 422 year expired, 401 bad token payload', async () => {
    fetchMock.mockReturnValueOnce(respond(403, { status: '0', message: 'This dashboard is available to students only.' }));
    await expect(fetchStudentDashboard()).rejects.toMatchObject({ kind: 'forbidden', message: 'This dashboard is available to students only.' });
    fetchMock.mockReturnValueOnce(respond(422, { success: false, message: 'Academic Term Date Expired', data: null, errors: null }));
    await expect(fetchStudentDashboard()).rejects.toMatchObject({ kind: 'validation', message: 'Academic Term Date Expired' });
    fetchMock.mockReturnValueOnce(respond(401, { success: false, message: 'Invalid token payload', data: null, errors: null }));
    await expect(fetchStudentDashboard()).rejects.toMatchObject({ kind: 'unauthorized' });
  });
});

describe('parseDashboard', () => {
  it('reads the empty-student shape verified on the local server (enrollment null)', () => {
    const d = parseDashboard({
      status: '1',
      message: 'Success',
      summary: { total_subjects: 0, pending_homework: 0, pending_assignments: 0 },
      enrollment: null,
      my_subjects: [],
      pending_homework: [],
      pending_assignments: [],
      recent_circulars: [],
      task_status: [{ label: 'Homework done', value: 0 }],
      achievements: [],
    });
    expect(d.enrollment).toBeNull();
    expect(d.summary).toEqual({ totalSubjects: 0, pendingHomework: 0, pendingAssignments: 0 });
  });

  it('tolerates missing sections, wrong types and negative or non-numeric counts', () => {
    for (const bad of [undefined, null, 5, 'x', [], {}]) {
      const d = parseDashboard(bad);
      expect(d.enrollment).toBeNull();
      expect(d.summary).toEqual({ totalSubjects: 0, pendingHomework: 0, pendingAssignments: 0 });
      expect([d.subjects, d.pendingHomework, d.pendingAssignments, d.circulars, d.tasks]).toEqual([[], [], [], [], []]);
    }
    const d = parseDashboard({ summary: { total_subjects: '3', pending_homework: -2, pending_assignments: 'x' }, task_status: [{ label: 'A', value: 'zz' }, null, 5] });
    expect(d.summary).toEqual({ totalSubjects: 3, pendingHomework: 0, pendingAssignments: 0 });
    expect(d.tasks).toEqual([{ label: 'A', value: 0 }]);
  });

  it('does not read achievements (always empty on the server)', () => {
    expect(JSON.stringify(parseDashboard({ achievements: [{ x: 1 }] }))).not.toContain('achievement');
  });
});
