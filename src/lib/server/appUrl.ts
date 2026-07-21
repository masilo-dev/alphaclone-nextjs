const DEFAULT_APP_URL = 'https://alphaclonesystems.com';

/** Public app origin for webhooks, OAuth redirects, and internal callbacks. */
export function getPublicAppUrl(fallback = DEFAULT_APP_URL): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    (process.env.RAILWAY_PUBLIC_DOMAIN
      ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
      : '') ||
    fallback;

  return String(raw).replace(/\/+$/, '');
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
