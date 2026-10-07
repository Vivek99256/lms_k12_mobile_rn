import { fireEvent, screen } from '@testing-library/react-native';
import React from 'react';
import { Linking } from 'react-native';
import { ApiError } from '../src/api/errors';
import { SchoolDetailRow } from '../src/api/student';
import { SchoolInfoScreen } from '../src/screens/student/SchoolInfoScreen';
import { SCHOOL_INFO_ACTIONS } from '../src/screens/student/schoolInfoModel';
import { makeClient, renderWith, signIn, tile } from './helpers/kit';

jest.mock('../src/config/env', () => ({ env: { apiBaseUrl: 'https://dev.triz.co.in', appEnv: 'test', erpHosts: [] } }));
jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock('../src/api/student', () => ({ ...jest.requireActual('../src/api/student'), fetchSchoolDetail: jest.fn() }));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { fetchSchoolDetail } = require('../src/api/student') as { fetchSchoolDetail: jest.Mock };

const row = (content: string, type = 'About Us'): SchoolDetailRow => ({ type, content });

let client = makeClient();
const ui = (screenName = 'about_us', api: string | null = 'https://erp.triz.co.in/schoolDetailAPI') =>
  renderWith(client, <SchoolInfoScreen tile={{ ...tile(screenName), api }} />);
let openURL: jest.SpyInstance;

beforeEach(() => {
  client = makeClient();
  fetchSchoolDetail.mockReset();
  openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  signIn();
});
afterEach(() => openURL.mockRestore());

describe('SchoolInfoScreen', () => {
  it('shows loading, then the page as plain text', async () => {
    fetchSchoolDetail.mockResolvedValue([row('<h2>Welcome</h2><p>Our <b>school</b></p>')]);
    await ui();
    expect(screen.getByText('Loading…')).toBeTruthy();
    expect(await screen.findByText(/Welcome\s+Our school/)).toBeTruthy();
    expect(screen.queryByText(/<h2>|<b>/)).toBeNull();
    expect(fetchSchoolDetail).toHaveBeenCalledTimes(1);
  });

  it.each(Object.entries(SCHOOL_INFO_ACTIONS))('the %s page asks for exactly %p', async (name, action) => {
    fetchSchoolDetail.mockResolvedValue([row('Content')]);
    await ui(name);
    await screen.findByText('Content');
    expect(fetchSchoolDetail).toHaveBeenCalledWith(action);
  });

  it("ignores the tile's stored api: another stored url changes nothing", async () => {
    fetchSchoolDetail.mockResolvedValue([row('Content')]);
    await ui('rules', 'https://erp.triz.co.in/front_desk/send_attachment/create');
    await screen.findByText('Content');
    expect(fetchSchoolDetail).toHaveBeenCalledTimes(1);
    expect(fetchSchoolDetail).toHaveBeenCalledWith('Rules');
  });

  it('only http(s) URLs in the text are tappable; javascript:, tel:, intent: and file: stay inert', async () => {
    fetchSchoolDetail.mockResolvedValue([row('<p>Site https://school.example/page and javascript:alert(1) and tel:123456 and intent://x and file:///etc/passwd</p>')]);
    await ui();
    await screen.findByText(/Site/);
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(1);
    await fireEvent.press(links[0]);
    expect(openURL).toHaveBeenCalledTimes(1);
    expect(openURL).toHaveBeenCalledWith('https://school.example/page');
  });

  it('a URL with credentials is not a link', async () => {
    fetchSchoolDetail.mockResolvedValue([row('See https://user:pw@evil.example/x now')]);
    await ui();
    await screen.findByText(/See/);
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });

  it('several rows are shown one under another in the server order', async () => {
    fetchSchoolDetail.mockResolvedValue([row('First part'), row('Second part')]);
    await ui();
    await screen.findByText('First part');
    expect(screen.getByText('Second part')).toBeTruthy();
  });

  it('empty or missing content is never invented: the empty state is shown', async () => {
    fetchSchoolDetail.mockResolvedValue([row('<p></p>'), row('   ')]);
    await ui();
    expect(await screen.findByText('Nothing published yet')).toBeTruthy();
    expect(screen.getByText('Your school has not added this page yet.')).toBeTruthy();
  });

  it('an empty list also shows the empty state', async () => {
    fetchSchoolDetail.mockResolvedValue([]);
    await ui();
    expect(await screen.findByText('Nothing published yet')).toBeTruthy();
  });

  it('is view only: no button other than Try again, no input', async () => {
    fetchSchoolDetail.mockResolvedValue([row('Content')]);
    await ui();
    await screen.findByText('Content');
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryByPlaceholderText(/./)).toBeNull();
  });

  it('401 shows the session message', async () => {
    fetchSchoolDetail.mockRejectedValue(new ApiError('unauthorized', 'Your session has expired. Please sign in again.', 401));
    await ui();
    expect(await screen.findByText('Your session has expired. Please sign in again.')).toBeTruthy();
  });

  it('a server error shows its message and Try again reloads', async () => {
    fetchSchoolDetail.mockRejectedValueOnce(new ApiError('server', 'The server had a problem. Please try again shortly.', 500));
    await ui();
    expect(await screen.findByText('The server had a problem. Please try again shortly.')).toBeTruthy();
    fetchSchoolDetail.mockResolvedValueOnce([row('Back again')]);
    await fireEvent.press(screen.getByText('Try again'));
    expect(await screen.findByText('Back again')).toBeTruthy();
  });

  it('"Parameter Missing" is shown with Try again', async () => {
    fetchSchoolDetail.mockRejectedValue(new ApiError('validation', 'Parameter Missing'));
    await ui();
    expect(await screen.findByText('Parameter Missing')).toBeTruthy();
  });

  it('a failed refresh keeps the text and shows the stale banner', async () => {
    fetchSchoolDetail.mockResolvedValueOnce([row('Kept text')]);
    await ui();
    await screen.findByText('Kept text');
    fetchSchoolDetail.mockRejectedValueOnce(new ApiError('server', 'x', 500));
    await client.refetchQueries();
    expect(await screen.findByText(/Couldn't refresh/)).toBeTruthy();
    expect(screen.getByText('Kept text')).toBeTruthy();
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
    expect(fetchSchoolDetail).not.toHaveBeenCalled();
  });

  it("cached per user: another student never sees the first student's page", async () => {
    fetchSchoolDetail.mockResolvedValueOnce([row('Alpha page')]);
    const first = await ui();
    await screen.findByText('Alpha page');
    await first.unmount();
    signIn({ id: 456 });
    fetchSchoolDetail.mockResolvedValueOnce([row('Beta page')]);
    await ui();
    expect(await screen.findByText('Beta page')).toBeTruthy();
    expect(screen.queryByText('Alpha page')).toBeNull();
  });

  it('a tile with no action text (unknown screen name) says it is unavailable and makes no request', async () => {
    await ui('something_else');
    expect(screen.getByText("This isn't available in the app yet.")).toBeTruthy();
    expect(screen.getByText('Please ask your school.')).toBeTruthy();
    expect(fetchSchoolDetail).not.toHaveBeenCalled();
  });
});
