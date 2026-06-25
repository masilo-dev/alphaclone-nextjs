import type { Metadata } from 'next';
import WhoWeServeContent from './WhoWeServeContent';

export const metadata: Metadata = {
    title: 'Who We Serve | Alphaclone for Agencies, Consultants & Service Teams',
    description:
        'Alphaclone is built for teams that sell and deliver client work — agencies, consultants, founders, and remote teams replacing fragmented CRM, billing, and project tools.',
    keywords: [
        'Alphaclone for agencies',
        'consulting firm software',
        'service business CRM and billing',
        'remote team client operations',
        'solo founder business software',
    ],
    alternates: { canonical: 'https://alphaclonesystems.com/who-we-serve' },
    openGraph: {
        title: 'Who Alphaclone Serves | Client Work in One Workspace',
        description:
            'See which team types use Alphaclone to connect leads, delivery, contracts, and billing — without tool sprawl.',
        url: 'https://alphaclonesystems.com/who-we-serve',
        type: 'website',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Who Alphaclone Serves',
        description: 'Agencies, consultants, and founders who need one workspace for client work.',
    },
    robots: { index: true, follow: true },
};

export default function Page() {
    return <WhoWeServeContent />;
}
