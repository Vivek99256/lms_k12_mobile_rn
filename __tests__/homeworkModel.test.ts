import { HomeworkItem } from '../src/api/student';
import {
  DEFAULT_FILTER,
  filterHomework,
  HOMEWORK_PAGE_SIZE,
  homeworkCounts,
  isSubmitted,
  metaText,
  rowLabel,
  showsOverdue,
  sortHomework,
  statusInfo,
} from '../src/screens/student/homeworkModel';

const hw = (over: Partial<HomeworkItem> = {}): HomeworkItem => ({
  id: '1',
  title: 'Fractions',
  subject: 'Maths',
  date: '2026-10-01',
  dueDate: '2026-10-12',
  status: null,
  fileCount: 0,
  aiStatus: '',
  ...over,
});
const TODAY = '2026-10-07';

describe('constants (S4a-D4, D8)', () => {
  it('opens on To do and shows 30 rows at a time', () => {
    expect(DEFAULT_FILTER).toBe('todo');
    expect(HOMEWORK_PAGE_SIZE).toBe(30);
  });
});

describe('isSubmitted', () => {
  it('status null and no files means not submitted; any status or any file means submitted', () => {
    expect(isSubmitted({ status: null, fileCount: 0 })).toBe(false);
    expect(isSubmitted({ status: 'Pending', fileCount: 0 })).toBe(true);
    expect(isSubmitted({ status: null, fileCount: 2 })).toBe(true);
    expect(isSubmitted({ status: 'Submitted', fileCount: 1 })).toBe(true);
  });
});

describe('statusInfo (S4a-D5, the web wording)', () => {
  const s = (status: string | null, fileCount = 0, aiStatus = '') => statusInfo({ status, fileCount, aiStatus });

  it('not submitted', () => {
    expect(s(null)).toEqual({ label: 'Not submitted', tone: 'neutral' });
  });

  it('Reviewed and Rejected win over everything else, case-insensitively', () => {
    expect(s('Reviewed', 1, 'Checking')).toEqual({ label: 'Reviewed', tone: 'success' });
    expect(s('reviewed')).toEqual({ label: 'Reviewed', tone: 'success' });
    expect(s('Rejected', 1)).toEqual({ label: 'Rejected', tone: 'danger' });
  });

  it('a submitted row reads from the AI status', () => {
    expect(s('Submitted', 1, 'Checking')).toEqual({ label: 'AI evaluating', tone: 'info' });
    expect(s('Submitted', 1, 'Evaluated')).toEqual({ label: 'AI evaluated', tone: 'warning' });
    for (const failed of ['OCR Failed', 'Evaluation Failed', 'Failed', ' failed ']) {
      expect(s('Submitted', 1, failed)).toEqual({ label: 'Evaluation failed', tone: 'danger' });
    }
  });

  it('Awaiting review when submitted with no, or an unknown, AI status', () => {
    expect(s('Submitted', 1)).toEqual({ label: 'Awaiting review', tone: 'warning' });
    expect(s('Under Review', 0, 'something new')).toEqual({ label: 'Awaiting review', tone: 'warning' });
    expect(s('Pending')).toEqual({ label: 'Awaiting review', tone: 'warning' });
  });

  it('files without a status count as submitted', () => {
    expect(s(null, 1)).toEqual({ label: 'Awaiting review', tone: 'warning' });
  });
});

describe('filterHomework', () => {
  const items = [hw({ id: '1' }), hw({ id: '2', status: 'Submitted', fileCount: 1 }), hw({ id: '3', status: 'Reviewed' }), hw({ id: '4' })];

  it('To do = not submitted, Submitted = submitted, All = everything', () => {
    expect(filterHomework(items, 'todo').map((h) => h.id)).toEqual(['1', '4']);
    expect(filterHomework(items, 'submitted').map((h) => h.id)).toEqual(['2', '3']);
    expect(filterHomework(items, 'all').map((h) => h.id)).toEqual(['1', '2', '3', '4']);
  });

  it('every item is in exactly one of To do / Submitted and counts add up', () => {
    const c = homeworkCounts(items);
    expect(c).toEqual({ todo: 2, submitted: 2, all: 4 });
    expect(homeworkCounts([])).toEqual({ todo: 0, submitted: 0, all: 0 });
  });
});

