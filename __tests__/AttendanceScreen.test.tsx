import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { ApiError } from '../src/api/errors';
import { StudentAttendance } from '../src/api/student';
import { useAuthStore } from '../src/auth/authStore';
import { AuthUser } from '../src/auth/types';
import { MenuTile } from '../src/menu/types';
import { AttendanceScreen } from '../src/screens/student/AttendanceScreen';

jest.mock('../src/config/env', () => ({ env: { apiBaseUrl: 'https://dev.triz.co.in', appEnv: 'test', erpHosts: [] } }));
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));
jest.mock('../src/api/student', () => ({
  ...jest.requireActual('../src/api/student'),
  fetchStudentAttendance: jest.fn(),
}));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { fetchStudentAttendance } = require('../src/api/student') as { fetchStudentAttendance: jest.Mock };

const tile: MenuTile = {
  key: 'activity/student-attendance',
  title: 'Student Attendance',
  section: 'Activity',
  icon: null,
  api: 'https://erp.triz.co.in/studentAttendanceAPI',
  apiParam: null,
  screenName: 'student_attendance',
  renderType: 'native',
  webUrl: null,
  openMode: 'in_app',
};

const studentUser: AuthUser = {
  id: 123,
  email: 's@example.com',
  name: 'Test Student',
  subInstituteId: 7,
  userProfileId: 3,
  userProfileName: 'Student',
  isAdmin: 0,
  isStudent: true,
  clientId: null,
  syear: '2026',
  schoolName: 'School',
};

const row = (attendance_date: string, attendance_code: string) => ({ attendance_date, attendance_code });
const cal = (school_date: string, title: string, description = '', event_type = 'holiday') => ({ school_date, title, description, event_type });

const october: StudentAttendance = {
  attendance: [row('2026-10-01', 'P'), row('2026-10-02', 'P'), row('2026-10-03', 'A'), row('2026-10-05', 'P'), row('2026-10-06', 'L'), row('2026-10-07', '')],
  holiday: [cal('2026-10-02', 'Gandhi Jayanti', 'National holiday')],
  event: [cal('2026-10-10', 'Sports day', '', 'event')],
  vacation: [],
};

let client: QueryClient;
const renderScreen = () =>
  render(
    <QueryClientProvider client={client}>
      <AttendanceScreen tile={tile} />
    </QueryClientProvider>,
  );

const signIn = (user: Partial<AuthUser> = {}) =>
  useAuthStore.setState({ status: 'signedIn', token: 'jwt', user: { ...studentUser, ...user } });

beforeAll(() => {
  // Pin only Date: "today" must be a fixed day in October 2026; timers stay real for react-query.
  jest.useFakeTimers({
    now: new Date(2026, 9, 7, 12, 0, 0),
    doNotFake: ['nextTick', 'setImmediate', 'clearImmediate', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'queueMicrotask', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'hrtime'],
  });
});
afterAll(() => jest.useRealTimers());

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  fetchStudentAttendance.mockReset();
  signIn();
});

