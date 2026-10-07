import { OwnProfile } from '../src/api/profile';
import { detailsFrom, MISMATCH_MESSAGE, sameAccount } from '../src/screens/profile/profileModel';

const me = { name: 'Asha Patel', email: 'asha@example.com', isStudent: true };
const p = (over: Partial<OwnProfile> = {}): OwnProfile => ({
  fullName: 'Asha Patel',
  email: 'asha@example.com',
  mobile: '9876543210',
  birthdate: '2012-05-17',
  joinYear: '2019',
  address: '12 Park Road',
  ...over,
});

describe('sameAccount - the mandatory fail-closed identity check', () => {
  describe('server email present: it must equal the login email', () => {
    it.each([
      ['identical', 'asha@example.com'],
      ['different case', 'ASHA@Example.COM'],
      ['surrounding spaces', '  asha@example.com  '],
    ])('%s -> match', (_n, email) => expect(sameAccount(p({ email }), me)).toBe(true));

    it('a different email is a mismatch EVEN WHEN the name matches (no fallback to the name)', () => {
      expect(sameAccount(p({ email: 'other@example.com', fullName: 'Asha Patel' }), me)).toBe(false);
    });

    it('a server email with an unknown login email cannot be verified -> mismatch (even with a matching name)', () => {
      expect(sameAccount(p({ email: 'asha@example.com' }), { name: 'Asha Patel', email: '' })).toBe(false);
      expect(sameAccount(p({ email: 'asha@example.com' }), { name: 'Asha Patel', email: '   ' })).toBe(false);
    });

    it('a staff record with the same numeric id but another person -> mismatch', () => {
      expect(sameAccount(p({ fullName: 'Ravi Staff Member', email: 'ravi@school.example', mobile: '1', address: 'Staff quarters' }), me)).toBe(false);
    });
  });

  describe('server email empty: the full name must equal the login name', () => {
    it.each([
      ['identical', 'Asha Patel'],
      ['different case', 'ASHA PATEL'],
      ['extra whitespace', '  Asha   Patel '],
    ])('%s -> match', (_n, fullName) => expect(sameAccount(p({ email: '', fullName }), me)).toBe(true));

    it('"null" / blank / missing server email counts as empty', () => {
      for (const email of ['', '   ', 'null', 'NULL']) expect(sameAccount(p({ email }), me)).toBe(true);
    });

    it('a different name -> mismatch', () => {
      expect(sameAccount(p({ email: '', fullName: 'Ravi Patel' }), me)).toBe(false);
      expect(sameAccount(p({ email: '', fullName: 'Asha Kumari Patel' }), me)).toBe(false);
    });

    it('both names empty, or either empty -> mismatch', () => {
      expect(sameAccount(p({ email: '', fullName: '' }), { name: '', email: '' })).toBe(false);
      expect(sameAccount(p({ email: '', fullName: '' }), me)).toBe(false);
      expect(sameAccount(p({ email: '', fullName: 'Asha Patel' }), { name: '', email: 'asha@example.com' })).toBe(false);
    });
  });

  it('a record with nothing to compare (no email, no name) is a mismatch', () => {
    expect(sameAccount(p({ email: '', fullName: '', mobile: '1', address: 'x' }), me)).toBe(false);
  });
});

describe('detailsFrom', () => {
  it('a rejected record yields NOTHING from it - not one field', () => {
    const r = detailsFrom(p({ email: 'other@example.com', fullName: 'Someone Else', mobile: '5550000', address: 'Secret Street', birthdate: '1980-01-01', joinYear: '2001' }), me);
    expect(r).toEqual({ kind: 'mismatch' });
    expect(JSON.stringify(r)).not.toMatch(/Someone|5550000|Secret|1980|2001|other@/);
  });

  it('student: Mobile, Date of birth, Admission year, Address - in that order', () => {
    expect(detailsFrom(p(), me)).toEqual({
      kind: 'ok',
      rows: [
        { label: 'Mobile', value: '9876543210' },
        { label: 'Date of birth', value: '17 May 2012' },
        { label: 'Admission year', value: '2019' },
        { label: 'Address', value: '12 Park Road' },
      ],
    });
  });

  it('staff: the year row is labelled "Joining year"', () => {
    const r = detailsFrom(p(), { ...me, isStudent: false });
    expect(r.kind === 'ok' && r.rows.map((x) => x.label)).toEqual(['Mobile', 'Date of birth', 'Joining year', 'Address']);
  });

  it('blank, null and missing values are omitted and never replaced', () => {
    const r = detailsFrom(p({ mobile: '', birthdate: 'null', joinYear: '  ', address: 'NULL' }), me);
    expect(r).toEqual({ kind: 'empty' });
    const some = detailsFrom(p({ mobile: '', address: '' }), me);
    expect(some.kind === 'ok' && some.rows.map((x) => x.label)).toEqual(['Date of birth', 'Admission year']);
  });

  it('an unreadable birthdate is shown as sent; the mobile number is plain text as sent', () => {
    const r = detailsFrom(p({ birthdate: 'unknown', mobile: '+91 98765 43210' }), me);
    expect(r.kind === 'ok' && r.rows).toContainEqual({ label: 'Date of birth', value: 'unknown' });
    expect(r.kind === 'ok' && r.rows).toContainEqual({ label: 'Mobile', value: '+91 98765 43210' });
  });

  it('never produces the server id, image, role or school rows (they are not even read)', () => {
    const r = detailsFrom({ ...p(), id: '5', image: 'a.jpg', user_profile: 'Student', school_name: 'X School' } as never, me);
    expect(JSON.stringify(r)).not.toMatch(/a\.jpg|X School|"5"|Role|School/);
  });

  it('exposes the mismatch message wording', () => expect(MISMATCH_MESSAGE).toBe("Your details can't be shown right now."));
});
