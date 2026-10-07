import { LeaveApplication } from '../src/api/student';
import { applySortKey, dateRange, leaveRows, leaveStatus } from '../src/screens/student/leaveModel';

jest.mock('../src/config/env', () => ({ env: { apiBaseUrl: 'https://dev.triz.co.in', appEnv: 'test', erpHosts: [] } }));

const L = (over: Partial<LeaveApplication> = {}): LeaveApplication => ({
  title: 'Sick leave',
  message: 'Fever',
  file: '',
  appliedOn: '05-10-2026 09:30:00',
  fromDate: '2026-10-06',
  toDate: '2026-10-08',
  status: '',
  reply: '',
  replyBy: '',
  replyOn: '',
  ...over,
});
const FILE = 'https://erp.triz.co.in/storage/leave_application/a.pdf';

describe('leaveStatus', () => {
  it('empty / blank / null -> Pending (warning); nothing else is invented', () => {
    for (const s of ['', '   ', 'null', 'NULL']) expect(leaveStatus(s)).toEqual({ label: 'Pending', tone: 'warning' });
  });
  it('the school words get their tone in any case', () => {
    expect(leaveStatus('Approved')).toEqual({ label: 'Approved', tone: 'success' });
    expect(leaveStatus(' approved ')).toEqual({ label: 'Approved', tone: 'success' });
    expect(leaveStatus('REJECTED')).toEqual({ label: 'Rejected', tone: 'danger' });
    expect(leaveStatus('pending')).toEqual({ label: 'Pending', tone: 'warning' });
  });
  it('any other text is shown as sent, neutral', () => {
    expect(leaveStatus('On hold')).toEqual({ label: 'On hold', tone: 'neutral' });
    expect(leaveStatus('Cancelled')).toEqual({ label: 'Cancelled', tone: 'neutral' });
  });
});

describe('applySortKey', () => {
  it('reads d-m-Y H:i:s and ISO, with the time part', () => {
    expect(applySortKey('05-10-2026 09:30:00')).toBe('2026-10-05 09:30:00');
    expect(applySortKey('2026-10-05 18:00:01')).toBe('2026-10-05 18:00:01');
    expect(applySortKey('2026-10-05')).toBe('2026-10-05 00:00:00');
  });
  it('unreadable -> null', () => {
    for (const s of ['', 'x', '31-02-2026 10:00:00', '2026-13-01']) expect(applySortKey(s)).toBeNull();
  });
});

describe('dateRange', () => {
  it('two dates', () => expect(dateRange('2026-10-06', '2026-10-08')).toBe('6 Oct 2026 – 8 Oct 2026'));
  it('one date when equal', () => expect(dateRange('2026-10-06', '2026-10-06')).toBe('6 Oct 2026'));
  it('one readable date', () => expect(dateRange('2026-10-06', '')).toBe('6 Oct 2026'));
  it('unreadable text is shown as sent, nothing invented; nothing sent -> empty', () => {
    expect(dateRange('soon', 'later')).toBe('soon – later');
    expect(dateRange('', '')).toBe('');
  });
  it('a reversed range is shown as sent', () => expect(dateRange('2026-10-08', '2026-10-06')).toBe('8 Oct 2026 – 6 Oct 2026'));
});

describe('leaveRows - ordering', () => {
  it('newest application first, by date and time', () => {
    const rows = leaveRows([
      L({ title: 'A', appliedOn: '01-10-2026 10:00:00' }),
      L({ title: 'B', appliedOn: '05-10-2026 08:00:00' }),
      L({ title: 'C', appliedOn: '05-10-2026 17:00:00' }),
      L({ title: 'D', appliedOn: '30-09-2026 23:59:59' }),
    ]);
    expect(rows.map((r) => r.title)).toEqual(['C', 'B', 'A', 'D']);
  });
  it('unreadable apply dates go last; ties keep the server order', () => {
    const rows = leaveRows([L({ title: 'X', appliedOn: '' }), L({ title: 'T1' }), L({ title: 'Y', appliedOn: 'bad' }), L({ title: 'T2' })]);
    expect(rows.map((r) => r.title)).toEqual(['T1', 'T2', 'X', 'Y']);
  });
  it('does not mutate its input and keeps every row', () => {
    const input = [L({ title: 'old', appliedOn: '01-01-2026 00:00:00' }), L({ title: 'new' })];
    const rows = leaveRows(input);
    expect(input.map((r) => r.title)).toEqual(['old', 'new']);
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((r) => r.key)).size).toBe(2);
  });
  it('empty input -> no rows', () => expect(leaveRows([])).toEqual([]));
});

describe('leaveRows - content', () => {
  it('an empty status is Pending', () => {
    expect(leaveRows([L({ status: '' })])[0]).toMatchObject({ statusLabel: 'Pending', statusTone: 'warning' });
  });
  it('title falls back, message and dates are plain text', () => {
    const r = leaveRows([L({ title: '  ', message: '  <b>Fever</b>  ' })])[0];
    expect(r.title).toBe('Leave request');
    expect(r.message).toBe('<b>Fever</b>');
    expect(r.range).toBe('6 Oct 2026 – 8 Oct 2026');
    expect(r.appliedOn).toBe('5 Oct 2026');
  });
  it('staff reply visible only when it has text (blank and "null" are no reply)', () => {
    expect(leaveRows([L({ reply: 'Get well soon', replyBy: 'Mrs Shah', replyOn: '06-10-2026 11:00:00' })])[0]).toMatchObject({
      hasReply: true,
      reply: 'Get well soon',
      replyBy: 'Mrs Shah',
      replyOn: '6 Oct 2026',
    });
    for (const reply of ['', '   ', 'null', 'NULL']) expect(leaveRows([L({ reply, replyBy: 'Mrs Shah' })])[0].hasReply).toBe(false);
  });
  it('"null" reply_by is no name', () => {
    expect(leaveRows([L({ reply: 'ok', replyBy: 'null' })])[0].replyBy).toBe('');
  });
  it('attachment: none / ready (re-based) / unsafe, row kept', () => {
    expect(leaveRows([L({ file: '' })])[0]).toMatchObject({ fileState: 'none', fileUrl: null });
    expect(leaveRows([L({ file: FILE })])[0]).toMatchObject({ fileState: 'ready', fileUrl: 'https://dev.triz.co.in/storage/leave_application/a.pdf' });
    for (const bad of [
      'https://evil.example/a.pdf',
      'https://erp.triz.co.in.evil.com/a.pdf',
      'https://erp.triz.co.in@evil.example/a.pdf',
      'javascript:alert(1)',
      'file:///etc/passwd',
      'intent://x',
      'ftp://erp.triz.co.in/a.pdf',
      'a.pdf',
      '/storage/leave_application/a.pdf',
    ]) {
      const rows = leaveRows([L({ file: bad })]);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ fileState: 'unsafe', fileUrl: null });
    }
  });
});
