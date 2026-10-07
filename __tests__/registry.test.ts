import { screenRegistry } from '../src/screens/registry';
import { AcademicCalendarScreen } from '../src/screens/student/AcademicCalendarScreen';
import { AttendanceScreen } from '../src/screens/student/AttendanceScreen';
import { CircularsScreen } from '../src/screens/student/CircularsScreen';
import { ExamScheduleScreen } from '../src/screens/student/ExamScheduleScreen';
import { FeesSummaryScreen } from '../src/screens/student/FeesSummaryScreen';
import { HolidayListScreen } from '../src/screens/student/HolidayListScreen';
import { HomeworkScreen } from '../src/screens/student/HomeworkScreen';
import { NotificationHubScreen } from '../src/screens/student/NotificationHubScreen';
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

  it('has exactly the registered student screens and claims no staff names (they keep their existing fallback)', () => {
    expect(Object.keys(screenRegistry).sort()).toEqual([
      'academic_calendar',
      'circular_events',
      'exam_schedule',
      'fees',
      'holiday_list',
      'home_work',
      'notification_hub',
      'student_attendance',
      'time_table',
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
