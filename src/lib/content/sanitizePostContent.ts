/**
 * Sanitize social post content — Bonnie v2.0 post sanitizer.
 * @see src/lib/bonnie/bonnieBannedLanguage.ts
 */

import { sanitizePost, stripBonnieEmoji } from '@/lib/bonnie/bonnieBannedLanguage';

const URL_RE = /https?:\/\/[^\s]+/gi;

export function sanitizePostContent(content: string): string {
  return sanitizePost(content).clean;
}

/** Ensure link_url appears as a clean line at the end, not buried mid-caption. */
export function appendCleanCtaLink(content: string, linkUrl?: string | null): string {
  const base = sanitizePostContent(content);
  const link = String(linkUrl || '').trim();
  if (!link) return base;

  const withoutEmbedded = base.replace(URL_RE, '').trim();
  if (withoutEmbedded.endsWith(link)) return withoutEmbedded;
  return `${withoutEmbedded}\n\n${link}`;
}

export function postHasCta(content: string, linkUrl?: string | null): boolean {
  if (String(linkUrl || '').trim()) return true;
  return URL_RE.test(String(content || ''));
}

export type SanitizedPostResult = {
  content: string;
  has_cta: boolean;
  warning?: string;
  warnings?: string[];
};

export function prepareSocialPostContent(
  content: string,
  linkUrl?: string | null
): SanitizedPostResult {
  const stripped = stripBonnieEmoji(String(content || ''));
  const prepared = appendCleanCtaLink(stripped, linkUrl);
  const { clean, warnings } = sanitizePost(prepared);
  const has_cta = postHasCta(clean, linkUrl);
  const ctaWarning = has_cta ? undefined : 'Post has no CTA or link';
  const allWarnings = [...warnings, ...(ctaWarning ? [ctaWarning] : [])];

  return {
    content: clean,
    has_cta,
    ...(ctaWarning ? { warning: ctaWarning } : {}),
    ...(allWarnings.length ? { warnings: allWarnings } : {}),
  };
}
