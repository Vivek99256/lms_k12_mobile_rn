import * as SecureStore from 'expo-secure-store';
import { StoredSession } from './types';

const KEY = 'auth.session.v1';

/** Reads never throw: a corrupt or unavailable keystore just means "signed out". */
export async function loadSession(): Promise<StoredSession | null> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    return parsed?.token && parsed?.user?.id ? parsed : null;
  } catch {
    return null;
  }
}

export async function saveSession(session: StoredSession): Promise<void> {
  await SecureStore.setItemAsync(KEY, JSON.stringify(session));
}

export async function clearSession(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(KEY);
  } catch {
    // Nothing useful to do; the in-memory state is already cleared.
  }
}
