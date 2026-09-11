import type { Metadata } from 'next';
import { PrivacyPolicy } from '@/components/pages/LegalDocs';

export const metadata: Metadata = {
    title: 'Privacy Policy | AlphaClone Systems',
    description: 'AlphaClone Systems Privacy Policy. Explains how we collect, use, store, and protect personal data across Bonnie AI, Hermes, CRM, finance, social, email, calendar, and third-party integrations.',
    keywords: ['AlphaClone privacy policy', 'data protection', 'GDPR', 'Gmail API privacy', 'LinkedIn Lead Gen privacy', 'Bonnie AI data handling', 'Hermes AI agent policy', 'personal data', 'POPIA compliance'],
    alternates: { canonical: 'https://alphaclonesystems.com/privacy-policy' },
    openGraph: { images: [{ url: '/opengraph-image', width: 1200, height: 630 }],
        title: 'Privacy Policy | AlphaClone Systems',
        description: 'How AlphaClone collects, uses, and protects data across Bonnie AI, Hermes, CRM, finance, email, social, calendar, and integrations.',
        url: 'https://alphaclonesystems.com/privacy-policy',
        type: 'article',
    },
    robots: { index: true, follow: true },
};

export default function Page() {
    return <PrivacyPolicy />;
}
