import { Discussion, DiscussionDetail } from '../src/api/student';
import { discussionLink, ownDiscussionRows, threadView } from '../src/screens/student/discussionModel';

jest.mock('../src/config/env', () => ({ env: { apiBaseUrl: 'https://dev.triz.co.in', appEnv: 'test', erpHosts: [] } }));

const ME = 123;
const d = (id: string, over: Partial<Discussion> = {}): Discussion => ({
  id,
  title: `Title ${id}`,
  description: `Text ${id}`,
  visibility: 'private',
  attachment: '',
  createdAt: '2026-03-01 10:00:00',
  commentCount: 0,
  authorId: String(ME),
  ...over,
});

describe('ownDiscussionRows - only the student\'s own discussions are ever shown', () => {
  it('drops everything not authored by the signed-in student (public feed rows, classmates, unknown authors)', () => {
    const rows = ownDiscussionRows(
      [d('1'), d('2', { authorId: '999', visibility: 'public' }), d('3', { authorId: '' }), d('4', { authorId: '1230' }), d('5', { authorId: ' 123 ' })],
      ME,
    );
    expect(rows.map((r) => r.id).sort()).toEqual(['1', '5']);
  });

  it('accepts the user id as a number or a string', () => {
    expect(ownDiscussionRows([d('1')], '123')).toHaveLength(1);
    expect(ownDiscussionRows([d('1')], 123)).toHaveLength(1);
    expect(ownDiscussionRows([d('1')], 124)).toHaveLength(0);
  });

  it('newest first by creation time, ties by higher id, undated last; input not mutated; nothing else dropped', () => {
    const input = [d('1', { createdAt: '2026-01-01 09:00:00' }), d('2', { createdAt: '2026-03-01 09:00:00' }), d('3', { createdAt: '' }), d('4', { createdAt: '2026-03-01 09:00:00' }), d('5', { createdAt: '2026-02-01 09:00:00' })];
    const copy = JSON.stringify(input);
    expect(ownDiscussionRows(input, ME).map((r) => r.id)).toEqual(['4', '2', '5', '1', '3']);
    expect(JSON.stringify(input)).toBe(copy);
  });

  it('title falls back; the description is plain text; visibility words; reply count; date', () => {
    const [r] = ownDiscussionRows([d('1', { title: ' ', description: '<p>Hello <b>there</b></p><script>alert(1)</script>', visibility: 'public', commentCount: 3 })], ME);
    expect(r).toMatchObject({ title: 'Discussion', text: 'Hello there', visibility: 'Shared with everyone', replies: 3, date: '1 Mar 2026' });
    expect(ownDiscussionRows([d('1', { visibility: 'private' })], ME)[0].visibility).toBe('Private');
    expect(ownDiscussionRows([d('1', { visibility: 'class' })], ME)[0].visibility).toBe('class');
    expect(ownDiscussionRows([d('1', { visibility: '' })], ME)[0].visibility).toBe('');
  });

  it('rows carry no author information at all', () => {
    const [r] = ownDiscussionRows([d('1')], ME);
    expect(Object.keys(r).sort()).toEqual(['attachment', 'date', 'id', 'replies', 'text', 'title', 'visibility']);
  });

  it('no discussions -> no rows', () => expect(ownDiscussionRows([], ME)).toEqual([]));
});

describe('discussionLink - attachments', () => {
  it('none for empty / blank', () => {
    expect(discussionLink('')).toEqual({ state: 'none', url: null });
    expect(discussionLink('  ')).toEqual({ state: 'none', url: null });
  });
  it('an ERP-hosted file is re-based onto the API host', () => {
    expect(discussionLink('https://erp.triz.co.in/storage/lms_doubts/a.pdf')).toEqual({ state: 'ready', url: 'https://dev.triz.co.in/storage/lms_doubts/a.pdf' });
  });
  it('a plain https content-CDN link is accepted as is', () => {
    expect(discussionLink('https://school.sgp1.digitaloceanspaces.com/public/lms_doubts/a.pdf')).toEqual({ state: 'ready', url: 'https://school.sgp1.digitaloceanspaces.com/public/lms_doubts/a.pdf' });
  });
  it.each([
    'https://user:pw@evil.example/a.pdf',
    'https://erp.triz.co.in@evil.example/a.pdf',
    'javascript:alert(1)',
    'file:///etc/passwd',
    'intent://x',
    'tel:123',
    'ftp://erp.triz.co.in/a.pdf',
    'a.pdf',
    '/storage/lms_doubts/a.pdf',
  ])('unsafe %p -> unsafe, no url', (bad) => expect(discussionLink(bad)).toEqual({ state: 'unsafe', url: null }));
});

describe('threadView - the conversation on the student\'s own discussion', () => {
  const detail = (over: Partial<DiscussionDetail> = {}): DiscussionDetail => ({
    ...d('7'),
    comments: [
      { id: '3', message: 'Later reply', createdAt: '2026-03-03 10:00:00', authorId: '55', authorName: 'Mrs Shah' },
      { id: '1', message: 'First reply', createdAt: '2026-03-01 12:00:00', authorId: String(ME), authorName: 'Me Myself' },
      { id: '2', message: '<p>Second <i>reply</i></p>', createdAt: '2026-03-02 09:00:00', authorId: '77', authorName: '' },
    ],
    ...over,
  });

  it('is not available when the discussion is not the student\'s own - public or another student\'s content is never rendered', () => {
    expect(threadView(detail({ authorId: '999', visibility: 'public' }), ME)).toBeNull();
    expect(threadView(detail({ authorId: '' }), ME)).toBeNull();
  });

  it('messages oldest first; the student is "You"; others by display name; missing name -> "Unknown"; plain text', () => {
    const v = threadView(detail(), ME)!;
    expect(v.messages.map((m) => `${m.author}|${m.text}`)).toEqual(['You|First reply', 'Unknown|Second reply', 'Mrs Shah|Later reply']);
    expect(v.messages.map((m) => m.mine)).toEqual([true, false, false]);
    expect(v.title).toBe('Title 7');
    expect(v.text).toBe('Text 7');
  });

  it('shows no class, avatar or id of any author', () => {
    const raw = { ...detail().comments[0], author: { user_id: 55, name: 'Mrs Shah', class: '7/A', avatar_url: 'https://x/y.jpg' } };
    const v = threadView(detail({ comments: [raw as never] }), ME)!;
    expect(JSON.stringify(v)).not.toMatch(/7\/A|avatar|y\.jpg|"55"/);
    expect(Object.keys(v.messages[0]).sort()).toEqual(['author', 'date', 'key', 'mine', 'text']);
  });

  it('no replies -> an empty message list; undated messages go last; input not mutated', () => {
    expect(threadView(detail({ comments: [] }), ME)!.messages).toEqual([]);
    const input = detail({ comments: [{ id: '1', message: 'a', createdAt: '', authorId: '1', authorName: 'A' }, { id: '2', message: 'b', createdAt: '2026-01-01 00:00:00', authorId: '2', authorName: 'B' }] });
    const copy = JSON.stringify(input);
    expect(threadView(input, ME)!.messages.map((m) => m.text)).toEqual(['b', 'a']);
    expect(JSON.stringify(input)).toBe(copy);
  });

  it('the attachment link follows the same rule', () => {
    expect(threadView(detail({ attachment: 'https://erp.triz.co.in/storage/lms_doubts/a.pdf' }), ME)!.attachment.state).toBe('ready');
    expect(threadView(detail({ attachment: 'javascript:alert(1)' }), ME)!.attachment).toEqual({ state: 'unsafe', url: null });
  });
});
