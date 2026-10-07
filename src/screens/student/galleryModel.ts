import { GalleryItem } from '../../api/student';
import { displayDate } from '../../utils/dates';
import { isSafeHttpUrl } from '../../utils/links';
import { safeAttachmentUrl } from './circularModel';
import { cleanText } from './listHelpers';
import { applySortKey } from './leaveModel';

export type GalleryKind = 'Photo' | 'Video';
export type GalleryLinkState = 'ready' | 'none' | 'unsafe';

export interface GalleryEntry {
  key: string;
  title: string;
  date: string;
  link: { state: GalleryLinkState; url: string | null };
}

export interface Album {
  key: string;
  title: string;
  count: number;
  /** Display date of the newest item, '' when none can be read. */
  newest: string;
  entries: GalleryEntry[];
}

/** A photo is opened only through the ERP host allow-list (re-based onto the API host); nothing else is ever fetched. */
export function photoLink(raw: string): { state: GalleryLinkState; url: string | null } {
  const s = raw.trim();
  if (!s) return { state: 'none', url: null };
  const url = safeAttachmentUrl(s);
  return url ? { state: 'ready', url } : { state: 'unsafe', url: null };
}

/** A video is a stored link (normally YouTube): any plain http(s) URL without credentials, opened only in the phone's browser/app. */
export function videoLink(raw: string): { state: GalleryLinkState; url: string | null } {
  const s = raw.trim();
  if (!s) return { state: 'none', url: null };
  return isSafeHttpUrl(s) ? { state: 'ready', url: s } : { state: 'unsafe', url: null };
}

/**
 * Albums grouped by title (trimmed; a missing title is "Album"), ordered by their newest item (readable dates first,
 * newest first), then by title (case-insensitive), then by first appearance - so the order never depends on how the
 * server's object keys happened to be listed. Inside an album the newest item is first; unreadable dates go last and
 * ties keep the server order. Every item is kept.
 */
export function buildAlbums(items: GalleryItem[], kind: GalleryKind): Album[] {
  const groups = new Map<string, { title: string; first: number; rows: { item: GalleryItem; at: number; k: string | null }[] }>();
  items.forEach((item, at) => {
    const title = cleanText(item.album) || 'Album';
    const g = groups.get(title) ?? { title, first: at, rows: [] };
    g.rows.push({ item, at, k: applySortKey(item.date) });
    groups.set(title, g);
  });
  const sortRows = <T extends { at: number; k: string | null }>(a: T, b: T) => {
    if (a.k !== null && b.k !== null) return a.k < b.k ? 1 : a.k > b.k ? -1 : a.at - b.at;
    if (a.k !== null) return -1;
    if (b.k !== null) return 1;
    return a.at - b.at;
  };
  const albums = [...groups.values()].map((g) => {
    g.rows.sort(sortRows);
    const newestKey = g.rows.find((r) => r.k !== null)?.k ?? null;
    return { g, newestKey };
  });
  albums.sort((a, b) => {
    if (a.newestKey !== null && b.newestKey !== null && a.newestKey !== b.newestKey) return a.newestKey < b.newestKey ? 1 : -1;
    if ((a.newestKey === null) !== (b.newestKey === null)) return a.newestKey === null ? 1 : -1;
    const ta = a.g.title.toLowerCase();
    const tb = b.g.title.toLowerCase();
    return ta < tb ? -1 : ta > tb ? 1 : a.g.first - b.g.first;
  });
  const link = kind === 'Photo' ? photoLink : videoLink;
  return albums.map(({ g }, i) => ({
    key: `${i}`,
    title: g.title,
    count: g.rows.length,
    newest: displayDate(g.rows.find((r) => r.k !== null)?.item.date ?? ''),
    entries: g.rows.map((r) => ({
      key: `${r.at}`,
      title: cleanText(r.item.title) || (kind === 'Photo' ? 'Photo' : 'Video'),
      date: displayDate(r.item.date),
      link: link(r.item.file),
    })),
  }));
}
