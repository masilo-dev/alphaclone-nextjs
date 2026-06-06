import { SITE_URL, absoluteUrl } from '@/lib/siteUrl';

export const SOCIAL_PROFILES = {
  linkedin: 'https://www.linkedin.com/company/alphaclone-systems',
  twitter: 'https://twitter.com/AlphaCloneSys',
  x: 'https://x.com/AlphaCloneSys',
} as const;

/** Verified external profiles — used in Organization schema sameAs for entity linking. */
export const SAME_AS_URLS = [SOCIAL_PROFILES.linkedin, SOCIAL_PROFILES.twitter] as const;

/** Primary marketing routes Google uses for sitelink and navigation signals. */
export const PRIMARY_SITE_NAV = [
  { name: 'About', path: '/about' },
  { name: 'Services', path: '/services' },
  { name: 'Pricing', path: '/pricing' },
  { name: 'Lead Management', path: '/lead-management' },
  { name: 'CRM', path: '/crm' },
  { name: 'AI Agents', path: '/ai-agents' },
  { name: 'Documentation', path: '/docs' },
  { name: 'Blog', path: '/blog' },
  { name: 'Contact', path: '/contact' },
] as const;

export function buildSiteNavigationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'AlphaClone Systems Site Navigation',
    itemListElement: PRIMARY_SITE_NAV.map((item, index) => ({
      '@type': 'SiteNavigationElement',
      position: index + 1,
      name: item.name,
      url: absoluteUrl(item.path),
    })),
  };
}

export function buildOrganizationEntitySchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'AlphaClone Systems',
    alternateName: ['Alphaclone', 'AlphaClone'],
    url: SITE_URL,
    logo: `${SITE_URL}/logo.png`,
    description:
      'Unified AI business operating system with CRM, lead management, invoicing, contracts, meetings, and automation.',
    sameAs: [...SAME_AS_URLS],
    contactPoint: [
      {
        '@type': 'ContactPoint',
        contactType: 'sales',
        email: 'sales@alphaclonesystems.com',
      },
      {
        '@type': 'ContactPoint',
        contactType: 'customer support',
        email: 'support@alphaclonesystems.com',
      },
    ],
  };
}
