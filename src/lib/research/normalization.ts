/**
 * Normalization utilities for domains, emails, phones, and business identities.
 */

export function normalizeDomain(rawUrlOrDomain?: string | null): string | null {
  if (!rawUrlOrDomain || typeof rawUrlOrDomain !== 'string') return null;
  const input = rawUrlOrDomain.trim().toLowerCase();
  if (!input) return null;

  try {
    const withScheme = input.startsWith('http://') || input.startsWith('https://') ? input : `https://${input}`;
    const parsed = new URL(withScheme);
    const host = parsed.hostname.replace(/^www\./, '').trim();
    return host && host.includes('.') ? host : null;
  } catch {
    const cleaned = input.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].split('?')[0].trim();
    return cleaned && cleaned.includes('.') ? cleaned : null;
  }
}

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const BLOCKED_EMAIL_DOMAINS = new Set([
  'example.com',
  'test.com',
  'sentry.io',
  'wixpress.com',
  'domain.com',
  'schema.org',
  'w3.org',
]);

export function normalizeEmail(rawEmail?: string | null): string | null {
  if (!rawEmail || typeof rawEmail !== 'string') return null;
  const cleaned = rawEmail.trim().toLowerCase();
  if (!EMAIL_REGEX.test(cleaned)) return null;

  const domain = cleaned.split('@')[1];
  if (!domain || BLOCKED_EMAIL_DOMAINS.has(domain)) return null;
  if (cleaned.startsWith('noreply@') || cleaned.startsWith('no-reply@') || cleaned.startsWith('donotreply@')) {
    return null;
  }

  return cleaned;
}

export function normalizePhone(rawPhone?: string | null, _country?: string | null): string | null {
  if (!rawPhone || typeof rawPhone !== 'string') return null;
  const trimmed = rawPhone.trim();
  if (!trimmed) return null;

  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) return null;

  return hasPlus ? `+${digits}` : digits;
}

export function normalizeBusinessName(name?: string | null): string {
  if (!name || typeof name !== 'string') return 'Discovered Business';
  let cleaned = name.trim();
  // Remove common generic company suffixes for matching
  cleaned = cleaned.replace(/\s+(ltd|limited|inc|incorporated|llc|pty|pty ltd|gmbh|sa|corp|corporation)\.?$/i, '');
  // Normalize whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  return cleaned || 'Discovered Business';
}

export function cleanSocialUrl(url?: string | null): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) return null;
  try {
    const parsed = new URL(trimmed);
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return null;
  }
}
