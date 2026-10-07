import { fireEvent, screen } from '@testing-library/react-native';
import React from 'react';
import { Linking } from 'react-native';
import { ApiError } from '../src/api/errors';
import { ExamEntry } from '../src/api/student';
import { ExamScheduleScreen } from '../src/screens/student/ExamScheduleScreen';
import { makeClient, pinToday, renderWith, signIn, tile } from './helpers/kit';

jest.mock('../src/config/env', () => ({ env: { apiBaseUrl: 'https://dev.triz.co.in', appEnv: 'test', erpHosts: [] } }));
jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock('../src/api/student', () => ({ ...jest.requireActual('../src/api/student'), fetchExamSchedule: jest.fn() }));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { fetchExamSchedule } = require('../src/api/student') as { fetchExamSchedule: jest.Mock };

const x = (title: string, date: string, file = ''): ExamEntry => ({ title, date, file });
const MID = 'https://erp.triz.co.in/storage/exam_schedule/mid.pdf';

// Today is pinned to Wednesday 7 October 2026.
const mixed: ExamEntry[] = [
  x('Quiz', '2026-09-15'),
  x('Midterm', '2026-10-20', MID),
  x('Mystery exam', ''),
  x('Entrance', '2026-08-01'),
  x('Unit test', '2026-10-07'),
  x('Midterm', '2026-10-20', MID), // duplicate (double enrollment row)
];

let client = makeClient();
const ui = () => renderWith(client, <ExamScheduleScreen tile={tile('exam_schedule')} />);
let openURL: jest.SpyInstance;
const cardLabels = () => screen.getAllByLabelText(/(Unit test|Midterm|Quiz|Entrance|Mystery exam|Final)/).map((n) => n.props.accessibilityLabel as string);

beforeAll(() => pinToday());
afterAll(() => jest.useRealTimers());
beforeEach(() => {
  client = makeClient();
  fetchExamSchedule.mockReset();
  openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  signIn();
});
afterEach(() => openURL.mockRestore());

describe('ExamScheduleScreen - grouping', () => {
  it('splits into Upcoming (soonest first, today included), Earlier (latest first) and Date to be confirmed', async () => {
    fetchExamSchedule.mockResolvedValue(mixed);
    await ui();
    await screen.findByText('Upcoming');
    expect(screen.getAllByRole('header').map((h) => h.props.children)).toEqual(['Upcoming', 'Earlier', 'Date to be confirmed']);
    expect(cardLabels()).toEqual([
      'Unit test, Wed, 7 Oct 2026',
      'Midterm, Tue, 20 Oct 2026',
      'Quiz, Tue, 15 Sep 2026',
      'Entrance, Sat, 1 Aug 2026',
      'Mystery exam, Date to be confirmed',
    ]);
    expect(fetchExamSchedule).toHaveBeenCalledTimes(1);
  });

  it('collapses the duplicate row', async () => {
    fetchExamSchedule.mockResolvedValue(mixed);
    await ui();
    await screen.findByText('Upcoming');
    expect(screen.getAllByText('Midterm')).toHaveLength(1);
  });

  it('reads both ISO and DD-MM-YYYY dates', async () => {
    fetchExamSchedule.mockResolvedValue([x('Final', '25-12-2026'), x('Quiz', '2026-12-01')]);
    await ui();
    await screen.findByText('Upcoming');
    expect(cardLabels()).toEqual(['Quiz, Tue, 1 Dec 2026', 'Final, Fri, 25 Dec 2026']);
  });

  it('says there are no upcoming exams when only earlier ones exist, and shows no empty Earlier or unknown group', async () => {
    fetchExamSchedule.mockResolvedValue([x('Quiz', '2026-09-15')]);
    await ui();
    expect(await screen.findByText('No upcoming exams.')).toBeTruthy();
    expect(screen.getAllByRole('header').map((h) => h.props.children)).toEqual(['Upcoming', 'Earlier']);
  });

  it('shows only Upcoming when nothing is earlier or unreadable', async () => {
    fetchExamSchedule.mockResolvedValue([x('Midterm', '2026-10-20')]);
    await ui();
    await screen.findByText('Upcoming');
    expect(screen.getAllByRole('header').map((h) => h.props.children)).toEqual(['Upcoming']);
  });
});

describe('ExamScheduleScreen - unreadable dates', () => {
  it('keeps an exam with an empty or unreadable date under "Date to be confirmed", never dropping it', async () => {
    fetchExamSchedule.mockResolvedValue([x('Mystery exam', ''), x('Odd exam', 'someday'), x('Midterm', '2026-10-20')]);
    await ui();
    await screen.findAllByText('Date to be confirmed');
    expect(screen.getByText('Mystery exam')).toBeTruthy();
    expect(screen.getByText('Odd exam')).toBeTruthy();
    expect(screen.getAllByText('Date to be confirmed').length).toBeGreaterThanOrEqual(3); // heading + two card dates
  });

  it('a list of only unreadable dates still shows them (and says there are no upcoming exams)', async () => {
    fetchExamSchedule.mockResolvedValue([x('Mystery exam', '')]);
    await ui();
    expect(await screen.findByText('Mystery exam')).toBeTruthy();
    expect(screen.getByText('No upcoming exams.')).toBeTruthy();
  });

  it('an untitled exam gets a readable title', async () => {
    fetchExamSchedule.mockResolvedValue([x('', '2026-10-20')]);
    await ui();
    expect(await screen.findByLabelText('Untitled exam, Tue, 20 Oct 2026')).toBeTruthy();
  });
});

