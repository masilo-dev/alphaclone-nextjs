import type { Metadata } from 'next';
import { SLA } from '@/components/pages/LegalDocs';

export const metadata: Metadata = {
    title: 'Service Level Agreement (SLA) | AlphaClone Systems',
    description: 'AlphaClone Systems Service Level Agreement. Commitment to platform uptime, support response times, and service reliability.',
    keywords: ['AlphaClone SLA', 'uptime commitment', 'support response time', 'service reliability'],
    alternates: { canonical: 'https://alphaclonesystems.com/sla' },
    robots: { index: true, follow: true },
};

export default function Page() {
    return <SLA />;
}
