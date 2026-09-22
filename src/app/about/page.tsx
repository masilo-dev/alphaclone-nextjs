import type { Metadata } from 'next';
import AboutPage from '@/components/pages/AboutPage';
import MarketingLandingShell from '@/components/landing/MarketingLandingShell';
import { buildBreadcrumbSchema } from '@/lib/seo/breadcrumbSchema';
import { absoluteUrl } from '@/lib/siteUrl';

export const metadata: Metadata = {
    title: 'Why AlphaClone Exists | The Founder Journey',
    description: 'The founder journey behind AlphaClone Systems: from disconnected business tools and manual coordination to a human-led execution layer connecting AI instructions with approved business actions.',
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
    openGraph: { images: [{ url: '/opengraph-image', width: 1200, height: 630 }],
        title: 'Why AlphaClone Exists | The Founder Journey',
        description: 'The personal problem, operational friction, and execution-layer idea that led to AlphaClone Systems.',
        url: absoluteUrl('/about'),
        type: 'website',
    },
    twitter: { images: ['/twitter-image'],
        card: 'summary_large_image',
        title: 'Why AlphaClone Exists | The Founder Journey',
        description: 'The personal problem and execution-layer idea that led to AlphaClone Systems.',
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
            <MarketingLandingShell>
                <AboutPage />
            </MarketingLandingShell>
        </>
    );
}
