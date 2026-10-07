import * as Updates from 'expo-updates';
import { AppState } from 'react-native';

const MIN_INTERVAL_MS = 10 * 60 * 1000;
let lastCheck = 0;
let running = false;

/**
 * Check for a JS-only update and download it in the background. It is applied on the NEXT app
 * launch - never reloaded mid-session, so a user is not interrupted or logged out of a form.
 *
 * Safe by construction:
 *  - the runtime version (native fingerprint) is enforced by the update server, so a bundle
 *    built for different native code is never offered to this binary;
 *  - any failure is swallowed (the app keeps running its current bundle);
 *  - expo-updates itself rolls back to the previous/embedded bundle if a new one fails to start.
 */
export async function checkForOtaUpdate(): Promise<void> {
  if (__DEV__ || !Updates.isEnabled || running) return;
  if (Date.now() - lastCheck < MIN_INTERVAL_MS) return;
  running = true;
  lastCheck = Date.now();
  try {
    const check = await Updates.checkForUpdateAsync();
    if (check.isAvailable) await Updates.fetchUpdateAsync();
  } catch (e) {
    console.warn('[ota] update check failed', e);
  } finally {
    running = false;
  }
}

/** Check at launch and every time the app returns to the foreground. */
export function startOtaChecks(): () => void {
  void checkForOtaUpdate();
  const sub = AppState.addEventListener('change', (s) => {
    if (s === 'active') void checkForOtaUpdate();
  });
  return () => sub.remove();
}
