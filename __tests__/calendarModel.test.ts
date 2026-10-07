import { CalendarRow } from '../src/api/student';
import { monthDays } from '../src/screens/student/calendarDays';
import { buildCalendarMap, calendarItems, eventKind, groupByMonth, itemsInMonth } from '../src/screens/student/calendarModel';

const row = (school_date: string, title = 'T', event_type = 'holiday', description = ''): CalendarRow => ({ school_date, title, description, event_type });

describe('eventKind', () => {
  it('recognises holiday and vacation case-insensitively; anything else is an event', () => {
    expect(eventKind('holiday')).toBe('holiday');
    expect(eventKind(' Holiday ')).toBe('holiday');
    expect(eventKind('VACATION')).toBe('vacation');
    expect(eventKind('event')).toBe('event');
    expect(eventKind('exam')).toBe('event');
    expect(eventKind('')).toBe('event');
  });
});

describe('calendarItems', () => {
  it('drops rows without a readable date (an enrollment with no events returns one all-NULL row)', () => {
    expect(calendarItems([row(''), row('garbage'), row('2026-13-40'), row('2026-10-02', 'Gandhi Jayanti')])).toHaveLength(1);
  });

  it('collapses identical rows (two enrollment rows for one year would duplicate every event)', () => {
    const items = calendarItems([row('2026-10-02', 'Gandhi Jayanti'), row('2026-10-02', 'Gandhi Jayanti'), row('2026-10-02', 'Gandhi Jayanti', 'event')]);
    expect(items.map((i) => i.kind).sort()).toEqual(['event', 'holiday']);
  });

  it('orders by date, then title, and normalises the date', () => {
    const items = calendarItems([row('2026-10-10 00:00:00', 'B'), row('2026-10-02', 'Z'), row('2026-10-02', 'A')]);
    expect(items.map((i) => `${i.date} ${i.title}`)).toEqual(['2026-10-02 A', '2026-10-02 Z', '2026-10-10 B']);
  });

  it('trims titles and descriptions', () => {
    expect(calendarItems([row('2026-10-02', '  Diwali ', 'vacation', ' break ')])[0]).toMatchObject({ title: 'Diwali', description: 'break', kind: 'vacation' });
  });
});

describe('buildCalendarMap', () => {
  const rows = [row('2026-10-02', 'Gandhi Jayanti', 'holiday', 'National'), row('2026-10-10', 'Sports day', 'event'), row('2026-10-20', 'Diwali break', 'vacation'), row('2026-10-02', 'Quiz', 'event')];

  it('puts each row on its day under the right kind, and sets no attendance', () => {
    const m = buildCalendarMap(rows);
    const d = m.get('2026-10-02')!;
    expect(d.status).toBeUndefined();
    expect(d.holidays).toEqual([{ title: 'Gandhi Jayanti', description: 'National' }]);
    expect(d.events).toEqual([{ title: 'Quiz', description: '' }]);
    expect(m.get('2026-10-20')?.vacations).toHaveLength(1);
  });

  it('feeds the shared grid helper (the same cells S2 uses)', () => {
    const days = monthDays(buildCalendarMap(rows), { year: 2026, month: 10 }, false);
    expect(days.get('2026-10-02')).toMatchObject({ holiday: true, event: true, vacation: false });
    // the calendar's labels never mention attendance
    expect(days.get('2026-10-02')?.label).toBe('2 October 2026, Holiday: Gandhi Jayanti, Event: Quiz');
    expect(monthDays(buildCalendarMap(rows), { year: 2026, month: 10 }).get('2026-10-02')?.label).toBe('2 October 2026, No attendance recorded, Holiday: Gandhi Jayanti, Event: Quiz');
    expect(days.get('2026-10-20')).toMatchObject({ vacation: true, holiday: false });
    expect(monthDays(buildCalendarMap(rows), { year: 2026, month: 9 }).size).toBe(0);
  });
});

describe('itemsInMonth / groupByMonth', () => {
  const items = calendarItems([row('2026-09-30', 'A'), row('2026-10-02', 'B'), row('2026-10-20', 'C'), row('2027-01-26', 'D')]);

  it('filters one month', () => {
    expect(itemsInMonth(items, { year: 2026, month: 10 }).map((i) => i.title)).toEqual(['B', 'C']);
    expect(itemsInMonth(items, { year: 2026, month: 11 })).toEqual([]);
  });

  it('groups consecutive items by month, in date order, across a year boundary', () => {
    const g = groupByMonth(items);
    expect(g.map((x) => `${x.key} ${x.title} ${x.items.length}`)).toEqual(['2026-09 September 2026 1', '2026-10 October 2026 2', '2027-01 January 2027 1']);
  });

  it('is empty for no items', () => {
    expect(groupByMonth([])).toEqual([]);
  });
});
