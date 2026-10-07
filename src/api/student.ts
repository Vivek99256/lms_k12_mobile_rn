import { api } from './client';
import { ApiError } from './errors';
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
const count = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

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

// ---------------------------------------------------------------------------------------------
// S1 - student home: calendar, notification hub, circulars & events, dashboard
// ---------------------------------------------------------------------------------------------

/**
 * Academic calendar rows for the student's standard. `POST studentCalenderAPI` (routes/cal.php:21).
 * Without `action` every event type comes back; `'holiday'` filters to holidays. Rows without a
 * `school_date` (an enrollment with no events yields one all-NULL row) are kept here and dropped by
 * the model, which owns date validation.
 */
export async function fetchStudentCalendar(action?: 'holiday'): Promise<CalendarRow[]> {
  const res = await legacy.post<unknown>('studentCalenderAPI', action ? { action } : undefined);
  return list(res.data, calendarRow);
}

export interface NotificationItem {
  id: string;
  /** Homework, Assignment, Circular, Photo Gallery, Notification, Student Remarks, Leave Application, ... */
  type: string;
  description: string;
  /** As sent: `DD-MM-YYYY`. */
  date: string;
}

/**
 * `POST notificationHubAPI` (routes/student.php:231). The server requires a non-empty `mobile_no` but
 * never uses it (the lookup that used it is commented out), so the constant '0' is sent instead of the
 * student's phone number (decision S1-D2). The server-built `image`/`side_image` URLs and the
 * undocumented `Status` column are deliberately not read (S1-D3).
 */
export async function fetchNotifications(): Promise<NotificationItem[]> {
  const res = await legacy.post<unknown>('notificationHubAPI', { mobile_no: '0' });
  return list(res.data, (r) => ({
    id: text(r.ID),
    type: text(r.NOTIFICATION_TYPE),
    description: text(r.NOTIFICATION_DESCRIPTION),
    date: text(r.NOTIFICATION_DATE),
  }));
}

/** The exact names stored in `circular_type` (`1 Circular`, `2 Event`; read-only SELECT 2026-10-07). */
export type CircularKind = 'Circular' | 'Event';

export interface CircularItem {
  id: string;
  title: string;
  message: string;
  /** As sent: `DD-MM-YYYY`. */
  date: string;
  /** Empty, or the absolute URL the server built from its own host; the screen checks it before use. */
  attachment: string;
}

/**
 * `POST circular/fetchData` (routes/student.php:225). Must be form-encoded (the controller reads
 * `$_REQUEST`), which the legacy client does. `action` must equal `circular_type.type`. A student with
 * no enrollment for the year makes the server answer HTTP 500.
 */
export async function fetchCirculars(kind: CircularKind): Promise<CircularItem[]> {
  const res = await legacy.post<unknown>('circular/fetchData', { action: kind });
  return list(res.data, (r) => ({
    id: text(r.id),
    title: text(r.title),
    message: text(r.message),
    date: text(r.date_),
    attachment: text(r.file_name),
  }));
}

export interface PendingItem {
  id: string;
  title: string;
  subjectId: string;
  /** Assignment date as sent (homework only; may be empty). */
  date: string;
  /** Submission/due date as sent. */
  dueDate: string;
}

export interface StudentDashboard {
  enrollment: { syear: string; standardName: string; sectionName: string } | null;
  summary: { totalSubjects: number; pendingHomework: number; pendingAssignments: number };
  subjects: { id: string; name: string }[];
  pendingHomework: PendingItem[];
  pendingAssignments: PendingItem[];
  circulars: { id: string; title: string; date: string }[];
  /** `{label, value}` pairs exactly as the server sends them (Homework done / pending, Assignments ...). */
  tasks: { label: string; value: number }[];
}

const pending = (r: Record<string, unknown>): PendingItem => ({
  id: text(r.id),
  title: text(r.title),
  subjectId: text(r.subject_id),
  date: text(r.date),
  dueDate: text(r.submission_date),
});

