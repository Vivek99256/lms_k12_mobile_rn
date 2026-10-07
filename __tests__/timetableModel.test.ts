import { TimetableEntry } from '../src/api/student';
import {
  buildTimetable,
  defaultDay,
  format12,
  normaliseDay,
  parseClock,
  periodLabel,
  timeRange,
  todayTab,
} from '../src/screens/student/timetableModel';

const e = (over: Partial<TimetableEntry> = {}): TimetableEntry => ({
  weekDay: 'Mon',
  periodId: '1',
  periodName: 'Period 1',
  startTime: '09:00:00',
  endTime: '09:45:00',
  subject: 'Maths',
  teacher: 'Mrs Shah',
  ...over,
});

describe('normaliseDay', () => {
  it('maps the server labels and full names, ignoring case and spaces', () => {
    expect(normaliseDay('Mon')).toBe('Mon');
    expect(normaliseDay(' tue ')).toBe('Tue');
    expect(normaliseDay('WEDNESDAY')).toBe('Wed');
    expect(normaliseDay('Sat')).toBe('Sat');
  });

  it('returns null for Sunday, empty, unknown and partial labels (no prefix guessing)', () => {
    for (const bad of ['', 'Sun', 'Sunday', 'U', 'M', 'Mo', 'Monday2', 'Someday', '  ']) {
      expect(normaliseDay(bad)).toBeNull();
    }
  });
});

describe('parseClock / format12 / timeRange (S3-D1)', () => {
  it('reads HH:MM:SS and H:MM', () => {
    expect(parseClock('09:05:00')).toEqual({ h: 9, m: 5 });
    expect(parseClock('9:05')).toEqual({ h: 9, m: 5 });
    expect(parseClock(' 23:59:59 ')).toEqual({ h: 23, m: 59 });
  });

  it('rejects anything not a real time', () => {
    for (const bad of ['', 'garbage', '24:00:00', '12:60', '12:30:61', '9', '09-05-00', '12:5', 'null']) {
      expect(parseClock(bad)).toBeNull();
    }
  });

  it('formats 12-hour time including midnight, noon and the PM hours', () => {
    expect(format12('00:00:00')).toBe('12:00 AM');
    expect(format12('00:30:00')).toBe('12:30 AM');
    expect(format12('08:15:00')).toBe('8:15 AM');
    expect(format12('11:59:00')).toBe('11:59 AM');
    expect(format12('12:00:00')).toBe('12:00 PM');
    expect(format12('13:05:00')).toBe('1:05 PM');
    expect(format12('23:45:00')).toBe('11:45 PM');
    expect(format12('nonsense')).toBe('');
  });

  it('builds a range, one time, or nothing', () => {
    expect(timeRange('09:00:00', '09:45:00')).toBe('9:00 AM – 9:45 AM');
    expect(timeRange('09:00:00', '')).toBe('9:00 AM');
    expect(timeRange('', '10:30:00')).toBe('10:30 AM');
    expect(timeRange('', 'x')).toBe('');
  });
});

