import { screenRegistry } from '../src/screens/registry';
import { AttendanceScreen } from '../src/screens/student/AttendanceScreen';

jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));

describe('screenRegistry', () => {
  it('maps the backend screen_name student_attendance to the dedicated screen (S2)', () => {
    expect(screenRegistry.student_attendance).toBe(AttendanceScreen);
  });

  it('does not claim staff attendance names or unknown screens (they keep their existing fallback)', () => {
    expect(screenRegistry.t_take_attendance).toBeUndefined();
    expect(screenRegistry.t_my_attendance).toBeUndefined();
    expect(screenRegistry.something_else).toBeUndefined();
  });
});
