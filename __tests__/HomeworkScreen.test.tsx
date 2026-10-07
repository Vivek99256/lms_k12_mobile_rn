import { fireEvent, screen } from '@testing-library/react-native';
import React from 'react';
import { ApiError } from '../src/api/errors';
import { HomeworkDetail, HomeworkItem } from '../src/api/student';
import { HomeworkScreen } from '../src/screens/student/HomeworkScreen';
import { makeClient, pinToday, renderWith, signIn, tile } from './helpers/kit';

jest.mock('../src/config/env', () => ({ env: { apiBaseUrl: 'https://dev.triz.co.in', appEnv: 'test', erpHosts: [] } }));
jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock('../src/api/student', () => ({ ...jest.requireActual('../src/api/student'), fetchHomeworkList: jest.fn(), fetchHomeworkDetail: jest.fn() }));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { fetchHomeworkList, fetchHomeworkDetail } = require('../src/api/student') as { fetchHomeworkList: jest.Mock; fetchHomeworkDetail: jest.Mock };

const hw = (over: Partial<HomeworkItem>): HomeworkItem => ({
  id: '1',
  title: 'T',
  subject: 'Maths',
  date: '2026-10-01',
  dueDate: '2026-10-12',
  status: null,
  fileCount: 0,
  aiStatus: '',
  ...over,
});

// Today is pinned to Wednesday 7 October 2026.
const items: HomeworkItem[] = [
  hw({ id: '5', title: 'Fractions', subject: 'Maths', date: '2026-10-01', dueDate: '2026-10-05' }), // overdue
  hw({ id: '6', title: 'Cells', subject: 'Science', date: '2026-10-02', dueDate: '2026-10-12' }),
  hw({ id: '7', title: 'Essay', subject: 'English', date: '2026-10-03', dueDate: '2026-10-09' }),
  hw({ id: '8', title: 'Poem', subject: 'Hindi', date: '2026-10-04', dueDate: '' }), // no due date
  hw({ id: '4', title: 'Algebra', subject: 'Maths', date: '2026-09-20', dueDate: '2026-09-25', status: 'Submitted', fileCount: 1 }),
  hw({ id: '3', title: 'Map', subject: 'Social', date: '2026-09-10', dueDate: '2026-09-15', status: 'Reviewed' }),
];

const detail = (over: Partial<HomeworkDetail> = {}): HomeworkDetail => ({
  id: '5',
  title: 'Fractions',
  description: 'Do page 4',
  subject: 'Maths',
  standard: '7',
  division: 'A',
  date: '2026-10-01',
  dueDate: '2026-10-05',
  teacher: 'Mrs Shah',
  referenceUrl: '',
  questions: [],
  submission: null,
  ...over,
});

let client = makeClient();
const ui = () => renderWith(client, <HomeworkScreen tile={tile('home_work')} />);
/** Row buttons only (not the status pills, which also carry a label), in on-screen order. */
const rowLabels = () => screen.getAllByRole('button').filter((b) => b.props.accessibilityHint === 'Show details' || b.props.accessibilityHint === 'Collapse details').map((b) => b.props.accessibilityLabel as string);

beforeAll(() => pinToday());
afterAll(() => jest.useRealTimers());
beforeEach(() => {
  client = makeClient();
  fetchHomeworkList.mockReset();
  fetchHomeworkDetail.mockReset();
  signIn();
});

