function canonicalizeSiteUrl(raw: string): string {
  return raw
    .trim()
    .replace(/\/$/, '')
    .replace(/^https?:\/\/www\.alphaclonesystems\.com/i, 'https://alphaclonesystems.com');
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);
const PRODUCTION_PUBLIC_ORIGIN = 'https://alphaclonesystems.com';

export const SITE_URL = canonicalizeSiteUrl(
  process.env.PUBLIC_APP_ORIGIN ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://alphaclonesystems.com'
);

/**
 * Absolute HTTPS origin for outbound email links (unsubscribe, preferences, legal).
 * Never uses localhost or http:// in production — providers and compliance require HTTPS.
 */
export function resolvePublicHttpsOrigin(): string {
  const candidates = [
    process.env.EMAIL_PUBLIC_ORIGIN,
    process.env.PUBLIC_APP_ORIGIN,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    PRODUCTION_PUBLIC_ORIGIN,
  ];

  const raw = candidates.find((value) => typeof value === 'string' && value.trim())?.trim()
    || PRODUCTION_PUBLIC_ORIGIN;

  try {
    const parsed = new URL(raw.includes('://') ? raw : `https://${raw}`);
    parsed.protocol = 'https:';
    if (process.env.NODE_ENV === 'production' && LOCAL_HOSTS.has(parsed.hostname)) {
      return PRODUCTION_PUBLIC_ORIGIN;
    }
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return PRODUCTION_PUBLIC_ORIGIN;
  }
}

export function publicEmailUrl(pathname: string): string {
  if (!pathname) return resolvePublicHttpsOrigin();
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${resolvePublicHttpsOrigin()}${path}`;
}

export function isAbsoluteHttpsUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:') return false;
    if (process.env.NODE_ENV === 'production' && LOCAL_HOSTS.has(parsed.hostname)) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function absoluteUrl(pathname: string): string {
  if (!pathname) return SITE_URL;
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${SITE_URL}${path}`;
}
