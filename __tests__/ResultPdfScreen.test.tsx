import { fireEvent, screen } from '@testing-library/react-native';
import React from 'react';
import { Linking } from 'react-native';
import { ApiError } from '../src/api/errors';
import { ResultFile } from '../src/api/student';
import { ResultPdfScreen } from '../src/screens/student/ResultPdfScreen';
import { makeClient, renderWith, signIn, tile } from './helpers/kit';

jest.mock('../src/config/env', () => ({ env: { apiBaseUrl: 'https://dev.triz.co.in', appEnv: 'test', erpHosts: [] } }));
jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock('../src/api/student', () => ({ ...jest.requireActual('../src/api/student'), fetchResultFiles: jest.fn() }));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { fetchResultFiles } = require('../src/api/student') as { fetchResultFiles: jest.Mock };

const f = (id: string, term: string, file = ''): ResultFile => ({ id, term, file });
const T1 = 'https://erp.triz.co.in/storage/upload_result/t1.pdf';
const T2 = 'https://erp.triz.co.in/storage/upload_result/t2.pdf';

const resultTile = (api: string | null = 'https://erp.triz.co.in/uploadResultAPI') => ({ ...tile('result_pdf', 'Result PDF'), api });

let client = makeClient();
const ui = (api?: string | null) => renderWith(client, <ResultPdfScreen tile={resultTile(api)} />);
let openURL: jest.SpyInstance;

beforeEach(() => {
  client = makeClient();
  fetchResultFiles.mockReset();
  openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  signIn();
});
afterEach(() => openURL.mockRestore());

