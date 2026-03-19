import type { Metadata } from 'next';
import AboutPage from '@/components/pages/AboutPage';

export const metadata: Metadata = {
    title: 'About AlphaClone Systems | Unified CRM, Billing, Scheduling, and Operations',
    description: 'Learn how AlphaClone Systems builds a unified business platform for service businesses by combining CRM, invoicing, scheduling, contracts, messaging, and operations in one product.',
    keywords: [
        'about AlphaClone Systems',
        'service business software platform',
        'CRM invoicing scheduling software',
        'business operations platform',
        'unified operations software',
        'client management and billing platform',
        'all in one business software',
        'business workflow automation platform',
        'small business operations software',
    ],
    alternates: { canonical: 'https://alphaclone.tech/about' },
    openGraph: {
        title: 'About AlphaClone | Unified Business Software for Service Teams',
        description: 'AlphaClone combines CRM, billing, scheduling, contracts, communication, and operations into one connected platform for service businesses.',
        url: 'https://alphaclone.tech/about',
        type: 'website',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'About AlphaClone | Unified Business Software for Service Teams',
        description: 'CRM, invoicing, scheduling, contracts, messaging, and operations in one connected platform.',
    },
};

const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://alphaclone.tech' },
        { '@type': 'ListItem', position: 2, name: 'About', item: 'https://alphaclone.tech/about' },
    ],
};

export default function Page() {
    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
            />
            <AboutPage />
        </>
    );
}
