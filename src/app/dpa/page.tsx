import type { Metadata } from 'next';
import { DPA } from '@/components/pages/LegalDocs';

export const metadata: Metadata = {
    title: 'Data Processing Agreement (DPA) | AlphaClone Systems',
    description: 'AlphaClone Systems Data Processing Agreement. Governs the processing of personal data on behalf of our business customers in compliance with GDPR.',
    keywords: ['AlphaClone DPA', 'data processing agreement', 'GDPR compliance', 'sub-processors'],
    alternates: { canonical: 'https://alphaclonesystems.com/dpa' },
    robots: { index: true, follow: true },
};

export default function Page() {
    return <DPA />;
}
