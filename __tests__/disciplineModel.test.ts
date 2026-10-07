import { DisciplineRecord } from '../src/api/student';
import { disciplineFlag, disciplineRows } from '../src/screens/student/recordsModel';

const r = (over: Partial<DisciplineRecord> = {}): DisciplineRecord => ({ type: 'Good', message: 'Helped a classmate', date: '2026-03-01', flag: '1', ...over });

describe('disciplineFlag - the backend\'s own coding, nothing invented', () => {
  it('1 / 0 / -1 are Positive / Neutral / Negative', () => {
    expect(disciplineFlag('1')?.label).toBe('Positive');
    expect(disciplineFlag('0')?.label).toBe('Neutral');
    expect(disciplineFlag('-1')?.label).toBe('Negative');
  });
  it('a blank or "null" flag shows no pill', () => {
    for (const f of ['', '  ', 'null', 'NULL']) expect(disciplineFlag(f)).toBeUndefined();
  });
  it('an unknown value is shown exactly as sent', () => {
    expect(disciplineFlag('2')?.label).toBe('2');
    expect(disciplineFlag('Serious')?.label).toBe('Serious');
  });
  it('every pill is neutral-toned: no judgement colours on a child\'s record', () => {
    for (const f of ['1', '0', '-1', 'x']) expect(disciplineFlag(f)?.tone).toBe('neutral');
  });
});

describe('disciplineRows', () => {
  it('newest first by date; unreadable dates last (shown as sent); ties keep the server order; nothing dropped; no mutation', () => {
    const input = [r({ message: 'old', date: '2025-01-01' }), r({ message: 'nodate', date: '' }), r({ message: 'new', date: '2026-03-01' }), r({ message: 'tie', date: '2026-03-01' }), r({ message: 'bad', date: 'soon' })];
    const copy = JSON.stringify(input);
    const rows = disciplineRows(input);
    expect(rows.map((x) => x.fields[0].value)).toEqual(['new', 'tie', 'old', 'nodate', 'bad']);
    expect(rows[4].date).toBe('soon');
    expect(JSON.stringify(input)).toBe(copy);
    expect(new Set(rows.map((x) => x.key)).size).toBe(5);
  });

  it('reads both date formats', () => {
    const rows = disciplineRows([r({ message: 'a', date: '15-03-2026' }), r({ message: 'b', date: '2026-04-01 09:00:00' })]);
    expect(rows.map((x) => x.fields[0].value)).toEqual(['b', 'a']);
    expect(rows.map((x) => x.date)).toEqual(['1 Apr 2026', '15 Mar 2026']);
  });

  it('title is the stored type as sent (Bad / Good / Check / Excellent ...), with a plain default', () => {
    expect(disciplineRows([r({ type: 'Excellent' })])[0].title).toBe('Excellent');
    expect(disciplineRows([r({ type: ' ' })])[0].title).toBe('Discipline note');
    expect(disciplineRows([r({ type: 'null' })])[0].title).toBe('Discipline note');
  });

  it('the message is plain text; an empty message leaves the row without a message field but keeps the row', () => {
    expect(disciplineRows([r({ message: '  <b>x</b> wrote  ' })])[0].fields).toEqual([{ label: 'Message', value: '<b>x</b> wrote' }]);
    const empty = disciplineRows([r({ message: '' })]);
    expect(empty).toHaveLength(1);
    expect(empty[0].fields).toEqual([]);
  });

  it('carries no ids, links, files or buttons - only title, date, flag and message', () => {
    const [row] = disciplineRows([r({ flag: '-1' })]);
    expect(row.status).toEqual({ label: 'Negative', tone: 'neutral' });
    expect(row.link).toBeUndefined();
    expect(row.text).toBeUndefined();
    expect(Object.keys(row).sort()).toEqual(['date', 'fields', 'key', 'status', 'title']);
  });

  it('extra server fields (ids, staff names) are never carried through', () => {
    const [row] = disciplineRows([{ ...r(), id: '99', student_id: '5', created_by: '7', teacher: 'Mrs Shah' } as never]);
    expect(JSON.stringify(row)).not.toMatch(/99|"5"|"7"|Shah/);
  });

  it('no records -> no rows', () => expect(disciplineRows([])).toEqual([]));
});
