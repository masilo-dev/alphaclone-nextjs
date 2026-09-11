import { PUBLIC_APP_ORIGIN } from '@/lib/config/public-origin';

const DEFAULT_APP_URL = 'https://alphaclonesystems.com';

/** Public app origin for webhooks, OAuth redirects, and internal callbacks. */
export function getPublicAppUrl(_fallback = DEFAULT_APP_URL): string {
  // Prefer centralized canonical origin (never Railway internal / 0.0.0.0)
  return PUBLIC_APP_ORIGIN || DEFAULT_APP_URL;
}

/** Git commit SHA exposed to the client for release tracking. */
export function getReleaseSha(): string {
  return (
    process.env.NEXT_PUBLIC_RAILWAY_GIT_COMMIT_SHA ||
    process.env.RAILWAY_GIT_COMMIT_SHA ||
    process.env.NEXT_PUBLIC_GIT_COMMIT_SHA ||
    'development'
  );
}
