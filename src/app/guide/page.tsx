import type { Metadata } from 'next';
import PlatformGuide from '@/components/pages/PlatformGuide';

export const metadata: Metadata = {
    title: 'Platform Guide & Onboarding | How to Set Up AlphaClone in 30 Minutes',
    description: 'Complete onboarding guide for AlphaClone Business OS. Step-by-step setup from account creation to your first AI lead campaign — including Gmail, Calendly, CRM, invoicing, and team setup. No technical knowledge required.',
    keywords: [
        'AlphaClone setup guide', 'how to set up business software', 'CRM onboarding tutorial',
        'business OS setup', 'AI sales agent setup', 'Gmail integration guide', 'Calendly integration',
        'how to use AlphaClone', 'business software tutorial', 'onboarding guide', 'getting started with AlphaClone',
        'small business software setup', 'AI business platform tutorial',
    ],
    alternates: { canonical: 'https://alphaclone.tech/guide' },
    openGraph: {
        title: 'Platform Guide & Onboarding | AlphaClone Systems',
        description: 'Set up your entire business OS in under 30 minutes. Step-by-step guide for CRM, invoicing, AI growth agent, Gmail, Calendly, and team management.',
        url: 'https://alphaclone.tech/guide',
        type: 'article',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Platform Guide & Onboarding | AlphaClone Systems',
        description: 'Complete setup guide — from account creation to your first AI lead campaign. No tech knowledge needed.',
    },
};

const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://alphaclone.tech' },
        { '@type': 'ListItem', position: 2, name: 'Guide', item: 'https://alphaclone.tech/guide' },
    ],
};

const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
        {
            '@type': 'Question',
            name: 'How long does it take to set up AlphaClone?',
            acceptedAnswer: {
                '@type': 'Answer',
                text: 'Most users complete their full AlphaClone setup — including workspace configuration, Gmail connection, CRM import, and first invoice — in under 30 minutes. The AI Growth Agent can be activated with a single button click after initial setup.',
            },
        },
        {
            '@type': 'Question',
            name: 'Do I need technical knowledge to set up AlphaClone?',
            acceptedAnswer: {
                '@type': 'Answer',
                text: 'No. AlphaClone is specifically designed for non-technical business owners. The setup wizard guides you through every step with plain-language instructions. If you can set up a Gmail account, you can set up AlphaClone.',
            },
        },
        {
            '@type': 'Question',
            name: 'How do I connect Gmail to AlphaClone?',
            acceptedAnswer: {
                '@type': 'Answer',
                text: 'Go to Settings → Gmail Integration and click "Connect Google Account." You\'ll be redirected to a standard Google OAuth screen where you authorize AlphaClone to read and send emails on your behalf. The connection takes under 60 seconds.',
            },
        },
        {
            '@type': 'Question',
            name: 'How do I connect my Calendly booking page?',
            acceptedAnswer: {
                '@type': 'Answer',
                text: 'Navigate to Settings → Calendly Integration. You can either paste your Calendly URL for a quick setup, or connect via OAuth for full two-way appointment syncing directly to your AlphaClone dashboard calendar.',
            },
        },
        {
            '@type': 'Question',
            name: 'Can I import my existing clients into AlphaClone CRM?',
            acceptedAnswer: {
                '@type': 'Answer',
                text: 'Yes. AlphaClone supports CSV import from any existing CRM, spreadsheet, or contact list. Go to CRM → Import Contacts, upload your CSV file, and map your columns to AlphaClone fields. The import typically takes under 2 minutes for up to 1,000 contacts.',
            },
        },
        {
            '@type': 'Question',
            name: 'How do I activate the AI Growth Agent?',
            acceptedAnswer: {
                '@type': 'Answer',
                text: 'Navigate to the Growth Agent tab in your dashboard. Click "Scrape Leads," enter your target industry or niche, and the AI will automatically find leads from public business directories. Then enable AI Outreach to let the agent begin qualifying conversations automatically.',
            },
        },
    ],
};

export default function Page() {
    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
            />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
            />
            <PlatformGuide />
        </>
    );
}
