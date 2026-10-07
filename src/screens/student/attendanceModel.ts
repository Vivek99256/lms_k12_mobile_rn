import { StudentAttendance } from '../../api/student';

/** Decision U-1 (approved): weeks start on Monday. 0 = Sunday, 1 = Monday. */
export const WEEK_STARTS_ON = 1 as const;
export const WEEKDAYS_MONDAY_FIRST = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

export type Status = 'present' | 'absent' | 'other';

export interface Entry {
  title: string;
  description: string;
}

export interface DayInfo {
  /** Recorded attendance for the day, if any. */
  status?: Status;
  /** The code as entered (upper-case); the only code shown for `other`. */
  code?: string;
  holidays: Entry[];
  events: Entry[];
  vacations: Entry[];
}

export type DayMap = Map<string, DayInfo>;

export interface YearMonth {
  year: number;
  /** 1-12 */
  month: number;
}

export interface Summary {
  present: number;
  absent: number;
  other: number;
  /** Days with a holiday entry. */
  holidays: number;
  /** Whole percent of present / (present + absent); null when there is no present or absent day. */
  percent: number | null;
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const daysIn = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();
const pad = (n: number) => String(n).padStart(2, '0');

/**
 * `YYYY-MM-DD` from a date or datetime string (`2026-10-05`, `2026-10-05 00:00:00`, `2026-10-05T00:00:00Z`).
 * Plain string handling, no Date parsing: it must not shift with the device time zone.
 */
export function dateKey(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})(?![\d])/.exec(v.trim());
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || d < 1 || d > daysIn(y, mo)) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

/**
 * Decision U-2 (approved): P = present, A = absent, empty = not marked (no record), anything else is
 * shown neutrally and never counted in the percentage.
 */
export function classifyCode(raw: unknown): { status: Status; code: string } | null {
  const code = typeof raw === 'string' ? raw.trim().toUpperCase() : '';
  if (!code) return null;
  if (code === 'P') return { status: 'present', code };
  if (code === 'A') return { status: 'absent', code };
  return { status: 'other', code };
}

const emptyDay = (): DayInfo => ({ holidays: [], events: [], vacations: [] });

/**
 * One entry per date. For several attendance rows on one date (a student who changed class) the last
 * non-empty code wins; the server orders by date only, so that is the best available rule.
 */
export function buildDayMap(data: StudentAttendance): DayMap {
  const map: DayMap = new Map();
  const day = (key: string) => {
    let d = map.get(key);
    if (!d) {
      d = emptyDay();
      map.set(key, d);
    }
    return d;
  };

  for (const r of data.attendance) {
    const key = dateKey(r.attendance_date);
    const c = classifyCode(r.attendance_code);
    if (!key || !c) continue;
    const d = day(key);
    d.status = c.status;
    d.code = c.code;
  }
  const addEntries = (rows: StudentAttendance['holiday'], field: 'holidays' | 'events' | 'vacations') => {
    for (const r of rows) {
      const key = dateKey(r.school_date);
      if (!key) continue;
      day(key)[field].push({ title: r.title, description: r.description });
    }
  };
  addEntries(data.holiday, 'holidays');
  addEntries(data.event, 'events');
  addEntries(data.vacation, 'vacations');
  return map;
}

/** Weeks of 7 cells: a `YYYY-MM-DD` key, or null for padding before the 1st / after the last day. */
export function monthGrid(ym: YearMonth, weekStartsOn: 0 | 1 = WEEK_STARTS_ON): (string | null)[][] {
  const first = new Date(Date.UTC(ym.year, ym.month - 1, 1)).getUTCDay(); // 0 = Sunday
  const lead = (first - weekStartsOn + 7) % 7;
  const total = daysIn(ym.year, ym.month);
  const cells: (string | null)[] = Array(lead).fill(null);
  for (let d = 1; d <= total; d++) cells.push(`${ym.year}-${pad(ym.month)}-${pad(d)}`);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export function summarise(map: DayMap, inRange: (key: string) => boolean = () => true): Summary {
  let present = 0;
  let absent = 0;
  let other = 0;
  let holidays = 0;
  for (const [key, d] of map) {
    if (!inRange(key)) continue;
    if (d.status === 'present') present++;
    else if (d.status === 'absent') absent++;
    else if (d.status === 'other') other++;
    if (d.holidays.length) holidays++;
  }
  const marked = present + absent;
  return { present, absent, other, holidays, percent: marked ? Math.round((present / marked) * 100) : null };
}

export const monthKeyOf = (ym: YearMonth) => `${ym.year}-${pad(ym.month)}`;

export function monthSummary(map: DayMap, ym: YearMonth): Summary {
  const prefix = `${monthKeyOf(ym)}-`;
  return summarise(map, (k) => k.startsWith(prefix));
}

export function monthOf(key: string): YearMonth {
  return { year: Number(key.slice(0, 4)), month: Number(key.slice(5, 7)) };
}

export function addMonths(ym: YearMonth, delta: number): YearMonth {
  const index = ym.year * 12 + (ym.month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

export const compareMonths = (a: YearMonth, b: YearMonth) => a.year * 12 + a.month - (b.year * 12 + b.month);

/** Navigation range: from the earliest date in the data (or this month) to the latest (or this month). */
export function monthBounds(map: DayMap, today: string): { min: YearMonth; max: YearMonth } {
  const keys = [...map.keys(), today].sort();
  return { min: monthOf(keys[0]), max: monthOf(keys[keys.length - 1]) };
}

export function clampMonth(ym: YearMonth, b: { min: YearMonth; max: YearMonth }): YearMonth {
  if (compareMonths(ym, b.min) < 0) return b.min;
  if (compareMonths(ym, b.max) > 0) return b.max;
  return ym;
}

/** Today in the device's local calendar, as `YYYY-MM-DD`. */
export const todayKey = (now: Date) => `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

export const monthTitle = (ym: YearMonth) => `${MONTHS[ym.month - 1]} ${ym.year}`;

/** `5 October 2026` */
export function formatLongDate(key: string): string {
  const { year, month } = monthOf(key);
  return `${Number(key.slice(8, 10))} ${MONTHS[month - 1]} ${year}`;
}

export function statusText(d?: DayInfo): string {
  if (!d || !d.status) return 'No attendance recorded';
  if (d.status === 'present') return 'Present';
  if (d.status === 'absent') return 'Absent';
  return `Other (${d.code})`;
}

/** Screen-reader label for a calendar cell: colour is never the only signal. */
export function dayLabel(key: string, d?: DayInfo): string {
  const parts = [formatLongDate(key), statusText(d)];
  for (const h of d?.holidays ?? []) parts.push(`Holiday: ${h.title || 'holiday'}`);
  for (const v of d?.vacations ?? []) parts.push(`Vacation: ${v.title || 'vacation'}`);
  for (const e of d?.events ?? []) parts.push(`Event: ${e.title || 'event'}`);
  return parts.join(', ');
}
