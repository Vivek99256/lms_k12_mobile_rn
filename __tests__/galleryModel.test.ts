import { flattenGallery, GalleryItem } from '../src/api/student';
import { buildAlbums, photoLink, videoLink } from '../src/screens/student/galleryModel';

jest.mock('../src/config/env', () => ({ env: { apiBaseUrl: 'https://dev.triz.co.in', appEnv: 'test', erpHosts: [] } }));

const PHOTO = 'https://erp.triz.co.in/storage/photo_video_gallary/a.jpg';
const g = (album: string, title: string, date: string, file = PHOTO): GalleryItem => ({ album, title, file, date, type: 'Photo' });

describe('flattenGallery - both response shapes', () => {
  const item = (album: string, title: string) => ({ album_title: album, title, file_name: PHOTO, date_: '2026-03-01', ai: 'Active', type: 'Photo' });

  it('an object keyed by album title', () => {
    const out = flattenGallery({ 'Sports Day': [item('Sports Day', 'a'), item('Sports Day', 'b')], Trip: [item('Trip', 'c')] });
    expect(out.map((i) => `${i.album}/${i.title}`)).toEqual(['Sports Day/a', 'Sports Day/b', 'Trip/c']);
  });

  it('a numeric-key array (album titles 0, 1, 2 …) of item lists', () => {
    const out = flattenGallery([[item('0', 'a')], [item('1', 'b'), item('1', 'c')]]);
    expect(out.map((i) => `${i.album}/${i.title}`)).toEqual(['0/a', '1/b', '1/c']);
  });

  it('takes the album from each item, falling back to the object key', () => {
    const out = flattenGallery({ 'Key Album': [{ title: 't', file_name: 'f', date_: '', type: 'Photo' }] });
    expect(out[0].album).toBe('Key Album');
  });

  it('a single item instead of a list is accepted; junk is skipped', () => {
    expect(flattenGallery({ A: item('A', 'x') })).toHaveLength(1);
    expect(flattenGallery({ A: [null, 3, 'x', item('A', 'ok')] }).map((i) => i.title)).toEqual(['ok']);
    for (const bad of [undefined, null, 'x', 5, {}, [], [null], { A: 'x' }]) expect(flattenGallery(bad)).toEqual([]);
  });

  it('maps fields as text; nulls become empty text; internal columns are not carried', () => {
    const [i] = flattenGallery({ A: [{ album_title: null, title: null, file_name: null, date_: null, type: null, ai: 'Active' }] });
    expect(i).toEqual({ album: 'A', title: '', file: '', date: '', type: '' });
  });
});

describe('buildAlbums - deterministic ordering', () => {
  it('albums are ordered by their newest item, newest first - not by the order the server listed them', () => {
    const albums = buildAlbums([g('Old', 'o1', '2025-01-01'), g('New', 'n1', '2026-05-01'), g('Mid', 'm1', '2026-01-01'), g('Mid', 'm2', '2026-02-01')], 'Photo');
    expect(albums.map((a) => a.title)).toEqual(['New', 'Mid', 'Old']);
  });

  it('integer-like album titles are ordered by date, not numerically (the JavaScript key-order quirk)', () => {
    const albums = buildAlbums([g('10', 'a', '2025-01-01'), g('2', 'b', '2026-01-01'), g('1', 'c', '2024-01-01')], 'Photo');
    expect(albums.map((a) => a.title)).toEqual(['2', '10', '1']);
  });

  it('albums with the same newest date are ordered by title (case-insensitive), then first appearance', () => {
    const albums = buildAlbums([g('beta', 'x', '2026-01-01'), g('Alpha', 'y', '2026-01-01'), g('alpha', 'z', '2026-01-01')], 'Photo');
    expect(albums.map((a) => a.title)).toEqual(['Alpha', 'alpha', 'beta']);
  });

  it('albums with no readable date go last (by title); their items are kept', () => {
    const albums = buildAlbums([g('Zeta', 'z', ''), g('Dated', 'd', '2026-01-01'), g('Alpha', 'a', 'soon')], 'Photo');
    expect(albums.map((a) => a.title)).toEqual(['Dated', 'Alpha', 'Zeta']);
    expect(albums[1].entries[0].date).toBe('soon');
    expect(albums[1].newest).toBe('');
  });

  it('the same input always gives the same output (deterministic), and the input is not mutated', () => {
    const input = [g('B', '1', '2026-01-01'), g('A', '2', '2026-01-01'), g('B', '3', '2026-02-01')];
    const copy = JSON.stringify(input);
    expect(JSON.stringify(buildAlbums(input, 'Photo'))).toBe(JSON.stringify(buildAlbums([...input].reverse().reverse(), 'Photo')));
    expect(JSON.stringify(input)).toBe(copy);
  });

  it('inside an album: newest first, unreadable dates last, ties keep the server order', () => {
    const [a] = buildAlbums([g('A', 'old', '2025-01-01'), g('A', 'nodate', ''), g('A', 'new', '2026-01-01'), g('A', 'new2', '2026-01-01')], 'Photo');
    expect(a.entries.map((e) => e.title)).toEqual(['new', 'new2', 'old', 'nodate']);
    expect(a.count).toBe(4);
    expect(a.newest).toBe('1 Jan 2026');
  });

  it('a missing album or item title gets a plain default; every item is kept; keys are unique', () => {
    const albums = buildAlbums([g('', '', '2026-01-01'), g('  ', ' ', '2026-01-02'), g('null', 'null', '2026-01-03')], 'Photo');
    expect(albums).toHaveLength(1);
    expect(albums[0].title).toBe('Album');
    expect(albums[0].entries.map((e) => e.title)).toEqual(['Photo', 'Photo', 'Photo']);
    expect(new Set(albums[0].entries.map((e) => e.key)).size).toBe(3);
    expect(buildAlbums([g('A', ' ', '')], 'Video')[0].entries[0].title).toBe('Video');
  });

  it('no items -> no albums', () => expect(buildAlbums([], 'Photo')).toEqual([]));
});

