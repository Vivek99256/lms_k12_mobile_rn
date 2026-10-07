import { fireEvent, screen } from '@testing-library/react-native';
import React from 'react';
import { Linking } from 'react-native';
import { ApiError } from '../src/api/errors';
import { NotificationItem } from '../src/api/student';
import { NotificationHubScreen } from '../src/screens/student/NotificationHubScreen';
import { makeClient, pinToday, renderWith, signIn, tile } from './helpers/kit';

jest.mock('../src/config/env', () => ({ env: { apiBaseUrl: 'https://dev.triz.co.in', appEnv: 'test', erpHosts: [] } }));
jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock('../src/api/student', () => ({ ...jest.requireActual('../src/api/student'), fetchNotifications: jest.fn() }));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { fetchNotifications } = require('../src/api/student') as { fetchNotifications: jest.Mock };

const n = (id: number, date: string, type = 'Homework', description = `Message ${id}`): NotificationItem => ({ id: String(id), type, description, date });

let client = makeClient();
const ui = () => renderWith(client, <NotificationHubScreen tile={tile('notification_hub')} />);
let openURL: jest.SpyInstance;

beforeAll(pinToday);
afterAll(() => jest.useRealTimers());
beforeEach(() => {
  client = makeClient();
  fetchNotifications.mockReset();
  openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  signIn();
});
afterEach(() => openURL.mockRestore());

describe('NotificationHubScreen', () => {
  it('groups notifications by day with Today / Yesterday headings, newest first', async () => {
    fetchNotifications.mockResolvedValue([n(1, '05-10-2026', 'Circular'), n(2, '07-10-2026', 'Homework'), n(3, '06-10-2026', 'Assignment')]);
    await ui();
    expect(await screen.findByText('Today')).toBeTruthy();
    const headings = screen.getAllByRole('header').map((h) => h.props.children);
    expect(headings).toEqual(['Today', 'Yesterday', '5 October 2026']);
    expect(screen.getByText('Message 2')).toBeTruthy();
    expect(screen.getByText('Circular')).toBeTruthy();
  });

  it('shows 30 at a time with a Show more button (S1-D5)', async () => {
    fetchNotifications.mockResolvedValue(Array.from({ length: 35 }, (_, i) => n(i + 1, '07-10-2026')));
    await ui();
    expect(await screen.findByText('Message 1')).toBeTruthy();
    expect(screen.queryByText('Message 31')).toBeNull();
    expect(screen.getByText('Message 30')).toBeTruthy();
    await fireEvent.press(screen.getByText('Show more (5 older)'));
    expect(screen.getByText('Message 35')).toBeTruthy();
    expect(screen.queryByText(/Show more/)).toBeNull();
  });

  it('makes only http(s) links tappable and opens them through Linking (S1-D6)', async () => {
    fetchNotifications.mockResolvedValue([n(1, '07-10-2026', 'Notification', 'Pay fees at https://school.example/fees. javascript:alert(1) tel:+911234567890')]);
    await ui();
    const links = await screen.findAllByRole('link');
    expect(links).toHaveLength(1);
    await fireEvent.press(links[0]);
    expect(openURL).toHaveBeenCalledTimes(1);
    expect(openURL).toHaveBeenCalledWith('https://school.example/fees');
  });

  it('never makes a link out of credentials-in-URL or other schemes', async () => {
    fetchNotifications.mockResolvedValue([n(1, '07-10-2026', 'Notification', 'go to https://erp.triz.co.in@evil.example/x or intent://x or file:///etc/passwd')]);
    await ui();
    await screen.findByText(/go to/);
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });

  it('puts notifications with an unreadable date under Earlier and tolerates unknown types and empty text', async () => {
    fetchNotifications.mockResolvedValue([n(1, 'sometime', 'Brand New Type', ''), n(2, '07-10-2026')]);
    await ui();
    expect(await screen.findByText('Earlier')).toBeTruthy();
    expect(screen.getByText('Brand New Type')).toBeTruthy();
  });

  it('never loads remote images', async () => {
    fetchNotifications.mockResolvedValue([{ ...n(1, '07-10-2026'), image: 'https://127.0.0.1/storage/student/homework.png' }]);
    await ui();
    await screen.findByText('Message 1');
    // Walk only type/children (the JSON tree also holds circular context objects in props).
    const types = (node: unknown): string[] =>
      !node || typeof node === 'string' ? [] : Array.isArray(node) ? node.flatMap(types) : [(node as { type: string }).type, ...types((node as { children?: unknown }).children)];
    const rendered = types(screen.toJSON());
    expect(rendered.length).toBeGreaterThan(5); // the screen did render
    expect(rendered).not.toContain('Image'); // and no image component is in it
  });

  it('shows an empty state', async () => {
    fetchNotifications.mockResolvedValue([]);
    await ui();
    expect(await screen.findByText('No notifications yet')).toBeTruthy();
  });

  it('shows an error with Try again that refetches', async () => {
    fetchNotifications.mockRejectedValueOnce(new ApiError('network', 'We could not reach the server. Check your connection and try again.'));
    await ui();
    expect(await screen.findByText('We could not reach the server. Check your connection and try again.')).toBeTruthy();
    fetchNotifications.mockResolvedValueOnce([n(1, '07-10-2026')]);
    await fireEvent.press(screen.getByText('Try again'));
    expect(await screen.findByText('Message 1')).toBeTruthy();
  });

  it('keeps the last list with a banner when a refresh fails', async () => {
    client.setQueryData(['student-notifications', 123, '2026'], [n(1, '07-10-2026')], { updatedAt: 0 });
    fetchNotifications.mockRejectedValue(new ApiError('network', 'offline'));
    await ui();
    expect(await screen.findByText(/Couldn't refresh — showing the last loaded data/)).toBeTruthy();
    expect(screen.getByText('Message 1')).toBeTruthy();
  });

  it('shows another student\'s cached notifications to nobody (cache is keyed by user)', async () => {
    client.setQueryData(['student-notifications', 999, '2026'], [n(9, '07-10-2026', 'Homework', 'SECRET OF 999')]);
    fetchNotifications.mockResolvedValue([n(1, '07-10-2026')]);
    await ui();
    expect(await screen.findByText('Message 1')).toBeTruthy();
    expect(screen.queryByText('SECRET OF 999')).toBeNull();
  });

  it('makes no request without a school year', async () => {
    signIn({ syear: null });
    await ui();
    expect(screen.getByText('School year not set')).toBeTruthy();
    expect(fetchNotifications).not.toHaveBeenCalled();
  });

  it('makes no request for a non-student session', async () => {
    signIn({ isStudent: false, userProfileName: 'Teacher' });
    await ui();
    expect(screen.getByText('Students only')).toBeTruthy();
    expect(fetchNotifications).not.toHaveBeenCalled();
  });
});
