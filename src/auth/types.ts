/** The slice of the /api/api-login `data` object the app keeps (small enough for SecureStore). */
export interface AuthUser {
  id: number;
  email: string;
  name: string;
  subInstituteId: number;
  userProfileId: number;
  userProfileName: string;
  isAdmin: number;
  isStudent: boolean;
  clientId: number | null;
  syear: string | null;
  schoolName: string;
}

export interface StoredSession {
  token: string;
  user: AuthUser;
}

/** Raw shape of POST /api/api-login -> data (only fields we read). */
export interface LoginData {
  id: number | string;
  email?: string;
  first_name?: string;
  last_name?: string;
  user_profile?: string;
  user_profile_id: number | string;
  sub_institute_id: number | string;
  is_admin?: number | string;
  client_id?: number | string | null;
  mobile_syear?: string | null;
  school_name?: string;
  user_token: string;
}
