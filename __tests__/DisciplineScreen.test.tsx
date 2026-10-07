import { fireEvent, screen } from '@testing-library/react-native';
import * as fs from 'fs';
import * as path from 'path';
import * as SecureStore from 'expo-secure-store';
import React from 'react';
import { Linking } from 'react-native';
import { ApiError } from '../src/api/errors';
import { DisciplineRecord } from '../src/api/student';
import { DisciplineScreen } from '../src/screens/student/RecordScreens';
import { screenRegistry } from '../src/screens/registry';
import { makeClient, renderWith, signIn, tile } from './helpers/kit';

jest.mock('../src/config/env', () => ({ env: { apiBaseUrl: 'https://dev.triz.co.in', appEnv: 'test', erpHosts: [] } }));
jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock('../src/api/student', () => ({ ...jest.requireActual('../src/api/student'), fetchDiscipline: jest.fn() }));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { fetchDiscipline } = require('../src/api/student') as { fetchDiscipline: jest.Mock };

const n = (over: Partial<DisciplineRecord> = {}): DisciplineRecord => ({ type: 'Good', message: 'Helped a classmate', date: '2026-03-01', flag: '1', ...over });

let client = makeClient();
const ui = (api: string | null = 'https://erp.triz.co.in/studentDisciplineAPI') => renderWith(client, <DisciplineScreen tile={{ ...tile('child_remark'), api }} />);
let consoleSpies: jest.SpyInstance[];
let openURL: jest.SpyInstance;

beforeEach(() => {
  client = makeClient();
  fetchDiscipline.mockReset();
  openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  consoleSpies = (['log', 'info', 'warn', 'debug'] as const).map((m) => jest.spyOn(console, m).mockImplementation(() => {}));
  (SecureStore.setItemAsync as jest.Mock).mockClear();
  signIn();
});
afterEach(() => {
  openURL.mockRestore();
  consoleSpies.forEach((s) => s.mockRestore());
});

