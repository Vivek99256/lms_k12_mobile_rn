import { fireEvent, screen } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import React from 'react';
import { Linking } from 'react-native';
import { ApiError } from '../src/api/errors';
import { OwnProfile } from '../src/api/profile';
import { useAuthStore } from '../src/auth/authStore';
import { ProfileScreen } from '../src/screens/ProfileScreen';
import { makeClient, renderWith, signIn } from './helpers/kit';

jest.mock('../src/config/env', () => ({ env: { apiBaseUrl: 'https://dev.triz.co.in', appEnv: 'test', erpHosts: [] } }));
jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('../src/api/profile', () => ({ ...jest.requireActual('../src/api/profile'), fetchOwnProfile: jest.fn() }));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { fetchOwnProfile } = require('../src/api/profile') as { fetchOwnProfile: jest.Mock };

const ME = { name: 'Asha Patel', email: 'asha@example.com' };
const profile = (over: Partial<OwnProfile> = {}): OwnProfile => ({
  fullName: 'Asha Patel',
  email: 'asha@example.com',
  mobile: '9876543210',
  birthdate: '2012-05-17',
  joinYear: '2019',
  address: '12 Park Road',
  ...over,
});

let client = makeClient();
const ui = () => renderWith(client, <ProfileScreen />);
let consoleSpies: jest.SpyInstance[];
let openURL: jest.SpyInstance;
let fetchSpy: jest.Mock;

const entries = () => client.getQueryCache().getAll().filter((q) => String(q.queryKey[0]) === 'own-profile-details');

beforeEach(() => {
  client = makeClient();
  fetchOwnProfile.mockReset();
  openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  fetchSpy = jest.fn();
  (global as { fetch: unknown }).fetch = fetchSpy;
  consoleSpies = (['log', 'info', 'warn', 'debug'] as const).map((m) => jest.spyOn(console, m).mockImplementation(() => {}));
  (SecureStore.setItemAsync as jest.Mock).mockClear();
  signIn({ ...ME, userProfileName: 'Student', isStudent: true });
});
afterEach(() => {
  openURL.mockRestore();
  consoleSpies.forEach((s) => s.mockRestore());
});

describe('Profile tab - unchanged until the user asks', () => {
  it('shows the existing session rows and Sign out, and makes NO request on open', async () => {
    await ui();
    expect(screen.getByText('asha@example.com')).toBeTruthy();
    expect(screen.getByText('Email')).toBeTruthy();
    expect(screen.getByText('Role')).toBeTruthy();
    expect(screen.getAllByText('School').length).toBeGreaterThan(0);
    expect(screen.getByText('Sign out')).toBeTruthy();
    expect(screen.getByText('Show my details')).toBeTruthy();
    expect(fetchOwnProfile).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(entries()).toHaveLength(0);
    expect(screen.queryByText('My details')).toBeNull();
  });

  it('Sign out still works', async () => {
    const signOut = jest.fn();
    useAuthStore.setState({ signOut } as never);
    await ui();
    await fireEvent.press(screen.getByText('Sign out'));
    expect(signOut).toHaveBeenCalledTimes(1);
  });
});

