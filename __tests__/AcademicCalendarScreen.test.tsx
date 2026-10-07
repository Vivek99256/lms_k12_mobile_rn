import { fireEvent, screen } from '@testing-library/react-native';
import React from 'react';
import { ApiError } from '../src/api/errors';
import { CalendarRow } from '../src/api/student';
import { AcademicCalendarScreen } from '../src/screens/student/AcademicCalendarScreen';
import { makeClient, pinToday, renderWith, signIn, tile } from './helpers/kit';

jest.mock('../src/config/env', () => ({ env: { apiBaseUrl: 'https://dev.triz.co.in', appEnv: 'test', erpHosts: [] } }));
jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock('../src/api/student', () => ({ ...jest.requireActual('../src/api/student'), fetchStudentCalendar: jest.fn() }));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { fetchStudentCalendar } = require('../src/api/student') as { fetchStudentCalendar: jest.Mock };

const row = (school_date: string, title: string, event_type: string, description = ''): CalendarRow => ({ school_date, title, description, event_type });
const rows: CalendarRow[] = [
  row('2026-09-21', 'Ganesh Chaturthi', 'holiday'),
  row('2026-10-02', 'Gandhi Jayanti', 'holiday', 'National holiday'),
  row('2026-10-10', 'Sports day', 'event'),
  row('2026-10-20', 'Diwali break', 'vacation'),
  row('', '', ''), // the all-NULL row an enrollment without events produces
];

let client = makeClient();
const ui = () => renderWith(client, <AcademicCalendarScreen tile={tile('academic_calendar')} />);

beforeAll(pinToday);
afterAll(() => jest.useRealTimers());
beforeEach(() => {
  client = makeClient();
  fetchStudentCalendar.mockReset();
  signIn();
});

describe('AcademicCalendarScreen', () => {
  it('shows the month grid and this month\'s events, ignoring the all-NULL row', async () => {
    fetchStudentCalendar.mockResolvedValue(rows);
    await ui();
    expect(await screen.findByText('October 2026')).toBeTruthy();
    expect(screen.getByText('In October 2026')).toBeTruthy();
    expect(screen.getByText('Gandhi Jayanti')).toBeTruthy();
    expect(screen.getByText('Sports day')).toBeTruthy();
    expect(screen.getByText('Diwali break')).toBeTruthy();
    expect(screen.queryByText('Ganesh Chaturthi')).toBeNull(); // September
    expect(fetchStudentCalendar).toHaveBeenCalledWith(undefined); // no action: every event type
  });

  it('day cells carry labels without any attendance wording', async () => {
    fetchStudentCalendar.mockResolvedValue(rows);
    await ui();
    expect(await screen.findByLabelText('2 October 2026, Holiday: Gandhi Jayanti')).toBeTruthy();
    expect(screen.getByLabelText('20 October 2026, Vacation: Diwali break')).toBeTruthy();
    expect(screen.queryByLabelText(/attendance/i)).toBeNull();
  });

  it('tapping a day shows its detail, tapping again hides it', async () => {
    fetchStudentCalendar.mockResolvedValue(rows);
    await ui();
    const cell = await screen.findByLabelText('2 October 2026, Holiday: Gandhi Jayanti');
    await fireEvent.press(cell);
    expect(screen.getByText('2 October 2026')).toBeTruthy();
    expect(screen.getAllByText('National holiday').length).toBeGreaterThan(1); // in the detail card and in the month list
    await fireEvent.press(cell);
    expect(screen.queryByText('2 October 2026')).toBeNull();
  });

  it('navigates back to a month with events and is clamped to the data range', async () => {
    fetchStudentCalendar.mockResolvedValue(rows);
    await ui();
    await screen.findByText('October 2026');
    expect(screen.getByLabelText('Next month').props.accessibilityState.disabled).toBe(true); // latest event is in October
    await fireEvent.press(screen.getByLabelText('Previous month'));
    expect(await screen.findByText('In September 2026')).toBeTruthy();
    expect(screen.getByText('Ganesh Chaturthi')).toBeTruthy();
    expect(screen.getByLabelText('Previous month').props.accessibilityState.disabled).toBe(true); // earliest event is in September
  });

  it('says so when a month has nothing scheduled', async () => {
    fetchStudentCalendar.mockResolvedValue([row('2026-08-15', 'Independence Day', 'holiday'), row('2026-10-02', 'Gandhi Jayanti', 'holiday')]);
    await ui();
    await screen.findByText('October 2026');
    await fireEvent.press(screen.getByLabelText('Previous month')); // September: between the two events, nothing scheduled
    expect(await screen.findByText('In September 2026')).toBeTruthy();
    expect(screen.getByText('Nothing scheduled this month.')).toBeTruthy();
  });

  it('treats an unknown event type as an event', async () => {
    fetchStudentCalendar.mockResolvedValue([row('2026-10-12', 'Parent meeting', 'meeting')]);
    await ui();
    expect(await screen.findByLabelText('12 October 2026, Event: Parent meeting')).toBeTruthy();
  });

  it('shows an empty state for no events, and for only the all-NULL row', async () => {
    fetchStudentCalendar.mockResolvedValue([row('', '', '')]);
    await ui();
    expect(await screen.findByText('No events in the calendar')).toBeTruthy();
  });

  it('shows loading, then an error with Try again that refetches', async () => {
    fetchStudentCalendar.mockRejectedValueOnce(new ApiError('network', 'We could not reach the server. Check your connection and try again.'));
    await ui();
    expect(await screen.findByText('We could not reach the server. Check your connection and try again.')).toBeTruthy();
    fetchStudentCalendar.mockResolvedValueOnce(rows);
    await fireEvent.press(screen.getByText('Try again'));
    expect(await screen.findByText('October 2026')).toBeTruthy();
    expect(fetchStudentCalendar).toHaveBeenCalledTimes(2);
  });

  it('keeps the last data with a banner when a refresh fails', async () => {
    client.setQueryData(['student-calendar', 123, '2026', 'all'], rows, { updatedAt: 0 });
    fetchStudentCalendar.mockRejectedValue(new ApiError('network', 'offline'));
    await ui();
    expect(await screen.findByText(/Couldn't refresh — showing the last loaded data/)).toBeTruthy();
    expect(screen.getByText('Gandhi Jayanti')).toBeTruthy();
  });

  it('makes no request without a school year', async () => {
    signIn({ syear: null });
    await ui();
    expect(screen.getByText('School year not set')).toBeTruthy();
    expect(fetchStudentCalendar).not.toHaveBeenCalled();
  });

  it('makes no request for a non-student session', async () => {
    signIn({ isStudent: false, userProfileName: 'Teacher' });
    await ui();
    expect(screen.getByText('Students only')).toBeTruthy();
    expect(fetchStudentCalendar).not.toHaveBeenCalled();
  });
});
