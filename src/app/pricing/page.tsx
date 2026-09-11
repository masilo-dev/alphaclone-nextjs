import type { Metadata } from 'next';
import MarketingLandingShell from '@/components/landing/MarketingLandingShell';
import PricingPage from '@/components/marketing/system/PricingPage';
import { PRICING_FROM } from '@/config/pricingPlans';
import { absoluteUrl } from '@/lib/siteUrl';

export const metadata: Metadata = {
  title: `Pricing | AlphaClone Plans from $${PRICING_FROM}/month`,
  description:
    'AlphaClone pricing for connected CRM, projects, contracts, billing context, meetings, and workflow automation in one business workspace.',
  keywords: [
    'AlphaClone pricing',
    'business workspace pricing',
    'CRM pricing',
    'project management pricing',
    'AI business automation pricing',
  ],
  alternates: { canonical: absoluteUrl('/pricing') },
  openGraph: {
    images: [{ url: '/opengraph-image', width: 1200, height: 630 }],
    title: `Pricing | AlphaClone Plans from $${PRICING_FROM}/month`,
    description:
      'Compare AlphaClone Free, Pro, and Premium plans for a connected business workspace.',
    url: absoluteUrl('/pricing'),
    type: 'website',
  },
  twitter: {
    images: ['/twitter-image'],
    card: 'summary_large_image',
    title: `Pricing | AlphaClone Plans from $${PRICING_FROM}/month`,
    description:
      'Compare AlphaClone plans for CRM, projects, contracts, meetings, and workflow automation.',
  },
  robots: { index: true, follow: true },
};

export default function Page() {
  return (
    <MarketingLandingShell>
      <PricingPage />
    </MarketingLandingShell>
  );
}
