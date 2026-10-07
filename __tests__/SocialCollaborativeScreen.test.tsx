import { fireEvent, screen } from '@testing-library/react-native';
import React from 'react';
import { Linking } from 'react-native';
import { ApiError } from '../src/api/errors';
import { Discussion, DiscussionDetail } from '../src/api/student';
import { SocialCollaborativeScreen } from '../src/screens/student/SocialCollaborativeScreen';
import { makeClient, renderWith, signIn, tile } from './helpers/kit';

jest.mock('../src/config/env', () => ({ env: { apiBaseUrl: 'https://dev.triz.co.in', appEnv: 'test', erpHosts: [] } }));
jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock('../src/api/student', () => ({ ...jest.requireActual('../src/api/student'), fetchMyDiscussions: jest.fn(), fetchDiscussion: jest.fn() }));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { fetchMyDiscussions, fetchDiscussion } = require('../src/api/student') as { fetchMyDiscussions: jest.Mock; fetchDiscussion: jest.Mock };

// signIn() uses user id 123 (helpers/kit).
const ME = '123';
const d = (id: string, over: Partial<Discussion> = {}): Discussion => ({
  id,
  title: `Doubt ${id}`,
  description: `About ${id}`,
  visibility: 'private',
  attachment: '',
  createdAt: '2026-03-01 10:00:00',
  commentCount: 0,
  authorId: ME,
  ...over,
});
const detail = (id: string, over: Partial<DiscussionDetail> = {}): DiscussionDetail => ({ ...d(id), comments: [], ...over });

let client = makeClient();
const ui = (api: string | null = 'https://erp.triz.co.in/studentSocialCollabrativeAPI') => renderWith(client, <SocialCollaborativeScreen tile={{ ...tile('social_collabrative'), api }} />);
let openURL: jest.SpyInstance;
let fetchSpy: jest.Mock;
let consoleSpies: jest.SpyInstance[];

beforeEach(() => {
  client = makeClient();
  fetchMyDiscussions.mockReset();
  fetchDiscussion.mockReset();
  openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  fetchSpy = jest.fn();
  (global as { fetch: unknown }).fetch = fetchSpy;
  consoleSpies = (['log', 'info', 'warn', 'debug'] as const).map((m) => jest.spyOn(console, m).mockImplementation(() => {}));
  signIn();
});
afterEach(() => {
  openURL.mockRestore();
  consoleSpies.forEach((s) => s.mockRestore());
});

