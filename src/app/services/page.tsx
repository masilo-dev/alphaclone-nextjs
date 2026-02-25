import type { Metadata } from 'next';
import ServicesPage from '@/components/pages/ServicesPage';

export const metadata: Metadata = {
    title: 'AI-Powered Business Services | CRM, Finance, Automation & More',
    description: 'AlphaClone Systems offers AI-powered business services including enterprise CRM, automated invoicing, AI sales agents, contract generation, video meetings, and financial accounting — all in one platform. Replace 10+ tools with one subscription.',
    keywords: [
        'AI business services', 'enterprise CRM software', 'AI sales automation', 'business operating system',
        'contract generation software', 'automated invoicing', 'AI growth agent', 'small business software',
        'all-in-one business platform', 'replace HubSpot QuickBooks Zoom', 'business management software',
        'AI-powered CRM', 'financial management software', 'client management system',
    ],
    alternates: { canonical: 'https://alphaclone.tech/services' },
    openGraph: {
        title: 'AI-Powered Business Services | AlphaClone Systems',
        description: 'From AI-driven lead generation to automated invoicing and contract management — AlphaClone replaces your entire SaaS stack. Starting at $15/month.',
        url: 'https://alphaclone.tech/services',
        type: 'website',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'AI-Powered Business Services | AlphaClone Systems',
        description: 'CRM, AI sales agent, invoicing, contracts, video meetings, accounting — one platform. Starting at $15/month.',
    },
};

const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
        {
            '@type': 'Question',
            name: 'What services does AlphaClone Systems offer?',
            acceptedAnswer: {
                '@type': 'Answer',
                text: 'AlphaClone Systems offers a full suite of AI-powered business services including enterprise CRM, AI-automated lead generation, professional invoicing, contract drafting and e-signatures, HD video meetings, Gmail integration, financial accounting, task and project management, and document management — all in a single unified platform.',
            },
        },
        {
            '@type': 'Question',
            name: 'How does the AI Growth Agent work?',
            acceptedAnswer: {
                '@type': 'Answer',
                text: 'The AlphaClone AI Growth Agent automatically discovers leads in your target industry, qualifies them through AI-powered chat, and manages initial outreach — so you can focus on closing deals. No sales team required. It runs 24/7 in the background while you run your business.',
            },
        },
        {
            '@type': 'Question',
            name: 'Can AlphaClone replace QuickBooks for invoicing and accounting?',
            acceptedAnswer: {
                '@type': 'Answer',
                text: 'Yes. AlphaClone includes a full accounting suite with chart of accounts, journal entries, P&L statements, balance sheets, and professional invoice generation with payment tracking. Most small businesses can completely replace QuickBooks with AlphaClone\'s financial module.',
            },
        },
        {
            '@type': 'Question',
            name: 'Does AlphaClone do video meetings and calls?',
            acceptedAnswer: {
                '@type': 'Answer',
                text: 'Yes. AlphaClone has a built-in HD video conferencing platform so you can meet with clients, team members, and prospects without needing Zoom or Google Meet. Video calls are linked directly to your CRM records.',
            },
        },
        {
            '@type': 'Question',
            name: 'Can I manage contracts and get e-signatures through AlphaClone?',
            acceptedAnswer: {
                '@type': 'Answer',
                text: 'Yes. AlphaClone\'s Contract Engine uses AI to assist in drafting professional business contracts, NDAs, service agreements, and proposals. Clients can then sign them electronically without needing DocuSign or a lawyer for standard contracts.',
            },
        },
        {
            '@type': 'Question',
            name: 'How much does AlphaClone cost?',
            acceptedAnswer: {
                '@type': 'Answer',
                text: 'AlphaClone starts at $15/month for the Starter plan (up to 3 users), $45/month for Pro (up to 10 users, full AI Growth Agent), and $80/month for Enterprise (unlimited users, priority support, custom integrations). Most businesses save $200-500/month by switching from multiple tools.',
            },
        },
    ],
};

const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://alphaclone.tech' },
        { '@type': 'ListItem', position: 2, name: 'Services', item: 'https://alphaclone.tech/services' },
    ],
};

export default function Page() {
    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
            />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
            />
            <ServicesPage />
        </>
    );
}
