/**
 * Public URL validation — zero-localhost rule for customer-facing links.
 */

const PRODUCTION_DOMAINS = [
  'alphaclonesystems.com',
  'www.alphaclonesystems.com', // accepted then rewritten to apex
  'alphaclone.com',
  'www.alphaclone.com',
  'alphaclone.tech',
  'railway.app',
];

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
]);

const BLOCKED_PATTERNS = [
  /localhost/i,
  /127\.0\.0\.1/,
  /0\.0\.0\.0/,
  /:3000\b/,
  /:8080\b/,
  /\.railway\.internal/i,
  /\.internal\b/i,
];

export interface PublicUrlValidationResult {
  valid: boolean;
  url?: string;
  reason?: string;
}

/** Resolve the canonical production base URL — never localhost, never www apex. */
export function getProductionBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL || 'https://alphaclonesystems.com';
  const cleaned = raw
    .replace(/^https:\/\/www\.alphaclonesystems\.com/i, 'https://alphaclonesystems.com')
    .replace(/^http:\/\/www\.alphaclonesystems\.com/i, 'https://alphaclonesystems.com')
    .replace(/\/$/, '');

  try {
    const parsed = new URL(cleaned);
    if (parsed.hostname.toLowerCase() === 'www.alphaclonesystems.com') {
      parsed.hostname = 'alphaclonesystems.com';
      return parsed.origin;
    }
    if (BLOCKED_HOSTNAMES.has(parsed.hostname) || isBlockedUrl(cleaned)) {
      return 'https://alphaclonesystems.com';
    }
    return cleaned;
  } catch {
    return 'https://alphaclonesystems.com';
  }
}

export function isBlockedUrl(url: string): boolean {
  return BLOCKED_PATTERNS.some((p) => p.test(url));
}

/** Validate a URL before exposing it to customers. */
export function validatePublicUrl(url: string): PublicUrlValidationResult {
  try {
    const parsed = new URL(url);

    if (parsed.protocol !== 'https:') {
      return { valid: false, reason: 'Public links must use HTTPS' };
    }

    if (BLOCKED_HOSTNAMES.has(parsed.hostname)) {
      return { valid: false, reason: 'Development URLs cannot be shared with customers' };
    }

    if (isBlockedUrl(url)) {
      return { valid: false, reason: 'URL contains blocked development patterns' };
    }

    const isProdDomain = PRODUCTION_DOMAINS.some(
      (d) => parsed.hostname === d || parsed.hostname.endsWith(`.${d}`)
    );

    if (!isProdDomain && process.env.NODE_ENV === 'production') {
      return { valid: false, reason: 'URL must use the production AlphaClone domain' };
    }

    return { valid: true, url };
  } catch {
    return { valid: false, reason: 'Invalid URL format' };
  }
}

/** Build a public URL and validate before returning. Throws if invalid in production. */
export function buildValidatedPublicUrl(path: string): string {
  const base = getProductionBaseUrl();
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
  const result = validatePublicUrl(url);
  if (!result.valid && process.env.NODE_ENV === 'production') {
    throw new Error(`Cannot create public link: ${result.reason}`);
  }
  return url;
}
