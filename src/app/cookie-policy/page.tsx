import type { Metadata } from 'next';
import { CookiePolicy } from '@/components/pages/LegalDocs';

export const metadata: Metadata = {
    title: 'Cookie Policy | AlphaClone Systems',
    description: 'AlphaClone Cookie Policy. Full breakdown of all cookies used — authentication, analytics, functional, and marketing categories — with instructions to manage your preferences.',
    keywords: ['AlphaClone cookie policy', 'cookie preferences', 'GDPR cookies', 'analytics cookies', 'marketing cookies', 'how to disable cookies'],
    alternates: { canonical: 'https://alphaclonesystems.com/cookie-policy' },
    openGraph: { images: [{ url: '/opengraph-image', width: 1200, height: 630 }],
        title: 'Cookie Policy | AlphaClone Systems',
        description: 'Complete list of cookies used by AlphaClone, their purpose, and how to manage your preferences.',
        url: 'https://alphaclonesystems.com/cookie-policy',
        type: 'article',
    },
    robots: { index: true, follow: true },
};

export default function Page() {
    return <CookiePolicy />;
}
