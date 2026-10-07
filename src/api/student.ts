import { legacy } from './legacy';

/** One row of `attendance_student` as `POST studentAttendanceAPI` returns it. */
export interface AttendanceRow {
  /** `YYYY-MM-DD` (the column is a date; a datetime string is also tolerated by the model). */
  attendance_date: string;
  /** `P`, `A`, other teacher-entered codes, or empty for an unmarked student. */
  attendance_code: string;
}

/** One row of `calendar_events` for the student's standard. */
export interface CalendarRow {
  school_date: string;
  title: string;
  description: string;
  event_type: string;
}

export interface StudentAttendance {
  attendance: AttendanceRow[];
  holiday: CalendarRow[];
  event: CalendarRow[];
  vacation: CalendarRow[];
}

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));

function list<T>(v: unknown, pick: (r: Record<string, unknown>) => T): T[] {
  return Array.isArray(v) ? v.filter(isRecord).map(pick) : [];
}

const calendarRow = (r: Record<string, unknown>): CalendarRow => ({
  school_date: text(r.school_date),
  title: text(r.title),
  description: text(r.description),
  event_type: text(r.event_type),
});

/** Tolerant reader: missing or malformed arrays become empty lists instead of crashing the screen. */
export function parseAttendance(data: unknown): StudentAttendance {
  const d = isRecord(data) ? data : {};
  const cal = isRecord(d.calendar_data) ? d.calendar_data : {};
  return {
    attendance: list(d.attendance_data, (r) => ({
      attendance_date: text(r.attendance_date),
      attendance_code: text(r.attendance_code),
    })),
    holiday: list(cal.holiday, calendarRow),
    event: list(cal.event, calendarRow),
    vacation: list(cal.vacation, calendarRow),
  };
}

/**
 * The signed-in student's attendance for the current academic year.
 * `POST studentAttendanceAPI` (routes/student.php:179). Identity (student_id, sub_institute_id, syear)
 * is added by the legacy client from the session; this function takes no ids on purpose.
 */
export async function fetchStudentAttendance(): Promise<StudentAttendance> {
  const res = await legacy.post<unknown>('studentAttendanceAPI');
  return parseAttendance(res.data);
}