describe('HomeworkScreen - filters (S4a-D4)', () => {
  it('opens on To do, with counts in the chips, ordered by due date (overdue first, undated last)', async () => {
    fetchHomeworkList.mockResolvedValue(items);
    await ui();
    expect(await screen.findByLabelText('To do (4)')).toBeTruthy();
    expect(screen.getByLabelText('To do (4)').props.accessibilityState.selected).toBe(true);
    expect(screen.getByLabelText('Submitted (2)').props.accessibilityState.selected).toBe(false);
    expect(screen.getByLabelText('All (6)')).toBeTruthy();
    expect(rowLabels()).toEqual([
      'Fractions, Maths, Overdue · 5 Oct 2026, Not submitted',
      'Essay, English, Due 9 Oct 2026, Not submitted',
      'Cells, Science, Due 12 Oct 2026, Not submitted',
      'Poem, Hindi, Not submitted',
    ]);
  });

  it('Submitted shows only submitted homework, newest assigned first, with its status wording', async () => {
    fetchHomeworkList.mockResolvedValue(items);
    await ui();
    await fireEvent.press(await screen.findByLabelText('Submitted (2)'));
    expect(screen.getByLabelText('Submitted (2)').props.accessibilityState.selected).toBe(true);
    expect(rowLabels()).toEqual(['Algebra, Maths, Due 25 Sep 2026, Awaiting review', 'Map, Social, Due 15 Sep 2026, Reviewed']);
  });

  it('All shows everything, newest assigned first', async () => {
    fetchHomeworkList.mockResolvedValue(items);
    await ui();
    await fireEvent.press(await screen.findByLabelText('All (6)'));
    expect(rowLabels().map((l) => l.split(',')[0])).toEqual(['Poem', 'Essay', 'Cells', 'Fractions', 'Algebra', 'Map']);
  });

  it('marks overdue in words, and only for homework still to do', async () => {
    fetchHomeworkList.mockResolvedValue([hw({ id: '1', title: 'Late', dueDate: '2026-10-05' }), hw({ id: '2', title: 'Done late', dueDate: '2026-10-05', status: 'Submitted', fileCount: 1 })]);
    await ui();
    expect(await screen.findByText(/Overdue · 5 Oct 2026/)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Submitted (1)'));
    expect(screen.queryByText(/Overdue/)).toBeNull();
    expect(screen.getByText(/Due 5 Oct 2026/)).toBeTruthy();
  });

  it('shows the status as a word on every row', async () => {
    fetchHomeworkList.mockResolvedValue(items);
    await ui();
    await fireEvent.press(await screen.findByLabelText('All (6)'));
    expect(screen.getAllByLabelText('Status: Not submitted')).toHaveLength(4);
    expect(screen.getByLabelText('Status: Awaiting review')).toBeTruthy();
    expect(screen.getByLabelText('Status: Reviewed')).toBeTruthy();
  });
});

describe('HomeworkScreen - empty states', () => {
  it('shows an empty state with no filter when there is no homework at all', async () => {
    fetchHomeworkList.mockResolvedValue([]);
    await ui();
    expect(await screen.findByText('No homework yet')).toBeTruthy();
    expect(screen.queryByLabelText(/^To do/)).toBeNull();
  });

  it('To do is empty when everything is submitted, and says so; the filter stays usable', async () => {
    fetchHomeworkList.mockResolvedValue([hw({ id: '1', status: 'Submitted', fileCount: 1 })]);
    await ui();
    expect(await screen.findByText('All caught up — no homework to do.')).toBeTruthy();
    expect(screen.getByText('Choose All to see past homework.')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('All (1)'));
    expect(await screen.findByLabelText(/^T,/)).toBeTruthy();
  });

  it('Submitted is empty when nothing is submitted yet', async () => {
    fetchHomeworkList.mockResolvedValue([hw({ id: '1' })]);
    await ui();
    await fireEvent.press(await screen.findByLabelText('Submitted (0)'));
    expect(screen.getByText('Nothing submitted yet.')).toBeTruthy();
  });
});

describe('HomeworkScreen - 30-row batches (S4a-D8)', () => {
  const many = Array.from({ length: 35 }, (_, i) => hw({ id: String(100 + i), title: `Task ${i}`, dueDate: `2026-11-${String((i % 28) + 1).padStart(2, '0')}`, date: '2026-10-01' }));

  it('shows 30 rows and a Show more button; pressing it shows the rest', async () => {
    fetchHomeworkList.mockResolvedValue(many);
    await ui();
    await screen.findByLabelText('To do (35)');
    expect(rowLabels()).toHaveLength(30);
    await fireEvent.press(screen.getByText('Show more (5 more)'));
    expect(rowLabels()).toHaveLength(35);
    expect(screen.queryByText(/Show more/)).toBeNull();
  });

  it('has no Show more button for 30 rows or fewer', async () => {
    fetchHomeworkList.mockResolvedValue(many.slice(0, 30));
    await ui();
    await screen.findByLabelText('To do (30)');
    expect(rowLabels()).toHaveLength(30);
    expect(screen.queryByText(/Show more/)).toBeNull();
  });

  it('switching the filter starts again at 30', async () => {
    fetchHomeworkList.mockResolvedValue(many);
    await ui();
    await fireEvent.press(await screen.findByText('Show more (5 more)'));
    expect(rowLabels()).toHaveLength(35);
    await fireEvent.press(screen.getByLabelText('All (35)'));
    expect(rowLabels()).toHaveLength(30);
  });
});

describe('HomeworkScreen - expand and collapse', () => {
  it('makes no detail request until a row is opened, then loads that homework only', async () => {
    fetchHomeworkList.mockResolvedValue(items);
    fetchHomeworkDetail.mockResolvedValue(detail());
    await ui();
    const row = await screen.findByLabelText('Fractions, Maths, Overdue · 5 Oct 2026, Not submitted');
    expect(fetchHomeworkDetail).not.toHaveBeenCalled();
    expect(row.props.accessibilityState.expanded).toBe(false);
    await fireEvent.press(row);
    expect(await screen.findByText('Do page 4')).toBeTruthy();
    expect(fetchHomeworkDetail).toHaveBeenCalledTimes(1);
    expect(fetchHomeworkDetail).toHaveBeenCalledWith('5');
    expect(screen.getByLabelText('Fractions, Maths, Overdue · 5 Oct 2026, Not submitted').props.accessibilityState.expanded).toBe(true);
  });

  it('shows loading inside the card while the detail loads', async () => {
    fetchHomeworkList.mockResolvedValue(items);
    fetchHomeworkDetail.mockReturnValue(new Promise(() => {}));
    await ui();
    await fireEvent.press(await screen.findByLabelText(/^Fractions,/));
    expect(await screen.findByText('Loading details…')).toBeTruthy();
    expect(screen.getByLabelText('To do (4)')).toBeTruthy(); // the list stays usable
  });

  it('collapses again and hides the details', async () => {
    fetchHomeworkList.mockResolvedValue(items);
    fetchHomeworkDetail.mockResolvedValue(detail());
    await ui();
    await fireEvent.press(await screen.findByLabelText(/^Fractions,/));
    await screen.findByText('Do page 4');
    await fireEvent.press(screen.getByLabelText(/^Fractions,/));
    expect(screen.queryByText('Do page 4')).toBeNull();
    expect(screen.getByLabelText(/^Fractions,/).props.accessibilityState.expanded).toBe(false);
  });

  it('opening another row closes the first (one open at a time)', async () => {
    fetchHomeworkList.mockResolvedValue(items);
    fetchHomeworkDetail.mockImplementation((id: string) => Promise.resolve(detail({ id, description: `Instructions for ${id}` })));
    await ui();
    await fireEvent.press(await screen.findByLabelText(/^Fractions,/));
    await screen.findByText('Instructions for 5');
    await fireEvent.press(screen.getByLabelText(/^Essay,/));
    expect(await screen.findByText('Instructions for 7')).toBeTruthy();
    expect(screen.queryByText('Instructions for 5')).toBeNull();
  });

  it('a 404 on one homework shows its message and Try again inside the card, and the list keeps working', async () => {
    fetchHomeworkList.mockResolvedValue(items);
    fetchHomeworkDetail.mockRejectedValueOnce(new ApiError('server', 'Homework not found', 404));
    await ui();
    await fireEvent.press(await screen.findByLabelText(/^Fractions,/));
    expect(await screen.findByText('Homework not found')).toBeTruthy();
    fetchHomeworkDetail.mockResolvedValueOnce(detail());
    await fireEvent.press(screen.getByText('Try again'));
    expect(await screen.findByText('Do page 4')).toBeTruthy();
    expect(fetchHomeworkDetail).toHaveBeenCalledTimes(2);
  });

  it('does not open details for a homework whose id is not plain digits (no request)', async () => {
    fetchHomeworkList.mockResolvedValue([hw({ id: 'abc', title: 'Odd' })]);
    await ui();
    await fireEvent.press(await screen.findByLabelText(/^Odd,/));
    expect(await screen.findByText('Details are not available for this item.')).toBeTruthy();
    expect(fetchHomeworkDetail).not.toHaveBeenCalled();
  });
});

describe('HomeworkScreen - loading, error, retry, stale, authentication', () => {
  it('shows the loading state first', async () => {
    fetchHomeworkList.mockReturnValue(new Promise(() => {}));
    await ui();
    expect(screen.getByText('Loading…')).toBeTruthy();
  });

  it('shows an error with Try again that refetches', async () => {
    fetchHomeworkList.mockRejectedValueOnce(new ApiError('network', 'We could not reach the server. Check your connection and try again.'));
    await ui();
    expect(await screen.findByText('We could not reach the server. Check your connection and try again.')).toBeTruthy();
    fetchHomeworkList.mockResolvedValueOnce(items);
    await fireEvent.press(screen.getByText('Try again'));
    expect(await screen.findByLabelText('To do (4)')).toBeTruthy();
    expect(fetchHomeworkList).toHaveBeenCalledTimes(2);
  });

  it('shows the server message for an expired academic year (422)', async () => {
    fetchHomeworkList.mockRejectedValue(new ApiError('validation', 'Academic Term Date Expired', 422));
    await ui();
    expect(await screen.findByText('Academic Term Date Expired')).toBeTruthy();
  });

  it('401 / authentication failure is shown as an error state (the client signs the user out)', async () => {
    fetchHomeworkList.mockRejectedValue(new ApiError('unauthorized', 'Authentication required', 401));
    await ui();
    expect(await screen.findByText('Authentication required')).toBeTruthy();
    expect(screen.getByText('Try again')).toBeTruthy();
  });

  it('keeps the last list with a banner when a refresh fails', async () => {
    client.setQueryData(['student-homework', 123, '2026'], items, { updatedAt: 0 });
    fetchHomeworkList.mockRejectedValue(new ApiError('network', 'offline'));
    await ui();
    expect(await screen.findByText(/Couldn't refresh — showing the last loaded data/)).toBeTruthy();
    expect(screen.getByLabelText('To do (4)')).toBeTruthy();
  });

  it('makes no request and explains when the school year is missing', async () => {
    signIn({ syear: null });
    await ui();
    expect(screen.getByText('School year not set')).toBeTruthy();
    expect(fetchHomeworkList).not.toHaveBeenCalled();
  });

  it('makes no request for a non-student session', async () => {
    signIn({ isStudent: false, userProfileName: 'Teacher' });
    await ui();
    expect(screen.getByText('Students only')).toBeTruthy();
    expect(fetchHomeworkList).not.toHaveBeenCalled();
  });

  it('never shows another user\'s cached homework (cache is keyed by user)', async () => {
    client.setQueryData(['student-homework', 999, '2026'], [hw({ id: '9', title: 'SECRET OF 999' })]);
    fetchHomeworkList.mockResolvedValue(items);
    await ui();
    await screen.findByLabelText('To do (4)');
    expect(screen.queryByText('SECRET OF 999')).toBeNull();
  });

  it('tolerates untitled homework without a subject or dates', async () => {
    fetchHomeworkList.mockResolvedValue([hw({ id: '1', title: '', subject: '', date: '', dueDate: '' })]);
    await ui();
    expect(await screen.findByLabelText('Untitled homework, Not submitted')).toBeTruthy();
  });
});
