import { fireEvent, screen } from '@testing-library/react-native';
import React from 'react';
import { ApiError } from '../src/api/errors';
import { ParentMessage } from '../src/api/student';
import { ParentCommunicationScreen } from '../src/screens/student/ParentCommunicationScreen';
import { makeClient, renderWith, signIn, tile } from './helpers/kit';

jest.mock('../src/config/env', () => ({ env: { apiBaseUrl: 'https://dev.triz.co.in', appEnv: 'test', erpHosts: [] } }));
jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock('../src/api/student', () => ({ ...jest.requireActual('../src/api/student'), fetchParentMessages: jest.fn() }));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { fetchParentMessages } = require('../src/api/student') as { fetchParentMessages: jest.Mock };

const M = (over: Partial<ParentMessage> = {}): ParentMessage => ({
  title: 'Bus timing',
  message: 'Please confirm the new timing',
  createdAt: '2026-10-05 09:30:00',
  reply: '',
  replyBy: '',
  replyOn: '',
  ...over,
});

let client = makeClient();
// The tile's stored api is the WRITE endpoint add_communicationAPI: the screen must ignore it.
const ui = () => renderWith(client, <ParentCommunicationScreen tile={{ ...tile('parent_communication', 'Parent Communication'), api: 'https://erp.triz.co.in/add_communicationAPI' }} />);

beforeEach(() => {
  client = makeClient();
  fetchParentMessages.mockReset();
  signIn();
});

