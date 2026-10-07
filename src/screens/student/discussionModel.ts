import { Discussion, DiscussionDetail } from '../../api/student';
import { displayDate } from '../../utils/dates';
import { isSafeHttpUrl } from '../../utils/links';
import { stripHtml } from '../../utils/text';
import { safeAttachmentUrl } from './circularModel';
import { applySortKey } from './leaveModel';
import { cleanText } from './listHelpers';

export type DiscussionLinkState = 'ready' | 'none' | 'unsafe';

export interface DiscussionRow {
  id: string;
  title: string;
  text: string;
  /** "Shared with everyone" / "Private"; other values are shown as sent; '' when none. */
  visibility: string;
  date: string;
  replies: number;
  attachment: { state: DiscussionLinkState; url: string | null };
}

export interface ThreadMessage {
  key: string;
  /** "You" for the student's own messages, otherwise the display name the server sent. */
  author: string;
  mine: boolean;
  date: string;
  text: string;
}

export interface ThreadView {
  title: string;
  text: string;
  date: string;
  attachment: { state: DiscussionLinkState; url: string | null };
  messages: ThreadMessage[];
}

/**
 * Attachments live on the content CDN (not the ERP host). ERP-hosted files are re-based onto the API host
 * (`safeAttachmentUrl`); any other plain http(s) link without credentials is accepted by the S1 link rule; the rest is refused.
 */
export function discussionLink(raw: string): { state: DiscussionLinkState; url: string | null } {
  const s = raw.trim();
  if (!s) return { state: 'none', url: null };
  const erp = safeAttachmentUrl(s);
  if (erp) return { state: 'ready', url: erp };
  return isSafeHttpUrl(s) ? { state: 'ready', url: s } : { state: 'unsafe', url: null };
}

const visibilityLabel = (v: string): string => {
  const s = cleanText(v);
  const k = s.toLowerCase();
  return k === 'public' ? 'Shared with everyone' : k === 'private' ? 'Private' : s;
};

const sameUser = (authorId: string, userId: string | number): boolean => authorId.trim() !== '' && authorId.trim() === String(userId);

/** Newest first by creation time (ties: higher id first). Rows that are not provably the student's own are dropped (fail closed). */
function newestFirst<T extends { createdAt: string; id: string }>(items: T[]): T[] {
  const keyed = items.map((item, at) => ({ item, at, k: applySortKey(item.createdAt) }));
  keyed.sort((a, b) => {
    if (a.k !== null && b.k !== null && a.k !== b.k) return a.k < b.k ? 1 : -1;
    if ((a.k === null) !== (b.k === null)) return a.k === null ? 1 : -1;
    const ia = Number(a.item.id);
    const ib = Number(b.item.id);
    return Number.isFinite(ia) && Number.isFinite(ib) && ia !== ib ? ib - ia : a.at - b.at;
  });
  return keyed.map((k) => k.item);
}

/**
 * The student's own discussions only. `mine=1` already restricts the server's answer; this is the second lock: anything whose
 * author is not the signed-in student - or whose author cannot be told - is never shown.
 */
export function ownDiscussionRows(items: Discussion[], userId: string | number): DiscussionRow[] {
  return newestFirst(items.filter((d) => sameUser(d.authorId, userId))).map((d) => ({
    id: d.id,
    title: cleanText(d.title) || 'Discussion',
    text: stripHtml(d.description),
    visibility: visibilityLabel(d.visibility),
    date: displayDate(d.createdAt),
    replies: d.commentCount,
    attachment: discussionLink(d.attachment),
  }));
}

/**
 * One conversation, oldest message first. Returns null - "not available" - when the discussion is not the student's own,
 * so another student's or a public discussion is never rendered, even if the server sent it.
 * Only each message's display name is used; class, avatar and ids are never shown.
 */
export function threadView(d: DiscussionDetail, userId: string | number): ThreadView | null {
  if (!sameUser(d.authorId, userId)) return null;
  const comments = d.comments.map((c, at) => ({ c, at, k: applySortKey(c.createdAt) }));
  comments.sort((a, b) => {
    if (a.k !== null && b.k !== null && a.k !== b.k) return a.k < b.k ? -1 : 1;
    if ((a.k === null) !== (b.k === null)) return a.k === null ? 1 : -1;
    return a.at - b.at;
  });
  return {
    title: cleanText(d.title) || 'Discussion',
    text: stripHtml(d.description),
    date: displayDate(d.createdAt),
    attachment: discussionLink(d.attachment),
    messages: comments.map(({ c, at }) => {
      const mine = sameUser(c.authorId, userId);
      return { key: `${at}`, author: mine ? 'You' : cleanText(c.authorName) || 'Unknown', mine, date: displayDate(c.createdAt), text: stripHtml(c.message) };
    }),
  };
}
