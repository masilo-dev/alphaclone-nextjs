import type { Metadata } from 'next';
import { PrivacyChoices } from '@/components/pages/LegalDocs';

export const metadata: Metadata = {
    title: 'Your Privacy Choices | AlphaClone Systems',
    description: 'Exercise your California privacy rights under the CCPA. Opt out of the sale or sharing of your personal information, and manage your privacy choices with AlphaClone Systems.',
    keywords: ['CCPA opt out', 'do not sell my data', 'California privacy rights', 'privacy choices', 'AlphaClone privacy'],
    alternates: { canonical: 'https://alphaclonesystems.com/privacy-choices' },
    openGraph: {
        title: 'Your Privacy Choices | AlphaClone Systems',
        description: 'Manage your California privacy rights and opt out of data sharing under the CCPA.',
        url: 'https://alphaclonesystems.com/privacy-choices',
        type: 'website',
    },
    robots: { index: true, follow: true },
};

export default function Page() {
    return <PrivacyChoices />;
}
