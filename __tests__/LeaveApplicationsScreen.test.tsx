import { fireEvent, screen } from '@testing-library/react-native';
import React from 'react';
import { Linking } from 'react-native';
import { ApiError } from '../src/api/errors';
import { LeaveApplication } from '../src/api/student';
import { LeaveApplicationsScreen } from '../src/screens/student/LeaveApplicationsScreen';
import { makeClient, renderWith, signIn, tile } from './helpers/kit';

jest.mock('../src/config/env', () => ({ env: { apiBaseUrl: 'https://dev.triz.co.in', appEnv: 'test', erpHosts: [] } }));
jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock('../src/api/student', () => ({ ...jest.requireActual('../src/api/student'), fetchLeaveApplications: jest.fn() }));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { fetchLeaveApplications } = require('../src/api/student') as { fetchLeaveApplications: jest.Mock };

const L = (over: Partial<LeaveApplication> = {}): LeaveApplication => ({
  title: 'Sick leave',
  message: 'Fever',
  file: '',
  appliedOn: '05-10-2026 09:30:00',
  fromDate: '2026-10-06',
  toDate: '2026-10-08',
  status: '',
  reply: '',
  replyBy: '',
  replyOn: '',
  ...over,
});
const FILE = 'https://erp.triz.co.in/storage/leave_application/a.pdf';

let client = makeClient();
const ui = () => renderWith(client, <LeaveApplicationsScreen tile={{ ...tile('leave_application', 'Leave Application'), api: 'https://erp.triz.co.in/studentLeaveApplicationAPI' }} />);
let openURL: jest.SpyInstance;

beforeEach(() => {
  client = makeClient();
  fetchLeaveApplications.mockReset();
  openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  signIn();
});
afterEach(() => openURL.mockRestore());