describe('photo links - F1 validation', () => {
  it('a real ERP photo is ready and re-based onto the configured API host', () => {
    expect(photoLink(PHOTO)).toEqual({ state: 'ready', url: 'https://dev.triz.co.in/storage/photo_video_gallary/a.jpg' });
  });
  it('empty -> none', () => {
    expect(photoLink('')).toEqual({ state: 'none', url: null });
    expect(photoLink('   ')).toEqual({ state: 'none', url: null });
  });
  it.each([
    'https://evil.example/a.jpg',
    'https://erp.triz.co.in.evil.com/a.jpg',
    'https://erp.triz.co.in@evil.example/a.jpg',
    'javascript:alert(1)',
    'file:///etc/passwd',
    'intent://x',
    'ftp://erp.triz.co.in/a.jpg',
    'a.jpg',
    '/storage/photo_video_gallary/a.jpg',
    'https://www.youtube.com/watch?v=abc',
  ])('unsafe %p -> unsafe, no url', (bad) => expect(photoLink(bad)).toEqual({ state: 'unsafe', url: null }));
});

describe('video links', () => {
  it('a plain https link opens as is (third-party hosts like YouTube are fine for a link in the browser)', () => {
    expect(videoLink('https://www.youtube.com/watch?v=abc123')).toEqual({ state: 'ready', url: 'https://www.youtube.com/watch?v=abc123' });
    expect(videoLink('http://example.com/v')).toEqual({ state: 'ready', url: 'http://example.com/v' });
  });
  it('empty -> none; anything that is not a plain http(s) URL, or has credentials, is unsafe', () => {
    expect(videoLink('')).toEqual({ state: 'none', url: null });
    for (const bad of ['https://user:pw@evil.example/x', 'javascript:alert(1)', 'intent://x', 'file:///etc/passwd', 'tel:123', 'vnd.youtube:abc', 'youtube.com/watch?v=abc', 'dQw4w9WgXcQ']) {
      expect(videoLink(bad)).toEqual({ state: 'unsafe', url: null });
    }
  });
  it('entries carry the right link rule per kind', () => {
    const v = buildAlbums([{ album: 'A', title: 't', file: 'https://youtu.be/abc', date: '2026-01-01', type: 'Video' }], 'Video')[0].entries[0];
    expect(v.link).toEqual({ state: 'ready', url: 'https://youtu.be/abc' });
    const p = buildAlbums([{ album: 'A', title: 't', file: 'https://youtu.be/abc', date: '2026-01-01', type: 'Photo' }], 'Photo')[0].entries[0];
    expect(p.link.state).toBe('unsafe');
  });
});
