import { LeaveApplication } from '../../api/student';
import { PillTone } from '../../components/StatusPill';
import { displayDate, toDateKey } from '../../utils/dates';
import { safeAttachmentUrl } from './circularModel';
import { cleanText } from './listHelpers';

export type LeaveFileState = 'none' | 'ready' | 'unsafe';

export interface LeaveRow {
  key: string;
  title: string;
  statusLabel: string;
  statusTone: PillTone;
  /** "12 Oct 2026 – 14 Oct 2026", one date when equal, raw text when unreadable, '' when nothing was sent. */
  range: string;
  appliedOn: string;
  message: string;
  fileState: LeaveFileState;
  /** Validated link; only when fileState is 'ready'. */
  fileUrl: string | null;
  hasReply: boolean;
  reply: string;
  replyBy: string;
  replyOn: string;
}

/** `YYYY-MM-DD HH:MM:SS` for ordering, from `d-m-Y H:i:s` or ISO text; null when no date can be read. */
export function applySortKey(v: string): string | null {
  const day = toDateKey(v);
  if (!day) return null;
  const t = /(\d{2}:\d{2}:\d{2})/.exec(v);
  return `${day} ${t ? t[1] : '00:00:00'}`;
}

/**
 * Status as the school wrote it. Empty means undecided -> "Pending". Only the words the school uses are given a tone
 * (Approved / Rejected / Pending, any case); any other text is shown as it is, neutral. No other status is invented.
 */
export function leaveStatus(raw: string): { label: string; tone: PillTone } {
  const s = cleanText(raw);
  if (!s) return { label: 'Pending', tone: 'warning' };
  const k = s.toLowerCase();
  if (k === 'approved') return { label: 'Approved', tone: 'success' };
  if (k === 'rejected') return { label: 'Rejected', tone: 'danger' };
  if (k === 'pending') return { label: 'Pending', tone: 'warning' };
  return { label: s, tone: 'neutral' };
}

export function dateRange(from: string, to: string): string {
  const parts = [displayDate(from), displayDate(to)].filter(Boolean);
  return parts.length === 2 && parts[0] === parts[1] ? parts[0] : parts.join(' – ');
}

/**
 * Newest application first (by apply time); rows with an unreadable apply date go last; ties keep the server order
 * (the server sends no id and no ORDER BY). Nothing is hidden or merged.
 */
export function leaveRows(items: LeaveApplication[]): LeaveRow[] {
  const keyed = items.map((l, at) => ({ l, at, k: applySortKey(l.appliedOn) }));
  keyed.sort((a, b) => {
    if (a.k !== null && b.k !== null) return a.k < b.k ? 1 : a.k > b.k ? -1 : a.at - b.at;
    if (a.k !== null) return -1;
    if (b.k !== null) return 1;
    return a.at - b.at;
  });
  return keyed.map(({ l, at }) => {
    const raw = l.file.trim();
    const url = raw ? safeAttachmentUrl(raw) : null;
    const reply = cleanText(l.reply);
    const status = leaveStatus(l.status);
    return {
      key: `${at}`,
      title: cleanText(l.title) || 'Leave request',
      statusLabel: status.label,
      statusTone: status.tone,
      range: dateRange(l.fromDate, l.toDate),
      appliedOn: displayDate(l.appliedOn),
      message: l.message.trim(),
      fileState: !raw ? 'none' : url ? 'ready' : 'unsafe',
      fileUrl: url,
      hasReply: reply !== '',
      reply,
      replyBy: cleanText(l.replyBy),
      replyOn: displayDate(l.replyOn),
    };
  });
}