describe('sortHomework - To do by due date', () => {
  it('soonest due first (overdue first), undated and unreadable due dates last', () => {
    const sorted = sortHomework(
      [
        hw({ id: '1', title: 'far', dueDate: '2026-10-12' }),
        hw({ id: '2', title: 'none', dueDate: '' }),
        hw({ id: '3', title: 'overdue', dueDate: '2026-10-05' }),
        hw({ id: '4', title: 'soon', dueDate: '2026-10-09' }),
        hw({ id: '5', title: 'junk', dueDate: 'whenever' }),
      ],
      'todo',
    );
    // the two unreadable due dates tie, so the higher id (newer homework) comes first
    expect(sorted.map((h) => h.title)).toEqual(['overdue', 'soon', 'far', 'junk', 'none']);
  });

  it('reads DD-MM-YYYY due dates too', () => {
    const sorted = sortHomework([hw({ id: '1', dueDate: '20-10-2026' }), hw({ id: '2', dueDate: '2026-10-08' })], 'todo');
    expect(sorted.map((h) => h.id)).toEqual(['2', '1']);
  });

  it('ties on the due date fall back to the newer assigned date, then the higher id', () => {
    const sorted = sortHomework(
      [hw({ id: '1', dueDate: '2026-10-10', date: '2026-10-01' }), hw({ id: '2', dueDate: '2026-10-10', date: '2026-10-03' }), hw({ id: '9', dueDate: '2026-10-10', date: '2026-10-03' })],
      'todo',
    );
    expect(sorted.map((h) => h.id)).toEqual(['9', '2', '1']);
  });
});

describe('sortHomework - Submitted and All by assigned date', () => {
  const items = [hw({ id: '1', date: '2026-09-01' }), hw({ id: '2', date: '2026-10-03' }), hw({ id: '3', date: '' }), hw({ id: '4', date: '2026-10-03' })];

  it('newest assigned first, unreadable dates last, ties by higher id', () => {
    expect(sortHomework(items, 'all').map((h) => h.id)).toEqual(['4', '2', '1', '3']);
    expect(sortHomework(items, 'submitted').map((h) => h.id)).toEqual(['4', '2', '1', '3']);
  });

  it('does not change the input array', () => {
    const copy = items.map((h) => h.id);
    sortHomework(items, 'all');
    expect(items.map((h) => h.id)).toEqual(copy);
  });

  it('copes with non-numeric ids and an empty list', () => {
    expect(sortHomework([hw({ id: 'x', date: '2026-10-01' }), hw({ id: '7', date: '2026-10-01' })], 'all').map((h) => h.id)).toEqual(['7', 'x']);
    expect(sortHomework([], 'todo')).toEqual([]);
  });
});

describe('dates in words', () => {
  it('metaText shows assigned and due, with Overdue only while it is still to do', () => {
    expect(metaText(hw({ dueDate: '2026-10-12' }), TODAY)).toBe('Assigned 1 Oct 2026 · Due 12 Oct 2026');
    expect(metaText(hw({ dueDate: '2026-10-07' }), TODAY)).toBe('Assigned 1 Oct 2026 · Due today');
    expect(metaText(hw({ dueDate: '2026-10-05' }), TODAY)).toBe('Assigned 1 Oct 2026 · Overdue · 5 Oct 2026');
    expect(metaText(hw({ dueDate: '2026-10-05', status: 'Submitted', fileCount: 1 }), TODAY)).toBe('Assigned 1 Oct 2026 · Due 5 Oct 2026');
  });

  it('metaText leaves out dates that cannot be read', () => {
    expect(metaText(hw({ date: '', dueDate: '' }), TODAY)).toBe('');
    expect(metaText(hw({ date: 'x', dueDate: '12-10-2026' }), TODAY)).toBe('Due 12 Oct 2026');
  });

  it('showsOverdue only for homework still to do', () => {
    expect(showsOverdue(hw({ dueDate: '2026-10-05' }), TODAY)).toBe(true);
    expect(showsOverdue(hw({ dueDate: '2026-10-05', status: 'Submitted' }), TODAY)).toBe(false);
    expect(showsOverdue(hw({ dueDate: '2026-10-07' }), TODAY)).toBe(false);
    expect(showsOverdue(hw({ dueDate: '' }), TODAY)).toBe(false);
  });

  it('rowLabel is one sentence with title, subject, due and status', () => {
    expect(rowLabel(hw(), TODAY)).toBe('Fractions, Maths, Due 12 Oct 2026, Not submitted');
    expect(rowLabel(hw({ dueDate: '2026-10-05' }), TODAY)).toBe('Fractions, Maths, Overdue · 5 Oct 2026, Not submitted');
    expect(rowLabel(hw({ title: ' ', subject: '', dueDate: '', status: 'Reviewed' }), TODAY)).toBe('Untitled homework, Reviewed');
  });
});
