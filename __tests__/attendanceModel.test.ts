import { StudentAttendance } from '../src/api/student';
import {
  addMonths,
  buildDayMap,
  classifyCode,
  clampMonth,
  dateKey,
  dayLabel,
  formatLongDate,
  monthBounds,
  monthGrid,
  monthSummary,
  monthTitle,
  statusText,
  summarise,
  todayKey,
} from '../src/screens/student/attendanceModel';

const data = (over: Partial<StudentAttendance> = {}): StudentAttendance => ({
  attendance: [],
  holiday: [],
  event: [],
  vacation: [],
  ...over,
});
const att = (attendance_date: string, attendance_code: string) => ({ attendance_date, attendance_code });
const cal = (school_date: string, title = 'T', description = 'D', event_type = 'holiday') => ({
  school_date,
  title,
  description,
  event_type,
});

describe('dateKey', () => {
  it('takes the date part of date, datetime and ISO strings without time-zone shifts', () => {
    expect(dateKey('2026-10-05')).toBe('2026-10-05');
    expect(dateKey('2026-10-05 00:00:00')).toBe('2026-10-05');
    expect(dateKey('2026-10-05T23:59:59Z')).toBe('2026-10-05');
    expect(dateKey('  2026-10-05 ')).toBe('2026-10-05');
  });

  it('rejects anything that is not a real calendar date', () => {
    for (const bad of [null, undefined, 5, '', 'garbage', '05-10-2026', '2026-13-01', '2026-02-30', '2026-00-10', '2026-10-5']) {
      expect(dateKey(bad)).toBeNull();
    }
    expect(dateKey('2028-02-29')).toBe('2028-02-29'); // leap day
    expect(dateKey('2026-02-29')).toBeNull();
  });
});

describe('classifyCode (decision U-2)', () => {
  it('maps P and A case-insensitively', () => {
    expect(classifyCode('P')).toEqual({ status: 'present', code: 'P' });
    expect(classifyCode(' a ')).toEqual({ status: 'absent', code: 'A' });
  });

  it('treats empty/null as not marked and any other code as "other"', () => {
    expect(classifyCode('')).toBeNull();
    expect(classifyCode('   ')).toBeNull();
    expect(classifyCode(null)).toBeNull();
    expect(classifyCode(undefined)).toBeNull();
    expect(classifyCode('l')).toEqual({ status: 'other', code: 'L' });
  });
});

describe('buildDayMap', () => {
  it('builds one entry per date and skips unmarked / invalid rows', () => {
    const m = buildDayMap(data({ attendance: [att('2026-10-01', 'P'), att('2026-10-02', ''), att('bad', 'P'), att('2026-10-03 00:00:00', 'A')] }));
    expect([...m.keys()].sort()).toEqual(['2026-10-01', '2026-10-03']);
    expect(m.get('2026-10-03')?.status).toBe('absent');
  });

  it('the last non-empty code wins for duplicate dates; empty rows never erase a code', () => {
    const m = buildDayMap(data({ attendance: [att('2026-10-01', 'A'), att('2026-10-01', 'P'), att('2026-10-01', '')] }));
    expect(m.get('2026-10-01')?.status).toBe('present');
  });

  it('merges holidays, events and vacations onto the same day as attendance (decision U-3: attendance stays)', () => {
    const m = buildDayMap(
      data({
        attendance: [att('2026-10-02', 'P')],
        holiday: [cal('2026-10-02', 'Gandhi Jayanti', 'National holiday')],
        event: [cal('2026-10-02', 'Quiz', '', 'event')],
        vacation: [cal('2026-10-20', 'Diwali break', '', 'vacation')],
      }),
    );
    const d = m.get('2026-10-02')!;
    expect(d.status).toBe('present');
    expect(d.holidays).toEqual([{ title: 'Gandhi Jayanti', description: 'National holiday' }]);
    expect(d.events).toHaveLength(1);
    expect(m.get('2026-10-20')?.vacations).toHaveLength(1);
    expect(m.get('2026-10-20')?.status).toBeUndefined();
  });
});

