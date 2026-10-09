import { normalizePhoneNumber, type PhoneContext } from '@/lib/phone/phoneNormalizer';

const LEGAL_SUFFIXES = /\b(inc|incorporated|llc|ltd|limited|corp|corporation|co|company|plc|gmbh|sa|bv|ag)\.?$/i;

/** Trim and lowercase email; returns null when invalid or empty. */
export function normalizeEmail(email: unknown): string | null {
  if (email == null) return null;
  const trimmed = String(email).trim().toLowerCase();
  if (!trimmed) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return null;
  return trimmed;
}

/** Normalize phone to E.164 when possible using country-aware normalizer. */
export function normalizePhone(phone: unknown, context?: PhoneContext | null): string | null {
  const result = normalizePhoneNumber(phone, context);
  return result.e164 || (result.isValid ? result.phone : null);
}

/** Collapse whitespace and strip common legal suffixes for company matching. */
export function normalizeCompanyName(name: unknown): string | null {
  if (name == null) return null;
  let value = String(name).trim().replace(/\s+/g, ' ');
  if (!value) return null;
  value = value.replace(LEGAL_SUFFIXES, '').trim();
  return value.toLowerCase() || null;
}

/** Extract hostname from website URL (no www, no path). */
export function normalizeDomain(website: unknown): string | null {
  if (website == null) return null;
  const raw = String(website).trim();
  if (!raw) return null;
  try {
    const normalized = raw.startsWith('http://') || raw.startsWith('https://') ? raw : `https://${raw}`;
    const host = new URL(normalized).hostname.replace(/^www\./i, '').toLowerCase();
    return host || null;
  } catch {
    const stripped = raw.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0]?.toLowerCase();
    return stripped || null;
  }
}

export function normalizeExternalAccountId(value: unknown): string | null {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed || null;
}

export function normalizeContactName(name: unknown): string | null {
  if (name == null) return null;
  const trimmed = String(name).trim().replace(/\s+/g, ' ');
  return trimmed || null;
}

/** Build alternate phone lookup keys (digits-only, E.164, local national variants). */
export function phoneLookupVariants(phone: unknown, context?: PhoneContext | null): string[] {
  const result = normalizePhoneNumber(phone, context);
  const variants = new Set<string>();
  const raw = String(phone || '').trim();
  if (raw) variants.add(raw);

  if (result.e164) {
    variants.add(result.e164);
    const digits = result.e164.replace(/\D/g, '');
    if (digits) variants.add(digits);
    if (result.national) {
      variants.add(result.national.trim());
      const natDigits = result.national.replace(/\D/g, '');
      if (natDigits) {
        variants.add(natDigits);
        if (!natDigits.startsWith('0')) variants.add(`0${natDigits}`);
      }
    }
  } else {
    const digits = raw.replace(/\D/g, '');
    if (digits) {
      variants.add(digits);
      if (digits.length === 11 && digits.startsWith('1')) variants.add(`+${digits}`);
      if (digits.length === 10 && (context?.countryCode === 'US' || context?.countryCode === 'CA')) {
        variants.add(`+1${digits}`);
      }
    }
  }
  return Array.from(variants);
}

