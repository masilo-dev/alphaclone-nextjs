import type { Metadata } from 'next';
import WhoWeServeContent from './WhoWeServeContent';

export const metadata: Metadata = {
    title: 'Who We Serve | AlphaClone Business OS for High-Performance Teams',
    description: 'AlphaClone\'s Unified Business OS eliminates operational friction for growing agencies, startups, consultants, and remote teams. One high-performance architecture replaces the chaos of fragmented SaaS tools.',
    keywords: [
        'AlphaClone for agencies',
        'Business OS for startups',
        'consulting firm software',
        'remote team operations platform',
        'AI CRM for growing teams',
        'SaaS alternative for small business',
        'unified platform for consultants',
    ],
    alternates: { canonical: 'https://alphaclonesystems.com/who-we-serve' },
    openGraph: {
        title: 'Who AlphaClone Serves | Unified Business OS for High-Performance Teams',
        description: 'Agencies, startups, consultants, remote teams — AlphaClone eliminates your operational friction with one unified architecture.',
        url: 'https://alphaclonesystems.com/who-we-serve',
        type: 'website',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Who AlphaClone Serves | Unified Business OS',
        description: 'Agencies, startups, consulting firms, and remote teams. One unified Business OS. No SaaS bloat.',
    },
    robots: { index: true, follow: true },
};

export default function Page() {
    return <WhoWeServeContent />;
}
