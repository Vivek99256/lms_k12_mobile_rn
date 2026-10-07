import { HomeworkItem } from '../../api/student';
import { shortDate, toDateKey } from '../../utils/dates';
import { dueLabel, isOverdue } from './dashboardModel';

/** Decision S4a-D8: the server returns every homework row, so the list shows this many at a time. */
export const HOMEWORK_PAGE_SIZE = 30;

/** Decision S4a-D4: the filter is To do / Submitted / All and opens on To do. */
export type HomeworkFilter = 'todo' | 'submitted' | 'all';
export const DEFAULT_FILTER: HomeworkFilter = 'todo';

export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

/** Submitted = the server sent a submission status, or files are attached. `status: null` means not submitted. */
export const isSubmitted = (h: Pick<HomeworkItem, 'status' | 'fileCount'>): boolean => h.status !== null || h.fileCount > 0;

const AI_FAILED = new Set(['ocr failed', 'evaluation failed', 'failed']);

/**
 * Decision S4a-D5, the web's own wording (`studentSubmissionStatus`, `statusVariant`): Reviewed, Rejected,
 * Not submitted, AI evaluating / evaluated / failed, otherwise Awaiting review. Always a word, never colour alone.
 */
export function statusInfo(h: { status: string | null; fileCount: number; aiStatus: string }): { label: string; tone: Tone } {
  const status = (h.status ?? '').trim().toLowerCase();
  if (status === 'reviewed') return { label: 'Reviewed', tone: 'success' };
  if (status === 'rejected') return { label: 'Rejected', tone: 'danger' };
  if (!isSubmitted(h)) return { label: 'Not submitted', tone: 'neutral' };
  const ai = h.aiStatus.trim().toLowerCase();
  if (ai === 'checking') return { label: 'AI evaluating', tone: 'info' };
  if (ai === 'evaluated') return { label: 'AI evaluated', tone: 'warning' };
  if (AI_FAILED.has(ai)) return { label: 'Evaluation failed', tone: 'danger' };
  return { label: 'Awaiting review', tone: 'warning' };
}

export function filterHomework(items: HomeworkItem[], filter: HomeworkFilter): HomeworkItem[] {
  if (filter === 'todo') return items.filter((h) => !isSubmitted(h));
  if (filter === 'submitted') return items.filter(isSubmitted);
  return items;
}

const idNumber = (id: string): number => (/^\d+$/.test(id) ? Number(id) : -1);

/** Later date first; an unreadable date sorts after every real one. */
const newestFirst = (a: string | null, b: string | null): number => (a === b ? 0 : a === null ? 1 : b === null ? -1 : b.localeCompare(a));
/** Earlier date first; an unreadable date sorts after every real one. */
const soonestFirst = (a: string | null, b: string | null): number => (a === b ? 0 : a === null ? 1 : b === null ? -1 : a.localeCompare(b));

/**
 * To do: soonest due date first, no due date last. Submitted and All: newest assigned first.
 * Ties fall back to the newer homework (higher id). Does not touch the input array.
 */
export function sortHomework(items: HomeworkItem[], filter: HomeworkFilter): HomeworkItem[] {
  return [...items].sort((a, b) => {
    const byDate =
      filter === 'todo'
        ? soonestFirst(toDateKey(a.dueDate), toDateKey(b.dueDate)) || newestFirst(toDateKey(a.date), toDateKey(b.date))
        : newestFirst(toDateKey(a.date), toDateKey(b.date));
    return byDate || idNumber(b.id) - idNumber(a.id);
  });
}

export function homeworkCounts(items: HomeworkItem[]): { todo: number; submitted: number; all: number } {
  const submitted = items.filter(isSubmitted).length;
  return { todo: items.length - submitted, submitted, all: items.length };
}

/** "Assigned 5 Oct 2026 · Due 12 Oct 2026" (or "Overdue · 5 Oct 2026" while it is still to do). */
export function metaText(h: HomeworkItem, today: string): string {
  const parts: string[] = [];
  const assigned = toDateKey(h.date);
  if (assigned) parts.push(`Assigned ${shortDate(assigned)}`);
  const due = toDateKey(h.dueDate);
  if (due) parts.push(isSubmitted(h) ? `Due ${shortDate(due)}` : dueLabel(h.dueDate, today));
  return parts.join(' · ');
}

/** Only homework that is still to do can be overdue. */
export const showsOverdue = (h: HomeworkItem, today: string): boolean => !isSubmitted(h) && isOverdue(h.dueDate, today);

/** One spoken sentence for a collapsed row, e.g. `Fractions, Maths, Due 12 Oct 2026, Not submitted`. */
export function rowLabel(h: HomeworkItem, today: string): string {
  const due = toDateKey(h.dueDate) ? (isSubmitted(h) ? `Due ${shortDate(toDateKey(h.dueDate)!)}` : dueLabel(h.dueDate, today)) : '';
  return [h.title.trim() || 'Untitled homework', h.subject.trim(), due, statusInfo(h).label].filter(Boolean).join(', ');
}
