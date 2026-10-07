import { configureApi, SessionContext } from '../src/api/client';
import { fetchHomeworkDetail, fetchHomeworkList, isHomeworkId, parseHomeworkDetail, parseHomeworkList } from '../src/api/student';

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

/** The path, without the query string F1 adds (type, sub_institute_id, syear) to every non-legacy call. */
const sentUrl = () => (fetchMock.mock.calls[0][0] as string).split('?')[0];
const sentInit = () => fetchMock.mock.calls[0][1];
const sentBody = () => JSON.parse(sentInit().body);

const listBody = {
  status_code: 1,
  message: 'SUCCESS',
  data: [
    {
      id: 12,
      title: 'Fractions',
      subject_id: 3,
      subject_name: 'Maths',
      date: '2026-10-01',
      date_fmt: '01-10-2026',
      submission_date: '2026-10-12',
      submission_date_fmt: '12-10-2026',
      reference_file_url: 'http://x/storage/student/a.pdf',
      source_type: 'attachment',
      status: 'Submitted',
      submission_files: [{ id: '12_0', file_url: 'http://x/f.pdf', original_name: 'f.pdf' }],
      submission_remarks: 'done',
      teacher_remarks: null,
      ai_status: 'Evaluated',
      ai_score: 8,
      feedback_published: false,
    },
    { id: 13, title: 'Cells', subject_name: null, date: null, date_fmt: '02-10-2026', submission_date: null, submission_date_fmt: null, status: null, submission_files: [], ai_status: null },
  ],
};

describe('fetchHomeworkList', () => {
  it('is a token-bound JSON call: no student id, no legacy block, no legacy endpoint', async () => {
    fetchMock.mockReturnValue(respond(200, listBody));
    await fetchHomeworkList();
    expect(sentUrl()).toBe('https://dev.triz.co.in/api/lms-homework/my-submissions');
    expect(sentUrl()).not.toContain('studentHomeworkAssignmentAPI');
    expect(sentInit().method).toBe('POST');
    expect(sentInit().headers['Content-Type']).toBe('application/json');
    expect(sentInit().headers.Authorization).toBe('Bearer jwt-student');
    const body = sentBody();
    for (const k of ['student_id', 'user_id', 'teacher_id', 'admin_id', 'user_profile_id', 'action']) expect(k in body).toBe(false);
    expect(body).toMatchObject({ type: 'API', sub_institute_id: '7', syear: '2026' });
  });

  it('maps rows, falling back to the DD-MM-YYYY copies and turning nulls into empty text / null status', async () => {
    fetchMock.mockReturnValue(respond(200, listBody));
    expect(await fetchHomeworkList()).toEqual([
      { id: '12', title: 'Fractions', subject: 'Maths', date: '2026-10-01', dueDate: '2026-10-12', status: 'Submitted', fileCount: 1, aiStatus: 'Evaluated' },
      { id: '13', title: 'Cells', subject: '', date: '02-10-2026', dueDate: '', status: null, fileCount: 0, aiStatus: '' },
    ]);
  });

  it('does not carry teacher remarks, AI scores or file URLs into the list rows', async () => {
    fetchMock.mockReturnValue(respond(200, listBody));
    const row = (await fetchHomeworkList())[0];
    expect(Object.keys(row).sort()).toEqual(['aiStatus', 'date', 'dueDate', 'fileCount', 'id', 'status', 'subject', 'title']);
  });

  it('an empty list is a normal result; a missing or malformed data field gives an empty list', async () => {
    fetchMock.mockReturnValue(respond(200, { status_code: 1, message: 'SUCCESS', data: [] }));
    expect(await fetchHomeworkList()).toEqual([]);
    fetchMock.mockReturnValue(respond(200, { status_code: 1, message: 'SUCCESS' }));
    expect(await fetchHomeworkList()).toEqual([]);
    fetchMock.mockReturnValue(respond(200, { status_code: 1, data: 'oops' }));
    expect(await fetchHomeworkList()).toEqual([]);
  });

  it('treats an empty-string status as not submitted and keeps only object rows', () => {
    expect(parseHomeworkList([null, 4, 'x', { id: 1, status: '' }, { id: 2, status: '  ' }])).toEqual([
      expect.objectContaining({ id: '1', status: null }),
      expect.objectContaining({ id: '2', status: null }),
    ]);
  });

  it('maps the failures: 401 authentication, 422 year expired, 419, HTTP 500, an HTML page', async () => {
    fetchMock.mockReturnValueOnce(respond(401, { success: false, message: 'Authentication required', data: null, errors: null }));
    await expect(fetchHomeworkList()).rejects.toMatchObject({ kind: 'unauthorized', message: 'Authentication required' });
    fetchMock.mockReturnValueOnce(respond(422, { success: false, message: 'Academic Term Date Expired', data: null, errors: null }));
    await expect(fetchHomeworkList()).rejects.toMatchObject({ kind: 'validation', message: 'Academic Term Date Expired' });
    fetchMock.mockReturnValueOnce(respond(419, '<html>Page Expired</html>'));
    await expect(fetchHomeworkList()).rejects.toMatchObject({ kind: 'server', status: 419 });
    fetchMock.mockReturnValueOnce(respond(500, { message: 'boom' }));
    await expect(fetchHomeworkList()).rejects.toMatchObject({ kind: 'server', status: 500 });
    fetchMock.mockReturnValueOnce(respond(200, '<br /><b>Warning</b>'));
    await expect(fetchHomeworkList()).rejects.toMatchObject({ kind: 'server' });
  });
});

