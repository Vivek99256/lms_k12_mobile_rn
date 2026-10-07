import { api } from '../api/client';
import { ApiError } from '../api/errors';
import { AuthUser } from '../auth/types';
import { fromLegacy, LegacySection } from './buildMenu';
import { BootstrapData } from './types';

/**
 * Identity and menu for the logged-in user. Preferred: GET /api/mobile/bootstrap, which the
 * backend derives entirely from the token. If the deployed backend predates it (404), fall
 * back to the legacy homescreen endpoints the Flutter app uses.
 */
export async function fetchBootstrap(user: AuthUser): Promise<BootstrapData> {
  try {
    const res = await api.get<BootstrapData>('api/mobile/bootstrap');
    return res.data;
  } catch (e) {
    if (!(e instanceof ApiError) || e.status !== 404) throw e;
  }

  const body = {
    sub_institute_id: user.subInstituteId,
    user_id: user.id,
    user_profile_id: user.userProfileId,
    user_profile_name: user.userProfileName,
  };
  const res = user.isStudent
    ? await api.post<LegacySection[]>('api/homescreen', { body })
    : await api.post<LegacySection[]>('teacher_homescreen', { body });

  return {
    user: {
      id: user.id,
      sub_institute_id: user.subInstituteId,
      user_profile_id: user.userProfileId,
      user_profile_name: user.userProfileName,
      is_student: user.isStudent,
      is_admin: user.isAdmin,
      school_name: user.schoolName,
    },
    menu: fromLegacy(Array.isArray(res.data) ? res.data : []),
  };
}
