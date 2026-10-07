import { screenRegistry } from '../src/screens/registry';
import { AcademicCalendarScreen } from '../src/screens/student/AcademicCalendarScreen';
import { AttendanceScreen } from '../src/screens/student/AttendanceScreen';
import { CircularsScreen } from '../src/screens/student/CircularsScreen';
import { HolidayListScreen } from '../src/screens/student/HolidayListScreen';
import { NotificationHubScreen } from '../src/screens/student/NotificationHubScreen';

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

  it('has exactly the registered student screens and claims no staff names (they keep their existing fallback)', () => {
    expect(Object.keys(screenRegistry).sort()).toEqual([
      'academic_calendar',
      'circular_events',
      'holiday_list',
      'notification_hub',
      'student_attendance',
    ]);
    expect(screenRegistry.t_take_attendance).toBeUndefined();
    expect(screenRegistry.t_circular).toBeUndefined();
    expect(screenRegistry.t_calander).toBeUndefined();
    expect(screenRegistry.something_else).toBeUndefined();
  });
});
