import { fireEvent, screen } from '@testing-library/react-native';
import React from 'react';
import { ApiError } from '../src/api/errors';
import { TimetableEntry } from '../src/api/student';
import { TimetableScreen } from '../src/screens/student/TimetableScreen';
import { makeClient, pinToday, renderWith, signIn, tile } from './helpers/kit';

jest.mock('../src/config/env', () => ({ env: { apiBaseUrl: 'https://dev.triz.co.in', appEnv: 'test', erpHosts: [] } }));
jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock('../src/api/student', () => ({ ...jest.requireActual('../src/api/student'), fetchTimetable: jest.fn() }));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { fetchTimetable } = require('../src/api/student') as { fetchTimetable: jest.Mock };

const row = (over: Partial<TimetableEntry>): TimetableEntry => ({
  weekDay: 'Mon',
  periodId: '1',
  periodName: 'Period 1',
  startTime: '09:00:00',
  endTime: '09:45:00',
  subject: 'Maths',
  teacher: 'Mrs Shah',
  ...over,
});

// Wednesday (the pinned "today") is deliberately given out of order, with a batch period, an untimed one and PM times.
const rows: TimetableEntry[] = [
  row({ weekDay: 'Mon', periodId: '2', periodName: 'Period 2', startTime: '09:45:00', endTime: '10:30:00', subject: 'Science', teacher: 'Mr Rao' }),
  row({ weekDay: 'Mon' }),
  row({ weekDay: 'Wed', periodId: '3', periodName: 'Period 3', startTime: '11:00:00', endTime: '11:45:00', subject: 'English', teacher: 'Ms Dsouza' }),
  row({ weekDay: 'Wed', periodId: '1', periodName: 'Period 1', startTime: '08:15:00', endTime: '09:00:00', subject: 'Hindi', teacher: 'Mr Jain' }),
  row({ weekDay: 'Wed', periodId: '5', periodName: 'Period 5', startTime: '13:05:00', endTime: '13:50:00', subject: 'Sanskrit,French', teacher: 'Mr A,Mrs B' }),
  row({ weekDay: 'Wed', periodId: '9', periodName: '', startTime: '', endTime: '', subject: 'Art', teacher: '' }),
  row({ weekDay: 'Wed', periodId: '4', periodName: 'Period 4', startTime: '12:00:00', endTime: '12:45:00', subject: 'Social', teacher: 'Mr Nair' }),
];
const withOther: TimetableEntry[] = [...rows, row({ weekDay: '', periodId: '7', periodName: 'Library', startTime: '14:00:00', endTime: '14:40:00', subject: 'Reading hour', teacher: '' })];

let client = makeClient();
const ui = () => renderWith(client, <TimetableScreen tile={tile('time_table')} />);
const periodLabels = () => screen.getAllByLabelText(/^Period/).map((n) => n.props.accessibilityLabel as string);

beforeAll(() => pinToday()); // Wednesday 7 October 2026
afterAll(() => jest.useRealTimers());
beforeEach(() => {
  jest.setSystemTime(new Date(2026, 9, 7, 12, 0, 0));
  client = makeClient();
  fetchTimetable.mockReset();
  signIn();
});

describe('TimetableScreen - success', () => {
  it('loads and opens on today (Wednesday) with its periods in start-time order, 12-hour times, text as sent', async () => {
    fetchTimetable.mockResolvedValue(rows);
    await ui();
    expect(await screen.findByText('School year 2026')).toBeTruthy();
    expect(screen.getByLabelText('Wednesday, today').props.accessibilityState.selected).toBe(true);
    expect(periodLabels()).toEqual([
      'Period 1, 8:15 AM to 9:00 AM, Hindi, Mr Jain',
      'Period 3, 11:00 AM to 11:45 AM, English, Ms Dsouza',
      'Period 4, 12:00 PM to 12:45 PM, Social, Mr Nair',
      'Period 5, 1:05 PM to 1:50 PM, Sanskrit,French, Mr A,Mrs B',
      'Period, Art', // no readable time: last
    ]);
    expect(screen.getByText('8:15 AM – 9:00 AM')).toBeTruthy();
    expect(screen.getByText('Sanskrit,French')).toBeTruthy(); // not split
    expect(fetchTimetable).toHaveBeenCalledTimes(1);
  });

  it('picking another day shows that day\'s periods', async () => {
    fetchTimetable.mockResolvedValue(rows);
    await ui();
    await fireEvent.press(await screen.findByLabelText('Monday'));
    expect(screen.getByLabelText('Monday').props.accessibilityState.selected).toBe(true);
    expect(periodLabels()).toEqual(['Period 1, 9:00 AM to 9:45 AM, Maths, Mrs Shah', 'Period 2, 9:45 AM to 10:30 AM, Science, Mr Rao']);
  });

  it('a day with no periods says so, and its chip says nothing is scheduled', async () => {
    fetchTimetable.mockResolvedValue(rows);
    await ui();
    await fireEvent.press(await screen.findByLabelText('Saturday, nothing scheduled'));
    expect(screen.getByText('No periods on Saturday.')).toBeTruthy();
    expect(screen.queryAllByLabelText(/^Period/)).toHaveLength(0);
  });

  it('shows the Monday-to-Saturday strip and no Sunday chip', async () => {
    fetchTimetable.mockResolvedValue(rows);
    await ui();
    await screen.findByText('School year 2026');
    const tabs = screen.getAllByRole('tab').map((t) => t.props.accessibilityLabel as string);
    expect(tabs).toEqual(['Monday', 'Tuesday, nothing scheduled', 'Wednesday, today', 'Thursday, nothing scheduled', 'Friday, nothing scheduled', 'Saturday, nothing scheduled']);
  });
});

