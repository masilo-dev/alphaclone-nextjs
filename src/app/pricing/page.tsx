import type { Metadata } from 'next';
import PricingPageContent from './PricingPageContent';

export const metadata: Metadata = {
    title: 'Pricing | AlphaClone Business OS from $15/month',
    description: 'AlphaClone\'s Unified Business OS starts at $15/month with CRM, finance, contracts, meetings, social workflows, and AI-assisted operations in one workspace.',
    keywords: [
        'AlphaClone pricing',
        'Business OS pricing',
        'reduce SaaS tool sprawl',
        'affordable AI business platform',
        'unified business software pricing',
        'HubSpot QuickBooks Zoom alternative',
        'AI growth agent pricing',
    ],
    alternates: { canonical: 'https://alphaclonesystems.com/pricing' },
    openGraph: {
        title: 'Pricing | AlphaClone Business OS — From $15/month',
        description: 'One unified AI Business OS starting at $15/month. 14-day free trial, no credit card required.',
        url: 'https://alphaclonesystems.com/pricing',
        type: 'website',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Pricing | AlphaClone Business OS — From $15/month',
        description: 'One unified AI Business OS from $15/month. CRM, finance, contracts, meetings, and AI-assisted workflows with a 14-day free trial.',
    },
    robots: { index: true, follow: true },
};

export default function Page() {
    return <PricingPageContent />;
}
