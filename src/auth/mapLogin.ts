import { AuthUser, LoginData } from './types';

export function mapLoginData(d: LoginData): AuthUser {
  const profile = (d.user_profile ?? '').trim();
  return {
    id: Number(d.id),
    email: d.email ?? '',
    name: [d.first_name, d.last_name].filter(Boolean).join(' ').trim() || (d.email ?? ''),
    subInstituteId: Number(d.sub_institute_id),
    userProfileId: Number(d.user_profile_id),
    userProfileName: profile,
    isAdmin: Number(d.is_admin ?? 0),
    isStudent: profile.toLowerCase() === 'student',
    clientId: d.client_id != null && d.client_id !== '' ? Number(d.client_id) : null,
    syear: d.mobile_syear ?? null,
    schoolName: d.school_name ?? '',
  };
}