describe('isHomeworkId', () => {
  it('accepts only plain digits, so an id can never alter the URL path', () => {
    for (const ok of ['1', '12', '999999999', '000123']) expect(isHomeworkId(ok)).toBe(true);
    for (const bad of ['', 'abc', '1/2', '12;', '../1', '1 ', ' 1', '-1', '1.5', '1?x=1', '%2e%2e', '1234567890123', 'ⅷ']) expect(isHomeworkId(bad)).toBe(false);
  });
});

describe('fetchHomeworkDetail', () => {
  const detailBody = {
    status_code: 1,
    message: 'SUCCESS',
    data: {
      homework: {
        id: 12,
        title: 'Fractions',
        description: 'Do page 4',
        subject_name: 'Maths',
        standard_name: '7',
        division_name: 'A',
        date: '2026-10-01',
        submission_date: '2026-10-12',
        teacher_name: 'Mrs Shah',
        reference_file_url: 'http://x/storage/student/a.pdf',
        sourceType: 'question_bank',
        questions: [{ id: 5, question_title: '<p>2+2?</p>', description: '', question_type_id: 1, points: '2' }],
      },
      submissions: [
        {
          status: 'Reviewed',
          submission_remarks: 'my note',
          teacher_remarks: 'Good',
          ai_status: 'Evaluated',
          ai_score: 8,
          ai_total_questions: 10,
          ai_percentage: 80,
          feedback_published: true,
          submitted_at: '2026-10-08',
          files: [{ id: '12_0', file_url: 'http://x/f.pdf', original_name: 'f.pdf', file_size: 100 }],
        },
      ],
    },
  };

  it('posts to the id in the path with only the session fields in the body', async () => {
    fetchMock.mockReturnValue(respond(200, detailBody));
    await fetchHomeworkDetail('12');
    expect(sentUrl()).toBe('https://dev.triz.co.in/api/lms-homework/detail/12');
    expect(sentInit().method).toBe('POST');
    expect(sentInit().headers.Authorization).toBe('Bearer jwt-student');
    const body = sentBody();
    expect('student_id' in body).toBe(false);
    expect(body).toMatchObject({ type: 'API', sub_institute_id: '7' });
  });

  it('refuses an invalid id before any request is made', async () => {
    for (const bad of ['abc', '1/2', '', '12;', '../1']) {
      await expect(fetchHomeworkDetail(bad)).rejects.toMatchObject({ kind: 'validation' });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps the homework and its single submission', async () => {
    fetchMock.mockReturnValue(respond(200, detailBody));
    const d = await fetchHomeworkDetail('12');
    expect(d).toMatchObject({ id: '12', title: 'Fractions', description: 'Do page 4', subject: 'Maths', standard: '7', division: 'A', teacher: 'Mrs Shah', dueDate: '2026-10-12', referenceUrl: 'http://x/storage/student/a.pdf' });
    expect(d.questions).toEqual([{ id: '5', title: '<p>2+2?</p>', description: '', points: 2 }]);
    expect(d.submission).toEqual({
      status: 'Reviewed',
      submittedAt: '2026-10-08',
      remarks: 'my note',
      teacherRemarks: 'Good',
      aiStatus: 'Evaluated',
      aiScore: 8,
      aiTotal: 10,
      aiPercentage: 80,
      feedbackPublished: true,
      files: [{ id: '12_0', name: 'f.pdf', url: 'http://x/f.pdf' }],
    });
  });

  it('submission is null when the student has not submitted; feedback_published accepts 1 / "1" / true only', async () => {
    fetchMock.mockReturnValue(respond(200, { status_code: 1, data: { homework: { id: 12 }, submissions: [] } }));
    expect((await fetchHomeworkDetail('12')).submission).toBeNull();
    for (const [raw, expected] of [[1, true], ['1', true], [true, true], [0, false], ['0', false], [null, false], ['yes', false]] as const) {
      const d = parseHomeworkDetail({ homework: { id: 1 }, submissions: [{ status: 'Reviewed', feedback_published: raw }] });
      expect(d.submission?.feedbackPublished).toBe(expected);
    }
  });

  it('is tolerant of missing sections and wrong types', () => {
    for (const bad of [undefined, null, 5, 'x', [], {}]) {
      const d = parseHomeworkDetail(bad);
      expect(d.submission).toBeNull();
      expect(d.questions).toEqual([]);
      expect(d.title).toBe('');
    }
    const d = parseHomeworkDetail({ homework: { questions: [null, 5, { id: 1, points: 'abc' }, { id: 2, points: null }] }, submissions: [null, 'x'] });
    expect(d.questions.map((q) => q.points)).toEqual([null, null]);
    expect(d.submission).toBeNull();
  });

  it('maps the failures: 404 homework not found, 403 not yours, 401, 422', async () => {
    fetchMock.mockReturnValueOnce(respond(404, { status_code: 0, message: 'Homework not found' }));
    await expect(fetchHomeworkDetail('99')).rejects.toMatchObject({ kind: 'server', status: 404, message: 'Homework not found' });
    fetchMock.mockReturnValueOnce(respond(403, { status_code: 0, message: 'You are not allowed to view this homework.' }));
    await expect(fetchHomeworkDetail('99')).rejects.toMatchObject({ kind: 'forbidden', message: 'You are not allowed to view this homework.' });
    fetchMock.mockReturnValueOnce(respond(401, { success: false, message: 'Authentication required', data: null, errors: null }));
    await expect(fetchHomeworkDetail('99')).rejects.toMatchObject({ kind: 'unauthorized' });
    fetchMock.mockReturnValueOnce(respond(422, { success: false, message: 'Academic Term Date Expired', data: null, errors: null }));
    await expect(fetchHomeworkDetail('99')).rejects.toMatchObject({ kind: 'validation' });
  });
});
