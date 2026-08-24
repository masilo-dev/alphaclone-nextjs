/** Marketing CTA destinations — single source of truth. */

import { DEFAULT_CALENDLY_URL } from '@/lib/marketing/booking';

export const LOGIN_HREF = '/auth/login';

export const TRIAL_HREF =
  '/auth/login?register=true&type=business&plan=starter';

/** @deprecated Use TRIAL_HREF — kept for existing imports */
export const BUSINESS_SIGNUP_HREF = TRIAL_HREF;

/**
 * External AlphaClone Systems public demo booking URL.
 * Central source of truth for ALL public "Book Demo" / "Book a Demo" /
 * "Schedule Demo" CTAs on the marketing site. Pointing to the external
 * calendar avoids broken internal modals and ensures a reliable direct
 * booking journey for visitors.
 */
export const PUBLIC_DEMO_BOOKING_URL: string =
  process.env.NEXT_PUBLIC_DEMO_BOOKING_URL?.trim() ||
  process.env.NEXT_PUBLIC_CALENDLY_URL?.trim() ||
  DEFAULT_CALENDLY_URL;

/**
 * Internal marketing route: /book-demo page embeds the same calendar and
 * adds more product context. Marketing CTAs should prefer the external link,
 * but DEMO_HREF is retained for any existing deep links that rely on the
 * in-app route.
 */
export const DEMO_HREF_INTERNAL = '/book-demo';

/**
 * Public demo CTA destination. Opens the external Calendly page directly.
 * Used by Primary/Secondary CTAs, nav, pricing, footer, and all other
 * public marketing surfaces.
 */
export const DEMO_HREF = PUBLIC_DEMO_BOOKING_URL;

export const CTA_LABELS = {
  primary: 'Start for $15/month',
  secondary: 'Book a demo',
  tertiaryLogin: 'Log in',
  pricing: 'See pricing',
  features: 'Explore the platform',
  guide: 'Read the guide',
} as const;

export function trialHrefForPlan(plan: 'starter' | 'pro' | 'enterprise'): string {
  return `/auth/login?register=true&type=business&plan=${plan}`;
}

const PRESERVE_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'gclid',
  'fbclid',
  'ref',
] as const;

/** Merge marketing attribution query params into a destination URL. */
export function withPreservedQuery(href: string, currentSearch = ''): string {
  if (!href) return href;
  if (!currentSearch || currentSearch === '?') return href;

  const incoming = new URLSearchParams(
    currentSearch.startsWith('?') ? currentSearch.slice(1) : currentSearch
  );
  const isExternal = /^https?:\/\//i.test(href);
  const base = isExternal ? href : 'https://alphaclonesystems.com';
  const url = new URL(href, base);

  for (const key of PRESERVE_KEYS) {
    const value = incoming.get(key);
    if (value && !url.searchParams.has(key)) {
      url.searchParams.set(key, value);
    }
  }

  if (isExternal) {
    return url.toString();
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

/** Returns true if the URL is an external http(s) link. */
export function isExternalHref(href: string | null | undefined): boolean {
  if (!href) return false;
  return /^https?:\/\//i.test(href.trim());
}

