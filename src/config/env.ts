export const env = {
  apiBaseUrl: (process.env.EXPO_PUBLIC_API_BASE_URL ?? '').replace(/\/+$/, ''),
  appEnv: process.env.EXPO_PUBLIC_APP_ENV ?? 'development',
};
