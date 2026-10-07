import { StudentDashboard } from '../src/api/student';
import { cappedCount, classLabel, dueLabel, isOverdue, PENDING_CAP, subjectName, taskProgress } from '../src/screens/student/dashboardModel';

const TODAY = '2026-10-07';
const tasks = (hd: number, hp: number, as: number, ap: number): StudentDashboard['tasks'] => [
  { label: 'Homework done', value: hd },
  { label: 'Homework pending', value: hp },
  { label: 'Assignments submitted', value: as },
  { label: 'Assignments pending', value: ap },
];

describe('cappedCount', () => {
  it('shows 10+ when the server list is at its cap of 10', () => {
    expect(PENDING_CAP).toBe(10);
    expect(cappedCount(0)).toBe('0');
    expect(cappedCount(9)).toBe('9');
    expect(cappedCount(10)).toBe('10+');
    expect(cappedCount(25)).toBe('10+');
  });
});

describe('dueLabel / isOverdue', () => {
  it('labels today, future and overdue dates in words, not only colour', () => {
    expect(dueLabel('2026-10-07', TODAY)).toBe('Due today');
    expect(dueLabel('2026-10-12', TODAY)).toBe('Due 12 Oct 2026');
    expect(dueLabel('2026-10-05', TODAY)).toBe('Overdue · 5 Oct 2026');
    expect(dueLabel('05-10-2026', TODAY)).toBe('Overdue · 5 Oct 2026');
    expect(dueLabel('2026-10-12 00:00:00', TODAY)).toBe('Due 12 Oct 2026');
  });

  it('returns an empty label for unreadable dates and never marks them overdue', () => {
    expect(dueLabel('', TODAY)).toBe('');
    expect(dueLabel('tomorrow', TODAY)).toBe('');
    expect(isOverdue('', TODAY)).toBe(false);
    expect(isOverdue('2026-10-06', TODAY)).toBe(true);
    expect(isOverdue('2026-10-07', TODAY)).toBe(false);
  });
});

describe('subjectName', () => {
  const subjects = [{ id: '3', name: ' Maths ' }, { id: '4', name: '' }];
  it('returns a name only when the id is in the student\'s own list', () => {
    expect(subjectName(subjects, '3')).toBe('Maths');
    expect(subjectName(subjects, '9')).toBeNull();
    expect(subjectName(subjects, '')).toBeNull();
    expect(subjectName(subjects, '4')).toBeNull(); // known id but no name: nothing invented
  });
});

describe('taskProgress', () => {
  it('computes done / (done + pending) for homework and assignments', () => {
    const p = taskProgress(tasks(6, 2, 3, 1));
    expect(p.homework).toEqual({ done: 6, pending: 2, ratio: 0.75 });
    expect(p.assignments).toEqual({ done: 3, pending: 1, ratio: 0.75 });
  });

  it('gives no ratio when there is nothing yet, or when pending is capped (the real number is unknown)', () => {
    expect(taskProgress(tasks(0, 0, 0, 0)).homework?.ratio).toBeNull();
    expect(taskProgress(tasks(5, 10, 0, 0)).homework).toEqual({ done: 5, pending: 10, ratio: null });
  });

  it('shows nothing when the server labels change instead of guessing by position', () => {
    expect(taskProgress([{ label: 'Done', value: 1 }, { label: 'Pending', value: 2 }])).toEqual({ homework: null, assignments: null });
    expect(taskProgress([])).toEqual({ homework: null, assignments: null });
  });
});

describe('classLabel', () => {
  it('joins standard and division and tolerates a missing part', () => {
    expect(classLabel({ syear: '2026', standardName: '7', sectionName: 'A' })).toBe('7 · A');
    expect(classLabel({ syear: '2026', standardName: '7', sectionName: '' })).toBe('7');
    expect(classLabel({ syear: '2026', standardName: '', sectionName: '' })).toBe('');
  });
});
