const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const pad = (n: number) => String(n).padStart(2, '0');
const daysIn = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();

function valid(y: number, m: number, d: number): boolean {
  return m >= 1 && m <= 12 && d >= 1 && d <= daysIn(y, m);
}

/**
 * `YYYY-MM-DD` from the date formats the ERP sends: `2026-10-05` (also with a time part) and the
 * `DD-MM-YYYY` that the legacy SQL formats with DATE_FORMAT. Plain string handling, so the result never
 * shifts with the device time zone. Anything else (or an impossible date) gives null.
 */
export function toDateKey(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})(?!\d)/.exec(s);
  if (m && valid(Number(m[1]), Number(m[2]), Number(m[3]))) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{2})-(\d{2})-(\d{4})(?!\d)/.exec(s);
  if (m && valid(Number(m[3]), Number(m[2]), Number(m[1]))) return `${m[3]}-${m[2]}-${m[1]}`;
  return null;
}

/** Today in the device's local calendar. */
export const localDateKey = (now: Date) => `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

/** The date `days` before/after `key` (calendar arithmetic in UTC, so no daylight-saving surprises). */
export function shiftDateKey(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** `5 October 2026` */
export function longDate(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** `5 Oct 2026` */
export function shortDate(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return `${d} ${MONTHS[m - 1].slice(0, 3)} ${y}`;
}

/** `Today`, `Yesterday`, otherwise the long date. */
export function dayHeading(key: string, today: string): string {
  if (key === today) return 'Today';
  if (key === shiftDateKey(today, -1)) return 'Yesterday';
  return longDate(key);
}

/** A server date as short text, or the raw text when it cannot be read (never throws, never invents a date). */
export function displayDate(v: unknown): string {
  const key = toDateKey(v);
  if (key) return shortDate(key);
  return typeof v === 'string' ? v.trim() : '';
}
