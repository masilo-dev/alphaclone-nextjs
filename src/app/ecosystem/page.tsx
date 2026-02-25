import type { Metadata } from 'next';
import EcosystemPage from '@/components/pages/EcosystemPage';

export const metadata: Metadata = {
    title: 'AlphaClone Ecosystem | Business OS Platform, Integrations & Digital Services',
    description: "Discover the AlphaClone ecosystem — an all-in-one AI-powered Business OS integrating CRM, invoicing, video meetings, contracts, task management, and growth automation into one platform. Explore what is inside.",
    keywords: ['AlphaClone ecosystem', 'business OS integrations', 'CRM ecosystem', 'AI business platform', 'all-in-one business software', 'AlphaClone platform overview'],
    alternates: { canonical: 'https://alphaclone.tech/ecosystem' },
    openGraph: {
        title: 'AlphaClone Ecosystem | Business OS Platform & Integrations',
        description: 'Explore the full AlphaClone ecosystem — 9 integrated tools replacing $330/month of separate SaaS subscriptions.',
        url: 'https://alphaclone.tech/ecosystem',
        type: 'website',
    },
    robots: { index: true, follow: true },
};

export default function Page() {
    return <EcosystemPage />;
}
