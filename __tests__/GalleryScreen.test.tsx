import { fireEvent, screen } from '@testing-library/react-native';
import * as fs from 'fs';
import * as path from 'path';
import React from 'react';
import { Linking } from 'react-native';
import { ApiError } from '../src/api/errors';
import { GalleryItem } from '../src/api/student';
import { PhotoGalleryScreen, VideoGalleryScreen } from '../src/screens/student/GalleryScreen';
import { RecordUnavailableScreen } from '../src/screens/student/RecordUnavailableScreen';
import { makeClient, renderWith, signIn, tile } from './helpers/kit';

jest.mock('../src/config/env', () => ({ env: { apiBaseUrl: 'https://dev.triz.co.in', appEnv: 'test', erpHosts: [] } }));
jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn() }));
jest.mock('../src/api/student', () => ({ ...jest.requireActual('../src/api/student'), fetchGallery: jest.fn(), fetchSchoolDetail: jest.fn() }));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { fetchGallery, fetchSchoolDetail } = require('../src/api/student') as { fetchGallery: jest.Mock; fetchSchoolDetail: jest.Mock };

const PHOTO = 'https://erp.triz.co.in/storage/photo_video_gallary/a.jpg';
const VIDEO = 'https://www.youtube.com/watch?v=abc123';
const g = (album: string, title: string, date: string, file = PHOTO, type = 'Photo'): GalleryItem => ({ album, title, file, date, type });

let client = makeClient();
const photos = (api: string | null = 'https://erp.triz.co.in/studentPhotoVideoGalleryAPI') => renderWith(client, <PhotoGalleryScreen tile={{ ...tile('photos_gallery'), api }} />);
const videos = () => renderWith(client, <VideoGalleryScreen tile={{ ...tile('video_gallery'), api: 'https://erp.triz.co.in/studentPhotoVideoGalleryAPI' }} />);
let openURL: jest.SpyInstance;
let fetchSpy: jest.Mock;
let consoleSpies: jest.SpyInstance[];

