import type { Metadata } from 'next';
import AboutPage from '@/components/pages/AboutPage';

export const metadata: Metadata = {
    title: 'About AlphaClone Systems | Building the Unified AI Business OS',
    description: 'AlphaClone Systems was built to end the era of SaaS bloat. We are on a mission to provide every high-performance team with a technically superior, AI-powered Business OS — one unified architecture to replace the chaos of 10+ disconnected tools.',
    keywords: [
        'about AlphaClone Systems',
        'AI Business OS mission',
        'end SaaS bloat',
        'AI-powered business platform',
        'unified operations software',
        'operational excellence company',
        'Data Sovereignty platform',
        'enterprise AI for small business',
    ],
    alternates: { canonical: 'https://alphaclone.tech/about' },
    openGraph: {
        title: 'About AlphaClone | Building the Unified AI Business OS',
        description: 'We built AlphaClone to eliminate SaaS bloat. One AI-powered Business OS. One unified architecture. Built for high-performance teams.',
        url: 'https://alphaclone.tech/about',
        type: 'website',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'About AlphaClone | Building the Unified AI Business OS',
        description: 'We built AlphaClone to end SaaS bloat. One unified, AI-powered Business OS for high-performance teams.',
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
