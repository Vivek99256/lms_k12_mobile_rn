import { configureApi, SessionContext } from '../src/api/client';
import { fetchDiscussion, fetchMyDiscussions, isDiscussionId } from '../src/api/student';

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

const urlOf = (i = 0) => new URL(String(fetchMock.mock.calls[i][0]));
const initOf = (i = 0) => fetchMock.mock.calls[i][1];

const item = (id: number, over: Record<string, unknown> = {}) => ({
  id,
  title: `T${id}`,
  description: `D${id}`,
  visibility: 'private',
  subject_id: 5,
  chapter_id: 6,
  topic_id: 7,
  attachment_url: null,
  created_at: '2026-03-01 10:00:00',
  total_days: 2,
  comment_count: 1,
  author: { user_id: 123, name: 'Me', type: 'student', class: '7/A', avatar_url: 'https://x/a.jpg' },
  ...over,
});
const page = (data: unknown[], current: number, last: number) => ({ success: true, message: 'ok', data, errors: null, meta: { current_page: current, per_page: 50, total: data.length, last_page: last } });

describe('fetchMyDiscussions - always mine=1, token-bound, GET only', () => {
  it('requests the modern GET with mine=1, per_page=50, page=1 and no student id', async () => {
    fetchMock.mockReturnValue(respond(200, page([], 1, 1)));
    await fetchMyDiscussions();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const u = urlOf();
    expect(u.pathname).toBe('/api/lms/social-collaborative');
    expect(u.searchParams.get('mine')).toBe('1');
    expect(u.searchParams.get('per_page')).toBe('50');
    expect(u.searchParams.get('page')).toBe('1');
    expect(initOf().method).toBe('GET');
    expect(initOf().body).toBeUndefined();
    expect(u.searchParams.has('student_id')).toBe(false);
    expect(u.searchParams.has('user_id')).toBe(false);
  });

  it('the token travels in the Authorization header only - never in the URL', async () => {
    fetchMock.mockReturnValue(respond(200, page([], 1, 1)));
    await fetchMyDiscussions();
    expect(initOf().headers.Authorization).toBe('Bearer jwt-student');
    expect(String(fetchMock.mock.calls[0][0])).not.toContain('jwt-student');
    expect(urlOf().searchParams.has('token')).toBe(false);
  });

  it('EVERY page request carries mine=1; it follows meta.last_page and stops there', async () => {
    fetchMock
      .mockReturnValueOnce(respond(200, page([item(1)], 1, 3)))
      .mockReturnValueOnce(respond(200, page([item(2)], 2, 3)))
      .mockReturnValueOnce(respond(200, page([item(3)], 3, 3)));
    const out = await fetchMyDiscussions();
    expect(out.map((d) => d.id)).toEqual(['1', '2', '3']);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    for (let i = 0; i < 3; i++) {
      expect(urlOf(i).searchParams.get('mine')).toBe('1');
      expect(urlOf(i).searchParams.get('page')).toBe(String(i + 1));
    }
  });

  it('is capped at 10 pages even if the server claims more', async () => {
    fetchMock.mockImplementation(() => respond(200, page([item(1)], 1, 999)));
    await fetchMyDiscussions();
    expect(fetchMock).toHaveBeenCalledTimes(10);
    fetchMock.mock.calls.forEach((_c, i) => expect(urlOf(i).searchParams.get('mine')).toBe('1'));
  });

  it('a missing or unreadable meta stops after the first page', async () => {
    fetchMock.mockReturnValue(respond(200, { success: true, data: [item(1)] }));
    expect(await fetchMyDiscussions()).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('takes no parameters: the broad feed cannot be requested through it', async () => {
    expect(fetchMyDiscussions.length).toBe(0);
    fetchMock.mockReturnValue(respond(200, page([], 1, 1)));
    await (fetchMyDiscussions as unknown as (x: unknown) => Promise<unknown>)({ mine: 0, visibility: 'public', search: 'x' });
    const u = urlOf();
    expect(u.searchParams.get('mine')).toBe('1');
    expect(u.searchParams.has('visibility')).toBe(false);
    expect(u.searchParams.has('search')).toBe(false);
  });

  it('maps the fields as text and keeps the author id; the server\'s class and avatar are not read', async () => {
    fetchMock.mockReturnValue(respond(200, page([item(9, { attachment_url: 'https://cdn.example/a.pdf', comment_count: '4' })], 1, 1)));
    const [d] = await fetchMyDiscussions();
    expect(d).toEqual({ id: '9', title: 'T9', description: 'D9', visibility: 'private', attachment: 'https://cdn.example/a.pdf', createdAt: '2026-03-01 10:00:00', commentCount: 4, authorId: '123' });
    expect(JSON.stringify(d)).not.toMatch(/7\/A|avatar/);
  });

  it('nulls become empty; non-list data is an empty list; junk rows are skipped', async () => {
    fetchMock.mockReturnValue(respond(200, page([{ id: null, title: null, author: null }, null, 3, 'x'] as unknown[], 1, 1)));
    expect(await fetchMyDiscussions()).toEqual([{ id: '', title: '', description: '', visibility: '', attachment: '', createdAt: '', commentCount: 0, authorId: '' }]);
    for (const data of [undefined, null, {}, 'x', 5]) {
      fetchMock.mockReturnValue(respond(200, { success: true, message: 'ok', data }));
      expect(await fetchMyDiscussions()).toEqual([]);
    }
  });

  it('401 is unauthorized (sign-out hook fires); 422 year-expired and 500/419/network are errors', async () => {
    fetchMock.mockReturnValue(respond(401, { success: false, message: 'JWT token is required.' }));
    await expect(fetchMyDiscussions()).rejects.toMatchObject({ kind: 'unauthorized', status: 401 });
    expect(onUnauthorized).toHaveBeenCalled();
    fetchMock.mockReturnValue(respond(422, { success: false, message: 'Academic Term Date Expired' }));
    await expect(fetchMyDiscussions()).rejects.toMatchObject({ kind: 'validation', status: 422, message: 'Academic Term Date Expired' });
    fetchMock.mockReturnValue(respond(500, '<html>Server Error</html>'));
    await expect(fetchMyDiscussions()).rejects.toMatchObject({ kind: 'server', status: 500 });
    fetchMock.mockReturnValue(respond(419, '<html>Page Expired</html>'));
    await expect(fetchMyDiscussions()).rejects.toMatchObject({ kind: 'server', status: 419 });
    fetchMock.mockReturnValue(Promise.reject(new TypeError('Network request failed')));
    await expect(fetchMyDiscussions()).rejects.toMatchObject({ kind: 'network' });
  });
});

describe('fetchDiscussion', () => {
  const detail = { ...item(7), comments: [{ id: 2, doubt_id: 7, message: 'M2', created_at: '2026-03-02 10:00:00', author: { user_id: 55, name: 'Mrs Shah', type: 'user', class: null, avatar_url: 'https://x/u.jpg' } }, { id: 1, doubt_id: 7, message: 'M1', created_at: '2026-03-01 11:00:00', author: { user_id: 123, name: 'Me' } }] };

  it('GETs the discussion by a validated id with the token in the header only', async () => {
    fetchMock.mockReturnValue(respond(200, { success: true, message: 'ok', data: detail }));
    await fetchDiscussion('7');
    expect(urlOf().pathname).toBe('/api/lms/social-collaborative/7');
    expect(initOf().method).toBe('GET');
    expect(initOf().headers.Authorization).toBe('Bearer jwt-student');
    expect(urlOf().searchParams.has('token')).toBe(false);
    expect(urlOf().searchParams.has('student_id')).toBe(false);
  });

  it('maps the conversation: message text, time, display name and author id only', async () => {
    fetchMock.mockReturnValue(respond(200, { success: true, message: 'ok', data: detail }));
    const out = await fetchDiscussion('7');
    expect(out.authorId).toBe('123');
    expect(out.comments).toEqual([
      { id: '2', message: 'M2', createdAt: '2026-03-02 10:00:00', authorId: '55', authorName: 'Mrs Shah' },
      { id: '1', message: 'M1', createdAt: '2026-03-01 11:00:00', authorId: '123', authorName: 'Me' },
    ]);
    expect(JSON.stringify(out)).not.toMatch(/avatar|u\.jpg|"class"/);
  });

  it('an unusable id is refused before any request is made', async () => {
    for (const bad of ['', 'abc', '../1', '1/2', '%2e%2e', '12;', "1 OR 1=1", "'", '1.5', '-1', '9999999999999']) {
      await expect(fetchDiscussion(bad)).rejects.toMatchObject({ kind: 'validation' });
    }
    expect(fetchMock).not.toHaveBeenCalled();
    expect(isDiscussionId('7')).toBe(true);
    expect(isDiscussionId('007')).toBe(true);
  });

  it('404 "This discussion is not available." and 401 surface as errors', async () => {
    fetchMock.mockReturnValue(respond(404, { success: false, message: 'This discussion is not available.' }));
    await expect(fetchDiscussion('7')).rejects.toMatchObject({ kind: 'server', status: 404, message: 'This discussion is not available.' });
    fetchMock.mockReturnValue(respond(401, { success: false, message: 'JWT token is required.' }));
    await expect(fetchDiscussion('7')).rejects.toMatchObject({ kind: 'unauthorized' });
  });

  it('missing comments or data -> no messages, never a crash', async () => {
    fetchMock.mockReturnValue(respond(200, { success: true, message: 'ok', data: item(7) }));
    expect((await fetchDiscussion('7')).comments).toEqual([]);
    fetchMock.mockReturnValue(respond(200, { success: true, message: 'ok', data: null }));
    expect((await fetchDiscussion('7')).comments).toEqual([]);
  });
});

describe('what S8 can never request', () => {
  it('no write, Learn-content, legacy LMS or broad-feed URL is ever requested by the S8a fetchers', async () => {
    fetchMock.mockImplementation(() => respond(200, page([item(1)], 1, 2)));
    await fetchMyDiscussions();
    fetchMock.mockImplementation(() => respond(200, { success: true, data: { ...item(1), comments: [] } }));
    await fetchDiscussion('1');
    for (const c of fetchMock.mock.calls) {
      expect(c[1].method).toBe('GET');
      const u = String(c[0]);
      for (const bad of ['studentContentAPI', 'studentSubjectAPI', 'studentSocialCollabrativeAPI', 'studentVirtualClassroomAPI', 'studentPortfolioAPI', 'studentLeaderBoardAPI', 'studentQuestionPaper', 'studentAssessment', '/comments', 'lms-chapter', 'lms-courses', 'leaderboard']) {
        expect(u).not.toContain(bad);
      }
    }
  });
});
