import { dayHeading, displayDate, localDateKey, longDate, shiftDateKey, shortDate, toDateKey } from '../src/utils/dates';

describe('toDateKey', () => {
  it('reads ISO dates, with or without a time part', () => {
    expect(toDateKey('2026-10-05')).toBe('2026-10-05');
    expect(toDateKey('2026-10-05 00:00:00')).toBe('2026-10-05');
    expect(toDateKey('2026-10-05T23:59:59Z')).toBe('2026-10-05');
    expect(toDateKey('  2026-10-05 ')).toBe('2026-10-05');
  });

  it('reads the DD-MM-YYYY the legacy SQL sends', () => {
    expect(toDateKey('05-10-2026')).toBe('2026-10-05');
    expect(toDateKey('31-12-2026')).toBe('2026-12-31');
    expect(toDateKey('29-02-2028')).toBe('2028-02-29');
  });

  it('rejects anything that is not a real calendar date', () => {
    for (const bad of [null, undefined, 5, {}, '', 'garbage', '2026-13-01', '2026-02-30', '2026-00-10', '32-01-2026', '29-02-2026', '2026-10-5', '5-10-2026', '10/05/2026']) {
      expect(toDateKey(bad)).toBeNull();
    }
  });

  it('does not take a longer digit run for a date', () => {
    expect(toDateKey('2026-10-051')).toBeNull();
    expect(toDateKey('05-10-20261')).toBeNull();
  });
});

describe('date helpers', () => {
  it('shiftDateKey crosses months, years and leap days', () => {
    expect(shiftDateKey('2026-10-01', -1)).toBe('2026-09-30');
    expect(shiftDateKey('2026-01-01', -1)).toBe('2025-12-31');
    expect(shiftDateKey('2028-03-01', -1)).toBe('2028-02-29');
    expect(shiftDateKey('2026-12-31', 1)).toBe('2027-01-01');
    expect(shiftDateKey('2026-10-07', 0)).toBe('2026-10-07');
  });

  it('formats long and short dates without Intl', () => {
    expect(longDate('2026-10-05')).toBe('5 October 2026');
    expect(shortDate('2026-10-05')).toBe('5 Oct 2026');
    expect(shortDate('2026-05-12')).toBe('12 May 2026');
  });

  it('localDateKey uses the device calendar day', () => {
    expect(localDateKey(new Date(2026, 9, 7, 23, 59))).toBe('2026-10-07');
    expect(localDateKey(new Date(2026, 0, 3))).toBe('2026-01-03');
  });

  it('dayHeading says Today / Yesterday, otherwise the long date', () => {
    expect(dayHeading('2026-10-07', '2026-10-07')).toBe('Today');
    expect(dayHeading('2026-10-06', '2026-10-07')).toBe('Yesterday');
    expect(dayHeading('2026-09-30', '2026-10-01')).toBe('Yesterday');
    expect(dayHeading('2026-10-05', '2026-10-07')).toBe('5 October 2026');
  });

  it('displayDate shows a readable date, the raw text when unreadable, and never throws', () => {
    expect(displayDate('05-10-2026')).toBe('5 Oct 2026');
    expect(displayDate('2026-10-05 00:00:00')).toBe('5 Oct 2026');
    expect(displayDate('next Monday')).toBe('next Monday');
    expect(displayDate(null)).toBe('');
    expect(displayDate(42)).toBe('');
  });
});