describe('ParentCommunicationScreen - list', () => {
  it('shows loading, then messages in server order with sent date, text and reply state', async () => {
    fetchParentMessages.mockResolvedValue([
      M({ title: 'Newest', reply: 'Confirmed', replyBy: 'Mr Rao', replyOn: '06-10-2026' }),
      M({ title: 'Older', createdAt: '2026-10-01 08:00:00' }),
    ]);
    await ui();
    expect(screen.getByText('Loading…')).toBeTruthy();
    expect(await screen.findByText('Newest')).toBeTruthy();
    const labels = screen.getAllByLabelText(/^(Newest|Older),/).map((n) => n.props.accessibilityLabel as string);
    expect(labels[0]).toBe('Newest, sent 5 Oct 2026. Reply from Mr Rao.');
    expect(labels[1]).toBe('Older, sent 1 Oct 2026. Awaiting reply.');
    expect(screen.getByText(/School year 2026/)).toBeTruthy();
    expect(screen.getByText('Confirmed')).toBeTruthy();
    expect(screen.getByText(/Reply from Mr Rao · 6 Oct 2026/)).toBeTruthy();
    expect(screen.getAllByText('Awaiting reply')).toHaveLength(1);
    expect(fetchParentMessages).toHaveBeenCalledTimes(1);
  });

  it('a reply of "null" or blank is "Awaiting reply", never shown as text', async () => {
    fetchParentMessages.mockResolvedValue([M({ title: 'A', reply: 'null' }), M({ title: 'B', reply: '  ' })]);
    await ui();
    await screen.findByText('A');
    expect(screen.getAllByText('Awaiting reply')).toHaveLength(2);
    expect(screen.queryByText('null')).toBeNull();
  });

  it('30 at a time with "Show more"', async () => {
    fetchParentMessages.mockResolvedValue(Array.from({ length: 31 }, (_, i) => M({ title: `Msg ${i}` })));
    await ui();
    await screen.findByText('Show more (1 more)');
    expect(screen.getAllByLabelText(/^Msg \d+,/)).toHaveLength(30);
    await fireEvent.press(screen.getByText('Show more (1 more)'));
    expect(screen.getAllByLabelText(/^Msg \d+,/)).toHaveLength(31);
  });

  it('is view only: no compose field, no send button; the unavailable-write wording is shown', async () => {
    fetchParentMessages.mockResolvedValue([M()]);
    await ui();
    await screen.findByText('Bus timing');
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryAllByRole('link')).toHaveLength(0);
    expect(screen.queryByPlaceholderText(/./)).toBeNull();
    expect(screen.queryByDisplayValue(/./)).toBeNull();
    expect(screen.getByText(/Send a message — This isn't available in the app yet\./)).toBeTruthy();
  });
});

describe('ParentCommunicationScreen - empty, errors, stale, guards', () => {
  it('empty list -> an empty state with the unavailable-write wording', async () => {
    fetchParentMessages.mockResolvedValue([]);
    await ui();
    expect(await screen.findByText('No messages for school year 2026')).toBeTruthy();
    expect(screen.getByText(/This isn't available in the app yet/)).toBeTruthy();
  });

  it('401 (authentication failure) shows the session message', async () => {
    fetchParentMessages.mockRejectedValue(new ApiError('unauthorized', 'Your session has expired. Please sign in again.', 401));
    await ui();
    expect(await screen.findByText('Your session has expired. Please sign in again.')).toBeTruthy();
  });

  it('a server error shows its message and Try again reloads', async () => {
    fetchParentMessages.mockRejectedValueOnce(new ApiError('server', 'The server had a problem. Please try again shortly.', 500));
    await ui();
    expect(await screen.findByText('The server had a problem. Please try again shortly.')).toBeTruthy();
    fetchParentMessages.mockResolvedValueOnce([M()]);
    await fireEvent.press(screen.getByText('Try again'));
    expect(await screen.findByText('Bus timing')).toBeTruthy();
  });

  it('"Parameter Missing" from the status_code envelope is shown with Try again', async () => {
    fetchParentMessages.mockRejectedValue(new ApiError('validation', 'Parameter Missing'));
    await ui();
    expect(await screen.findByText('Parameter Missing')).toBeTruthy();
  });

  it('a failed refresh keeps the rows and shows the stale banner', async () => {
    fetchParentMessages.mockResolvedValueOnce([M()]);
    await ui();
    await screen.findByText('Bus timing');
    fetchParentMessages.mockRejectedValueOnce(new ApiError('server', 'x', 500));
    await client.refetchQueries();
    expect(await screen.findByText(/Couldn't refresh/)).toBeTruthy();
    expect(screen.getByText('Bus timing')).toBeTruthy();
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
    expect(fetchParentMessages).not.toHaveBeenCalled();
  });

  it("cached per user: another student never sees the first student's messages", async () => {
    fetchParentMessages.mockResolvedValueOnce([M({ title: 'Alpha message' })]);
    const first = await ui();
    await screen.findByText('Alpha message');
    await first.unmount();
    signIn({ id: 456 });
    fetchParentMessages.mockResolvedValueOnce([M({ title: 'Beta message' })]);
    await ui();
    expect(await screen.findByText('Beta message')).toBeTruthy();
    expect(screen.queryByText('Alpha message')).toBeNull();
  });
});

describe('the write endpoint is never contacted', () => {
  it('opening the screen over the real client requests only studentParentcommunicationListAPI, although the tile stores add_communicationAPI', async () => {
    jest.resetModules();
    const fetchMock = jest.fn().mockResolvedValue({ status: 200, text: () => Promise.resolve(JSON.stringify({ status_code: 1, message: 'Success', data: [] })) });
    (global as { fetch: unknown }).fetch = fetchMock;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const real = jest.requireActual('../src/api/student') as typeof import('../src/api/student');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { configureApi } = require('../src/api/client') as typeof import('../src/api/client');
    configureApi({
      getSession: () => ({ token: 't', subInstituteId: 7, syear: '2026', userId: 123, userProfileId: 3, userProfileName: 'Student', isStudent: true }),
      onUnauthorized: () => {},
    });
    await real.fetchParentMessages();
    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain('studentParentcommunicationListAPI');
    expect(urls.some((u) => u.includes('add_communicationAPI'))).toBe(false);
  });
});
