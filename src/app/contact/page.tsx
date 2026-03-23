import type { Metadata } from 'next';
import ContactPage from '@/components/pages/ContactPage';

export const metadata: Metadata = {
    title: 'Contact | AlphaClone Systems',
    description: 'Contact AlphaClone Systems to streamline CRM, billing, contracts, scheduling, and operations in one platform.',
    alternates: { canonical: 'https://alphaclone.tech/contact' },
    robots: { index: true, follow: true },
    openGraph: {
        title: 'Contact | AlphaClone Systems',
        description: 'Talk to AlphaClone Systems about a unified platform for CRM, billing, and operations.',
        url: 'https://alphaclone.tech/contact',
        type: 'website',
    },
};

export default function Page() {
    return <ContactPage />;
}
