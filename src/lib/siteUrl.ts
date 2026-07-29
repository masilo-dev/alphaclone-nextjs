<<<<<<< HEAD
function canonicalizeSiteUrl(raw: string): string {
  return raw
    .trim()
    .replace(/\/$/, '')
    .replace(/^https?:\/\/www\.alphaclonesystems\.com/i, 'https://alphaclonesystems.com');
}

export const SITE_URL = canonicalizeSiteUrl(
  process.env.PUBLIC_APP_ORIGIN ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://alphaclonesystems.com'
);
=======
export const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://alphaclonesystems.com').replace(/\/$/, '');
>>>>>>> origin/main

export function absoluteUrl(pathname: string): string {
  if (!pathname) return SITE_URL;
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${SITE_URL}${path}`;
}
