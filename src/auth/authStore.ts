import { create } from 'zustand';
import { api, configureApi } from '../api/client';
import { ApiError } from '../api/errors';
import { mapLoginData } from './mapLogin';
import { clearSession, loadSession, saveSession } from './secureStorage';
import { AuthUser, LoginData } from './types';

type Status = 'restoring' | 'signedOut' | 'signedIn';

interface AuthState {
  status: Status;
  token: string | null;
  user: AuthUser | null;
  /** Reads the keystore on app start. */
  restore: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  /** Local sign-out. The backend has no logout endpoint (stateless JWT). */
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'restoring',
  token: null,
  user: null,

  restore: async () => {
    const s = await loadSession();
    set(s ? { status: 'signedIn', token: s.token, user: s.user } : { status: 'signedOut', token: null, user: null });
  },

  signIn: async (email, password) => {
    const res = await api.post<LoginData>('api/api-login', {
      body: { email: email.trim(), password, type: 'API' },
      withSession: false,
      skipAuthHandling: true, // 401 here means wrong credentials, not an expired session
    });
    const data = res.data;
    if (!data?.user_token) throw new ApiError('server', 'Login succeeded but no session was returned.');
    const user = mapLoginData(data);
    await saveSession({ token: data.user_token, user });
    set({ status: 'signedIn', token: data.user_token, user });
  },

  signOut: async () => {
    if (get().status === 'signedOut') return;
    set({ status: 'signedOut', token: null, user: null });
    await clearSession();
  },
}));

type SignOutListener = () => void;
const listeners = new Set<SignOutListener>();
const forbiddenListeners = new Set<SignOutListener>();
/** Called on any 403, so the permission snapshot can be refreshed. */
export const onForbidden = (fn: SignOutListener) => {
  forbiddenListeners.add(fn);
  return () => forbiddenListeners.delete(fn);
};
/** Lets other layers (query cache, menu store) reset when the session ends. */
export const onSignedOut = (fn: SignOutListener) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

let prev: Status = useAuthStore.getState().status;
useAuthStore.subscribe((s) => {
  if (prev === 'signedIn' && s.status === 'signedOut') listeners.forEach((fn) => fn());
  prev = s.status;
});

configureApi({
  getSession: () => {
    const { token, user } = useAuthStore.getState();
    return { token, subInstituteId: user?.subInstituteId, syear: user?.syear };
  },
  onUnauthorized: () => {
    void useAuthStore.getState().signOut();
  },
  onForbidden: () => forbiddenListeners.forEach((fn) => fn()),
});
