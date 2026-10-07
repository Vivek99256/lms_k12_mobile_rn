import { api } from './client';

/**
 * The few fields of `GET api/own-profile` the Profile tab can show (OwnProfileApiController.php:27-43). The server's internal
 * `id`, `image`, `user_profile` (role) and `school_name` are deliberately NOT read: they are never shown, and no image is fetched.
 */
export interface OwnProfile {
  fullName: string;
  email: string;
  mobile: string;
  birthdate: string;
  /** Admission year for a student, joining year for staff, as sent. */
  joinYear: string;
  address: string;
}

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === 'string' ? v : v == null || typeof v === 'object' ? '' : String(v));

/**
 * `GET api/own-profile` (routes/api.php:98, group `api.session`): token-bound, read-only, takes no id. The token travels in the
 * Authorization header only (`bearerOnly`, never in the URL) and no query parameter at all is added (`withSession: false`),
 * so no user, student or staff id is ever sent. The caller must check that the record is the signed-in user's own before
 * showing any of it (profileModel.detailsFrom).
 */
export async function fetchOwnProfile(): Promise<OwnProfile> {
  const res = await api.get<unknown>('api/own-profile', { bearerOnly: true, withSession: false });
  const d = isRecord(res.data) ? res.data : {};
  return {
    fullName: str(d.full_name),
    email: str(d.email),
    mobile: str(d.mobile),
    birthdate: str(d.birthdate),
    joinYear: str(d.join_year),
    address: str(d.address),
  };
}
