import type { Metadata } from 'next';
import MarketingLandingShell from '@/components/landing/MarketingLandingShell';
import PricingPage from '@/components/marketing/system/PricingPage';
import { PRICING_FROM } from '@/config/pricingPlans';
import { absoluteUrl } from '@/lib/siteUrl';

export const metadata: Metadata = {
<<<<<<< HEAD
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
      'Compare AlphaClone Starter, Pro, and Enterprise plans for a connected business workspace.',
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
=======
    title: 'Pricing | AlphaClone Business OS — End SaaS Bloat from $15/month',
    description: 'Stop paying $330+/month for fragmented SaaS tools. AlphaClone\'s Unified Business OS starts at $15/month. One AI-powered platform: Autonomous Growth, Unified CRM, Mission Control, Revenue Center, and more.',
    keywords: [
        'AlphaClone pricing',
        'Business OS pricing',
        'end SaaS bloat cost',
        'affordable AI business platform',
        'unified business software pricing',
        'replace HubSpot QuickBooks Zoom cost',
        'AI growth agent pricing',
    ],
    alternates: { canonical: 'https://alphaclonesystems.com/pricing' },
    openGraph: {
        title: 'Pricing | AlphaClone Business OS — From $15/month',
        description: 'End SaaS bloat. One unified AI Business OS starting at $15/month. 14-day free trial, no credit card required.',
        url: 'https://alphaclonesystems.com/pricing',
        type: 'website',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Pricing | AlphaClone Business OS — From $15/month',
        description: 'One unified AI Business OS from $15/month. Replace $330+/month in SaaS tools. 14-day free trial.',
    },
    robots: { index: true, follow: true },
>>>>>>> origin/main
};

export default function Page() {
  return (
    <MarketingLandingShell>
      <PricingPage />
    </MarketingLandingShell>
  );
}
