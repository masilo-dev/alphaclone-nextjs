import type { Metadata } from 'next';
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
    openGraph: {
        title: 'Who AlphaClone Serves | Client Work in One Workspace',
        description:
            'See which team types use AlphaClone to connect leads, delivery, contracts, and billing — without tool sprawl.',
        url: 'https://alphaclonesystems.com/who-we-serve',
        type: 'website',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Who AlphaClone Serves',
        description: 'Agencies, consultants, and founders who need one workspace for client work.',
    },
    robots: { index: true, follow: true },
};

export default function Page() {
    return <WhoWeServeContent />;
}
