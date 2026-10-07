import { ParentMessage } from '../src/api/student';
import { messageRows } from '../src/screens/student/communicationModel';
import { cleanText, LIST_PAGE_SIZE } from '../src/screens/student/listHelpers';
import { teacherRows } from '../src/screens/student/subjectTeachersModel';

const M = (over: Partial<ParentMessage> = {}): ParentMessage => ({
  title: 'Bus timing',
  message: 'Please confirm the new timing',
  createdAt: '2026-10-05 09:30:00',
  reply: '',
  replyBy: '',
  replyOn: '',
  ...over,
});

describe('cleanText / LIST_PAGE_SIZE', () => {
  it('trims and treats the literal "null" as nothing', () => {
    expect(cleanText('  hi  ')).toBe('hi');
    for (const s of ['', '  ', 'null', 'NULL', ' Null ', 'undefined']) expect(cleanText(s)).toBe('');
    expect(cleanText('nullable')).toBe('nullable');
  });
  it('lists show 30 at a time', () => expect(LIST_PAGE_SIZE).toBe(30));
});

describe('messageRows', () => {
  it('keeps the server order (newest first as sent) and every row', () => {
    const rows = messageRows([M({ title: 'new' }), M({ title: 'old', createdAt: '2026-01-01 00:00:00' }), M({ title: 'x', createdAt: '' })]);
    expect(rows.map((r) => r.title)).toEqual(['new', 'old', 'x']);
    expect(new Set(rows.map((r) => r.key)).size).toBe(3);
  });
  it('sent date from created_at; raw text when unreadable; nothing invented', () => {
    expect(messageRows([M()])[0].sentOn).toBe('5 Oct 2026');
    expect(messageRows([M({ createdAt: 'yesterday' })])[0].sentOn).toBe('yesterday');
    expect(messageRows([M({ createdAt: '' })])[0].sentOn).toBe('');
  });
  it('title falls back; message is plain text', () => {
    const r = messageRows([M({ title: ' ', message: ' <i>hi</i> ' })])[0];
    expect(r.title).toBe('Message');
    expect(r.message).toBe('<i>hi</i>');
  });
  it('a reply is shown only when it has text; "null" and blank mean awaiting', () => {
    expect(messageRows([M({ reply: 'Confirmed', replyBy: 'Mr Rao', replyOn: '06-10-2026' })])[0]).toMatchObject({
      hasReply: true,
      reply: 'Confirmed',
      replyBy: 'Mr Rao',
      replyOn: '6 Oct 2026',
    });
    for (const reply of ['', ' ', 'null', 'NULL']) expect(messageRows([M({ reply, replyBy: 'Mr Rao' })])[0].hasReply).toBe(false);
  });
  it('empty input -> no rows', () => expect(messageRows([])).toEqual([]));
});

describe('teacherRows', () => {
  it('server order; subjects split on commas, trimmed, de-duplicated', () => {
    const rows = teacherRows([
      { name: 'Mrs Shah', subjects: 'Maths, Science ,Maths,, ' },
      { name: 'Mr Rao', subjects: 'English' },
    ]);
    expect(rows.map((r) => r.name)).toEqual(['Mrs Shah', 'Mr Rao']);
    expect(rows[0].subjects).toEqual(['Maths', 'Science']);
    expect(rows[1].subjects).toEqual(['English']);
  });
  it('a missing name shows "Teacher"; no subjects -> empty list; "null" is nothing', () => {
    const rows = teacherRows([{ name: '', subjects: '' }, { name: 'null', subjects: 'null' }]);
    expect(rows.map((r) => r.name)).toEqual(['Teacher', 'Teacher']);
    expect(rows.map((r) => r.subjects)).toEqual([[], []]);
  });
  it('the parsed row carries no mobile number or image', () => {
    const row = teacherRows([{ name: 'A', subjects: 'B', mobile: '9999999999', image: 'https://x/y.png' } as never])[0];
    expect(Object.keys(row).sort()).toEqual(['key', 'name', 'subjects']);
  });
});
