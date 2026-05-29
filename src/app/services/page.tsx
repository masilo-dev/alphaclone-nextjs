import type { Metadata } from 'next';
import ServicesPage from '@/components/pages/ServicesPage';

export const metadata: Metadata = {
    title: 'Operating System | Unified AI Business OS for Service Teams',
    description: 'AlphaClone is the business operating system for service teams: CRM, invoicing, contracts, meetings, accounting, and AI workflows in one backbone.',
    keywords: [
        'AI business operating system',
        'reduce SaaS tool sprawl',
        'AI Growth Agent',
        'Unified CRM intelligence',
        'Mission Control software',
        'Agreement Lifecycle management',
        'Revenue automation',
        'AI-powered business platform',
        'operational excellence software',
        'unified business operations platform',
        'business operating system software',
        'Data Sovereignty',
    ],
    alternates: { canonical: 'https://alphaclonesystems.com/services' },
    openGraph: {
        title: 'Operating System | AlphaClone Unified AI Business OS',
        description: 'Run AI sales workflows, CRM, projects, invoicing, contracts, and meetings from one operating backbone.',
        url: 'https://alphaclonesystems.com/services',
        type: 'website',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Operating System | AlphaClone Unified AI Business OS',
        description: 'One workspace for AI sales workflows, CRM, projects, invoicing, contracts, and meetings. Starting at $15/month.',
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
                text: 'The AlphaClone AI Growth Agent helps discover leads from public sources, supports qualification workflows, and prepares outreach for review and follow-up inside your CRM.',
            },
        },
        {
            '@type': 'Question',
            name: 'Can AlphaClone replace QuickBooks for invoicing and accounting?',
            acceptedAnswer: {
                '@type': 'Answer',
                text: 'AlphaClone includes invoice generation, payment tracking, chart of accounts, journal entries, P&L statements, balance sheets, and related financial workflows. Businesses should confirm their accounting and tax requirements before replacing dedicated accounting software.',
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
                text: 'Yes. AlphaClone\'s Contract Engine uses AI to assist with contract, NDA, service agreement, and proposal drafts. Clients can sign electronically, and teams should review legal documents before sending.',
            },
        },
        {
            '@type': 'Question',
            name: 'How much does AlphaClone cost?',
            acceptedAnswer: {
                '@type': 'Answer',
                text: 'AlphaClone starts at $15/month for Starter and has a Pro Video plan for teams that need integrated video meetings. Current plan details are shown on the pricing section of the site.',
            },
        },
    ],
};

const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://alphaclonesystems.com' },
        { '@type': 'ListItem', position: 2, name: 'Services', item: 'https://alphaclonesystems.com/services' },
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
