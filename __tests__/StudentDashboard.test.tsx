import { fireEvent, screen } from '@testing-library/react-native';
import React from 'react';
import { ApiError } from '../src/api/errors';
import { StudentDashboard as Data } from '../src/api/student';
import { StudentDashboard } from '../src/screens/student/StudentDashboard';
import { makeClient, pinToday, renderWith, signIn } from './helpers/kit';

jest.mock('../src/config/env', () => ({ env: { apiBaseUrl: 'https://dev.triz.co.in', appEnv: 'test', erpHosts: [] } }));
jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock('../src/api/student', () => ({ ...jest.requireActual('../src/api/student'), fetchStudentDashboard: jest.fn() }));
const mockOpen = jest.fn();
let mockTiles = ['circular_events', 'home_work'];
jest.mock('../src/navigation/useOpenScreen', () => ({
  useOpenScreen: () => ({ canOpen: (n: string) => mockTiles.includes(n), open: (n: string) => mockOpen(n) }),
}));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { fetchStudentDashboard } = require('../src/api/student') as { fetchStudentDashboard: jest.Mock };

const data = (over: Partial<Data> = {}): Data => ({
  enrollment: { syear: '2026', standardName: '7', sectionName: 'A' },
  summary: { totalSubjects: 3, pendingHomework: 2, pendingAssignments: 1 },
  subjects: [{ id: '3', name: 'Maths' }, { id: '4', name: 'Science' }],
  pendingHomework: [
    { id: '11', title: 'Fractions', subjectId: '3', date: '2026-10-01', dueDate: '2026-10-05' }, // overdue
    { id: '12', title: 'Cells', subjectId: '99', date: '2026-10-02', dueDate: '2026-10-12' }, // subject not in my list
  ],
  pendingAssignments: [{ id: '21', title: 'Project', subjectId: '4', date: '', dueDate: '2026-10-07' }],
  circulars: [{ id: '5', title: 'Sports day', date: '2026-10-06' }],
  tasks: [
    { label: 'Homework done', value: 6 },
    { label: 'Homework pending', value: 2 },
    { label: 'Assignments submitted', value: 3 },
    { label: 'Assignments pending', value: 1 },
  ],
  ...over,
});

let client = makeClient();
const ui = () => renderWith(client, <StudentDashboard />);

beforeAll(pinToday);
afterAll(() => jest.useRealTimers());
beforeEach(() => {
  client = makeClient();
  fetchStudentDashboard.mockReset();
  mockOpen.mockReset();
  mockTiles = ['circular_events', 'home_work'];
  signIn();
});

