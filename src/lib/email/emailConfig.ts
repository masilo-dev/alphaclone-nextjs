import { absoluteUrl, publicEmailUrl, resolvePublicHttpsOrigin, isAbsoluteHttpsUrl } from '@/lib/siteUrl';

/** Permanent public path for the official AlphaClone email logo (PNG, under 10KB). */
export const EMAIL_LOGO_PATH = '/email-assets/alphaclone-email-logo.png';

/** Last verified production logo URL — used when live validation is temporarily unavailable. */
export const VERIFIED_EMAIL_LOGO_URL =
  'https://alphaclonesystems.com/email-assets/alphaclone-email-logo.png';

export const EMAIL_BRAND_HOME_URL = 'https://alphaclonesystems.com';

export const EMAIL_DESIGN = {
  pageBackground: '#F3F6F8',
  cardBackground: '#FFFFFF',
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#64748B',
  accent: '#0F766E',
  accentBright: '#14B8A6',
  border: '#E2E8F0',
  footerBackground: '#F8FAFC',
  maxWidth: 620,
  logoDisplayWidth: 72,
  fontStack: 'Arial,Helvetica,sans-serif',
} as const;

export function resolveEmailLogoUrl(): string {
  const fromEnv = String(process.env.EMAIL_LOGO_URL || process.env.NEXT_PUBLIC_EMAIL_LOGO_URL || '').trim();
  if (fromEnv && isAbsoluteHttpsUrl(fromEnv)) return fromEnv;
  return absoluteUrl(EMAIL_LOGO_PATH);
}

export { isAbsoluteHttpsUrl } from '@/lib/siteUrl';

export type EmailLogoValidationResult = {
  ok: boolean;
  url: string;
  status?: number;
  contentType?: string;
  error?: string;
};

/** Validates that the configured logo URL is publicly reachable and returns an image. */
export async function validateEmailLogoUrl(url?: string): Promise<EmailLogoValidationResult> {
  const target = url || resolveEmailLogoUrl();
  if (!isAbsoluteHttpsUrl(target)) {
    return { ok: false, url: target, error: 'Logo URL must be absolute HTTPS' };
  }
  if (/localhost|127\.0\.0\.1|placeholder|via\.placeholder/i.test(target)) {
    return { ok: false, url: target, error: 'Logo URL must not be local or placeholder' };
  }

  try {
    const response = await fetch(target, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(12_000),
      headers: { Accept: 'image/*' },
    });
    const contentType = response.headers.get('content-type') || '';
    const bodySnippet = (await response.text()).slice(0, 200).toLowerCase();

    if (!response.ok) {
      return { ok: false, url: target, status: response.status, contentType, error: `HTTP ${response.status}` };
    }
    if (!contentType.startsWith('image/')) {
      return { ok: false, url: target, status: response.status, contentType, error: 'Response is not an image' };
    }
    if (bodySnippet.includes('<!doctype html') || bodySnippet.includes('<html')) {
      return { ok: false, url: target, status: response.status, contentType, error: 'Response appears to be HTML, not an image' };
    }
    return { ok: true, url: target, status: response.status, contentType };
  } catch (err: unknown) {
    return {
      ok: false,
      url: target,
      error: err instanceof Error ? err.message : 'Logo validation failed',
    };
  }
}

export function getLegalUrls() {
  const origin = resolvePublicHttpsOrigin();
  return {
    privacy: `${origin}/privacy-policy`,
    terms: `${origin}/terms-of-service`,
    preferences: publicEmailUrl('/preferences/email'),
    privacyRequest: publicEmailUrl('/legal/data-request'),
    website: EMAIL_BRAND_HOME_URL,
  };
}
