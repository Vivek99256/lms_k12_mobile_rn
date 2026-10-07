import { ExamEntry } from '../../api/student';
import { toDateKey } from '../../utils/dates';

export interface ExamItem {
  title: string;
  /** `YYYY-MM-DD`, or null when the server date cannot be read. */
  dateKey: string | null;
  /** The file link exactly as sent ('' when there is none); validated by the screen before use. */
  file: string;
}

export interface ExamGroups {
  /** Today and later, soonest first. */
  upcoming: ExamItem[];
  /** Before today, most recent first. */
  earlier: ExamItem[];
  /** S3: rows whose date cannot be read are kept here, in server order, never dropped. */
  unknown: ExamItem[];
}

/** Normalised, de-duplicated items (a student with two enrollment rows for the year would see each schedule twice). */
export function examItems(entries: ExamEntry[]): ExamItem[] {
  const seen = new Set<string>();
  const out: ExamItem[] = [];
  for (const e of entries) {
    const item: ExamItem = { title: e.title.trim(), dateKey: toDateKey(e.date), file: e.file.trim() };
    const id = `${item.dateKey ?? `raw:${e.date.trim()}`}|${item.title}|${item.file}`;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(item);
  }
  return out;
}

/** S3-D4: Upcoming (today inclusive, ascending) and Earlier (descending); `today` is the device's local date key. */
export function splitExams(items: ExamItem[], today: string): ExamGroups {
  const dated = items.filter((i): i is ExamItem & { dateKey: string } => i.dateKey !== null);
  const byDate = (a: ExamItem & { dateKey: string }, b: ExamItem & { dateKey: string }) => a.dateKey.localeCompare(b.dateKey) || a.title.localeCompare(b.title);
  return {
    upcoming: dated.filter((i) => i.dateKey >= today).sort(byDate),
    earlier: dated.filter((i) => i.dateKey < today).sort((a, b) => byDate(b, a)),
    unknown: items.filter((i) => i.dateKey === null),
  };
}
