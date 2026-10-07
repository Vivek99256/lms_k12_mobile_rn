import { ResultFile } from '../src/api/student';
import { isBlockedResultTile, resultRows } from '../src/screens/student/resultsModel';

jest.mock('../src/config/env', () => ({ env: { apiBaseUrl: 'https://dev.triz.co.in', appEnv: 'test', erpHosts: [] } }));

const f = (id: string, term: string, file = ''): ResultFile => ({ id, term, file });
const T1 = 'https://erp.triz.co.in/storage/upload_result/t1.pdf';
const T2 = 'https://erp.triz.co.in/storage/upload_result/t2.pdf';

describe('resultRows', () => {
  it('one row per term, ordered by id ascending (numerically, not as text)', () => {
    const rows = resultRows([f('10', 'Term 2', T2), f('9', 'Term 1', T1), f('100', 'Term 3')]);
    expect(rows.map((r) => r.term)).toEqual(['Term 1', 'Term 2', 'Term 3']);
  });

  it('non-numeric ids come after numeric ones, keeping the server order; ties keep the server order', () => {
    const rows = resultRows([f('x', 'Late A'), f('5', 'Five'), f('', 'Late B'), f('5', 'Five again', T1), f('abc', 'Late C')]);
    expect(rows.map((r) => r.term)).toEqual(['Five', 'Five again', 'Late A', 'Late B', 'Late C']);
  });

  it('does not mutate its input', () => {
    const input = [f('2', 'B', T2), f('1', 'A', T1)];
    resultRows(input);
    expect(input.map((r) => r.id)).toEqual(['2', '1']);
  });

  it('a validated link is "ready" and re-based onto the API host', () => {
    expect(resultRows([f('1', 'Term 1', T1)])[0]).toMatchObject({ state: 'ready', url: 'https://dev.triz.co.in/storage/upload_result/t1.pdf' });
  });

  it('no file -> "none" with no url (empty and blank)', () => {
    expect(resultRows([f('1', 'Term 1', '')])[0]).toMatchObject({ state: 'none', url: null });
    expect(resultRows([f('1', 'Term 1', '   ')])[0]).toMatchObject({ state: 'none', url: null });
  });

  it.each([
    'https://evil.example/a.pdf',
    'https://erp.triz.co.in.evil.com/a.pdf',
    'https://erp.triz.co.in@evil.example/a.pdf',
    'javascript:alert(1)',
    'file:///etc/passwd',
    'intent://x',
    'ftp://erp.triz.co.in/a.pdf',
    'a.pdf',
    '/storage/upload_result/a.pdf',
  ])('unsafe link %p -> "unsafe", no url, row still shown', (bad) => {
    const rows = resultRows([f('1', 'Term 1', bad)]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ term: 'Term 1', state: 'unsafe', url: null });
  });

  it('a missing term name shows as "Term"; names are trimmed', () => {
    expect(resultRows([f('1', '', T1)])[0].term).toBe('Term');
    expect(resultRows([f('1', '   ', T1)])[0].term).toBe('Term');
    expect(resultRows([f('1', '  Term 1  ', T1)])[0].term).toBe('Term 1');
  });

  it('identical rows (same term and file) collapse; different files for one term do not', () => {
    expect(resultRows([f('1', 'Term 1', T1), f('2', 'term 1', T1)])).toHaveLength(1);
    expect(resultRows([f('1', 'Term 1', T1), f('2', 'Term 1', T2)])).toHaveLength(2);
  });

  it('empty input -> no rows; keys are unique', () => {
    expect(resultRows([])).toEqual([]);
    const keys = resultRows([f('', 'A'), f('', 'B'), f('', 'C', T1)]).map((r) => r.key);
    expect(new Set(keys).size).toBe(3);
  });
});

describe('isBlockedResultTile', () => {
  it.each([
    'https://erp.triz.co.in/studentResultPDFAPI',
    'studentResultPDFAPI',
    '/studentResultPDFAPI',
    'https://erp.triz.co.in/STUDENTRESULTPDFAPI/',
    'https://erp.triz.co.in/studentResultPDFAPI?x=1#y',
    '  https://dev.triz.co.in/studentResultPDFAPI  ',
  ])('blocks %p', (api) => expect(isBlockedResultTile(api)).toBe(true));

  it.each([
    'https://erp.triz.co.in/uploadResultAPI',
    'uploadResultAPI',
    null,
    undefined,
    '',
    'https://erp.triz.co.in/get_wrtreportAPI',
    'https://erp.triz.co.in/studentResultPDFAPIv2',
    'https://erp.triz.co.in/x/studentResultPDFAPI/other',
  ])('does not block %p', (api) => expect(isBlockedResultTile(api)).toBe(false));
});