beforeEach(() => {
  client = makeClient();
  fetchGallery.mockReset();
  fetchSchoolDetail.mockReset();
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

describe('Photo gallery', () => {
  it('requests the Photo kind once, shows loading, then albums ordered by their newest item', async () => {
    fetchGallery.mockResolvedValue([g('Old trip', 'o', '2025-01-01'), g('Sports Day', 's1', '2026-03-01'), g('Sports Day', 's2', '2026-02-01')]);
    await photos();
    expect(screen.getByText('Loading…')).toBeTruthy();
    expect(await screen.findByText('Sports Day')).toBeTruthy();
    expect(fetchGallery).toHaveBeenCalledTimes(1);
    expect(fetchGallery).toHaveBeenCalledWith('Photo');
    const labels = screen.getAllByLabelText(/^(Sports Day|Old trip),/).map((n) => n.props.accessibilityLabel as string);
    expect(labels[0]).toMatch(/^Sports Day, 2 photos, latest 1 Mar 2026, collapsed/);
    expect(labels[1]).toMatch(/^Old trip, 1 photo, latest 1 Jan 2025, collapsed/);
    expect(screen.getByText(/School year 2026/)).toBeTruthy();
  });

  it('opening an album lists its photos newest first by title - as text, with no image', async () => {
    fetchGallery.mockResolvedValue([g('Sports Day', 'older', '2026-02-01'), g('Sports Day', 'newer', '2026-03-01')]);
    await photos();
    await fireEvent.press(await screen.findByText('Sports Day'));
    const titles = screen.getAllByLabelText(/^(newer|older)/).map((n) => n.props.accessibilityLabel as string);
    expect(titles[0].startsWith('newer')).toBe(true);
    expect(titles[1].startsWith('older')).toBe(true);
    expect(screen.queryByRole('image')).toBeNull();
    await fireEvent.press(screen.getByText('Sports Day'));
    expect(screen.queryByText('newer')).toBeNull();
  });

  it('Open photo hands the validated, re-based URL to the phone once; the app fetches nothing itself', async () => {
    fetchGallery.mockResolvedValue([g('A', 'one', '2026-03-01')]);
    await photos();
    await fireEvent.press(await screen.findByText('A'));
    await fireEvent.press(screen.getByText('Open photo'));
    expect(openURL).toHaveBeenCalledTimes(1);
    expect(openURL).toHaveBeenCalledWith('https://dev.triz.co.in/storage/photo_video_gallary/a.jpg');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('unsafe photo links show a message and no button; nothing is opened', async () => {
    fetchGallery.mockResolvedValue([
      g('A', 'foreign', '2026-03-05', 'https://evil.example/a.jpg'),
      g('A', 'lookalike', '2026-03-04', 'https://erp.triz.co.in.evil.com/a.jpg'),
      g('A', 'creds', '2026-03-03', 'https://erp.triz.co.in@evil.example/a.jpg'),
      g('A', 'script', '2026-03-02', 'javascript:alert(1)'),
      g('A', 'file', '2026-03-01', 'file:///etc/passwd'),
    ]);
    await photos();
    await fireEvent.press(await screen.findByText('A'));
    expect(screen.getAllByText("Photo can't be opened from the app")).toHaveLength(5);
    expect(screen.queryByText('Open photo')).toBeNull();
    expect(openURL).not.toHaveBeenCalled();
  });

  it('an item with no file link has no button and no message', async () => {
    fetchGallery.mockResolvedValue([g('A', 'nofile', '2026-03-01', '')]);
    await photos();
    await fireEvent.press(await screen.findByText('A'));
    expect(screen.getByText('nofile')).toBeTruthy();
    expect(screen.queryByText('Open photo')).toBeNull();
    expect(screen.queryByText(/can't be opened/)).toBeNull();
  });

  it('an open failure shows an inline notice and the screen stays usable', async () => {
    openURL.mockRejectedValue(new Error('No Activity found'));
    fetchGallery.mockResolvedValue([g('A', 'one', '2026-03-01')]);
    await photos();
    await fireEvent.press(await screen.findByText('A'));
    await fireEvent.press(screen.getByText('Open photo'));
    expect(await screen.findByText("Couldn't open the file. Please try again or contact your school.")).toBeTruthy();
    expect(screen.getByText('Open photo')).toBeTruthy();
  });

  it('30 photos at a time inside an album', async () => {
    fetchGallery.mockResolvedValue(Array.from({ length: 31 }, (_, i) => g('Big', `p${i}`, '2026-03-01')));
    await photos();
    await fireEvent.press(await screen.findByText('Big'));
    expect(screen.getAllByText('Open photo')).toHaveLength(30);
    await fireEvent.press(screen.getByText('Show more (1 more)'));
    expect(screen.getAllByText('Open photo')).toHaveLength(31);

  });

  it('empty gallery -> an empty state', async () => {
    fetchGallery.mockResolvedValue([]);
    await photos();
    expect(await screen.findByText('No photos for your class yet')).toBeTruthy();
  });

  it("ignores the tile's stored api", async () => {
    fetchGallery.mockResolvedValue([g('A', 'one', '2026-03-01')]);
    await photos('https://erp.triz.co.in/front_desk/send_attachment/create');
    await screen.findByText('A');
    expect(fetchGallery).toHaveBeenCalledTimes(1);
    expect(fetchGallery).toHaveBeenCalledWith('Photo');
  });

  it('401, server error + Try again, Parameter Missing and stale banner', async () => {
    fetchGallery.mockRejectedValueOnce(new ApiError('unauthorized', 'Your session has expired. Please sign in again.', 401));
    const first = await photos();
    expect(await screen.findByText('Your session has expired. Please sign in again.')).toBeTruthy();
    await first.unmount();

    client = makeClient();
    fetchGallery.mockRejectedValueOnce(new ApiError('server', 'The server had a problem. Please try again shortly.', 500));
    const second = await photos();
    expect(await screen.findByText('The server had a problem. Please try again shortly.')).toBeTruthy();
    fetchGallery.mockResolvedValueOnce([g('A', 'one', '2026-03-01')]);
    await fireEvent.press(screen.getByText('Try again'));
    expect(await screen.findByText('A')).toBeTruthy();
    fetchGallery.mockRejectedValueOnce(new ApiError('server', 'x', 500));
    await client.refetchQueries();
    expect(await screen.findByText(/Couldn't refresh/)).toBeTruthy();
    expect(screen.getByText('A')).toBeTruthy();
    await second.unmount();

    client = makeClient();
    fetchGallery.mockRejectedValue(new ApiError('validation', 'Parameter Missing'));
    await photos();
    expect(await screen.findByText('Parameter Missing')).toBeTruthy();
  });

  it('guards: no school year / non-student -> message and no request', async () => {
    signIn({ syear: '' });
    const first = await photos();
    expect(screen.getByText('School year not set')).toBeTruthy();
    await first.unmount();
    signIn({ isStudent: false });
    client = makeClient();
    await photos();
    expect(screen.getByText('Students only')).toBeTruthy();
    expect(fetchGallery).not.toHaveBeenCalled();
  });

  it("cached per user: another student never sees the first student's albums", async () => {
    fetchGallery.mockResolvedValueOnce([g('Alpha album', 'a', '2026-03-01')]);
    const first = await photos();
    await screen.findByText('Alpha album');
    await first.unmount();
    signIn({ id: 456 });
    fetchGallery.mockResolvedValueOnce([g('Beta album', 'b', '2026-03-01')]);
    await photos();
    expect(await screen.findByText('Beta album')).toBeTruthy();
    expect(screen.queryByText('Alpha album')).toBeNull();
  });
});

describe('Video gallery', () => {
  const v = (album: string, title: string, date: string, file = VIDEO) => g(album, title, date, file, 'Video');

  it('requests the Video kind and shows albums with "videos"', async () => {
    fetchGallery.mockResolvedValue([v('Assembly', 'a', '2026-03-01'), v('Assembly', 'b', '2026-03-02')]);
    await videos();
    await screen.findByText('Assembly');
    expect(fetchGallery).toHaveBeenCalledWith('Video');
    expect(screen.getByText(/2 videos/)).toBeTruthy();
  });

  it('Open video opens the plain https link once, in the phone; no third-party request is made', async () => {
    fetchGallery.mockResolvedValue([v('Assembly', 'clip', '2026-03-01')]);
    await videos();
    await fireEvent.press(await screen.findByText('Assembly'));
    await fireEvent.press(screen.getByText('Open video'));
    expect(openURL).toHaveBeenCalledTimes(1);
    expect(openURL).toHaveBeenCalledWith(VIDEO);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(screen.queryByRole('image')).toBeNull();
  });

  it('unsafe video links (credentials, javascript:, intent:, file:, tel:, bare id) have no button and a message', async () => {
    fetchGallery.mockResolvedValue([
      v('A', 'creds', '2026-03-06', 'https://user:pw@evil.example/x'),
      v('A', 'script', '2026-03-05', 'javascript:alert(1)'),
      v('A', 'intent', '2026-03-04', 'intent://x'),
      v('A', 'file', '2026-03-03', 'file:///etc/passwd'),
      v('A', 'tel', '2026-03-02', 'tel:123'),
      v('A', 'bare', '2026-03-01', 'dQw4w9WgXcQ'),
    ]);
    await videos();
    await fireEvent.press(await screen.findByText('A'));
    expect(screen.getAllByText("Video can't be opened from the app")).toHaveLength(6);
    expect(screen.queryByText('Open video')).toBeNull();
    expect(openURL).not.toHaveBeenCalled();
  });

  it('empty -> an empty state', async () => {
    fetchGallery.mockResolvedValue([]);
    await videos();
    expect(await screen.findByText('No videos for your class yet')).toBeTruthy();
  });
});

describe('no media is downloaded, cached, saved, shared or logged by the app', () => {
  it('there is no share, save, download or upload control anywhere in the gallery', async () => {
    fetchGallery.mockResolvedValue([g('A', 'one', '2026-03-01')]);
    await photos();
    await fireEvent.press(await screen.findByText('A'));
    expect(screen.queryByText(/share|save|download|upload|delete|add /i)).toBeNull();
    const allowed = /^(Open photo|Open video|Show more.*|Try again)$/;
    for (const b of screen.queryAllByRole('button')) {
      const label = String(b.props.accessibilityLabel ?? '');
      expect(label === '' || allowed.test(label) || /collapsed|expanded/.test(label)).toBe(true);
    }
  });

  it('rendering and opening writes nothing to the console', async () => {
    fetchGallery.mockResolvedValue([g('Secret album title', 'secret photo title', '2026-03-01')]);
    const r = await photos();
    await fireEvent.press(await screen.findByText('Secret album title'));
    await fireEvent.press(screen.getByText('Open photo'));
    await r.unmount();
    for (const spy of consoleSpies) for (const call of spy.mock.calls) expect(JSON.stringify(call)).not.toMatch(/Secret album|secret photo/i);
  });

  it('the S10 screen sources never use an image component, an image library, file-system, storage or console calls', () => {
    const dir = path.join(__dirname, '..', 'src');
    const files = [
      'screens/student/GalleryScreen.tsx',
      'screens/student/galleryModel.ts',
      'screens/student/SchoolInfoScreen.tsx',
      'screens/student/schoolInfoModel.ts',
      'hooks/useSchoolInfo.ts',
    ];
    for (const f of files) {
      // Comments are removed first: only code is checked.
      const src = fs
        .readFileSync(path.join(dir, f), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
      expect(src).not.toMatch(/\bImage\b/);
      expect(src).not.toMatch(/expo-image|expo-file-system|FileSystem|AsyncStorage|SecureStore|MediaLibrary|expo-sharing|Share\b|react-native-fast-image/);
      expect(src).not.toMatch(/console\./);
      expect(src).not.toMatch(/\bfetch\(/);
    }
  });
});

describe('the classwork gallery tile', () => {
  it("shows \"This isn't available in the app yet.\" / \"Please ask your school.\" and never contacts any endpoint", async () => {
    const r = await renderWith(makeClient(), <RecordUnavailableScreen tile={{ ...tile('classwork_gallery'), api: 'https://erp.triz.co.in/front_desk/send_attachment/create' }} />);
    expect(screen.getByText("This isn't available in the app yet.")).toBeTruthy();
    expect(screen.getByText('Please ask your school.')).toBeTruthy();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    await r.unmount();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(fetchGallery).not.toHaveBeenCalled();
    expect(fetchSchoolDetail).not.toHaveBeenCalled();
  });
});