describe('Show / Hide', () => {
  it('Show loads the card: loading, then the approved rows for a student (admission year), mobile as plain text', async () => {
    fetchOwnProfile.mockResolvedValue(profile());
    await ui();
    await fireEvent.press(screen.getByText('Show my details'));
    expect(fetchOwnProfile).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('9876543210')).toBeTruthy();
    expect(screen.getByText('My details')).toBeTruthy();
    expect(screen.getByText('Mobile')).toBeTruthy();
    expect(screen.getByText('Date of birth')).toBeTruthy();
    expect(screen.getByText('17 May 2012')).toBeTruthy();
    expect(screen.getByText('Admission year')).toBeTruthy();
    expect(screen.getByText('2019')).toBeTruthy();
    expect(screen.getByText('Address')).toBeTruthy();
    expect(screen.getByText('12 Park Road')).toBeTruthy();
    expect(screen.queryByText('Show my details')).toBeNull();
  });

  it('the mobile number is plain text: pressing it opens nothing and there is no link role', async () => {
    fetchOwnProfile.mockResolvedValue(profile());
    await ui();
    await fireEvent.press(screen.getByText('Show my details'));
    await fireEvent.press(await screen.findByText('9876543210'));
    expect(openURL).not.toHaveBeenCalled();
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });

  it('staff see "Joining year"', async () => {
    signIn({ ...ME, userProfileName: 'Teacher', isStudent: false });
    fetchOwnProfile.mockResolvedValue(profile());
    await ui();
    await fireEvent.press(screen.getByText('Show my details'));
    expect(await screen.findByText('Joining year')).toBeTruthy();
    expect(screen.queryByText('Admission year')).toBeNull();
  });

  it('Hide removes the details at once and empties the query cache; the Show button returns', async () => {
    fetchOwnProfile.mockResolvedValue(profile());
    await ui();
    await fireEvent.press(screen.getByText('Show my details'));
    await screen.findByText('12 Park Road');
    expect(entries()).toHaveLength(1);
    await fireEvent.press(screen.getByText('Hide details'));
    expect(screen.queryByText('12 Park Road')).toBeNull();
    expect(screen.queryByText('9876543210')).toBeNull();
    expect(screen.queryByText('My details')).toBeNull();
    expect(entries()).toHaveLength(0);
    expect(screen.getByText('Show my details')).toBeTruthy();
  });

  it('showing again after Hide fetches again (nothing was kept)', async () => {
    fetchOwnProfile.mockResolvedValue(profile());
    await ui();
    await fireEvent.press(screen.getByText('Show my details'));
    await screen.findByText('12 Park Road');
    await fireEvent.press(screen.getByText('Hide details'));
    fetchOwnProfile.mockResolvedValue(profile({ address: 'New Address 5' }));
    await fireEvent.press(screen.getByText('Show my details'));
    expect(await screen.findByText('New Address 5')).toBeTruthy();
    expect(fetchOwnProfile).toHaveBeenCalledTimes(2);
  });

  it('blank values are omitted and nothing is invented', async () => {
    fetchOwnProfile.mockResolvedValue(profile({ mobile: '', address: 'null', birthdate: '  ' }));
    await ui();
    await fireEvent.press(screen.getByText('Show my details'));
    expect(await screen.findByText('2019')).toBeTruthy();
    expect(screen.queryByText('Mobile')).toBeNull();
    expect(screen.queryByText('Address')).toBeNull();
    expect(screen.queryByText('Date of birth')).toBeNull();
  });

  it('a record with no usable details says so', async () => {
    fetchOwnProfile.mockResolvedValue(profile({ mobile: '', address: '', birthdate: '', joinYear: '' }));
    await ui();
    await fireEvent.press(screen.getByText('Show my details'));
    expect(await screen.findByText("Your school hasn't added more details yet.")).toBeTruthy();
  });

  it('never shows the server id, role, school or image even if they were present', async () => {
    fetchOwnProfile.mockResolvedValue({ ...profile(), id: '777123', user_profile: 'Student', school_name: 'Hidden School', image: 'face.jpg' } as OwnProfile);
    await ui();
    await fireEvent.press(screen.getByText('Show my details'));
    await screen.findByText('12 Park Road');
    expect(JSON.stringify(screen.toJSON())).not.toMatch(/777123|Hidden School|face\.jpg/);
    expect(screen.queryByRole('image')).toBeNull();
  });
});

describe('the identity cross-check - rejected responses expose zero profile fields', () => {
  const SECRET = { fullName: 'Someone Else', email: 'someone@else.example', mobile: '5550001111', birthdate: '1980-02-03', joinYear: '1999', address: 'Secret Street 9' };

  const expectNothingExposed = () => {
    expect(screen.getByText("Your details can't be shown right now.")).toBeTruthy();
    const tree = JSON.stringify(screen.toJSON());
    for (const v of ['Someone Else', 'someone@else.example', '5550001111', '3 Feb 1980', '1980', '1999', 'Secret Street']) expect(tree).not.toContain(v);
    expect(screen.queryByText('Mobile')).toBeNull();
    expect(screen.queryByText('Address')).toBeNull();
    // the cache holds only a bare "mismatch", never the raw record
    const data = entries()[0]?.state.data;
    expect(data).toEqual({ kind: 'mismatch' });
    expect(JSON.stringify(data)).not.toMatch(/Someone|5550001111|Secret/);
  };

  it('a different email is rejected', async () => {
    fetchOwnProfile.mockResolvedValue({ ...SECRET });
    await ui();
    await fireEvent.press(screen.getByText('Show my details'));
    await screen.findByText("Your details can't be shown right now.");
    expectNothingExposed();
  });

  it('a different email is rejected EVEN WHEN the name matches (no fall-back to the name)', async () => {
    fetchOwnProfile.mockResolvedValue({ ...SECRET, fullName: 'Asha Patel' });
    await ui();
    await fireEvent.press(screen.getByText('Show my details'));
    await screen.findByText("Your details can't be shown right now.");
    expectNothingExposed();
  });

  it('an empty server email with a different name is rejected', async () => {
    fetchOwnProfile.mockResolvedValue({ ...SECRET, email: '' });
    await ui();
    await fireEvent.press(screen.getByText('Show my details'));
    await screen.findByText("Your details can't be shown right now.");
    expectNothingExposed();
  });

  it('a record with neither email nor name is rejected', async () => {
    fetchOwnProfile.mockResolvedValue({ ...SECRET, email: '', fullName: '' });
    await ui();
    await fireEvent.press(screen.getByText('Show my details'));
    await screen.findByText("Your details can't be shown right now.");
    expectNothingExposed();
  });

  it('matching: the email in a different case is accepted', async () => {
    fetchOwnProfile.mockResolvedValue(profile({ email: 'ASHA@EXAMPLE.COM' }));
    await ui();
    await fireEvent.press(screen.getByText('Show my details'));
    expect(await screen.findByText('12 Park Road')).toBeTruthy();
    expect(screen.queryByText("Your details can't be shown right now.")).toBeNull();
  });

  it('matching: an empty server email with the same name is accepted', async () => {
    fetchOwnProfile.mockResolvedValue(profile({ email: '', fullName: '  asha   PATEL ' }));
    await ui();
    await fireEvent.press(screen.getByText('Show my details'));
    expect(await screen.findByText('12 Park Road')).toBeTruthy();
  });

  it('Hide after a rejection clears the cache too', async () => {
    fetchOwnProfile.mockResolvedValue({ ...SECRET });
    await ui();
    await fireEvent.press(screen.getByText('Show my details'));
    await screen.findByText("Your details can't be shown right now.");
    await fireEvent.press(screen.getByText('Hide details'));
    expect(entries()).toHaveLength(0);
  });
});

