import { PendingItem, StudentDashboard } from '../../api/student';
import { shortDate, toDateKey } from '../../utils/dates';

/** The server lists at most 10 pending items, so a count of 10 means "10 or more". */
export const PENDING_CAP = 10;

export const cappedCount = (n: number): string => (n >= PENDING_CAP ? `${PENDING_CAP}+` : String(n));

/** "Due 12 Oct 2026", "Due today", "Overdue · 5 Oct 2026", or '' when the server sent no readable date. */
export function dueLabel(dueDate: string, today: string): string {
  const key = toDateKey(dueDate);
  if (!key) return '';
  if (key === today) return 'Due today';
  return key < today ? `Overdue · ${shortDate(key)}` : `Due ${shortDate(key)}`;
}

export const isOverdue = (dueDate: string, today: string): boolean => {
  const key = toDateKey(dueDate);
  return !!key && key < today;
};

/** The subject's name only when the id is in the student's own subject list; never guessed. */
export function subjectName(subjects: StudentDashboard['subjects'], id: string): string | null {
  if (!id) return null;
  return subjects.find((s) => s.id === id)?.name.trim() || null;
}

export interface Progress {
  done: number;
  pending: number;
  /** done / (done + pending) as a 0-1 fraction; null when it would be misleading (nothing, or pending is capped). */
  ratio: number | null;
}

function pair(tasks: StudentDashboard['tasks'], doneLabel: string, pendingLabel: string): Progress | null {
  const done = tasks.find((t) => t.label === doneLabel);
  const pending = tasks.find((t) => t.label === pendingLabel);
  if (!done || !pending) return null; // labels changed on the server: show nothing rather than guess
  const total = done.value + pending.value;
  return { done: done.value, pending: pending.value, ratio: total === 0 || pending.value >= PENDING_CAP ? null : done.value / total };
}

/** Homework and assignment progress from the server's `task_status` rows (matched by their exact labels). */
export function taskProgress(tasks: StudentDashboard['tasks']): { homework: Progress | null; assignments: Progress | null } {
  return {
    homework: pair(tasks, 'Homework done', 'Homework pending'),
    assignments: pair(tasks, 'Assignments submitted', 'Assignments pending'),
  };
}

export const classLabel = (e: NonNullable<StudentDashboard['enrollment']>): string =>
  [e.standardName, e.sectionName].filter(Boolean).join(' · ');

export const pendingTitle = (p: PendingItem): string => p.title.trim() || 'Untitled';
