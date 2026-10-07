import type { ExpoConfig } from 'expo/config';

// Set after `eas init` (see README). Without it OTA stays disabled, which is safe.
const projectId = process.env.EAS_PROJECT_ID;

const config: ExpoConfig = {
  name: 'Teach Connect',
  slug: 'lms-k12-mobile',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  scheme: 'lmsk12',
  ios: { supportsTablet: true, bundleIdentifier: 'in.triz.lmsk12' },
  android: {
    package: 'in.triz.lmsk12',
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  plugins: ['expo-secure-store', 'expo-updates'],
  // Fingerprint: an OTA update is only delivered to binaries whose native code is identical.
  runtimeVersion: { policy: 'fingerprint' },
  updates: projectId
    ? {
        url: `https://u.expo.dev/${projectId}`,
        checkAutomatically: 'NEVER', // src/updates/otaClient.ts decides when to check
        fallbackToCacheTimeout: 0,
      }
    : { enabled: false },
  extra: projectId ? { eas: { projectId } } : {},
};

export default config;