describe('TimetableScreen - Sunday and Monday behaviour (S3-D2)', () => {
  it('opens on Monday on a Sunday and marks no chip as today', async () => {
    jest.setSystemTime(new Date(2026, 9, 11, 12, 0, 0)); // Sunday
    fetchTimetable.mockResolvedValue(rows);
    await ui();
    await screen.findByText('School year 2026');
    expect(screen.getByLabelText('Monday').props.accessibilityState.selected).toBe(true);
    expect(screen.queryByLabelText(/today/)).toBeNull();
    expect(periodLabels()).toHaveLength(2);
  });

  it('opens on Monday when today is Monday', async () => {
    jest.setSystemTime(new Date(2026, 9, 5, 12, 0, 0)); // Monday
    fetchTimetable.mockResolvedValue(rows);
    await ui();
    expect(await screen.findByLabelText('Monday, today')).toBeTruthy();
    expect(screen.getByLabelText('Monday, today').props.accessibilityState.selected).toBe(true);
  });

  it('opens on Saturday when today is Saturday, even with nothing scheduled that day', async () => {
    jest.setSystemTime(new Date(2026, 9, 10, 12, 0, 0)); // Saturday
    fetchTimetable.mockResolvedValue(rows);
    await ui();
    expect(await screen.findByText('No periods on Saturday.')).toBeTruthy();
  });
});

describe('TimetableScreen - unknown or missing weekday', () => {
  it('adds an "Other days" chip only when the server sent such periods, and keeps them reachable', async () => {
    fetchTimetable.mockResolvedValue(withOther);
    await ui();
    await fireEvent.press(await screen.findByLabelText('Other days'));
    expect(screen.getByText('Periods without a weekday from your school.')).toBeTruthy();
    expect(screen.getByText('Reading hour')).toBeTruthy();
    expect(screen.getByText('2:00 PM – 2:40 PM')).toBeTruthy();
  });

  it('shows no Other chip when every period has a weekday', async () => {
    fetchTimetable.mockResolvedValue(rows);
    await ui();
    await screen.findByText('School year 2026');
    expect(screen.queryByLabelText('Other days')).toBeNull();
  });

  it('a timetable made only of unmapped periods is not "empty": the Other chip is the way in', async () => {
    fetchTimetable.mockResolvedValue([row({ weekDay: 'Sunday', subject: 'Camp' })]);
    await ui();
    expect(await screen.findByLabelText('Other days')).toBeTruthy();
    expect(screen.queryByText('No timetable published yet')).toBeNull();
  });
});

describe('TimetableScreen - empty, loading, error and stale states', () => {
  it('shows an empty state naming the school year when there are no periods', async () => {
    fetchTimetable.mockResolvedValue([]);
    await ui();
    expect(await screen.findByText('No timetable published yet')).toBeTruthy();
    expect(screen.getByText(/school year 2026/)).toBeTruthy();
  });

  it('rows with nothing to show do not count as a timetable', async () => {
    fetchTimetable.mockResolvedValue([row({ subject: '', periodName: '', startTime: '', endTime: '' })]);
    await ui();
    expect(await screen.findByText('No timetable published yet')).toBeTruthy();
  });

  it('shows the loading state first', async () => {
    fetchTimetable.mockReturnValue(new Promise(() => {}));
    await ui();
    expect(screen.getByText('Loading…')).toBeTruthy();
  });

  it('shows an error with Try again that refetches', async () => {
    fetchTimetable.mockRejectedValueOnce(new ApiError('network', 'We could not reach the server. Check your connection and try again.'));
    await ui();
    expect(await screen.findByText('We could not reach the server. Check your connection and try again.')).toBeTruthy();
    fetchTimetable.mockResolvedValueOnce(rows);
    await fireEvent.press(screen.getByText('Try again'));
    expect(await screen.findByText('School year 2026')).toBeTruthy();
    expect(fetchTimetable).toHaveBeenCalledTimes(2);
  });

  it('shows the 419 server-address message', async () => {
    fetchTimetable.mockRejectedValue(new ApiError('server', "The server rejected the request. Check the app's server address.", 419));
    await ui();
    expect(await screen.findByText(/server address/)).toBeTruthy();
  });

  it('keeps the last timetable with a banner when a refresh fails', async () => {
    client.setQueryData(['student-timetable', 123, '2026'], rows, { updatedAt: 0 });
    fetchTimetable.mockRejectedValue(new ApiError('network', 'offline'));
    await ui();
    expect(await screen.findByText(/Couldn't refresh — showing the last loaded data/)).toBeTruthy();
    expect(screen.getAllByLabelText(/^Period/).length).toBeGreaterThan(0);
  });
});

describe('TimetableScreen - authentication and identity', () => {
  it('makes no request and explains when the school year is missing', async () => {
    signIn({ syear: null });
    await ui();
    expect(screen.getByText('School year not set')).toBeTruthy();
    expect(fetchTimetable).not.toHaveBeenCalled();
  });

  it('makes no request for a non-student session', async () => {
    signIn({ isStudent: false, userProfileName: 'Teacher' });
    await ui();
    expect(screen.getByText('Students only')).toBeTruthy();
    expect(fetchTimetable).not.toHaveBeenCalled();
  });

  it('never shows another user\'s cached timetable (cache is keyed by user)', async () => {
    client.setQueryData(['student-timetable', 999, '2026'], [row({ weekDay: 'Wed', subject: 'SECRET OF 999' })]);
    fetchTimetable.mockResolvedValue(rows);
    await ui();
    await screen.findByText('Hindi');
    expect(screen.queryByText('SECRET OF 999')).toBeNull();
  });
});
