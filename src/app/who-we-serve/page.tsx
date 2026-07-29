import type { Metadata } from 'next';
import MarketingLandingShell from '@/components/landing/MarketingLandingShell';
import WhoWeServeContent from './WhoWeServeContent';

export const metadata: Metadata = {
    title: 'Who We Serve | AlphaClone for Agencies, Consultants & Service Teams',
    description:
        'AlphaClone is built for teams that sell and deliver client work — agencies, consultants, founders, and remote teams replacing fragmented CRM, billing, and project tools.',
    keywords: [
        'AlphaClone for agencies',
        'consulting firm software',
        'service business CRM and billing',
        'remote team client operations',
        'solo founder business software',
    ],
    alternates: { canonical: 'https://alphaclonesystems.com/who-we-serve' },
<<<<<<< HEAD
    openGraph: { images: [{ url: '/opengraph-image', width: 1200, height: 630 }],
        title: 'Who AlphaClone Serves | Client Work in One Workspace',
        description:
            'See which team types use AlphaClone to connect leads, delivery, contracts, and billing — without tool sprawl.',
=======
    openGraph: {
        title: 'Who AlphaClone Serves | Unified Business OS for High-Performance Teams',
        description: 'Agencies, startups, consultants, remote teams — AlphaClone eliminates your operational friction with one unified architecture.',
>>>>>>> origin/main
        url: 'https://alphaclonesystems.com/who-we-serve',
        type: 'website',
    },
    twitter: { images: ['/twitter-image'],
        card: 'summary_large_image',
        title: 'Who AlphaClone Serves',
        description: 'Agencies, consultants, and founders who need one workspace for client work.',
    },
    robots: { index: true, follow: true },
};

export default function Page() {
    return (
        <MarketingLandingShell>
            <WhoWeServeContent />
        </MarketingLandingShell>
    );
}
