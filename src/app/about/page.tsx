import type { Metadata } from 'next';
import AboutPage from '@/components/pages/AboutPage';
import { buildBreadcrumbSchema } from '@/lib/seo/breadcrumbSchema';
import { absoluteUrl } from '@/lib/siteUrl';

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
    alternates: { canonical: absoluteUrl('/about') },
    openGraph: {
        title: 'About AlphaClone | Unified Business Software for Service Teams',
        description: 'AlphaClone combines CRM, billing, scheduling, contracts, communication, and operations into one connected platform for service businesses.',
        url: absoluteUrl('/about'),
        type: 'website',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'About AlphaClone | Unified Business Software for Service Teams',
        description: 'CRM, invoicing, scheduling, contracts, messaging, and operations in one connected platform.',
    },
};

const breadcrumbSchema = buildBreadcrumbSchema([
    { name: 'Home', path: '/' },
    { name: 'About', path: '/about' },
]);

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
