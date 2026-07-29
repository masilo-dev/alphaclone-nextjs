import type { Metadata } from 'next';
import ContactPage from '@/components/pages/ContactPage';
import MarketingLandingShell from '@/components/landing/MarketingLandingShell';

const siteUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://alphaclonesystems.com').replace(/\/$/, '');

const siteUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://alphaclonesystems.com').replace(/\/$/, '');

export const metadata: Metadata = {
    title: 'Contact | AlphaClone Systems',
    description: 'Contact AlphaClone Systems to streamline CRM, billing, contracts, scheduling, and operations in one platform.',
    alternates: { canonical: `${siteUrl}/contact` },
    robots: { index: true, follow: true },
    openGraph: { images: [{ url: '/opengraph-image', width: 1200, height: 630 }],
        title: 'Contact | AlphaClone Systems',
        description: 'Talk to AlphaClone Systems about a unified platform for CRM, billing, and operations.',
        url: `${siteUrl}/contact`,
        type: 'website',
    },
};

export default function Page() {
    return (
        <MarketingLandingShell>
            <ContactPage />
        </MarketingLandingShell>
    );
}