describe('LeaveApplicationsScreen - list', () => {
  it('shows loading, then the applications newest first with dates, status, note and applied date', async () => {
    fetchLeaveApplications.mockResolvedValue([
      L({ title: 'Older', appliedOn: '01-10-2026 10:00:00', fromDate: '2026-10-02', toDate: '2026-10-02' }),
      L({ title: 'Newest', appliedOn: '05-10-2026 17:00:00' }),
    ]);
    await ui();
    expect(screen.getByText('Loading…')).toBeTruthy();
    expect(await screen.findByText('Newest')).toBeTruthy();
    const labels = screen.getAllByLabelText(/^(Older|Newest),/).map((n) => n.props.accessibilityLabel as string);
    expect(labels[0]).toMatch(/^Newest, 6 Oct 2026 – 8 Oct 2026, Pending/);
    expect(labels[1]).toMatch(/^Older, 2 Oct 2026, Pending/);
    expect(screen.getByText(/School year 2026/)).toBeTruthy();
    expect(screen.getAllByText('Fever')).toHaveLength(2);
    expect(screen.getByText('Applied 5 Oct 2026')).toBeTruthy();
    expect(fetchLeaveApplications).toHaveBeenCalledTimes(1);
  });

  it('an empty status shows Pending; Approved and Rejected show as written; other text is shown as sent', async () => {
    fetchLeaveApplications.mockResolvedValue([
      L({ title: 'A', status: '' }),
      L({ title: 'B', status: 'Approved' }),
      L({ title: 'C', status: 'Rejected' }),
      L({ title: 'D', status: 'On hold' }),
    ]);
    await ui();
    await screen.findByText('A');
    expect(screen.getByLabelText('Status: Pending')).toBeTruthy();
    expect(screen.getByLabelText('Status: Approved')).toBeTruthy();
    expect(screen.getByLabelText('Status: Rejected')).toBeTruthy();
    expect(screen.getByLabelText('Status: On hold')).toBeTruthy();
    expect(screen.getAllByLabelText(/^Status: /)).toHaveLength(4);
  });

  it('the staff reply is visible with who and when, and absent when blank or "null"', async () => {
    fetchLeaveApplications.mockResolvedValue([
      L({ title: 'Replied', status: 'Approved', reply: 'Get well soon', replyBy: 'Mrs Shah', replyOn: '06-10-2026 11:00:00' }),
      L({ title: 'NoReply', reply: '' }),
      L({ title: 'NullReply', reply: 'null' }),
    ]);
    await ui();
    await screen.findByText('Replied');
    expect(screen.getByText('Get well soon')).toBeTruthy();
    expect(screen.getByText(/Reply from Mrs Shah · 6 Oct 2026/)).toBeTruthy();
    expect(screen.getAllByText(/^Reply/)).toHaveLength(1);
    expect(screen.queryByText('null')).toBeNull();
  });

  it('30 at a time with "Show more"', async () => {
    fetchLeaveApplications.mockResolvedValue(Array.from({ length: 35 }, (_, i) => L({ title: `Leave ${i}`, appliedOn: `${String((i % 28) + 1).padStart(2, '0')}-09-2026 10:00:00` })));
    await ui();
    await screen.findByText('Show more (5 more)');
    expect(screen.getAllByLabelText(/^Leave \d+,/)).toHaveLength(30);
    await fireEvent.press(screen.getByText('Show more (5 more)'));
    expect(screen.getAllByLabelText(/^Leave \d+,/)).toHaveLength(35);
    expect(screen.queryByText(/Show more/)).toBeNull();
  });

  it('is view only: no input, no submit; the unavailable-write wording is shown', async () => {
    fetchLeaveApplications.mockResolvedValue([L()]);
    await ui();
    await screen.findByText('Sick leave');
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryAllByRole('link')).toHaveLength(0);
    expect(screen.getByText(/Apply for leave — This isn't available in the app yet\./)).toBeTruthy();
  });
});

describe('LeaveApplicationsScreen - attachment', () => {
  it('a valid link opens once, re-based onto the API host, only in the phone viewer', async () => {
    fetchLeaveApplications.mockResolvedValue([L({ file: FILE })]);
    await ui();
    await fireEvent.press(await screen.findByText('Open attachment'));
    expect(openURL).toHaveBeenCalledTimes(1);
    expect(openURL).toHaveBeenCalledWith('https://dev.triz.co.in/storage/leave_application/a.pdf');
  });

  it('unsafe links have no button and a clear message; the row stays; nothing is opened', async () => {
    fetchLeaveApplications.mockResolvedValue([
      L({ title: 'Foreign', file: 'https://evil.example/a.pdf' }),
      L({ title: 'Lookalike', file: 'https://erp.triz.co.in.evil.com/a.pdf' }),
      L({ title: 'Creds', file: 'https://erp.triz.co.in@evil.example/a.pdf' }),
      L({ title: 'Script', file: 'javascript:alert(1)' }),
    ]);
    await ui();
    await screen.findByText('Foreign');
    expect(screen.getAllByText("Attachment can't be opened from the app")).toHaveLength(4);
    expect(screen.queryByText('Open attachment')).toBeNull();
    expect(openURL).not.toHaveBeenCalled();
  });

  it('no file -> no button and no message', async () => {
    fetchLeaveApplications.mockResolvedValue([L({ file: '' })]);
    await ui();
    await screen.findByText('Sick leave');
    expect(screen.queryByText('Open attachment')).toBeNull();
    expect(screen.queryByText(/can't be opened/)).toBeNull();
  });

  it('an open failure shows an inline notice and the screen stays usable', async () => {
    openURL.mockRejectedValue(new Error('No Activity found'));
    fetchLeaveApplications.mockResolvedValue([L({ file: FILE })]);
    await ui();
    await fireEvent.press(await screen.findByText('Open attachment'));
    expect(await screen.findByText("Couldn't open the file. Please try again or contact your school.")).toBeTruthy();
    expect(screen.getByText('Open attachment')).toBeTruthy();
  });

  it('nothing is fetched or stored by the app for the file: the only side effect is Linking.openURL', async () => {
    fetchLeaveApplications.mockResolvedValue([L({ file: FILE })]);
    await ui();
    const spy = jest.fn();
    (global as { fetch: unknown }).fetch = spy;
    await fireEvent.press(await screen.findByText('Open attachment'));
    expect(spy).not.toHaveBeenCalled();
    expect(openURL).toHaveBeenCalledTimes(1);
  });
});

describe('LeaveApplicationsScreen - empty, errors, stale, guards', () => {
  it('empty list -> an empty state with the unavailable-write wording', async () => {
    fetchLeaveApplications.mockResolvedValue([]);
    await ui();
    expect(await screen.findByText('No leave requests for school year 2026')).toBeTruthy();
    expect(screen.getByText(/This isn't available in the app yet/)).toBeTruthy();
  });

  it('401 (authentication failure) shows the session message', async () => {
    fetchLeaveApplications.mockRejectedValue(new ApiError('unauthorized', 'Your session has expired. Please sign in again.', 401));
    await ui();
    expect(await screen.findByText('Your session has expired. Please sign in again.')).toBeTruthy();
  });

  it('a server error shows its message and Try again reloads', async () => {
    fetchLeaveApplications.mockRejectedValueOnce(new ApiError('server', 'The server had a problem. Please try again shortly.', 500));
    await ui();
    expect(await screen.findByText('The server had a problem. Please try again shortly.')).toBeTruthy();
    fetchLeaveApplications.mockResolvedValueOnce([L()]);
    await fireEvent.press(screen.getByText('Try again'));
    expect(await screen.findByText('Sick leave')).toBeTruthy();
  });

  it('"Parameter Missing" is shown with Try again', async () => {
    fetchLeaveApplications.mockRejectedValue(new ApiError('validation', 'Parameter Missing'));
    await ui();
    expect(await screen.findByText('Parameter Missing')).toBeTruthy();
    expect(screen.getByText('Try again')).toBeTruthy();
  });

  it('a failed refresh keeps the rows and shows the stale banner', async () => {
    fetchLeaveApplications.mockResolvedValueOnce([L({ file: FILE })]);
    await ui();
    await screen.findByText('Sick leave');
    fetchLeaveApplications.mockRejectedValueOnce(new ApiError('server', 'x', 500));
    await client.refetchQueries();
    expect(await screen.findByText(/Couldn't refresh/)).toBeTruthy();
    expect(screen.getByText('Sick leave')).toBeTruthy();
    expect(screen.getByText('Open attachment')).toBeTruthy();
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
    expect(fetchLeaveApplications).not.toHaveBeenCalled();
  });

  it("cached per user: another student never sees the first student's leave", async () => {
    fetchLeaveApplications.mockResolvedValueOnce([L({ title: 'Alpha leave' })]);
    const first = await ui();
    await screen.findByText('Alpha leave');
    await first.unmount();
    signIn({ id: 456 });
    fetchLeaveApplications.mockResolvedValueOnce([L({ title: 'Beta leave' })]);
    await ui();
    expect(await screen.findByText('Beta leave')).toBeTruthy();
    expect(screen.queryByText('Alpha leave')).toBeNull();
  });
});