describe('error states', () => {
  it('404 "Profile not found." shows "Your details aren\'t available." with no retry loop', async () => {
    fetchOwnProfile.mockRejectedValue(new ApiError('server', 'Profile not found.', 404));
    await ui();
    await fireEvent.press(screen.getByText('Show my details'));
    expect(await screen.findByText("Your details aren't available.")).toBeTruthy();
    expect(screen.queryByText('Try again')).toBeNull();
    expect(fetchOwnProfile).toHaveBeenCalledTimes(1);
  });

  it('422 (no current academic year) shows the server message safely, with Try again', async () => {
    fetchOwnProfile.mockRejectedValueOnce(new ApiError('validation', 'Academic Term Date Expired', 422));
    await ui();
    await fireEvent.press(screen.getByText('Show my details'));
    expect(await screen.findByText('Academic Term Date Expired')).toBeTruthy();
    expect(screen.queryByText('9876543210')).toBeNull();
    fetchOwnProfile.mockResolvedValueOnce(profile());
    await fireEvent.press(screen.getByText('Try again'));
    expect(await screen.findByText('12 Park Road')).toBeTruthy();
    expect(fetchOwnProfile).toHaveBeenCalledTimes(2);
  });

  it('401 shows the session message (the client signs the user out)', async () => {
    fetchOwnProfile.mockRejectedValue(new ApiError('unauthorized', 'Your session has expired. Please sign in again.', 401));
    await ui();
    await fireEvent.press(screen.getByText('Show my details'));
    expect(await screen.findByText('Your session has expired. Please sign in again.')).toBeTruthy();
  });

  it('a server error and a network error show their messages with Try again', async () => {
    fetchOwnProfile.mockRejectedValueOnce(new ApiError('server', 'The server had a problem. Please try again shortly.', 500));
    await ui();
    await fireEvent.press(screen.getByText('Show my details'));
    expect(await screen.findByText('The server had a problem. Please try again shortly.')).toBeTruthy();
    fetchOwnProfile.mockRejectedValueOnce(new ApiError('network', 'We could not reach the server. Check your connection and try again.'));
    await fireEvent.press(screen.getByText('Try again'));
    expect(await screen.findByText('We could not reach the server. Check your connection and try again.')).toBeTruthy();
  });

  it('Hide works from an error state and leaves nothing in the cache', async () => {
    fetchOwnProfile.mockRejectedValue(new ApiError('server', 'x', 500));
    await ui();
    await fireEvent.press(screen.getByText('Show my details'));
    await screen.findByText('Try again');
    await fireEvent.press(screen.getByText('Hide details'));
    expect(entries()).toHaveLength(0);
    expect(screen.getByText('Show my details')).toBeTruthy();
  });
});

describe('privacy', () => {
  it('rendering, rejecting and hiding write nothing to storage or the console, and fetch no image or other URL', async () => {
    fetchOwnProfile.mockResolvedValue(profile({ address: 'PRIVATE-ADDRESS-TEXT', mobile: '5559998888' }));
    const r = await ui();
    await fireEvent.press(screen.getByText('Show my details'));
    await screen.findByText('PRIVATE-ADDRESS-TEXT');
    await fireEvent.press(screen.getByText('Hide details'));
    await r.unmount();
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    for (const spy of consoleSpies) for (const call of spy.mock.calls) expect(JSON.stringify(call)).not.toMatch(/PRIVATE-ADDRESS|5559998888/);
  });

  it('the card has no share, copy, export, edit or photo control', async () => {
    fetchOwnProfile.mockResolvedValue(profile());
    await ui();
    await fireEvent.press(screen.getByText('Show my details'));
    await screen.findByText('12 Park Road');
    expect(screen.queryByText(/share|copy|export|edit|change|photo|password|save/i)).toBeNull();
    const buttons = screen.queryAllByRole('button').map((b) => String(b.props.accessibilityLabel ?? ''));
    for (const l of buttons) expect(l === '' || /Hide details|Sign out|Try again/.test(l)).toBe(true);
  });
});
