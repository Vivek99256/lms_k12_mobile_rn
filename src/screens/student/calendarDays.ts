import { CalendarDay } from '../../components/MonthCalendar';
import { dayLabel, DayMap, YearMonth } from './attendanceModel';

/**
 * Cell data for one month of a day map: status mark, holiday/vacation/event flags and the
 * screen-reader label. Shared by the attendance screen (S2) and the academic calendar (S1).
 * `includeAttendance = false` (calendar screens) leaves "No attendance recorded" out of the labels.
 */
export function monthDays(map: DayMap, ym: YearMonth, includeAttendance = true): Map<string, CalendarDay> {
  const out = new Map<string, CalendarDay>();
  const prefix = `${ym.year}-${String(ym.month).padStart(2, '0')}-`;
  for (const [key, d] of map) {
    if (!key.startsWith(prefix)) continue;
    out.set(key, {
      status: d.status,
      mark: d.status === 'present' ? 'P' : d.status === 'absent' ? 'A' : d.status === 'other' ? (d.code ?? '').slice(0, 2) : undefined,
      holiday: d.holidays.length > 0,
      vacation: d.vacations.length > 0,
      event: d.events.length > 0,
      label: dayLabel(key, d, includeAttendance),
    });
  }
  return out;
}