/** The summary payload is top-level (no `data` key). Tolerant of missing sections. `achievements` is always empty on the server and is not read. */
export function parseDashboard(body: unknown): StudentDashboard {
  const b = isRecord(body) ? body : {};
  const s = isRecord(b.summary) ? b.summary : {};
  const e = isRecord(b.enrollment) ? b.enrollment : null;
  return {
    enrollment: e ? { syear: text(e.syear), standardName: text(e.standard_name), sectionName: text(e.section_name) } : null,
    summary: {
      totalSubjects: count(s.total_subjects),
      pendingHomework: count(s.pending_homework),
      pendingAssignments: count(s.pending_assignments),
    },
    subjects: list(b.my_subjects, (r) => ({ id: text(r.id), name: text(r.subject_name) })),
    pendingHomework: list(b.pending_homework, pending),
    pendingAssignments: list(b.pending_assignments, pending),
    circulars: list(b.recent_circulars, (r) => ({ id: text(r.id), title: text(r.title), date: text(r.date_) })),
    tasks: list(b.task_status, (r) => ({ label: text(r.label), value: count(r.value) })),
  };
}

/**
 * `POST api/student-dashboard/summary` (routes/api.php:162, `api.session`): token-bound, so identity,
 * school and year come from the JWT and nothing user-supplied is sent. Students only (403 otherwise).
 */
export async function fetchStudentDashboard(): Promise<StudentDashboard> {
  const res = await api.post<unknown>('api/student-dashboard/summary');
  return parseDashboard(res.raw);
}

// ---------------------------------------------------------------------------------------------
// S3 - student timetable and exam schedule
// ---------------------------------------------------------------------------------------------

/** One period of the student's class timetable (`POST studentTimetableAPI`). Text fields are exactly what the server sent. */
export interface TimetableEntry {
  /** `Mon`..`Sat`; empty when the stored weekday code is not one the server maps (for example Sunday). */
  weekDay: string;
  periodId: string;
  periodName: string;
  /** `HH:MM:SS` (a TIME column), or empty. */
  startTime: string;
  endTime: string;
  /** GROUP_CONCAT on the server: several subjects (e.g. batches) arrive as one comma-joined string. */
  subject: string;
  teacher: string;
}

/**
 * The student's timetable for the current school year. `POST studentTimetableAPI` (routes/web.php:476).
 * Identity (student_id, sub_institute_id, syear) comes from the session via the legacy client; this takes no ids.
 */
export async function fetchTimetable(): Promise<TimetableEntry[]> {
  const res = await legacy.post<unknown>('studentTimetableAPI');
  return list(res.data, (r) => ({
    weekDay: text(r.week_day),
    periodId: text(r.period_id),
    periodName: text(r.period_name),
    startTime: text(r.start_time),
    endTime: text(r.end_time),
    subject: text(r.subject_name),
    teacher: text(r.teacher_name),
  }));
}

/** One published exam schedule (`POST studentExamScheduleAPI`). The server returns no id. */
export interface ExamEntry {
  title: string;
  /** As sent: a `date` column (`YYYY-MM-DD`). */
  date: string;
  /** Empty, or an absolute URL the server built from its own host name; the screen checks it before use. */
  file: string;
}

/** `POST studentExamScheduleAPI` (routes/student.php:182): schedules for the student's class and division, newest date first. */
export async function fetchExamSchedule(): Promise<ExamEntry[]> {
  const res = await legacy.post<unknown>('studentExamScheduleAPI');
  return list(res.data, (r) => ({ title: text(r.title), date: text(r.date_), file: text(r.file_name) }));
}

// ---------------------------------------------------------------------------------------------
// S4a - student homework (view only). Modern token-bound API: the student comes from the JWT, never from the request.
// The legacy studentHomeworkAssignmentAPI is deliberately NOT used (no ownership check, no due date or status).
// ---------------------------------------------------------------------------------------------

const asBool = (v: unknown): boolean => v === true || v === 1 || v === '1' || v === 'true';
const numOrNull = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export interface HomeworkFile {
  id: string;
  /** The submitted file's original name, or ''. */
  name: string;
  /** Absolute URL built by the server from the request host; checked by the screen before it is opened. */
  url: string;
}

const homeworkFile = (r: Record<string, unknown>): HomeworkFile => ({
  id: text(r.id),
  name: text(r.original_name),
  url: text(r.file_url),
});

