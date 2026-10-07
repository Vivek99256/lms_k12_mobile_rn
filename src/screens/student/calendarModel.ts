import { CalendarRow, StudentAttendance } from '../../api/student';
import { toDateKey } from '../../utils/dates';
import { buildDayMap, DayMap, monthOf, monthTitle, YearMonth } from './attendanceModel';

export type EventKind = 'holiday' | 'vacation' | 'event';

export const KIND_LABEL: Record<EventKind, string> = { holiday: 'Holiday', vacation: 'Vacation', event: 'Event' };

/** `holiday` and `vacation` are recognised; any other stored type is treated as an event. */
export function eventKind(type: string): EventKind {
  const t = type.trim().toLowerCase();
  return t === 'holiday' || t === 'vacation' ? t : 'event';
}

export interface CalendarListItem {
  /** `YYYY-MM-DD` */
  date: string;
  title: string;
  description: string;
  kind: EventKind;
}

/**
 * Valid, de-duplicated, date-ordered events. Rows without a readable date are dropped (an enrollment with
 * no events comes back as one all-NULL row); identical rows are collapsed (a student with two enrollment
 * rows for the year would otherwise see every event twice).
 */
export function calendarItems(rows: CalendarRow[]): CalendarListItem[] {
  const seen = new Set<string>();
  const items: CalendarListItem[] = [];
  for (const r of rows) {
    const date = toDateKey(r.school_date);
    if (!date) continue;
    const item: CalendarListItem = { date, title: r.title.trim(), description: r.description.trim(), kind: eventKind(r.event_type) };
    const id = `${item.date}|${item.kind}|${item.title}|${item.description}`;
    if (seen.has(id)) continue;
    seen.add(id);
    items.push(item);
  }
  return items.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
}

/** The day map the calendar grid and the day detail use, built with the same model as the attendance screen. */
export function buildCalendarMap(rows: CalendarRow[]): DayMap {
  const split: Pick<StudentAttendance, 'holiday' | 'event' | 'vacation'> = { holiday: [], event: [], vacation: [] };
  for (const i of calendarItems(rows)) {
    split[i.kind].push({ school_date: i.date, title: i.title, description: i.description, event_type: i.kind });
  }
  return buildDayMap({ attendance: [], ...split });
}

export function itemsInMonth(items: CalendarListItem[], ym: YearMonth): CalendarListItem[] {
  const prefix = `${ym.year}-${String(ym.month).padStart(2, '0')}-`;
  return items.filter((i) => i.date.startsWith(prefix));
}

export interface MonthGroup {
  /** `YYYY-MM` */
  key: string;
  title: string;
  items: CalendarListItem[];
}

/** Items (already date-ordered) grouped under their month, in date order. */
export function groupByMonth(items: CalendarListItem[]): MonthGroup[] {
  const groups: MonthGroup[] = [];
  for (const i of items) {
    const key = i.date.slice(0, 7);
    let g = groups[groups.length - 1];
    if (!g || g.key !== key) {
      g = { key, title: monthTitle(monthOf(i.date)), items: [] };
      groups.push(g);
    }
    g.items.push(i);
  }
  return groups;
}