describe('StudentDashboard', () => {
  it('shows the class, the three headline numbers and the task progress', async () => {
    fetchStudentDashboard.mockResolvedValue(data());
    await ui();
    expect(await screen.findByText('Your day at a glance')).toBeTruthy();
    expect(await screen.findByLabelText('Class 7 · A, school year 2026')).toBeTruthy();
    expect(screen.getByLabelText('Subjects: 3')).toBeTruthy();
    expect(screen.getByLabelText('Pending homework: 2')).toBeTruthy();
    expect(screen.getByLabelText('Pending assignments: 1')).toBeTruthy();
    expect(screen.getByLabelText('Homework: 6 done · 2 pending')).toBeTruthy();
    expect(screen.getByLabelText('Assignments: 3 done · 1 pending')).toBeTruthy();
  });

  it('lists pending work with due dates in words; overdue is marked in text; subject only when it is the student\'s own', async () => {
    fetchStudentDashboard.mockResolvedValue(data());
    await ui();
    expect(await screen.findByLabelText('Fractions, Maths, Overdue · 5 Oct 2026')).toBeTruthy();
    expect(screen.getByLabelText('Cells, Due 12 Oct 2026')).toBeTruthy(); // subject 99 is not in my_subjects: no name invented
    expect(screen.getByLabelText('Project, Science, Due today')).toBeTruthy();
  });

  it('shows recent circulars and the subject chips', async () => {
    fetchStudentDashboard.mockResolvedValue(data());
    await ui();
    expect(await screen.findByLabelText('Sports day, 6 Oct 2026')).toBeTruthy();
    expect(screen.getByText('My subjects')).toBeTruthy();
    expect(screen.getAllByText('Maths')).toHaveLength(2); // beside "Fractions" and as a chip
    expect(screen.getAllByText('Science')).toHaveLength(2); // beside "Project" and as a chip
  });

  it('shows 10+ when the server list is at its cap, and no progress bar for an unknown real count', async () => {
    fetchStudentDashboard.mockResolvedValue(
      data({ summary: { totalSubjects: 3, pendingHomework: 10, pendingAssignments: 0 }, tasks: [{ label: 'Homework done', value: 4 }, { label: 'Homework pending', value: 10 }, { label: 'Assignments submitted', value: 0 }, { label: 'Assignments pending', value: 0 }] }),
    );
    await ui();
    expect(await screen.findByLabelText('Pending homework: 10+')).toBeTruthy();
    expect(screen.getByLabelText('Homework: 4 done · 10+ pending')).toBeTruthy();
  });

  it('"View all" appears only for tiles in the student\'s menu and opens them', async () => {
    fetchStudentDashboard.mockResolvedValue(data());
    await ui();
    await screen.findByText('Recent circulars');
    const viewAll = screen.getAllByLabelText(/^View all/);
    expect(viewAll.map((v) => v.props.accessibilityLabel)).toEqual(['View all pending homework', 'View all recent circulars']);
    await fireEvent.press(screen.getByLabelText('View all recent circulars'));
    expect(mockOpen).toHaveBeenCalledWith('circular_events');
    await fireEvent.press(screen.getByLabelText('View all pending homework'));
    expect(mockOpen).toHaveBeenCalledWith('home_work');
  });

  it('hides "View all" when the tile is not in the menu', async () => {
    mockTiles = [];
    fetchStudentDashboard.mockResolvedValue(data());
    await ui();
    await screen.findByText('Recent circulars');
    expect(screen.queryAllByLabelText(/^View all/)).toHaveLength(0);
  });

  it('says so when the student has no class for the year (enrollment null) and shows empty lists calmly', async () => {
    fetchStudentDashboard.mockResolvedValue(data({ enrollment: null, subjects: [], pendingHomework: [], pendingAssignments: [], circulars: [], tasks: [], summary: { totalSubjects: 0, pendingHomework: 0, pendingAssignments: 0 } }));
    await ui();
    expect(await screen.findByLabelText('No class found for this school year')).toBeTruthy();
    expect(screen.getByText('No pending homework.')).toBeTruthy();
    expect(screen.getByText('No pending assignments.')).toBeTruthy();
    expect(screen.getByText('No recent circulars.')).toBeTruthy();
    expect(screen.queryByText('Task progress')).toBeNull(); // server labels absent: nothing guessed
    expect(screen.queryByText('My subjects')).toBeNull();
  });

  it('never blocks Home: an error becomes a compact card with Try again that refetches', async () => {
    fetchStudentDashboard.mockRejectedValueOnce(new ApiError('validation', 'Academic Term Date Expired', 422));
    await ui();
    expect(await screen.findByText('Dashboard unavailable: Academic Term Date Expired')).toBeTruthy();
    expect(screen.getByText('Your day at a glance')).toBeTruthy();
    fetchStudentDashboard.mockResolvedValueOnce(data());
    await fireEvent.press(screen.getByText('Try again'));
    expect(await screen.findByLabelText('Subjects: 3')).toBeTruthy();
    expect(fetchStudentDashboard).toHaveBeenCalledTimes(2);
  });

  it('keeps the last data with a notice when a refresh fails', async () => {
    client.setQueryData(['student-dashboard', 123, '2026'], data(), { updatedAt: 0 });
    fetchStudentDashboard.mockRejectedValue(new ApiError('network', 'offline'));
    await ui();
    expect(await screen.findByText(/Couldn't refresh — showing the last loaded data/)).toBeTruthy();
    expect(screen.getByLabelText('Subjects: 3')).toBeTruthy();
  });

  it('tolerates untitled items and unreadable dates', async () => {
    fetchStudentDashboard.mockResolvedValue(data({ pendingHomework: [{ id: '1', title: '', subjectId: '', date: '', dueDate: 'whenever' }] }));
    await ui();
    expect(await screen.findByLabelText('Untitled')).toBeTruthy();
  });

  it('does not use another student\'s cached dashboard', async () => {
    client.setQueryData(['student-dashboard', 999, '2026'], data({ enrollment: { syear: '2026', standardName: 'OTHER', sectionName: 'X' } }));
    fetchStudentDashboard.mockResolvedValue(data());
    await ui();
    expect(await screen.findByLabelText('Class 7 · A, school year 2026')).toBeTruthy();
    expect(screen.queryByLabelText(/OTHER/)).toBeNull();
  });

  it('renders nothing and makes no request for a non-student session', async () => {
    signIn({ isStudent: false, userProfileName: 'Teacher' });
    await ui();
    expect(screen.queryByText('Your day at a glance')).toBeNull();
    expect(fetchStudentDashboard).not.toHaveBeenCalled();
  });

  it('explains a missing school year without calling the API', async () => {
    signIn({ syear: null });
    await ui();
    expect(screen.getByText(/School year not set/)).toBeTruthy();
    expect(fetchStudentDashboard).not.toHaveBeenCalled();
  });
});
