import { OwnProfile } from '../../api/profile';
import { displayDate } from '../../utils/dates';

export const MISMATCH_MESSAGE = "Your details can't be shown right now.";

export interface DetailRow {
  label: string;
  value: string;
}

/** `rows` only exist for a record that was proven to be the signed-in user's own. A rejected record produces no rows at all. */
export type DetailsResult = { kind: 'ok'; rows: DetailRow[] } | { kind: 'empty' } | { kind: 'mismatch' };

export interface SignedInUser {
  name: string;
  email: string;
  isStudent: boolean;
}

const norm = (s: string): string => s.trim().replace(/\s+/g, ' ').toLowerCase();
const clean = (s: string): string => {
  const t = s.trim();
  return /^(null|undefined)$/i.test(t) ? '' : t;
};

/**
 * Is this record the signed-in user's own? Fail-closed rule (the backend can return another person's record when a school's
 * student profile is not named exactly "Student" - OwnProfileApiController.php:17):
 *  - the server sent an email: it must equal the login email, ignoring case and surrounding spaces; a different email is a
 *    mismatch and the name is NOT consulted as a fallback; if the login email is unknown it cannot be verified: mismatch;
 *  - the server email is empty: the full name must equal the login name, ignoring case and extra whitespace (both non-empty);
 *  - anything else: mismatch.
 */
export function sameAccount(p: OwnProfile, user: Pick<SignedInUser, 'name' | 'email'>): boolean {
  const serverEmail = norm(clean(p.email));
  if (serverEmail) {
    const mine = norm(clean(user.email));
    return mine !== '' && serverEmail === mine;
  }
  const serverName = norm(clean(p.fullName));
  const myName = norm(clean(user.name));
  return serverName !== '' && myName !== '' && serverName === myName;
}

/**
 * The only function that turns a server record into something displayable. A record that is not provably the user's own gives
 * `mismatch` and NOTHING from it is returned. Otherwise only the approved rows are produced, blanks omitted, nothing invented:
 * Mobile (plain text), Date of birth, Admission year (student) / Joining year (staff), Address. The server's id, image, role
 * and school are never read.
 */
export function detailsFrom(p: OwnProfile, user: SignedInUser): DetailsResult {
  if (!sameAccount(p, user)) return { kind: 'mismatch' };
  const rows: DetailRow[] = [];
  const mobile = clean(p.mobile);
  if (mobile) rows.push({ label: 'Mobile', value: mobile });
  const birth = clean(p.birthdate);
  if (birth) rows.push({ label: 'Date of birth', value: displayDate(birth) });
  const year = clean(p.joinYear);
  if (year) rows.push({ label: user.isStudent ? 'Admission year' : 'Joining year', value: year });
  const address = clean(p.address);
  if (address) rows.push({ label: 'Address', value: address });
  return rows.length ? { kind: 'ok', rows } : { kind: 'empty' };
}
