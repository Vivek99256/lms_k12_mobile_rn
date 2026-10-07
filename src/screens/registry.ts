import React from 'react';
import { MenuTile } from '../menu/types';
import { AcademicCalendarScreen } from './student/AcademicCalendarScreen';
import { AttendanceScreen } from './student/AttendanceScreen';
import { CircularsScreen } from './student/CircularsScreen';
import { ExamScheduleScreen } from './student/ExamScheduleScreen';
import { FeesSummaryScreen } from './student/FeesSummaryScreen';
import { HolidayListScreen } from './student/HolidayListScreen';
import { HomeworkScreen } from './student/HomeworkScreen';
import { NotificationHubScreen } from './student/NotificationHubScreen';
import { LeaveApplicationsScreen } from './student/LeaveApplicationsScreen';
import { ParentCommunicationScreen } from './student/ParentCommunicationScreen';
import { ResultPdfScreen } from './student/ResultPdfScreen';
import { SubjectTeachersScreen } from './student/SubjectTeachersScreen';
import { TimetableScreen } from './student/TimetableScreen';

export type TileScreenComponent = React.ComponentType<{ tile: MenuTile }>;

/**
 * screen_name (from the backend menu) -> dedicated native screen.
 * A tile only reaches one of these after the guard has confirmed the backend listed it for
 * this user; a screen_name with no entry here falls back to the generic API screen.
 */
export const screenRegistry: Record<string, TileScreenComponent> = {
  // S2 - student attendance (studentAttendanceAPI)
  student_attendance: AttendanceScreen,
  // S1 - student home (studentCalenderAPI, notificationHubAPI, circular/fetchData)
  academic_calendar: AcademicCalendarScreen,
  holiday_list: HolidayListScreen,
  notification_hub: NotificationHubScreen,
  circular_events: CircularsScreen,
  // S3 - timetable and exam schedule (studentTimetableAPI, studentExamScheduleAPI)
  time_table: TimetableScreen,
  exam_schedule: ExamScheduleScreen,
  // S4a - homework list/detail, view only (lms-homework/my-submissions, lms-homework/detail/{id})
  home_work: HomeworkScreen,
  // S6a - fees summary, view only (fees/PaidUnpaid, legacy form-encoded; no payment or receipt)
  fees: FeesSummaryScreen,
  // S5a - result PDFs, view only (uploadResultAPI, legacy form-encoded; files open in the phone's viewer)
  result_pdf: ResultPdfScreen,
  // S7 - subject teachers, leave applications and messages to school, view only (legacy read endpoints; the
  // tiles' stored api is ignored - parent_communication stores the WRITE endpoint add_communicationAPI)
  subjects: SubjectTeachersScreen,
  leave_application: LeaveApplicationsScreen,
  parent_communication: ParentCommunicationScreen,
};

export function registerScreens(entries: Record<string, TileScreenComponent>) {
  Object.assign(screenRegistry, entries);
}
