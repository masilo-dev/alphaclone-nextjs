import type { Metadata } from 'next';
import AboutPage from '@/components/pages/AboutPage';

export const metadata: Metadata = {
    title: 'About AlphaClone Systems | Our Mission, Story & AI Philosophy',
    description: 'Learn about AlphaClone Systems — the company on a mission to replace 10+ fragmented SaaS tools with one AI-powered Business Operating System. Discover our story, values, technology philosophy, and why thousands of small businesses trust us.',
    keywords: [
        'about AlphaClone Systems', 'business software company', 'AI startup story', 'enterprise software mission',
        'small business operating system company', 'AI-powered business platform', 'who is AlphaClone',
        'business automation company', 'technology company for small business',
    ],
    alternates: { canonical: 'https://alphaclone.tech/about' },
    openGraph: {
        title: 'About AlphaClone Systems | Our Mission & Story',
        description: 'We built AlphaClone because small businesses deserve enterprise technology without enterprise complexity or price tags. Learn our story.',
        url: 'https://alphaclone.tech/about',
        type: 'website',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'About AlphaClone Systems | Our Mission & Story',
        description: 'We built AlphaClone because small businesses deserve enterprise technology. Learn our story and mission.',
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
