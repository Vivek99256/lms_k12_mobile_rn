import { NotificationItem } from '../../api/student';
import { dayHeading, toDateKey } from '../../utils/dates';

/** Decision S1-D5: the server returns every notification, so the screen shows this many at a time. */
export const NOTIFICATION_PAGE_SIZE = 30;

export interface NotificationGroup {
  /** `YYYY-MM-DD`, or `unknown` when the server date cannot be read. */
  key: string;
  label: string;
  items: NotificationItem[];
}

/**
 * Notifications grouped by day, newest day first (undated ones last under "Earlier"). Inside a day the
 * server order is kept (it sorts by id, newest first).
 */
export function groupNotifications(items: NotificationItem[], today: string): NotificationGroup[] {
  const byKey = new Map<string, NotificationItem[]>();
  for (const n of items) {
    const key = toDateKey(n.date) ?? 'unknown';
    const bucket = byKey.get(key);
    if (bucket) bucket.push(n);
    else byKey.set(key, [n]);
  }
  const keys = [...byKey.keys()].sort((a, b) => (a === 'unknown' ? 1 : b === 'unknown' ? -1 : b.localeCompare(a)));
  return keys.map((key) => ({ key, label: key === 'unknown' ? 'Earlier' : dayHeading(key, today), items: byKey.get(key)! }));
}

/** The first `limit` notifications across the groups (whole groups are clipped, never reordered). */
export function limitGroups(groups: NotificationGroup[], limit: number): NotificationGroup[] {
  const out: NotificationGroup[] = [];
  let left = limit;
  for (const g of groups) {
    if (left <= 0) break;
    const items = g.items.slice(0, left);
    left -= items.length;
    out.push({ ...g, items });
  }
  return out;
}