describe('AttendanceScreen', () => {
  it('shows the month summary, the calendar and the academic-year line for a student', async () => {
    fetchStudentAttendance.mockResolvedValue(october);
    await renderScreen();

    expect(await screen.findByText('75%')).toBeTruthy(); // 3 present / (3 present + 1 absent)
    expect(screen.getByLabelText('Present: 3')).toBeTruthy();
    expect(screen.getByLabelText('Absent: 1')).toBeTruthy();
    expect(screen.getByLabelText('Holidays: 1')).toBeTruthy();
    expect(screen.getByText('Attendance in October 2026')).toBeTruthy();
    expect(screen.getByText(/Academic year 2026: 3 present · 1 absent · 75%/)).toBeTruthy();
    expect(screen.getByText(/1 day\(s\) with another code are not counted/)).toBeTruthy();
    expect(fetchStudentAttendance).toHaveBeenCalledTimes(1);
  });

  it('every day cell has a screen-reader label; recorded attendance wins over a holiday (decision U-3)', async () => {
    fetchStudentAttendance.mockResolvedValue(october);
    await renderScreen();
    expect(await screen.findByLabelText('2 October 2026, Present, Holiday: Gandhi Jayanti')).toBeTruthy();
    expect(screen.getByLabelText('3 October 2026, Absent')).toBeTruthy();
    expect(screen.getByLabelText('6 October 2026, Other (L)')).toBeTruthy();
    expect(screen.getByLabelText('10 October 2026, No attendance recorded, Event: Sports day')).toBeTruthy();
  });

  it('tapping a day shows its detail, tapping it again hides it', async () => {
    fetchStudentAttendance.mockResolvedValue(october);
    await renderScreen();
    const cell = await screen.findByLabelText('2 October 2026, Present, Holiday: Gandhi Jayanti');
    await fireEvent.press(cell);
    expect(screen.getByText('2 October 2026')).toBeTruthy();
    expect(screen.getByText('Gandhi Jayanti')).toBeTruthy();
    expect(screen.getByText('National holiday')).toBeTruthy();
    await fireEvent.press(cell);
    expect(screen.queryByText('National holiday')).toBeNull();
  });

  it('month navigation is clamped to the data range', async () => {
    fetchStudentAttendance.mockResolvedValue({ ...october, attendance: [row('2026-09-30', 'A'), ...october.attendance] });
    await renderScreen();
    await screen.findByText('Attendance in October 2026');
    expect(screen.getByLabelText('Next month').props.accessibilityState.disabled).toBe(true); // already at the latest month
    await fireEvent.press(screen.getByLabelText('Previous month'));
    expect(await screen.findByText('Attendance in September 2026')).toBeTruthy();
    expect(screen.getByText('0%')).toBeTruthy(); // 1 absent, 0 present
    expect(screen.getByLabelText('Previous month').props.accessibilityState.disabled).toBe(true); // earliest month
  });

  it('shows the loading state first', async () => {
    fetchStudentAttendance.mockReturnValue(new Promise(() => {}));
    await renderScreen();
    expect(screen.getByText('Loading…')).toBeTruthy();
  });

  it('shows an error with Try again that refetches', async () => {
    fetchStudentAttendance.mockRejectedValueOnce(new ApiError('network', 'We could not reach the server. Check your connection and try again.'));
    await renderScreen();
    expect(await screen.findByText('We could not reach the server. Check your connection and try again.')).toBeTruthy();
    fetchStudentAttendance.mockResolvedValueOnce(october);
    await fireEvent.press(screen.getByText('Try again'));
    expect(await screen.findByText('75%')).toBeTruthy();
    expect(fetchStudentAttendance).toHaveBeenCalledTimes(2);
  });

  it('keeps showing the last data with a banner when a refresh fails', async () => {
    client.setQueryData(['student-attendance', 123, '2026'], october, { updatedAt: 0 }); // stale, so it refetches on mount
    fetchStudentAttendance.mockRejectedValue(new ApiError('network', 'offline'));
    await renderScreen();
    expect(await screen.findByText(/Couldn't refresh — showing the last loaded data/)).toBeTruthy();
    expect(screen.getByText('75%')).toBeTruthy();
  });

  it('shows an empty state when there is no attendance and no calendar data', async () => {
    fetchStudentAttendance.mockResolvedValue({ attendance: [], holiday: [], event: [], vacation: [] });
    await renderScreen();
    expect(await screen.findByText('No attendance recorded yet')).toBeTruthy();
    expect(screen.queryByText('Previous month')).toBeNull();
  });

  it('does not call the API and explains when the school year is not set', async () => {
    signIn({ syear: null });
    await renderScreen();
    expect(screen.getByText('School year not set')).toBeTruthy();
    expect(fetchStudentAttendance).not.toHaveBeenCalled();
  });

  it('is students-only: a staff session sees no data and makes no request', async () => {
    signIn({ isStudent: false, userProfileName: 'Teacher' });
    await renderScreen();
    expect(screen.getByText('Students only')).toBeTruthy();
    expect(fetchStudentAttendance).not.toHaveBeenCalled();
  });

  it('keys the cache by user, so another student never sees cached data', async () => {
    fetchStudentAttendance.mockResolvedValue(october);
    client.setQueryData(['student-attendance', 999, '2026'], { attendance: [row('2026-10-01', 'A')], holiday: [], event: [], vacation: [] });
    await renderScreen();
    expect(await screen.findByText('75%')).toBeTruthy(); // student 123's data, not 999's
  });
});
