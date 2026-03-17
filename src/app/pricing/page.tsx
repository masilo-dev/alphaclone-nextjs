import type { Metadata } from 'next';
import PricingPageContent from './PricingPageContent';

export const metadata: Metadata = {
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
    alternates: { canonical: 'https://alphaclone.tech/pricing' },
    openGraph: {
        title: 'Pricing | AlphaClone Business OS — From $15/month',
        description: 'End SaaS bloat. One unified AI Business OS starting at $15/month. 14-day free trial, no credit card required.',
        url: 'https://alphaclone.tech/pricing',
        type: 'website',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Pricing | AlphaClone Business OS — From $15/month',
        description: 'One unified AI Business OS from $15/month. Replace $330+/month in SaaS tools. 14-day free trial.',
    },
    robots: { index: true, follow: true },
};

export default function Page() {
    return <PricingPageContent />;
}
