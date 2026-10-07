import { fireEvent, screen } from '@testing-library/react-native';
import React from 'react';
import { ApiError } from '../src/api/errors';
import { CalendarRow } from '../src/api/student';
import { HolidayListScreen } from '../src/screens/student/HolidayListScreen';
import { makeClient, renderWith, signIn, tile } from './helpers/kit';

jest.mock('../src/config/env', () => ({ env: { apiBaseUrl: 'https://dev.triz.co.in', appEnv: 'test', erpHosts: [] } }));
jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock('../src/api/student', () => ({ ...jest.requireActual('../src/api/student'), fetchStudentCalendar: jest.fn() }));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { fetchStudentCalendar } = require('../src/api/student') as { fetchStudentCalendar: jest.Mock };

const row = (school_date: string, title: string, event_type = 'holiday', description = ''): CalendarRow => ({ school_date, title, description, event_type });

let client = makeClient();
const ui = () => renderWith(client, <HolidayListScreen tile={tile('holiday_list')} />);

beforeEach(() => {
  client = makeClient();
  fetchStudentCalendar.mockReset();
  signIn();
});

describe('HolidayListScreen', () => {
  it('asks the server for holidays only and lists them by month in date order', async () => {
    fetchStudentCalendar.mockResolvedValue([
      row('2026-11-12', 'Diwali', 'holiday', 'Festival of lights'),
      row('2026-10-02', 'Gandhi Jayanti'),
      row('2026-10-24', 'Dussehra'),
    ]);
    await ui();
    expect(await screen.findByText('October 2026')).toBeTruthy();
    expect(fetchStudentCalendar).toHaveBeenCalledWith('holiday');
    expect(screen.getByText('November 2026')).toBeTruthy();
    expect(screen.getByText('Festival of lights')).toBeTruthy();
    const labels = screen.getAllByLabelText(/^\d+ \w+ 2026, /).map((n) => n.props.accessibilityLabel);
    expect(labels).toEqual(['2 Oct 2026, Gandhi Jayanti', '24 Oct 2026, Dussehra', '12 Nov 2026, Diwali']);
  });

  it('never shows a row that is not a holiday, nor a row without a date', async () => {
    fetchStudentCalendar.mockResolvedValue([row('2026-10-02', 'Gandhi Jayanti'), row('2026-10-10', 'Sports day', 'event'), row('', '', '')]);
    await ui();
    expect(await screen.findByText('Gandhi Jayanti')).toBeTruthy();
    expect(screen.queryByText('Sports day')).toBeNull();
  });

  it('shows an empty state when there are no holidays', async () => {
    fetchStudentCalendar.mockResolvedValue([]);
    await ui();
    expect(await screen.findByText('No holidays listed')).toBeTruthy();
  });

  it('shows an error with Try again that refetches', async () => {
    fetchStudentCalendar.mockRejectedValueOnce(new ApiError('server', 'The server had a problem. Please try again shortly.', 500));
    await ui();
    expect(await screen.findByText('The server had a problem. Please try again shortly.')).toBeTruthy();
    fetchStudentCalendar.mockResolvedValueOnce([row('2026-10-02', 'Gandhi Jayanti')]);
    await fireEvent.press(screen.getByText('Try again'));
    expect(await screen.findByText('Gandhi Jayanti')).toBeTruthy();
  });

  it('keeps the last list with a banner when a refresh fails', async () => {
    client.setQueryData(['student-calendar', 123, '2026', 'holiday'], [row('2026-10-02', 'Gandhi Jayanti')], { updatedAt: 0 });
    fetchStudentCalendar.mockRejectedValue(new ApiError('network', 'offline'));
    await ui();
    expect(await screen.findByText(/Couldn't refresh — showing the last loaded data/)).toBeTruthy();
    expect(screen.getByText('Gandhi Jayanti')).toBeTruthy();
  });

  it('keeps holidays and the full calendar in separate caches', async () => {
    client.setQueryData(['student-calendar', 123, '2026', 'all'], [row('2026-10-10', 'Sports day', 'event')]);
    fetchStudentCalendar.mockResolvedValue([row('2026-10-02', 'Gandhi Jayanti')]);
    await ui();
    expect(await screen.findByText('Gandhi Jayanti')).toBeTruthy();
    expect(screen.queryByText('Sports day')).toBeNull();
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
