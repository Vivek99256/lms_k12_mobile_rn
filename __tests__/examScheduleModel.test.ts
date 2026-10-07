import { ExamEntry } from '../src/api/student';
import { examItems, splitExams } from '../src/screens/student/examScheduleModel';

const x = (title: string, date: string, file = ''): ExamEntry => ({ title, date, file });
const TODAY = '2026-10-07';

describe('examItems', () => {
  it('reads ISO and DD-MM-YYYY dates and trims text', () => {
    const items = examItems([x('  Midterm ', '2026-10-20'), x('Quiz', '15-09-2026')]);
    expect(items.map((i) => [i.title, i.dateKey])).toEqual([['Midterm', '2026-10-20'], ['Quiz', '2026-09-15']]);
  });

  it('collapses identical rows (two enrollment rows for one year would duplicate each schedule)', () => {
    const items = examItems([x('Midterm', '2026-10-20', 'https://a/f.pdf'), x('Midterm', '2026-10-20', 'https://a/f.pdf'), x('Midterm', '2026-10-20', 'https://a/g.pdf')]);
    expect(items).toHaveLength(2);
  });

  it('keeps unreadable dates (dateKey null) and does not merge different unreadable rows', () => {
    const items = examItems([x('A', ''), x('B', 'soon'), x('A', '')]);
    expect(items.map((i) => [i.title, i.dateKey])).toEqual([['A', null], ['B', null]]);
  });
});

describe('splitExams (S3-D4)', () => {
  const items = examItems([
    x('Late', '2026-12-01'),
    x('Today', '2026-10-07'),
    x('Soon', '2026-10-08'),
    x('Yesterday', '2026-10-06'),
    x('Old', '2026-08-01'),
    x('Mystery', ''),
    x('Odd', 'someday'),
  ]);

  it('puts today and later in Upcoming, soonest first', () => {
    expect(splitExams(items, TODAY).upcoming.map((i) => i.title)).toEqual(['Today', 'Soon', 'Late']);
  });

  it('puts earlier exams in Earlier, most recent first', () => {
    expect(splitExams(items, TODAY).earlier.map((i) => i.title)).toEqual(['Yesterday', 'Old']);
  });

  it('keeps unreadable dates in their own group, in server order, never dropped', () => {
    expect(splitExams(items, TODAY).unknown.map((i) => i.title)).toEqual(['Mystery', 'Odd']);
  });

  it('an exam dated today counts as Upcoming all day', () => {
    expect(splitExams(examItems([x('Today', '2026-10-07')]), '2026-10-07').upcoming).toHaveLength(1);
    expect(splitExams(examItems([x('Today', '2026-10-07')]), '2026-10-08').earlier).toHaveLength(1);
  });

  it('breaks ties on the same date by title and works with an empty list', () => {
    const g = splitExams(examItems([x('B', '2026-10-20'), x('A', '2026-10-20')]), TODAY);
    expect(g.upcoming.map((i) => i.title)).toEqual(['A', 'B']);
    expect(splitExams([], TODAY)).toEqual({ upcoming: [], earlier: [], unknown: [] });
  });

  it('every item lands in exactly one group', () => {
    const g = splitExams(items, TODAY);
    expect(g.upcoming.length + g.earlier.length + g.unknown.length).toBe(items.length);
  });
});
