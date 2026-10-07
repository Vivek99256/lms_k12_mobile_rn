import { fireEvent, screen } from '@testing-library/react-native';
import React from 'react';
import { Linking } from 'react-native';
import { ApiError } from '../src/api/errors';
import { CircularItem } from '../src/api/student';
import { CircularsScreen } from '../src/screens/student/CircularsScreen';
import { makeClient, renderWith, signIn, tile } from './helpers/kit';

jest.mock('../src/config/env', () => ({ env: { apiBaseUrl: 'https://dev.triz.co.in', appEnv: 'test', erpHosts: [] } }));
jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock('../src/api/student', () => ({ ...jest.requireActual('../src/api/student'), fetchCirculars: jest.fn() }));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { fetchCirculars } = require('../src/api/student') as { fetchCirculars: jest.Mock };

const item = (id: number, title: string, over: Partial<CircularItem> = {}): CircularItem => ({
  id: String(id),
  title,
  message: `Message of ${title}`,
  date: '07-10-2026',
  attachment: '',
  ...over,
});

let client = makeClient();
const ui = () => renderWith(client, <CircularsScreen tile={tile('circular_events')} />);
let openURL: jest.SpyInstance;

beforeEach(() => {
  client = makeClient();
  fetchCirculars.mockReset();
  openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  signIn();
});
afterEach(() => openURL.mockRestore());

describe('CircularsScreen', () => {
  it('opens on Circulars and asks for the exact stored type name', async () => {
    fetchCirculars.mockResolvedValue([item(1, 'Sports day')]);
    await ui();
    expect(await screen.findByText('Sports day')).toBeTruthy();
    expect(fetchCirculars).toHaveBeenCalledWith('Circular');
    expect(screen.getByText('7 Oct 2026')).toBeTruthy();
    expect(screen.getByLabelText('Circulars').props.accessibilityState.selected).toBe(true);
  });

  it('switching to Events fetches the other kind and shows its own empty state', async () => {
    fetchCirculars.mockImplementation((kind: string) => Promise.resolve(kind === 'Circular' ? [item(1, 'Sports day')] : []));
    await ui();
    await screen.findByText('Sports day');
    await fireEvent.press(screen.getByLabelText('Events'));
    expect(await screen.findByText('No events announced')).toBeTruthy();
    expect(fetchCirculars).toHaveBeenCalledWith('Event');
    expect(screen.queryByText('Sports day')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Circulars'));
    expect(await screen.findByText('Sports day')).toBeTruthy();
  });

  it('a card expands to the full text and collapses again', async () => {
    fetchCirculars.mockResolvedValue([item(1, 'Sports day', { message: 'Line one\nLine two' })]);
    await ui();
    const card = await screen.findByLabelText('Sports day, 7 Oct 2026');
    expect(card.props.accessibilityState.expanded).toBe(false);
    await fireEvent.press(card);
    expect(screen.getByLabelText('Sports day, 7 Oct 2026').props.accessibilityState.expanded).toBe(true);
    await fireEvent.press(screen.getByLabelText('Sports day, 7 Oct 2026'));
    expect(screen.getByLabelText('Sports day, 7 Oct 2026').props.accessibilityState.expanded).toBe(false);
  });

  it('opens an attachment from an ERP host, re-based onto the configured API host', async () => {
    fetchCirculars.mockResolvedValue([item(1, 'Notice', { attachment: 'https://erp.triz.co.in/storage/circular/notice.pdf' })]);
    await ui();
    await fireEvent.press(await screen.findByText('Open attachment'));
    expect(openURL).toHaveBeenCalledWith('https://dev.triz.co.in/storage/circular/notice.pdf');
  });

  it('shows no attachment button for a foreign host, a bare file name, an empty value or a non-http scheme', async () => {
    fetchCirculars.mockResolvedValue([
      item(1, 'Foreign', { attachment: 'https://evil.example/a.pdf' }),
      item(2, 'Bare', { attachment: 'a.pdf' }),
      item(3, 'Empty', { attachment: '' }),
      item(4, 'Script', { attachment: 'javascript:alert(1)' }),
      item(5, 'Credentials', { attachment: 'https://erp.triz.co.in@evil.example/a.pdf' }),
    ]);
    await ui();
    await screen.findByText('Foreign');
    expect(screen.queryByText('Open attachment')).toBeNull();
    expect(openURL).not.toHaveBeenCalled();
  });

  it('adds the enrollment hint to an HTTP 500 and keeps the tabs usable', async () => {
    fetchCirculars.mockRejectedValue(new ApiError('server', 'The server had a problem. Please try again shortly.', 500));
    await ui();
    expect(await screen.findByText(/This can happen if you are not enrolled for the current school year\./)).toBeTruthy();
    expect(screen.getByLabelText('Events')).toBeTruthy();
    fetchCirculars.mockResolvedValue([item(7, 'Event notice')]);
    await fireEvent.press(screen.getByLabelText('Events'));
    expect(await screen.findByText('Event notice')).toBeTruthy();
  });

  it('does not add the enrollment hint to other errors', async () => {
    fetchCirculars.mockRejectedValue(new ApiError('network', 'We could not reach the server. Check your connection and try again.'));
    await ui();
    expect(await screen.findByText('We could not reach the server. Check your connection and try again.')).toBeTruthy();
    expect(screen.queryByText(/enrolled/)).toBeNull();
  });

  it('Try again refetches', async () => {
    fetchCirculars.mockRejectedValueOnce(new ApiError('server', 'The server had a problem. Please try again shortly.', 500));
    await ui();
    await screen.findByText(/The server had a problem/);
    fetchCirculars.mockResolvedValueOnce([item(1, 'Sports day')]);
    await fireEvent.press(screen.getByText('Try again'));
    expect(await screen.findByText('Sports day')).toBeTruthy();
  });

  it('shows the empty state for circulars', async () => {
    fetchCirculars.mockResolvedValue([]);
    await ui();
    expect(await screen.findByText('No circulars published')).toBeTruthy();
  });

  it('keeps the last list with a banner when a refresh fails', async () => {
    client.setQueryData(['student-circulars', 123, '2026', 'Circular'], [item(1, 'Sports day')], { updatedAt: 0 });
    fetchCirculars.mockRejectedValue(new ApiError('network', 'offline'));
    await ui();
    expect(await screen.findByText(/Couldn't refresh — showing the last loaded data/)).toBeTruthy();
    expect(screen.getByText('Sports day')).toBeTruthy();
  });

  it('tolerates an untitled circular with an unreadable date', async () => {
    fetchCirculars.mockResolvedValue([item(1, '', { date: 'soon', message: '' })]);
    await ui();
    expect(await screen.findByText('Untitled')).toBeTruthy();
    expect(screen.getByText('soon')).toBeTruthy();
  });

  it('makes no request without a school year', async () => {
    signIn({ syear: null });
    await ui();
    expect(screen.getByText('School year not set')).toBeTruthy();
    expect(fetchCirculars).not.toHaveBeenCalled();
  });

  it('makes no request for a non-student session', async () => {
    signIn({ isStudent: false, userProfileName: 'Teacher' });
    await ui();
    expect(screen.getByText('Students only')).toBeTruthy();
    expect(fetchCirculars).not.toHaveBeenCalled();
  });
});