describe('monthGrid (Monday first, decision U-1)', () => {
  const flat = (w: (string | null)[][]) => w.flat();

  it('always yields full weeks of 7', () => {
    for (const ym of [{ year: 2026, month: 2 }, { year: 2026, month: 3 }, { year: 2028, month: 2 }, { year: 2026, month: 6 }, { year: 2026, month: 10 }]) {
      const g = monthGrid(ym);
      expect(g.every((w) => w.length === 7)).toBe(true);
      expect(flat(g).filter(Boolean)).toHaveLength(new Date(Date.UTC(ym.year, ym.month, 0)).getUTCDate());
    }
  });

  it('October 2026 starts on a Thursday: 3 leading blanks', () => {
    const g = monthGrid({ year: 2026, month: 10 });
    expect(g[0].slice(0, 4)).toEqual([null, null, null, '2026-10-01']);
    expect(g).toHaveLength(5);
  });

  it('a month starting on Monday has no leading blanks (June 2026)', () => {
    expect(monthGrid({ year: 2026, month: 6 })[0][0]).toBe('2026-06-01');
  });

  it('a month starting on Sunday has 6 leading blanks (Feb 2026) and may need 6 weeks (Mar 2026)', () => {
    expect(monthGrid({ year: 2026, month: 2 })[0].filter((c) => c === null)).toHaveLength(6);
    expect(monthGrid({ year: 2026, month: 3 })).toHaveLength(6);
  });

  it('knows leap years (Feb 2028 has 29 days, Feb 2026 has 28)', () => {
    expect(flat(monthGrid({ year: 2028, month: 2 })).filter(Boolean).pop()).toBe('2028-02-29');
    expect(flat(monthGrid({ year: 2026, month: 2 })).filter(Boolean).pop()).toBe('2026-02-28');
  });

  it('can start weeks on Sunday', () => {
    expect(monthGrid({ year: 2026, month: 2 }, 0)[0][0]).toBe('2026-02-01');
  });
});

describe('summaries', () => {
  const m = buildDayMap(
    data({
      attendance: [att('2026-10-01', 'P'), att('2026-10-02', 'P'), att('2026-10-03', 'A'), att('2026-10-05', 'P'), att('2026-10-06', 'L'), att('2026-09-30', 'A')],
      holiday: [cal('2026-10-02'), cal('2026-10-02', 'second'), cal('2026-10-08')],
    }),
  );

  it('counts present/absent/other/holiday days per month; unknown codes are excluded from the percentage', () => {
    expect(monthSummary(m, { year: 2026, month: 10 })).toEqual({ present: 3, absent: 1, other: 1, holidays: 2, percent: 75 });
    expect(monthSummary(m, { year: 2026, month: 9 })).toEqual({ present: 0, absent: 1, other: 0, holidays: 0, percent: 0 });
  });

  it('whole-year totals', () => {
    expect(summarise(m)).toMatchObject({ present: 3, absent: 2, other: 1, percent: 60 });
  });

  it('percent rounds to a whole number and is null when nothing is present/absent', () => {
    const two = buildDayMap(data({ attendance: [att('2026-10-01', 'P'), att('2026-10-02', 'P'), att('2026-10-03', 'A')] }));
    expect(summarise(two).percent).toBe(67);
    expect(summarise(buildDayMap(data())).percent).toBeNull();
    expect(summarise(buildDayMap(data({ attendance: [att('2026-10-01', 'X')] }))).percent).toBeNull();
  });
});

describe('month navigation', () => {
  it('addMonths crosses year boundaries both ways', () => {
    expect(addMonths({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(addMonths({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
    expect(addMonths({ year: 2026, month: 5 }, -17)).toEqual({ year: 2024, month: 12 });
  });

  it('bounds run from the earliest date (or this month) to the latest (or this month)', () => {
    const m = buildDayMap(data({ attendance: [att('2026-04-10', 'P'), att('2026-09-30', 'A')], holiday: [cal('2026-12-25')] }));
    expect(monthBounds(m, '2026-10-07')).toEqual({ min: { year: 2026, month: 4 }, max: { year: 2026, month: 12 } });
    expect(monthBounds(new Map(), '2026-10-07')).toEqual({ min: { year: 2026, month: 10 }, max: { year: 2026, month: 10 } });
  });

  it('clampMonth keeps a month inside the bounds', () => {
    const b = { min: { year: 2026, month: 4 }, max: { year: 2026, month: 10 } };
    expect(clampMonth({ year: 2026, month: 1 }, b)).toEqual(b.min);
    expect(clampMonth({ year: 2027, month: 1 }, b)).toEqual(b.max);
    expect(clampMonth({ year: 2026, month: 6 }, b)).toEqual({ year: 2026, month: 6 });
  });
});

describe('formatting', () => {
  it('formats dates and titles without Intl', () => {
    expect(formatLongDate('2026-10-05')).toBe('5 October 2026');
    expect(monthTitle({ year: 2026, month: 1 })).toBe('January 2026');
    expect(todayKey(new Date(2026, 9, 7, 23, 59))).toBe('2026-10-07');
    expect(todayKey(new Date(2026, 0, 3))).toBe('2026-01-03');
  });

  it('status text and accessibility labels carry the meaning, not just colour', () => {
    const m = buildDayMap(data({ attendance: [att('2026-10-02', 'P'), att('2026-10-06', 'L')], holiday: [cal('2026-10-02', 'Gandhi Jayanti')] }));
    expect(statusText(m.get('2026-10-02'))).toBe('Present');
    expect(statusText(m.get('2026-10-06'))).toBe('Other (L)');
    expect(statusText(undefined)).toBe('No attendance recorded');
    expect(dayLabel('2026-10-02', m.get('2026-10-02'))).toBe('2 October 2026, Present, Holiday: Gandhi Jayanti');
    expect(dayLabel('2026-10-09')).toBe('9 October 2026, No attendance recorded');
  });
});
