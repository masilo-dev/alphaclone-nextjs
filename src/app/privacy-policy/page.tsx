import type { Metadata } from 'next';
import { PrivacyPolicy } from '@/components/pages/LegalDocs';

export const metadata: Metadata = {
    title: 'Privacy Policy | AlphaClone Systems',
    description: 'AlphaClone Systems Privacy Policy. Explains how we collect, use, store, and protect your personal data. Covers Gmail API data use, GDPR rights, data retention, and third-party processors.',
    keywords: ['AlphaClone privacy policy', 'data protection', 'GDPR', 'Gmail API privacy', 'personal data', 'POPIA compliance'],
    alternates: { canonical: 'https://alphaclonesystems.com/privacy-policy' },
    openGraph: {
        title: 'Privacy Policy | AlphaClone Systems',
        description: 'How AlphaClone collects, uses, and protects your data. Full GDPR and POPIA compliant privacy policy.',
        url: 'https://alphaclonesystems.com/privacy-policy',
        type: 'article',
    },
    robots: { index: true, follow: true },
};

export default function Page() {
    return <PrivacyPolicy />;
}
