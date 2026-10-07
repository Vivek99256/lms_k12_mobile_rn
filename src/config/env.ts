export const env = {
  apiBaseUrl: (process.env.EXPO_PUBLIC_API_BASE_URL ?? '').replace(/\/+$/, ''),
  appEnv: process.env.EXPO_PUBLIC_APP_ENV ?? 'development',
  /** Hosts the ERP menu may name in absolute endpoint URLs (see src/api/url.ts). Empty = built-in defaults. */
  erpHosts: (process.env.EXPO_PUBLIC_ERP_HOSTS ?? '')
    .split(',')
    .map((h: string) => h.trim().toLowerCase())
    .filter(Boolean),
};
