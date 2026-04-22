import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/siteUrl';

export const metadata: Metadata = {
    title: 'Knowledge Hub | Business OS Insights & AI Automation Guides',
    description: 'Expert insights on AI-powered business operations, autonomous growth, unified CRM intelligence, and eliminating SaaS bloat. Practical guides for high-performance teams.',
    keywords: [
        'AI business automation guides',
        'Business OS insights',
        'eliminate SaaS bloat tips',
        'autonomous growth strategies',
        'unified CRM best practices',
        'operational excellence content',
        'AlphaClone blog',
    ],
    alternates: { canonical: `${SITE_URL}/blog` },
    openGraph: {
        title: 'Knowledge Hub | AlphaClone Business OS Insights',
        description: 'Expert insights on AI automation, unified operations, and eliminating SaaS bloat for high-performance teams.',
        url: `${SITE_URL}/blog`,
        type: 'website',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Knowledge Hub | AlphaClone Business OS Insights',
        description: 'Guides on AI automation, unified operations, and ending SaaS bloat for high-performance teams.',
    },
    robots: { index: true, follow: true },
};

export { default } from './page';