describe('ExamScheduleScreen - file link validation (S3-D6)', () => {
  it('opens a schedule file from an ERP host, re-based onto the configured API host', async () => {
    fetchExamSchedule.mockResolvedValue([x('Midterm', '2026-10-20', MID)]);
    await ui();
    await fireEvent.press(await screen.findByText('Open schedule'));
    expect(openURL).toHaveBeenCalledTimes(1);
    expect(openURL).toHaveBeenCalledWith('https://dev.triz.co.in/storage/exam_schedule/mid.pdf');
  });

  it('shows no button for a foreign host, look-alike, credentials in the URL, a bare file name, an empty value or a non-http scheme', async () => {
    fetchExamSchedule.mockResolvedValue([
      x('Foreign', '2026-10-20', 'https://evil.example/a.pdf'),
      x('Lookalike', '2026-10-21', 'https://erp.triz.co.in.evil.com/a.pdf'),
      x('Creds', '2026-10-22', 'https://erp.triz.co.in@evil.example/a.pdf'),
      x('Bare', '2026-10-23', 'a.pdf'),
      x('Empty', '2026-10-24', ''),
      x('Script', '2026-10-25', 'javascript:alert(1)'),
      x('File', '2026-10-26', 'file:///etc/passwd'),
    ]);
    await ui();
    await screen.findByText('Foreign');
    expect(screen.queryByText('Open schedule')).toBeNull();
    expect(openURL).not.toHaveBeenCalled();
  });

  it('shows the button only on the cards that have an acceptable link', async () => {
    fetchExamSchedule.mockResolvedValue([x('Midterm', '2026-10-20', MID), x('Quiz', '2026-10-21', ''), x('Foreign', '2026-10-22', 'https://evil.example/a.pdf')]);
    await ui();
    await screen.findByText('Midterm');
    expect(screen.getAllByText('Open schedule')).toHaveLength(1);
  });
});

describe('ExamScheduleScreen - empty, loading, error and stale states', () => {
  it('shows an empty state', async () => {
    fetchExamSchedule.mockResolvedValue([]);
    await ui();
    expect(await screen.findByText('No exams scheduled')).toBeTruthy();
  });

  it('shows the loading state first', async () => {
    fetchExamSchedule.mockReturnValue(new Promise(() => {}));
    await ui();
    expect(screen.getByText('Loading…')).toBeTruthy();
  });

  it('shows an error with Try again that refetches', async () => {
    fetchExamSchedule.mockRejectedValueOnce(new ApiError('server', 'The server had a problem. Please try again shortly.', 500));
    await ui();
    expect(await screen.findByText('The server had a problem. Please try again shortly.')).toBeTruthy();
    fetchExamSchedule.mockResolvedValueOnce([x('Midterm', '2026-10-20')]);
    await fireEvent.press(screen.getByText('Try again'));
    expect(await screen.findByText('Midterm')).toBeTruthy();
    expect(fetchExamSchedule).toHaveBeenCalledTimes(2);
  });

  it('keeps the last list with a banner when a refresh fails', async () => {
    client.setQueryData(['student-exam-schedule', 123, '2026'], [x('Midterm', '2026-10-20')], { updatedAt: 0 });
    fetchExamSchedule.mockRejectedValue(new ApiError('network', 'offline'));
    await ui();
    expect(await screen.findByText(/Couldn't refresh — showing the last loaded data/)).toBeTruthy();
    expect(screen.getByText('Midterm')).toBeTruthy();
  });
});

describe('ExamScheduleScreen - authentication and identity', () => {
  it('maps an expired session (401) to the error state', async () => {
    fetchExamSchedule.mockRejectedValue(new ApiError('unauthorized', 'Your session has expired. Please sign in again.', 401));
    await ui();
    expect(await screen.findByText('Your session has expired. Please sign in again.')).toBeTruthy();
  });

  it('makes no request and explains when the school year is missing', async () => {
    signIn({ syear: null });
    await ui();
    expect(screen.getByText('School year not set')).toBeTruthy();
    expect(fetchExamSchedule).not.toHaveBeenCalled();
  });

  it('makes no request for a non-student session', async () => {
    signIn({ isStudent: false, userProfileName: 'Teacher' });
    await ui();
    expect(screen.getByText('Students only')).toBeTruthy();
    expect(fetchExamSchedule).not.toHaveBeenCalled();
  });

  it('never shows another user\'s cached schedule (cache is keyed by user)', async () => {
    client.setQueryData(['student-exam-schedule', 999, '2026'], [x('SECRET OF 999', '2026-10-20')]);
    fetchExamSchedule.mockResolvedValue([x('Midterm', '2026-10-20')]);
    await ui();
    await screen.findByText('Midterm');
    expect(screen.queryByText('SECRET OF 999')).toBeNull();
  });
});
