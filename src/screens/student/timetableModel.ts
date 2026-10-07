import { TimetableEntry } from '../../api/student';

/** Decision S3-D2 (approved): the day strip is Monday to Saturday. The server never maps a Sunday. */
export const DAY_KEYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
export type DayKey = (typeof DAY_KEYS)[number];
/** `Other` holds periods whose weekday the server could not map (null / empty / unknown). */
export type DayTab = DayKey | 'Other';

export const DAY_NAMES: Record<DayKey, string> = {
  Mon: 'Monday',
  Tue: 'Tuesday',
  Wed: 'Wednesday',
  Thu: 'Thursday',
  Fri: 'Friday',
  Sat: 'Saturday',
};

/** `Mon` / `monday` (any case, surrounding spaces) -> `Mon`; anything else -> null. No prefix guessing. */
export function normaliseDay(label: string): DayKey | null {
  const t = label.trim().toLowerCase();
  return DAY_KEYS.find((k) => t === k.toLowerCase() || t === DAY_NAMES[k].toLowerCase()) ?? null;
}

/** Hours and minutes of a `HH:MM` / `HH:MM:SS` clock text, strictly validated; null when unreadable. */
export function parseClock(v: string): { h: number; m: number } | null {
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(v.trim());
  if (!m) return null;
  const [h, min, sec] = [Number(m[1]), Number(m[2]), m[3] === undefined ? 0 : Number(m[3])];
  return h > 23 || min > 59 || sec > 59 ? null : { h, m: min };
}

/** Decision S3-D1 (approved): 12-hour time, `9:05 AM`; empty when the text cannot be read (never guessed). */
export function format12(v: string): string {
  const c = parseClock(v);
  if (!c) return '';
  return `${c.h % 12 || 12}:${String(c.m).padStart(2, '0')} ${c.h < 12 ? 'AM' : 'PM'}`;
}

/** `9:00 AM – 9:45 AM`, just one time if only one is readable, or ''. */
export function timeRange(start: string, end: string): string {
  return [format12(start), format12(end)].filter(Boolean).join(' – ');
}

export interface Period {
  day: DayTab;
  periodId: string;
  periodName: string;
  /** Exactly as the server sent it (not split on commas: a subject name may contain one). */
  subject: string;
  teacher: string;
  start: string;
  end: string;
  startMinutes: number | null;
}

export interface Timetable {
  byDay: Record<DayTab, Period[]>;
  total: number;
  /** True when some period has no recognised weekday (the "Other" chip is then shown). */
  hasOther: boolean;
}

const minutesOf = (v: string): number | null => {
  const c = parseClock(v);
  return c ? c.h * 60 + c.m : null;
};

const numberOrNull = (v: string): number | null => (/^\d+$/.test(v.trim()) ? Number(v) : null);

/** Ascending, with unknown values last. */
const nullLast = (a: number | null, b: number | null): number => (a === b ? 0 : a === null ? 1 : b === null ? -1 : a - b);

/**
 * Groups periods by weekday. Within a day: by start time (S3-D3), unreadable times last, then by period id,
 * then by name. The server's own order is alphabetical by weekday label, so nothing of it is relied on.
 * A row with no subject, no period name and no time has nothing to show and is skipped.
 */
export function buildTimetable(entries: TimetableEntry[]): Timetable {
  const byDay: Record<DayTab, Period[]> = { Mon: [], Tue: [], Wed: [], Thu: [], Fri: [], Sat: [], Other: [] };
  let total = 0;
  for (const e of entries) {
    const subject = e.subject.trim();
    const periodName = e.periodName.trim();
    if (!subject && !periodName && !format12(e.startTime)) continue;
    const day: DayTab = normaliseDay(e.weekDay) ?? 'Other';
    byDay[day].push({
      day,
      periodId: e.periodId.trim(),
      periodName,
      subject,
      teacher: e.teacher.trim(),
      start: e.startTime,
      end: e.endTime,
      startMinutes: minutesOf(e.startTime),
    });
    total++;
  }
  for (const list of Object.values(byDay)) {
    list.sort(
      (a, b) =>
        nullLast(a.startMinutes, b.startMinutes) ||
        nullLast(numberOrNull(a.periodId), numberOrNull(b.periodId)) ||
        a.periodName.localeCompare(b.periodName),
    );
  }
  return { byDay, total, hasOther: byDay.Other.length > 0 };
}

/** The weekday of `now` on the strip, or null on a Sunday (the strip has no Sunday). */
export function todayTab(now: Date): DayKey | null {
  const d = now.getDay(); // 0 = Sunday, local device calendar
  return d >= 1 && d <= 6 ? DAY_KEYS[d - 1] : null;
}

/** S3-D2: open on today; on a Sunday open on Monday. */
export const defaultDay = (now: Date): DayKey => todayTab(now) ?? 'Mon';

/** One spoken sentence for a period card, e.g. `Period 2, 9:45 AM to 10:30 AM, Mathematics, Mrs Shah`. */
export function periodLabel(p: Period): string {
  const s = format12(p.start);
  const e = format12(p.end);
  const when = s && e ? `${s} to ${e}` : s || e;
  return [p.periodName || 'Period', when, p.subject, p.teacher].filter(Boolean).join(', ');
}
