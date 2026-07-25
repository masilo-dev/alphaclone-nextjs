/** Marketing CTA destinations — single source of truth. */

export const LOGIN_HREF = '/auth/login';

export const TRIAL_HREF =
  '/auth/login?register=true&type=business&plan=starter';

/** @deprecated Use TRIAL_HREF — kept for existing imports */
export const BUSINESS_SIGNUP_HREF = TRIAL_HREF;

export const DEMO_HREF = '/book-demo';

export const CTA_LABELS = {
  primary: 'Start free for 14 days',
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
  if (!currentSearch || currentSearch === '?') return href;

  const incoming = new URLSearchParams(
    currentSearch.startsWith('?') ? currentSearch.slice(1) : currentSearch
  );
  const url = new URL(href, 'https://alphaclonesystems.com');

  for (const key of PRESERVE_KEYS) {
    const value = incoming.get(key);
    if (value && !url.searchParams.has(key)) {
      url.searchParams.set(key, value);
    }
  }

  return `${url.pathname}${url.search}${url.hash}`;
}