describe('buildTimetable', () => {
  it('groups periods by weekday', () => {
    const t = buildTimetable([e({ weekDay: 'Mon' }), e({ weekDay: 'Wed', periodId: '2' }), e({ weekDay: 'Mon', periodId: '3', startTime: '10:00:00' })]);
    expect(t.byDay.Mon).toHaveLength(2);
    expect(t.byDay.Wed).toHaveLength(1);
    expect(t.byDay.Tue).toHaveLength(0);
    expect(t.total).toBe(3);
    expect(t.hasOther).toBe(false);
  });

  it('orders periods by start time, not by the server order (S3-D3)', () => {
    const t = buildTimetable([
      e({ periodId: '3', periodName: 'Period 3', startTime: '11:00:00', subject: 'English' }),
      e({ periodId: '1', periodName: 'Period 1', startTime: '08:15:00', subject: 'Hindi' }),
      e({ periodId: '2', periodName: 'Period 2', startTime: '13:05:00', subject: 'Science' }),
      e({ periodId: '4', periodName: 'Period 4', startTime: '12:00:00', subject: 'Art' }),
    ]);
    expect(t.byDay.Mon.map((p) => p.subject)).toEqual(['Hindi', 'English', 'Art', 'Science']);
  });

  it('puts periods without a readable start time last, ordered by period id then name', () => {
    const t = buildTimetable([
      e({ periodId: '9', periodName: 'Z', startTime: '', subject: 'NoTimeNine' }),
      e({ periodId: '5', periodName: 'Y', startTime: 'garbage', subject: 'NoTimeFive' }),
      e({ periodId: '1', startTime: '09:00:00', subject: 'Timed' }),
      e({ periodId: '', periodName: 'A', startTime: '', subject: 'NoIdA' }),
    ]);
    expect(t.byDay.Mon.map((p) => p.subject)).toEqual(['Timed', 'NoTimeFive', 'NoTimeNine', 'NoIdA']);
  });

  it('sorts equal start times by numeric period id (10 after 9, not after 1)', () => {
    const t = buildTimetable([e({ periodId: '10', subject: 'Ten' }), e({ periodId: '9', subject: 'Nine' }), e({ periodId: '2', subject: 'Two' })]);
    expect(t.byDay.Mon.map((p) => p.subject)).toEqual(['Two', 'Nine', 'Ten']);
  });

  it('keeps periods with a missing or unknown weekday under Other, never dropped', () => {
    const t = buildTimetable([e({ weekDay: '', subject: 'Library' }), e({ weekDay: 'Sunday', subject: 'Camp' }), e({ weekDay: 'Funday', subject: 'Odd' }), e({ weekDay: 'Tue', subject: 'Real' })]);
    expect(t.hasOther).toBe(true);
    expect(t.byDay.Other.map((p) => p.subject).sort()).toEqual(['Camp', 'Library', 'Odd']);
    expect(t.byDay.Tue.map((p) => p.subject)).toEqual(['Real']);
    expect(t.total).toBe(4);
  });

  it('shows subject and teacher text exactly as sent: comma-joined batch subjects are not split (S3-D5)', () => {
    const t = buildTimetable([e({ subject: 'Sanskrit,French', teacher: 'Mr A,Mrs B' })]);
    expect(t.byDay.Mon[0].subject).toBe('Sanskrit,French');
    expect(t.byDay.Mon[0].teacher).toBe('Mr A,Mrs B');
  });

  it('skips a row that has nothing to show, but keeps one with only a subject, only a period name or only a time', () => {
    const t = buildTimetable([
      e({ subject: '', periodName: '', startTime: '', endTime: '', teacher: 'Ghost' }),
      e({ subject: 'OnlySubject', periodName: '', startTime: '' }),
      e({ subject: '', periodName: 'OnlyName', startTime: '' }),
      e({ subject: '', periodName: '', startTime: '10:00:00' }),
    ]);
    expect(t.total).toBe(3);
  });

  it('is empty for no entries', () => {
    const t = buildTimetable([]);
    expect(t.total).toBe(0);
    expect(t.hasOther).toBe(false);
    expect(Object.values(t.byDay).every((l) => l.length === 0)).toBe(true);
  });
});

describe('todayTab / defaultDay (S3-D2)', () => {
  // 5 Oct 2026 is a Monday, 11 Oct a Sunday.
  const at = (day: number) => new Date(2026, 9, day, 12);

  it('opens on today for Monday to Saturday', () => {
    expect([5, 6, 7, 8, 9, 10].map((d) => defaultDay(at(d)))).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
    expect(todayTab(at(7))).toBe('Wed');
  });

  it('opens on Monday on a Sunday, and there is no "today" chip then', () => {
    expect(defaultDay(at(11))).toBe('Mon');
    expect(todayTab(at(11))).toBeNull();
  });
});

describe('periodLabel', () => {
  it('reads as one sentence, with a range or a single time', () => {
    const [p] = buildTimetable([e()]).byDay.Mon;
    expect(periodLabel(p)).toBe('Period 1, 9:00 AM to 9:45 AM, Maths, Mrs Shah');
    const [q] = buildTimetable([e({ endTime: '', teacher: '' })]).byDay.Mon;
    expect(periodLabel(q)).toBe('Period 1, 9:00 AM, Maths');
  });

  it('falls back to "Period" when the row has no period name', () => {
    const [p] = buildTimetable([e({ periodName: '', startTime: '', endTime: '', teacher: '' })]).byDay.Mon;
    expect(periodLabel(p)).toBe('Period, Maths');
  });
});
