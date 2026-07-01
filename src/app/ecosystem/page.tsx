import type { Metadata } from 'next';
import EcosystemPage from '@/components/pages/EcosystemPage';

export const metadata: Metadata = {
    title: 'The AlphaClone Ecosystem | One Unified Business OS Architecture',
    description: 'Explore the AlphaClone Business OS ecosystem. Integrated modules for CRM, operations, revenue workflows, agreements, meetings, and analytics in one platform.',
    keywords: [
        'AlphaClone ecosystem',
        'unified business OS architecture',
        'AI business platform modules',
        'SaaS consolidation platform',
        'AI Growth Agent',
        'Mission Control software',
        'Unified CRM Intelligence',
        'revenue operations platform',
    ],
    alternates: { canonical: 'https://alphaclonesystems.com/ecosystem' },
    openGraph: { images: [{ url: '/opengraph-image', width: 1200, height: 630 }],
        title: 'The AlphaClone Ecosystem | Unified Business OS Architecture',
        description: 'Integrated modules for CRM, operations, revenue workflows, agreements, meetings, and analytics in one AlphaClone workspace.',
        url: 'https://alphaclonesystems.com/ecosystem',
        type: 'website',
    },
    twitter: { images: ['/twitter-image'],
        card: 'summary_large_image',
        title: 'The AlphaClone Ecosystem | Unified Business OS',
        description: 'Nine integrated modules. One unified platform. Explore the full AlphaClone Business OS architecture.',
    },
    robots: { index: true, follow: true },
};

export default function Page() {
    return <EcosystemPage />;
}
