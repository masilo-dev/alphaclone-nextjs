import type { Metadata } from 'next';
import { TermsOfService } from '@/components/pages/LegalDocs';

export const metadata: Metadata = {
    title: 'Terms of Service | AlphaClone Systems',
    description: 'Terms of Service for the AlphaClone Business OS platform. Covers subscription billing, acceptable use, intellectual property, data ownership, SLA, AI Growth Agent terms, and liability.',
    keywords: ['AlphaClone terms of service', 'AlphaClone ToS', 'platform terms', 'subscription terms', 'AI growth agent terms', 'acceptable use policy'],
    alternates: { canonical: 'https://alphaclonesystems.com/terms-of-service' },
    openGraph: { images: [{ url: '/opengraph-image', width: 1200, height: 630 }],
        title: 'Terms of Service | AlphaClone Systems',
        description: 'Read the full AlphaClone Terms of Service — subscription billing, data ownership, AI Growth Agent terms, and SLA.',
        url: 'https://alphaclonesystems.com/terms-of-service',
        type: 'article',
    },
    robots: { index: true, follow: true },
};

export default function Page() {
    return <TermsOfService />;
}
