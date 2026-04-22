import type { Metadata } from 'next';
import EcosystemPage from '@/components/pages/EcosystemPage';

export const metadata: Metadata = {
    title: 'The AlphaClone Ecosystem | One Unified Business OS Architecture',
    description: 'Explore the AlphaClone Business OS ecosystem. Nine integrated modules — Autonomous Growth, Unified CRM, Mission Control, Revenue Center, Agreement Lifecycle, and more — operating as one high-performance architecture. No SaaS bloat. One platform.',
    keywords: [
        'AlphaClone ecosystem',
        'unified business OS architecture',
        'AI business platform modules',
        'SaaS consolidation platform',
        'Autonomous Growth Agent',
        'Mission Control software',
        'Unified CRM Intelligence',
        'revenue operations platform',
    ],
    alternates: { canonical: 'https://alphaclonesystems.com/ecosystem' },
    openGraph: {
        title: 'The AlphaClone Ecosystem | Unified Business OS Architecture',
        description: 'Nine integrated modules. One unified Business OS. No SaaS bloat. Explore the full AlphaClone architecture.',
        url: 'https://alphaclonesystems.com/ecosystem',
        type: 'website',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'The AlphaClone Ecosystem | Unified Business OS',
        description: 'Nine integrated modules. One unified platform. Explore the full AlphaClone Business OS architecture.',
    },
    robots: { index: true, follow: true },
};

export default function Page() {
    return <EcosystemPage />;
}