/** One row of `POST lms-homework/my-submissions` (the web's own student list). */
export interface HomeworkItem {
  id: string;
  title: string;
  subject: string;
  /** Assigned date as sent (`YYYY-MM-DD`, falling back to the `DD-MM-YYYY` copy). */
  date: string;
  /** Due date as sent. */
  dueDate: string;
  /** `null` means not submitted; otherwise the submission status (`Pending`, `Submitted`, `Under Review`, `Reviewed`, `Rejected`, ...). */
  status: string | null;
  fileCount: number;
  aiStatus: string;
}

export function parseHomeworkList(data: unknown): HomeworkItem[] {
  return list(data, (r) => {
    const status = r.status === null || r.status === undefined ? null : text(r.status).trim();
    return {
      id: text(r.id),
      title: text(r.title),
      subject: text(r.subject_name),
      date: text(r.date) || text(r.date_fmt),
      dueDate: text(r.submission_date) || text(r.submission_date_fmt),
      status: status === '' ? null : status,
      fileCount: Array.isArray(r.submission_files) ? r.submission_files.length : 0,
      aiStatus: text(r.ai_status),
    };
  });
}

/** The student's own homework, newest first as the server orders it. Token-bound: the app sends no student id. */
export async function fetchHomeworkList(): Promise<HomeworkItem[]> {
  const res = await api.post<unknown>('api/lms-homework/my-submissions');
  return parseHomeworkList(res.data);
}

export interface HomeworkSubmission {
  status: string;
  submittedAt: string;
  remarks: string;
  teacherRemarks: string;
  aiStatus: string;
  aiScore: number | null;
  aiTotal: number | null;
  aiPercentage: number | null;
  feedbackPublished: boolean;
  files: HomeworkFile[];
}

export interface HomeworkQuestion {
  id: string;
  /** Raw (may contain HTML): converted to plain text by the model before display. */
  title: string;
  description: string;
  points: number | null;
}

export interface HomeworkDetail {
  id: string;
  title: string;
  description: string;
  subject: string;
  standard: string;
  division: string;
  date: string;
  dueDate: string;
  teacher: string;
  referenceUrl: string;
  questions: HomeworkQuestion[];
  /** `null` until the student has submitted (the server sends at most one entry). */
  submission: HomeworkSubmission | null;
}

export function parseHomeworkDetail(data: unknown): HomeworkDetail {
  const d = isRecord(data) ? data : {};
  const h = isRecord(d.homework) ? d.homework : {};
  const first = Array.isArray(d.submissions) ? d.submissions.find(isRecord) : undefined;
  return {
    id: text(h.id),
    title: text(h.title),
    description: text(h.description),
    subject: text(h.subject_name),
    standard: text(h.standard_name),
    division: text(h.division_name),
    date: text(h.date),
    dueDate: text(h.submission_date),
    teacher: text(h.teacher_name),
    referenceUrl: text(h.reference_file_url),
    questions: list(h.questions, (q) => ({
      id: text(q.id),
      title: text(q.question_title),
      description: text(q.description),
      points: numOrNull(q.points),
    })),
    submission: first
      ? {
          status: text(first.status),
          submittedAt: text(first.submitted_at) || text(first.submitted_at_fmt),
          remarks: text(first.submission_remarks),
          teacherRemarks: text(first.teacher_remarks),
          aiStatus: text(first.ai_status),
          aiScore: numOrNull(first.ai_score),
          aiTotal: numOrNull(first.ai_total_questions),
          aiPercentage: numOrNull(first.ai_percentage),
          feedbackPublished: asBool(first.feedback_published),
          files: list(first.files, homeworkFile),
        }
      : null,
  };
}

/** A homework id is digits only; it comes from a list row and goes into a URL path, so anything else is refused. */
export const isHomeworkId = (id: string): boolean => /^\d{1,12}$/.test(id);

/**
 * One homework in full. `POST lms-homework/detail/{id}`: the server answers 404 for an unknown id and 403 for another
 * student's row. The id is validated before any request is made.
 */
export async function fetchHomeworkDetail(id: string): Promise<HomeworkDetail> {
  if (!isHomeworkId(id)) throw new ApiError('validation', 'This homework cannot be opened.');
  const res = await api.post<unknown>(`api/lms-homework/detail/${id}`);
  return parseHomeworkDetail(res.data);
}
