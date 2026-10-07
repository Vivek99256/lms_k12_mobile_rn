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
import { CertificatesScreen, ConsentScreen, DisciplineScreen, HealthDetailsScreen, HeightWeightScreen, InfirmaryScreen, TransportScreen, VaccinationScreen } from './student/RecordScreens';
import { RecordUnavailableScreen } from './student/RecordUnavailableScreen';
import { PhotoGalleryScreen, VideoGalleryScreen } from './student/GalleryScreen';
import { ResultPdfScreen } from './student/ResultPdfScreen';
import { SchoolInfoScreen } from './student/SchoolInfoScreen';
import { SocialCollaborativeScreen } from './student/SocialCollaborativeScreen';
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
  // S9 - my records, view only (JWT-checked legacy read endpoints; tiles' stored api ignored)
  height_weight: HeightWeightScreen,
  student_vaccination: VaccinationScreen,
  health_details: HealthDetailsScreen,
  student_infirmary: InfirmaryScreen,
  student_consent: ConsentScreen,
  student_transport: TransportScreen,
  student_certificate: CertificatesScreen,
  // S9c - Student Discipline, view only (studentDisciplineAPI; the tile's stored api is ignored).
  child_remark: DisciplineScreen,
  // Hostel and Achievement Certificate cannot work for token callers (backend reads the school from session()):
  // an honest message, no request.
  student_hostel: RecordUnavailableScreen,
  achievement_certificate: RecordUnavailableScreen,
  // S10 - school information (schoolDetailAPI, fixed action text per page) and photo / video galleries, view only.
  about_us: SchoolInfoScreen,
  principal_desk: SchoolInfoScreen,
  school_information: SchoolInfoScreen,
  achievement: SchoolInfoScreen,
  school_timing: SchoolInfoScreen,
  rules: SchoolInfoScreen,
  facility: SchoolInfoScreen,
  acadamic_activity: SchoolInfoScreen,
  reach_us: SchoolInfoScreen,
  photos_gallery: PhotoGalleryScreen,
  video_gallery: VideoGalleryScreen,
  // The classwork gallery's only endpoint (front_desk/send_attachment/create) embeds staff passwords in every row:
  // it is never called; an honest message instead.
  classwork_gallery: RecordUnavailableScreen,
  // S8 - Social Collaborative: the student's OWN discussions only (modern token-bound API, always mine=1), view only.
  social_collabrative: SocialCollaborativeScreen,
  // Learn: the content endpoint (studentContentAPI) is never called; Live Lecture has no endpoint. Honest message, no request.
  lms_subject: RecordUnavailableScreen,
  live_lecture: RecordUnavailableScreen,
};

export function registerScreens(entries: Record<string, TileScreenComponent>) {
  Object.assign(screenRegistry, entries);
}
