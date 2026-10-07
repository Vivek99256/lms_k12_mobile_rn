import { screenRegistry } from '../src/screens/registry';
import { AcademicCalendarScreen } from '../src/screens/student/AcademicCalendarScreen';
import { AttendanceScreen } from '../src/screens/student/AttendanceScreen';
import { CircularsScreen } from '../src/screens/student/CircularsScreen';
import { ExamScheduleScreen } from '../src/screens/student/ExamScheduleScreen';
import { FeesSummaryScreen } from '../src/screens/student/FeesSummaryScreen';
import { HolidayListScreen } from '../src/screens/student/HolidayListScreen';
import { HomeworkScreen } from '../src/screens/student/HomeworkScreen';
import { NotificationHubScreen } from '../src/screens/student/NotificationHubScreen';
import { CertificatesScreen, ConsentScreen, DisciplineScreen, HealthDetailsScreen, HeightWeightScreen, InfirmaryScreen, TransportScreen, VaccinationScreen } from '../src/screens/student/RecordScreens';
import { PhotoGalleryScreen, VideoGalleryScreen } from '../src/screens/student/GalleryScreen';
import { SchoolInfoScreen } from '../src/screens/student/SchoolInfoScreen';
import { SocialCollaborativeScreen } from '../src/screens/student/SocialCollaborativeScreen';
import { RecordUnavailableScreen } from '../src/screens/student/RecordUnavailableScreen';
import { ResultPdfScreen } from '../src/screens/student/ResultPdfScreen';
import { LeaveApplicationsScreen } from '../src/screens/student/LeaveApplicationsScreen';
import { ParentCommunicationScreen } from '../src/screens/student/ParentCommunicationScreen';
import { SubjectTeachersScreen } from '../src/screens/student/SubjectTeachersScreen';
import { TimetableScreen } from '../src/screens/student/TimetableScreen';

jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));

describe('screenRegistry', () => {
  it('maps the backend screen_name student_attendance to the dedicated screen (S2)', () => {
    expect(screenRegistry.student_attendance).toBe(AttendanceScreen);
  });

  it('maps the four S1 tiles to their dedicated screens', () => {
    expect(screenRegistry.academic_calendar).toBe(AcademicCalendarScreen);
    expect(screenRegistry.holiday_list).toBe(HolidayListScreen);
    expect(screenRegistry.notification_hub).toBe(NotificationHubScreen);
    expect(screenRegistry.circular_events).toBe(CircularsScreen);
  });

  it('maps the two S3 tiles to their dedicated screens', () => {
    expect(screenRegistry.time_table).toBe(TimetableScreen);
    expect(screenRegistry.exam_schedule).toBe(ExamScheduleScreen);
  });

  it('maps the S4a tile to the homework screen', () => {
    expect(screenRegistry.home_work).toBe(HomeworkScreen);
  });

  it('maps the S6a tile to the fees summary screen', () => {
    expect(screenRegistry.fees).toBe(FeesSummaryScreen);
  });

  it('maps the S5a tile to the result PDF screen', () => {
    expect(screenRegistry.result_pdf).toBe(ResultPdfScreen);
  });

  it('maps the three S7 tiles to their view-only screens', () => {
    expect(screenRegistry.subjects).toBe(SubjectTeachersScreen);
    expect(screenRegistry.leave_application).toBe(LeaveApplicationsScreen);
    expect(screenRegistry.parent_communication).toBe(ParentCommunicationScreen);
  });

  it('maps the S9 tiles to the record lists and the two blocked tiles to the unavailable message', () => {
    expect(screenRegistry.height_weight).toBe(HeightWeightScreen);
    expect(screenRegistry.student_vaccination).toBe(VaccinationScreen);
    expect(screenRegistry.health_details).toBe(HealthDetailsScreen);
    expect(screenRegistry.student_infirmary).toBe(InfirmaryScreen);
    expect(screenRegistry.student_consent).toBe(ConsentScreen);
    expect(screenRegistry.student_transport).toBe(TransportScreen);
    expect(screenRegistry.student_certificate).toBe(CertificatesScreen);
    expect(screenRegistry.student_hostel).toBe(RecordUnavailableScreen);
    expect(screenRegistry.achievement_certificate).toBe(RecordUnavailableScreen);
  });

  it('maps the S10 tiles: nine school-information pages, two galleries, and the classwork tile to the unavailable message', () => {
    for (const n of ['about_us', 'principal_desk', 'school_information', 'achievement', 'school_timing', 'rules', 'facility', 'acadamic_activity', 'reach_us']) {
      expect(screenRegistry[n]).toBe(SchoolInfoScreen);
    }
    expect(screenRegistry.photos_gallery).toBe(PhotoGalleryScreen);
    expect(screenRegistry.video_gallery).toBe(VideoGalleryScreen);
    expect(screenRegistry.classwork_gallery).toBe(RecordUnavailableScreen);
  });

  it('maps the S8 tiles: Social Collaborative to its screen; Learn and Live Lecture to the unavailable message', () => {
    expect(screenRegistry.social_collabrative).toBe(SocialCollaborativeScreen);
    expect(screenRegistry.lms_subject).toBe(RecordUnavailableScreen);
    expect(screenRegistry.live_lecture).toBe(RecordUnavailableScreen);
  });

  it('maps the S9c Student Discipline tile (child_remark) to its view-only list', () => {
    expect(screenRegistry.child_remark).toBe(DisciplineScreen);
  });

  it('has exactly the registered student screens and claims no staff names (they keep their existing fallback)', () => {
    expect(Object.keys(screenRegistry).sort()).toEqual([
      'about_us',
      'acadamic_activity',
      'academic_calendar',
      'achievement',
      'achievement_certificate',
      'child_remark',
      'circular_events',
      'classwork_gallery',
      'exam_schedule',
      'facility',
      'fees',
      'health_details',
      'height_weight',
      'holiday_list',
      'home_work',
      'leave_application',
      'live_lecture',
      'lms_subject',
      'notification_hub',
      'parent_communication',
      'photos_gallery',
      'principal_desk',
      'reach_us',
      'result_pdf',
      'rules',
      'school_information',
      'school_timing',
      'social_collabrative',
      'student_attendance',
      'student_certificate',
      'student_consent',
      'student_hostel',
      'student_infirmary',
      'student_transport',
      'student_vaccination',
      'subjects',
      'time_table',
      'video_gallery',
    ]);
    expect(screenRegistry.t_take_attendance).toBeUndefined();
    expect(screenRegistry.t_circular).toBeUndefined();
    expect(screenRegistry.t_calander).toBeUndefined();
    expect(screenRegistry.t_timetable).toBeUndefined(); // the teacher tiles are different screens
    expect(screenRegistry.t_exam_schedule).toBeUndefined();
    expect(screenRegistry.t_homework).toBeUndefined(); // the teacher's homework tile is a different screen
    expect(screenRegistry.something_else).toBeUndefined();
  });
});
