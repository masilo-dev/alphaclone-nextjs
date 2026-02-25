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

// FAQPage JSON-LD for pricing questions that appear in AI search
const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
        {
            '@type': 'Question',
            name: 'How much does AlphaClone cost?',
            acceptedAnswer: {
                '@type': 'Answer',
                text: 'AlphaClone offers three plans: Starter at $15/month (up to 5 users), Professional at $45/month (up to 25 users, includes AI Growth Agent), and Enterprise at $80/month (unlimited users, white-label, dedicated support). All plans include a 14-day free trial with no credit card required.',
            },
        },
        {
            '@type': 'Question',
            name: 'Is there a free trial for AlphaClone?',
            acceptedAnswer: {
                '@type': 'Answer',
                text: 'Yes. All AlphaClone plans include a 14-day free trial with full access to all features in that plan. No credit card is required to start. After the trial ends, you choose a plan or your account is paused.',
            },
        },
        {
            '@type': 'Question',
            name: 'What is included in the AlphaClone Professional plan?',
            acceptedAnswer: {
                '@type': 'Answer',
                text: 'The Professional plan ($45/month) includes: up to 25 users, unlimited CRM pipelines, AI Growth Agent for automated outreach, Gmail integration, Calendly integration, HD video meetings, invoicing and financial suite, contract engine, document hub, task management, and priority support.',
            },
        },
        {
            '@type': 'Question',
            name: 'Can I cancel AlphaClone at any time?',
            acceptedAnswer: {
                '@type': 'Answer',
                text: 'Yes. You can cancel at any time from Settings → Billing. Cancellation takes effect at the end of the current billing period. Your data is retained for 90 days after cancellation so you can export or reactivate.',
            },
        },
        {
            '@type': 'Question',
            name: 'Does AlphaClone replace tools like HubSpot, Zoom, DocuSign, and QuickBooks?',
            acceptedAnswer: {
                '@type': 'Answer',
                text: 'Yes. AlphaClone is designed to replace the combination of HubSpot (CRM), Zoom (video meetings), DocuSign (contracts), QuickBooks (financial management), Mailchimp (email), and several other tools — all for a fraction of the combined cost.',
            },
        },
    ],
};

const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://alphaclone.tech' },
        { '@type': 'ListItem', position: 2, name: 'Pricing', item: 'https://alphaclone.tech/pricing' },
    ],
};

export default function Page() {
    return (
        <>
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
            <PricingPageContent />
        </>
    );
}
