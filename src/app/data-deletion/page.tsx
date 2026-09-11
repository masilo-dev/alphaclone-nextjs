import type { Metadata } from 'next';
import DataDeletionPage from '@/components/pages/DataDeletionPage';
import MarketingLandingShell from '@/components/landing/MarketingLandingShell';

export const metadata: Metadata = {
    title: 'Data Deletion Request | AlphaClone Systems',
    description: 'Request deletion of your personal data from AlphaClone Systems. GDPR & CCPA compliant. Covers Facebook Login data, platform data, and all associated records.',
    robots: { index: true, follow: true },
    alternates: { canonical: 'https://alphaclonesystems.com/data-deletion' },
};

export default function Page() {
    return (
        <MarketingLandingShell>
            <div className="pt-20">
                <DataDeletionPage />
            </div>
        </MarketingLandingShell>
    );
}
