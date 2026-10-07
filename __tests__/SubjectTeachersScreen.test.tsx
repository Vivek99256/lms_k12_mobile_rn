import { fireEvent, screen } from '@testing-library/react-native';
import React from 'react';
import { ApiError } from '../src/api/errors';
import { SubjectTeacher } from '../src/api/student';
import { SubjectTeachersScreen } from '../src/screens/student/SubjectTeachersScreen';
import { makeClient, renderWith, signIn, tile } from './helpers/kit';

jest.mock('../src/config/env', () => ({ env: { apiBaseUrl: 'https://dev.triz.co.in', appEnv: 'test', erpHosts: [] } }));
jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock('../src/api/student', () => ({ ...jest.requireActual('../src/api/student'), fetchSubjectTeachers: jest.fn() }));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { fetchSubjectTeachers } = require('../src/api/student') as { fetchSubjectTeachers: jest.Mock };

const T = (name: string, subjects: string): SubjectTeacher => ({ name, subjects });

let client = makeClient();
// The tile stores a URL; the screen must ignore it (it always calls the fixed read endpoint).
const ui = () => renderWith(client, <SubjectTeachersScreen tile={{ ...tile('subjects', 'Subject Teachers'), api: 'https://erp.triz.co.in/studentTeacherListAPI' }} />);

beforeEach(() => {
  client = makeClient();
  fetchSubjectTeachers.mockReset();
  signIn();
});

describe('SubjectTeachersScreen', () => {
  it('shows loading, then each teacher with their subjects as separate lines, in server order', async () => {
    fetchSubjectTeachers.mockResolvedValue([T('Mr Rao', 'English'), T('Mrs Shah', 'Maths, Science')]);
    await ui();
    expect(screen.getByText('Loading…')).toBeTruthy();
    expect(await screen.findByText('Mrs Shah')).toBeTruthy();
    expect(screen.getByText(/School year 2026/)).toBeTruthy();
    expect(screen.getByText('Maths')).toBeTruthy();
    expect(screen.getByText('Science')).toBeTruthy();
    expect(screen.getByLabelText('Mr Rao, English')).toBeTruthy();
    expect(screen.getByLabelText('Mrs Shah, Maths, Science')).toBeTruthy();
    expect(fetchSubjectTeachers).toHaveBeenCalledTimes(1);
  });

  it('is strictly view only: no button, no link, no phone number, no image', async () => {
    fetchSubjectTeachers.mockResolvedValue([{ name: 'Mrs Shah', subjects: 'Maths', mobile: '9876543210', image: 'https://erp.triz.co.in/a.png' } as SubjectTeacher]);
    await ui();
    await screen.findByText('Mrs Shah');
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryAllByRole('link')).toHaveLength(0);
    expect(screen.queryByText(/9876543210|call|phone|mobile/i)).toBeNull();
    expect(screen.queryByRole('image')).toBeNull();
  });

  it('a teacher with no name or subjects still shows a row', async () => {
    fetchSubjectTeachers.mockResolvedValue([T('', '')]);
    await ui();
    expect(await screen.findByText('Teacher')).toBeTruthy();
  });

  it('empty list -> an empty state naming the school year', async () => {
    fetchSubjectTeachers.mockResolvedValue([]);
    await ui();
    expect(await screen.findByText('No subject teachers to show yet')).toBeTruthy();
    expect(screen.getByText(/school year 2026/)).toBeTruthy();
  });

  it('401 shows the session message', async () => {
    fetchSubjectTeachers.mockRejectedValue(new ApiError('unauthorized', 'Your session has expired. Please sign in again.', 401));
    await ui();
    expect(await screen.findByText('Your session has expired. Please sign in again.')).toBeTruthy();
  });

  it('a server error shows its message and Try again reloads', async () => {
    fetchSubjectTeachers.mockRejectedValueOnce(new ApiError('server', 'The server had a problem. Please try again shortly.', 500));
    await ui();
    expect(await screen.findByText('The server had a problem. Please try again shortly.')).toBeTruthy();
    fetchSubjectTeachers.mockResolvedValueOnce([T('Mrs Shah', 'Maths')]);
    await fireEvent.press(screen.getByText('Try again'));
    expect(await screen.findByText('Mrs Shah')).toBeTruthy();
    expect(fetchSubjectTeachers).toHaveBeenCalledTimes(2);
  });

  it('a failed refresh keeps the rows and shows the stale banner', async () => {
    fetchSubjectTeachers.mockResolvedValueOnce([T('Mrs Shah', 'Maths')]);
    await ui();
    await screen.findByText('Mrs Shah');
    fetchSubjectTeachers.mockRejectedValueOnce(new ApiError('server', 'x', 500));
    await client.refetchQueries();
    expect(await screen.findByText(/Couldn't refresh/)).toBeTruthy();
    expect(screen.getByText('Mrs Shah')).toBeTruthy();
  });

  it('guards: no school year / non-student -> message and no request', async () => {
    signIn({ syear: '' });
    const first = await ui();
    expect(screen.getByText('School year not set')).toBeTruthy();
    await first.unmount();
    signIn({ isStudent: false });
    client = makeClient();
    await ui();
    expect(screen.getByText('Students only')).toBeTruthy();
    expect(fetchSubjectTeachers).not.toHaveBeenCalled();
  });

  it("cached per user: another student never sees the first student's teachers", async () => {
    fetchSubjectTeachers.mockResolvedValueOnce([T('Alpha Teacher', 'A')]);
    const first = await ui();
    await screen.findByText('Alpha Teacher');
    await first.unmount();
    signIn({ id: 456 });
    fetchSubjectTeachers.mockResolvedValueOnce([T('Beta Teacher', 'B')]);
    await ui();
    expect(await screen.findByText('Beta Teacher')).toBeTruthy();
    expect(screen.queryByText('Alpha Teacher')).toBeNull();
  });
});