describe('SocialCollaborativeScreen - my discussions', () => {
  it('shows loading, then only my discussions, newest first, with date, visibility and replies', async () => {
    fetchMyDiscussions.mockResolvedValue([d('1', { createdAt: '2026-01-01 09:00:00' }), d('2', { createdAt: '2026-03-02 09:00:00', visibility: 'public', commentCount: 2 })]);
    await ui();
    expect(screen.getByText('Loading…')).toBeTruthy();
    expect(await screen.findByText('Doubt 2')).toBeTruthy();
    const labels = screen.getAllByLabelText(/^Doubt \d,/).map((n) => n.props.accessibilityLabel as string);
    expect(labels[0]).toBe('Doubt 2, 2 Mar 2026 · Shared with everyone · 2 replies');
    expect(labels[1]).toBe('Doubt 1, 1 Jan 2026 · Private');
    expect(screen.getByText(/My discussions · School year 2026/)).toBeTruthy();
    expect(fetchMyDiscussions).toHaveBeenCalledTimes(1);
  });

  it('never shows another student\'s or a public discussion, even if the server sends one', async () => {
    fetchMyDiscussions.mockResolvedValue([d('1'), d('2', { authorId: '999', visibility: 'public', title: 'Someone else' }), d('3', { authorId: '', title: 'Unknown author' })]);
    await ui();
    await screen.findByText('Doubt 1');
    expect(screen.queryByText('Someone else')).toBeNull();
    expect(screen.queryByText('Unknown author')).toBeNull();
  });

  it('shows no author information in the list', async () => {
    fetchMyDiscussions.mockResolvedValue([d('1')]);
    await ui();
    await screen.findByText('Doubt 1');
    expect(screen.queryByText(/by |author|class|@/i)).toBeNull();
  });

  it('is view only: no composer, no post / comment / edit / delete control', async () => {
    fetchMyDiscussions.mockResolvedValue([d('1')]);
    await ui();
    await screen.findByText('Doubt 1');
    expect(screen.queryByPlaceholderText(/./)).toBeNull();
    expect(screen.queryByDisplayValue(/./)).toBeNull();
    expect(screen.queryByText(/^(post|send|reply|comment|edit|delete|new discussion|ask)\b/i)).toBeNull();
    expect(screen.getByText("Starting a discussion or replying isn't available in the app yet.")).toBeTruthy();
  });

  it('30 at a time with "Show more"', async () => {
    fetchMyDiscussions.mockResolvedValue(Array.from({ length: 31 }, (_, i) => d(String(i + 1), { createdAt: `2026-03-${String((i % 28) + 1).padStart(2, '0')} 10:00:00` })));
    await ui();
    await screen.findByText('Show more (1 more)');
    await fireEvent.press(screen.getByText('Show more (1 more)'));
    expect(screen.queryByText(/Show more/)).toBeNull();
  });

  it('empty -> an empty state with the not-available note', async () => {
    fetchMyDiscussions.mockResolvedValue([]);
    await ui();
    expect(await screen.findByText("You haven't started any discussions")).toBeTruthy();
    expect(screen.getByText("Starting a discussion or replying isn't available in the app yet.")).toBeTruthy();
  });

  it("ignores the tile's stored api (even the legacy endpoint and a broad URL)", async () => {
    fetchMyDiscussions.mockResolvedValue([d('1')]);
    await ui('https://erp.triz.co.in/api/lms/social-collaborative');
    await screen.findByText('Doubt 1');
    expect(fetchMyDiscussions).toHaveBeenCalledTimes(1);
    expect(fetchMyDiscussions).toHaveBeenCalledWith();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('SocialCollaborativeScreen - attachments', () => {
  it('a valid link opens once after validation; the app fetches nothing itself', async () => {
    fetchMyDiscussions.mockResolvedValue([d('1', { attachment: 'https://school.sgp1.digitaloceanspaces.com/public/lms_doubts/a.pdf' })]);
    await ui();
    await fireEvent.press(await screen.findByText('Open attachment'));
    expect(openURL).toHaveBeenCalledTimes(1);
    expect(openURL).toHaveBeenCalledWith('https://school.sgp1.digitaloceanspaces.com/public/lms_doubts/a.pdf');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(screen.queryByRole('image')).toBeNull();
  });

  it('unsafe links show a message and no button; nothing is opened', async () => {
    fetchMyDiscussions.mockResolvedValue([
      d('1', { attachment: 'javascript:alert(1)' }),
      d('2', { attachment: 'https://user:pw@evil.example/a.pdf' }),
      d('3', { attachment: 'file:///etc/passwd' }),
    ]);
    await ui();
    await screen.findByText('Doubt 1');
    expect(screen.getAllByText("Attachment can't be opened from the app")).toHaveLength(3);
    expect(screen.queryByText('Open attachment')).toBeNull();
    expect(openURL).not.toHaveBeenCalled();
  });

  it('an open failure shows an inline notice', async () => {
    openURL.mockRejectedValue(new Error('No Activity found'));
    fetchMyDiscussions.mockResolvedValue([d('1', { attachment: 'https://cdn.example/a.pdf' })]);
    await ui();
    await fireEvent.press(await screen.findByText('Open attachment'));
    expect(await screen.findByText("Couldn't open the file. Please try again or contact your school.")).toBeTruthy();
  });
});

describe('SocialCollaborativeScreen - conversation', () => {
  it('opens a discussion and shows the conversation oldest first, "You" for my messages, display names for others', async () => {
    fetchMyDiscussions.mockResolvedValue([d('7')]);
    fetchDiscussion.mockResolvedValue(
      detail('7', {
        comments: [
          { id: '2', message: 'Teacher answer', createdAt: '2026-03-03 10:00:00', authorId: '55', authorName: 'Mrs Shah' },
          { id: '1', message: 'My first note', createdAt: '2026-03-02 10:00:00', authorId: ME, authorName: 'Me Myself' },
        ],
      }),
    );
    await ui();
    await fireEvent.press(await screen.findByText('Doubt 7'));
    expect(await screen.findByText('Teacher answer')).toBeTruthy();
    expect(fetchDiscussion).toHaveBeenCalledWith('7');
    const msgs = screen.getAllByLabelText(/^(You|Mrs Shah),/).map((n) => n.props.accessibilityLabel as string);
    expect(msgs[0]).toMatch(/^You, 2 Mar 2026\. My first note/);
    expect(msgs[1]).toMatch(/^Mrs Shah, 3 Mar 2026\. Teacher answer/);
    expect(screen.queryByText('Me Myself')).toBeNull();
  });

  it('no composer in the conversation; the not-available note is shown; Back returns to the list', async () => {
    fetchMyDiscussions.mockResolvedValue([d('7')]);
    fetchDiscussion.mockResolvedValue(detail('7'));
    await ui();
    await fireEvent.press(await screen.findByText('Doubt 7'));
    expect(await screen.findByText('No replies yet.')).toBeTruthy();
    expect(screen.queryByPlaceholderText(/./)).toBeNull();
    expect(screen.getByText("Starting a discussion or replying isn't available in the app yet.")).toBeTruthy();
    await fireEvent.press(screen.getByText('Back to my discussions'));
    expect(await screen.findByText(/My discussions · School year 2026/)).toBeTruthy();
  });

  it('a discussion that is not the student\'s own is never rendered: "This discussion is not available."', async () => {
    fetchMyDiscussions.mockResolvedValue([d('7')]);
    fetchDiscussion.mockResolvedValue(detail('7', { authorId: '999', title: 'Public elsewhere', description: 'secret text' }));
    await ui();
    await fireEvent.press(await screen.findByText('Doubt 7'));
    expect(await screen.findByText('This discussion is not available.')).toBeTruthy();
    expect(screen.queryByText('Public elsewhere')).toBeNull();
    expect(screen.queryByText('secret text')).toBeNull();
  });

  it('a 404 from the server shows "This discussion is not available." with Try again', async () => {
    fetchMyDiscussions.mockResolvedValue([d('7')]);
    fetchDiscussion.mockRejectedValue(new ApiError('server', 'This discussion is not available.', 404));
    await ui();
    await fireEvent.press(await screen.findByText('Doubt 7'));
    expect(await screen.findByText('This discussion is not available.')).toBeTruthy();
    expect(screen.getByText('Try again')).toBeTruthy();
    expect(screen.getByText('Back to my discussions')).toBeTruthy();
  });

  it('a conversation never renders author class or avatars, and no image is requested', async () => {
    fetchMyDiscussions.mockResolvedValue([d('7')]);
    fetchDiscussion.mockResolvedValue(detail('7', { comments: [{ id: '1', message: 'Hi', createdAt: '2026-03-02 10:00:00', authorId: '55', authorName: 'Mrs Shah', class: '7/A', avatar: 'https://x/a.jpg' } as never] }));
    await ui();
    await fireEvent.press(await screen.findByText('Doubt 7'));
    await screen.findByText('Hi');
    expect(screen.queryByText(/7\/A/)).toBeNull();
    expect(screen.queryByRole('image')).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('SocialCollaborativeScreen - errors, stale data, guards', () => {
  it('401 shows the session message', async () => {
    fetchMyDiscussions.mockRejectedValue(new ApiError('unauthorized', 'Your session has expired. Please sign in again.', 401));
    await ui();
    expect(await screen.findByText('Your session has expired. Please sign in again.')).toBeTruthy();
  });

  it('a missing academic year (422) shows the server message with Try again', async () => {
    fetchMyDiscussions.mockRejectedValue(new ApiError('validation', 'Academic Term Date Expired', 422));
    await ui();
    expect(await screen.findByText('Academic Term Date Expired')).toBeTruthy();
    expect(screen.getByText('Try again')).toBeTruthy();
  });

  it('a server error shows its message and Try again reloads', async () => {
    fetchMyDiscussions.mockRejectedValueOnce(new ApiError('server', 'The server had a problem. Please try again shortly.', 500));
    await ui();
    expect(await screen.findByText('The server had a problem. Please try again shortly.')).toBeTruthy();
    fetchMyDiscussions.mockResolvedValueOnce([d('1')]);
    await fireEvent.press(screen.getByText('Try again'));
    expect(await screen.findByText('Doubt 1')).toBeTruthy();
  });

  it('a failed refresh keeps the list and shows the stale banner', async () => {
    fetchMyDiscussions.mockResolvedValueOnce([d('1')]);
    await ui();
    await screen.findByText('Doubt 1');
    fetchMyDiscussions.mockRejectedValueOnce(new ApiError('server', 'x', 500));
    await client.refetchQueries();
    expect(await screen.findByText(/Couldn't refresh/)).toBeTruthy();
    expect(screen.getByText('Doubt 1')).toBeTruthy();
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
    expect(fetchMyDiscussions).not.toHaveBeenCalled();
  });

  it("cached per user: another student never sees the first student's discussions", async () => {
    fetchMyDiscussions.mockResolvedValueOnce([d('1', { title: 'Alpha doubt' })]);
    const first = await ui();
    await screen.findByText('Alpha doubt');
    await first.unmount();
    signIn({ id: 456 });
    fetchMyDiscussions.mockResolvedValueOnce([d('2', { title: 'Beta doubt', authorId: '456' })]);
    await ui();
    expect(await screen.findByText('Beta doubt')).toBeTruthy();
    expect(screen.queryByText('Alpha doubt')).toBeNull();
  });

  it('nothing is written to the console', async () => {
    fetchMyDiscussions.mockResolvedValue([d('1', { title: 'Private worry', description: 'private text' })]);
    const r = await ui();
    await screen.findByText('Private worry');
    await r.unmount();
    for (const spy of consoleSpies) for (const call of spy.mock.calls) expect(JSON.stringify(call)).not.toMatch(/Private worry|private text/);
  });
});
