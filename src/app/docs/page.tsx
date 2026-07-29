import type { Metadata } from 'next';
import MarketingLandingShell from '@/components/landing/MarketingLandingShell';
import DocsPageContent from './DocsPageContent';

export const metadata: Metadata = {
    title: 'Documentation | AlphaClone Business OS — Complete Feature Reference',
    description: 'Full documentation for the AlphaClone Business Operating System. Covers registration, CRM, AI Growth Agent, Gmail integration, financial management, contracts, video meetings, Calendly, and security. Detailed guides for every platform feature.',
    keywords: [
        'AlphaClone documentation', 'business OS docs', 'CRM guide', 'AI growth agent documentation',
        'how to use AlphaClone', 'AlphaClone features', 'business software documentation',
        'Gmail integration guide', 'Calendly integration', 'invoice management guide',
        'financial accounting software guide', 'AlphaClone help',
    ],
    alternates: { canonical: 'https://alphaclonesystems.com/docs' },
<<<<<<< HEAD
    openGraph: { images: [{ url: '/opengraph-image', width: 1200, height: 630 }],
=======
    openGraph: {
>>>>>>> origin/main
        title: 'Documentation | AlphaClone Business OS',
        description: 'Complete reference documentation for every AlphaClone feature — CRM, AI Growth Agent, invoicing, contracts, video meetings, and security.',
        url: 'https://alphaclonesystems.com/docs',
        type: 'article',
    },
};

const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://alphaclonesystems.com' },
        { '@type': 'ListItem', position: 2, name: 'Documentation', item: 'https://alphaclonesystems.com/docs' },
    ],
};

export default function Page() {
    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
            />
            <MarketingLandingShell>
                <DocsPageContent />
            </MarketingLandingShell>
        </>
    );
}