describe('DisciplineScreen', () => {
  it('is registered for the child_remark tile', () => {
    expect(screenRegistry.child_remark).toBe(DisciplineScreen);
  });

  it('shows loading, then the notes newest first with type, date, flag word and message', async () => {
    fetchDiscipline.mockResolvedValue([n({ type: 'Check', message: 'Old note', date: '2025-01-01', flag: '0' }), n({ type: 'Bad', message: 'New note', date: '2026-03-02', flag: '-1' })]);
    await ui();
    expect(screen.getByText('Loading…')).toBeTruthy();
    expect(await screen.findByText('School year 2026')).toBeTruthy();
    const labels = screen.getAllByLabelText(/^(Bad|Check)\./).map((x) => x.props.accessibilityLabel as string);
    expect(labels[0]).toBe('Bad. 2 Mar 2026. Negative. Message New note');
    expect(labels[1]).toBe('Check. 1 Jan 2025. Neutral. Message Old note');
    expect(screen.getByLabelText('Status: Negative')).toBeTruthy();
    expect(screen.getByText('Records are added by your school.')).toBeTruthy();
    expect(fetchDiscipline).toHaveBeenCalledTimes(1);
  });

  it('shows only what the backend sent: no flag pill when the flag is blank, unknown flags as sent, no invented states', async () => {
    fetchDiscipline.mockResolvedValue([n({ flag: '', message: 'A' }), n({ flag: 'Serious', message: 'B' })]);
    await ui();
    await screen.findByText('School year 2026');
    expect(screen.getAllByLabelText(/^Status: /)).toHaveLength(1);
    expect(screen.getByLabelText('Status: Serious')).toBeTruthy();
    expect(screen.queryByText(/pending|resolved|closed|escalat|warning|suspend/i)).toBeNull();
  });

  it('is strictly view only: no input, no button other than Try again / Show more, no link, no share / export / edit / delete', async () => {
    fetchDiscipline.mockResolvedValue([n()]);
    await ui();
    await screen.findByText('School year 2026');
    expect(screen.queryByPlaceholderText(/./)).toBeNull();
    expect(screen.queryByDisplayValue(/./)).toBeNull();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryAllByRole('link')).toHaveLength(0);
    expect(screen.queryByText(/share|export|download|edit|delete|add |submit|save|appeal|reply/i)).toBeNull();
    expect(openURL).not.toHaveBeenCalled();
  });

  it('empty list -> an empty state with the note', async () => {
    fetchDiscipline.mockResolvedValue([]);
    await ui();
    expect(await screen.findByText('No discipline records for school year 2026')).toBeTruthy();
    expect(screen.getByText('Records are added by your school.')).toBeTruthy();
  });

  it('401 shows the session message', async () => {
    fetchDiscipline.mockRejectedValue(new ApiError('unauthorized', 'Your session has expired. Please sign in again.', 401));
    await ui();
    expect(await screen.findByText('Your session has expired. Please sign in again.')).toBeTruthy();
  });

  it('a server error shows its message and Try again reloads', async () => {
    fetchDiscipline.mockRejectedValueOnce(new ApiError('server', 'The server had a problem. Please try again shortly.', 500));
    await ui();
    expect(await screen.findByText('The server had a problem. Please try again shortly.')).toBeTruthy();
    fetchDiscipline.mockResolvedValueOnce([n()]);
    await fireEvent.press(screen.getByText('Try again'));
    expect(await screen.findByText('School year 2026')).toBeTruthy();
    expect(fetchDiscipline).toHaveBeenCalledTimes(2);
  });

  it('"Parameter Missing" is shown with Try again', async () => {
    fetchDiscipline.mockRejectedValue(new ApiError('validation', 'Parameter Missing'));
    await ui();
    expect(await screen.findByText('Parameter Missing')).toBeTruthy();
    expect(screen.getByText('Try again')).toBeTruthy();
  });

  it('a failed refresh keeps the notes and shows the stale banner', async () => {
    fetchDiscipline.mockResolvedValueOnce([n({ message: 'Kept note' })]);
    await ui();
    await screen.findByText(/Kept note/);
    fetchDiscipline.mockRejectedValueOnce(new ApiError('server', 'x', 500));
    await client.refetchQueries();
    expect(await screen.findByText(/Couldn't refresh/)).toBeTruthy();
    expect(screen.getByText(/Kept note/)).toBeTruthy();
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
    expect(fetchDiscipline).not.toHaveBeenCalled();
  });

  it("cached per user: another student never sees the first student's notes", async () => {
    fetchDiscipline.mockResolvedValueOnce([n({ message: 'Alpha note' })]);
    const first = await ui();
    await screen.findByText(/Alpha note/);
    await first.unmount();
    signIn({ id: 456 });
    fetchDiscipline.mockResolvedValueOnce([]);
    await ui();
    expect(await screen.findByText('No discipline records for school year 2026')).toBeTruthy();
    expect(screen.queryByText(/Alpha note/)).toBeNull();
  });

  it("ignores the tile's stored api", async () => {
    fetchDiscipline.mockResolvedValue([n()]);
    await ui('https://erp.triz.co.in/student-care/discipline');
    await screen.findByText('School year 2026');
    expect(fetchDiscipline).toHaveBeenCalledTimes(1);
  });
});

describe('Discipline data is held in memory only, never logged or persisted', () => {
  it('the query data is dropped from memory as soon as the screen closes', async () => {
    fetchDiscipline.mockResolvedValue([n()]);
    const r = await ui();
    await screen.findByText('School year 2026');
    expect(client.getQueryCache().getAll().length).toBe(1);
    await r.unmount();
    await new Promise((res) => setTimeout(res, 20));
    expect(client.getQueryCache().getAll()).toHaveLength(0);
  });

  it('rendering writes nothing to storage and nothing to the console', async () => {
    fetchDiscipline.mockResolvedValue([n({ message: 'SENSITIVE-BEHAVIOUR-NOTE', type: 'Bad', flag: '-1' })]);
    const r = await ui();
    await screen.findByText(/SENSITIVE-BEHAVIOUR-NOTE/);
    await r.unmount();
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    for (const spy of consoleSpies) for (const call of spy.mock.calls) expect(JSON.stringify(call)).not.toMatch(/SENSITIVE/);
  });

  it('the S9c code has no console, storage, sharing or file-system use and no write call', () => {
    const src = path.join(__dirname, '..', 'src');
    const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    for (const f of ['screens/student/RecordListScreen.tsx', 'screens/student/RecordScreens.tsx', 'hooks/useStudentRecords.ts']) {
      const code = strip(fs.readFileSync(path.join(src, f), 'utf8'));
      expect(code).not.toMatch(/console\.|AsyncStorage|SecureStore|expo-sharing|expo-file-system|FileSystem|\bShare\b|persist/);
      expect(code).not.toMatch(/api\.post|legacy\.(get)|method: 'POST'/);
    }
    const apiCode = strip(fs.readFileSync(path.join(src, 'api', 'student.ts'), 'utf8'));
    const block = apiCode.slice(apiCode.indexOf('export const fetchDiscipline'));
    expect(block).toMatch(/studentDisciplineAPI/);
    expect(block).not.toMatch(/student-care|add_teacherStudentDiscipline|dicipline\//);
  });
});
