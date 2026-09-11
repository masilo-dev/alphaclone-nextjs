export const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://alphaclonesystems.com').replace(/\/$/, '');

export function absoluteUrl(pathname: string): string {
  if (!pathname) return SITE_URL;
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${SITE_URL}${path}`;
}
