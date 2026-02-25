import type { Metadata } from 'next';
import PricingPageContent from './PricingPageContent';

export const metadata: Metadata = {
    title: 'Pricing | AlphaClone Business OS — Plans from $15/month',
    description: 'AlphaClone pricing plans: Starter ($15/mo), Professional ($45/mo), Enterprise ($80/mo). All plans include a 14-day free trial. Replace $330+/month of separate SaaS subscriptions with one all-in-one Business OS.',
    keywords: ['AlphaClone pricing', 'business OS pricing', 'CRM software pricing', 'affordable business software', 'SaaS alternative pricing', 'AI business platform cost'],
    alternates: { canonical: 'https://alphaclone.tech/pricing' },
    openGraph: {
        title: 'Pricing | AlphaClone Business OS — From $15/month',
        description: 'Replace $330+/month of separate tools with one AlphaClone plan. 14-day free trial, no credit card required.',
        url: 'https://alphaclone.tech/pricing',
        type: 'website',
    },
    robots: { index: true, follow: true },
};

export default function Page() {
    return <PricingPageContent />;
}