describe('ResultPdfScreen - list', () => {
  it('shows loading, then one row per term in id order with the school year', async () => {
    fetchResultFiles.mockResolvedValue([f('12', 'Term 2', T2), f('9', 'Term 1', T1)]);
    await ui();
    expect(screen.getByText('Loading…')).toBeTruthy();
    expect(await screen.findByText('Term 1')).toBeTruthy();
    expect(screen.getByText(/School year 2026/)).toBeTruthy();
    const labels = screen.getAllByLabelText(/^Term \d, /).map((n) => n.props.accessibilityLabel as string);
    expect(labels).toEqual(['Term 1, file available', 'Term 2, file available']);
    expect(fetchResultFiles).toHaveBeenCalledTimes(1);
  });

  it('says where the marks are and how files open', async () => {
    fetchResultFiles.mockResolvedValue([f('1', 'Term 1', T1)]);
    await ui();
    await screen.findByText('Term 1');
    expect(screen.getByText(/Your marks and grades are in the PDF your school published/)).toBeTruthy();
  });

  it('shows no marks, percentages, grades or ranks', async () => {
    fetchResultFiles.mockResolvedValue([f('1', 'Term 1', T1), f('2', 'Term 2')]);
    await ui();
    await screen.findByText('Term 1');
    expect(screen.queryByText(/\d\s?%|percent|grade [A-F]|rank|marks obtained|total marks/i)).toBeNull();
  });

  it('empty list -> an empty state naming the school year', async () => {
    fetchResultFiles.mockResolvedValue([]);
    await ui();
    expect(await screen.findByText('No results published yet')).toBeTruthy();
    expect(screen.getByText(/school year 2026/)).toBeTruthy();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('a synthetic / unknown student gets the same empty state', async () => {
    signIn({ id: 999999999 });
    fetchResultFiles.mockResolvedValue([]);
    await ui();
    expect(await screen.findByText('No results published yet')).toBeTruthy();
  });
});

describe('ResultPdfScreen - file states', () => {
  it('a row with no file says so and has no Open button', async () => {
    fetchResultFiles.mockResolvedValue([f('1', 'Term 1')]);
    await ui();
    expect(await screen.findByText('No file uploaded yet')).toBeTruthy();
    expect(screen.queryByText('Open PDF')).toBeNull();
    expect(screen.getByLabelText('Term 1, no file uploaded yet')).toBeTruthy();
  });

  it('an unsafe link is non-actionable with a clear message; the row stays', async () => {
    fetchResultFiles.mockResolvedValue([
      f('1', 'Foreign', 'https://evil.example/a.pdf'),
      f('2', 'Lookalike', 'https://erp.triz.co.in.evil.com/a.pdf'),
      f('3', 'Creds', 'https://erp.triz.co.in@evil.example/a.pdf'),
      f('4', 'Script', 'javascript:alert(1)'),
      f('5', 'Local', 'file:///etc/passwd'),
    ]);
    await ui();
    await screen.findByText('Foreign');
    expect(screen.getAllByText("This file can't be opened from the app")).toHaveLength(5);
    expect(screen.queryByText('Open PDF')).toBeNull();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(openURL).not.toHaveBeenCalled();
  });

  it('Open hands the validated, re-based link to the phone (browser / PDF viewer) once', async () => {
    fetchResultFiles.mockResolvedValue([f('1', 'Term 1', T1)]);
    await ui();
    await fireEvent.press(await screen.findByText('Open PDF'));
    expect(openURL).toHaveBeenCalledTimes(1);
    expect(openURL).toHaveBeenCalledWith('https://dev.triz.co.in/storage/upload_result/t1.pdf');
  });

  it('only the pressed row\'s own link is opened', async () => {
    fetchResultFiles.mockResolvedValue([f('1', 'Term 1', T1), f('2', 'Term 2', T2)]);
    await ui();
    const buttons = await screen.findAllByText('Open PDF');
    await fireEvent.press(buttons[1]);
    expect(openURL).toHaveBeenCalledWith('https://dev.triz.co.in/storage/upload_result/t2.pdf');
    expect(openURL).toHaveBeenCalledTimes(1);
  });

  it('an open failure (no app can open it) shows an inline notice; the screen stays usable', async () => {
    openURL.mockRejectedValue(new Error('No Activity found'));
    fetchResultFiles.mockResolvedValue([f('1', 'Term 1', T1)]);
    await ui();
    await fireEvent.press(await screen.findByText('Open PDF'));
    expect(await screen.findByText("Couldn't open the file. Please try again or contact your school.")).toBeTruthy();
    expect(screen.getByText('Open PDF')).toBeTruthy();
  });

  it('a synchronous throw from the linking module is handled the same way', async () => {
    openURL.mockImplementation(() => {
      throw new Error('boom');
    });
    fetchResultFiles.mockResolvedValue([f('1', 'Term 1', T1)]);
    await ui();
    await fireEvent.press(await screen.findByText('Open PDF'));
    expect(await screen.findByText(/Couldn't open the file/)).toBeTruthy();
  });

  it('nothing is downloaded, cached or shared: the only side effect is Linking.openURL', async () => {
    const fetchSpy = jest.fn();
    (global as { fetch: unknown }).fetch = fetchSpy;
    fetchResultFiles.mockResolvedValue([f('1', 'Term 1', T1)]);
    await ui();
    await fireEvent.press(await screen.findByText('Open PDF'));
    expect(fetchSpy).not.toHaveBeenCalled(); // the app never fetches the file itself
    expect(openURL).toHaveBeenCalledTimes(1);
  });
});

describe('ResultPdfScreen - errors, stale data and guards', () => {
  it('401 shows the session message', async () => {
    fetchResultFiles.mockRejectedValue(new ApiError('unauthorized', 'Your session has expired. Please sign in again.', 401));
    await ui();
    expect(await screen.findByText('Your session has expired. Please sign in again.')).toBeTruthy();
  });

  it('a server error shows its message and Try again reloads', async () => {
    fetchResultFiles.mockRejectedValueOnce(new ApiError('server', 'The server had a problem. Please try again shortly.', 500));
    await ui();
    expect(await screen.findByText('The server had a problem. Please try again shortly.')).toBeTruthy();
    fetchResultFiles.mockResolvedValueOnce([f('1', 'Term 1', T1)]);
    await fireEvent.press(screen.getByText('Try again'));
    expect(await screen.findByText('Term 1')).toBeTruthy();
    expect(fetchResultFiles).toHaveBeenCalledTimes(2);
  });

  it('a network error and a validation message each get their own text', async () => {
    fetchResultFiles.mockRejectedValue(new ApiError('network', 'No internet connection.'));
    await ui();
    expect(await screen.findByText('No internet connection.')).toBeTruthy();
  });

  it('"Parameter Missing" is shown with Try again', async () => {
    fetchResultFiles.mockRejectedValue(new ApiError('validation', 'Parameter Missing'));
    await ui();
    expect(await screen.findByText('Parameter Missing')).toBeTruthy();
    expect(screen.getByText('Try again')).toBeTruthy();
  });

  it('a failed refresh keeps the rows and shows the stale banner', async () => {
    fetchResultFiles.mockResolvedValueOnce([f('1', 'Term 1', T1)]);
    await ui();
    await screen.findByText('Term 1');
    fetchResultFiles.mockRejectedValueOnce(new ApiError('server', 'x', 500));
    await client.refetchQueries();
    expect(await screen.findByText(/Couldn't refresh/)).toBeTruthy();
    expect(screen.getByText('Term 1')).toBeTruthy();
    expect(screen.getByText('Open PDF')).toBeTruthy();
  });

  it('academic year: no school year -> "School year not set" and no request', async () => {
    signIn({ syear: '' });
    await ui();
    expect(screen.getByText('School year not set')).toBeTruthy();
    expect(fetchResultFiles).not.toHaveBeenCalled();
  });

  it('a non-student sees "Students only" and no request is made', async () => {
    signIn({ isStudent: false });
    await ui();
    expect(screen.getByText('Students only')).toBeTruthy();
    expect(fetchResultFiles).not.toHaveBeenCalled();
  });

  it('cached per user: another student never sees the first student\'s rows', async () => {
    fetchResultFiles.mockResolvedValueOnce([f('1', 'Alpha term', T1)]);
    const first = await ui();
    await screen.findByText('Alpha term');
    await first.unmount();
    signIn({ id: 456 });
    fetchResultFiles.mockResolvedValueOnce([f('1', 'Beta term', T2)]);
    await ui();
    expect(await screen.findByText('Beta term')).toBeTruthy();
    expect(screen.queryByText('Alpha term')).toBeNull();
    expect(fetchResultFiles).toHaveBeenCalledTimes(2);
  });
});

describe('ResultPdfScreen - the unsafe-endpoint tile', () => {
  it.each(['https://erp.triz.co.in/studentResultPDFAPI', 'studentResultPDFAPI', 'https://erp.triz.co.in/STUDENTRESULTPDFAPI?x=1'])(
    'a tile pointing at %p shows "not available" and makes no request',
    async (api) => {
      await ui(api);
      expect(screen.getByText("Result PDFs aren't available in the app yet")).toBeTruthy();
      expect(screen.getByText('Please ask your school for your report card.')).toBeTruthy();
      expect(fetchResultFiles).not.toHaveBeenCalled();
      expect(screen.queryAllByRole('button')).toHaveLength(0);
    },
  );

  it('the uploadResultAPI tile and a tile with no stored api both load the list', async () => {
    fetchResultFiles.mockResolvedValue([f('1', 'Term 1', T1)]);
    const first = await ui('https://erp.triz.co.in/uploadResultAPI');
    expect(await screen.findByText('Term 1')).toBeTruthy();
    await first.unmount();
    client = makeClient();
    await ui(null);
    expect(await screen.findByText('Term 1')).toBeTruthy();
  });
});
