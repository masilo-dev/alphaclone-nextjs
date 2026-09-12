import type { Metadata } from 'next';
import EcosystemPage from '@/components/pages/EcosystemPage';
import MarketingLandingShell from '@/components/landing/MarketingLandingShell';

export const metadata: Metadata = {
    title: 'AlphaClone Integrations | AI Business Execution Layer',
    description: 'Explore the systems and providers available to the AlphaClone AI Business Execution Layer, with clear availability status for CRM, finance, scheduling, social, email, and AI connections.',
    keywords: [
        'AlphaClone ecosystem',
        'AI business execution architecture',
        'AI business platform modules',
        'SaaS consolidation platform',
        'AI Growth Agent',
        'Mission Control software',
        'Unified CRM Intelligence',
        'revenue operations platform',
        'Cal.com scheduling',
        'LinkedIn integration',
        'Facebook integration',
        'DeepSeek API',
        'Claude API',
        'OpenAI API',
        'OpenRouter API',
        'WhatsApp coming soon',
        'Instagram coming soon',
    ],
    alternates: { canonical: 'https://alphaclonesystems.com/ecosystem' },
    openGraph: { images: [{ url: '/opengraph-image', width: 1200, height: 630 }],
        title: 'AlphaClone Integrations | AI Business Execution Layer',
        description: 'Integrated modules plus provider status for Cal.com, LinkedIn, Facebook, AI APIs, Microsoft 365, WhatsApp, and Instagram.',
        url: 'https://alphaclonesystems.com/ecosystem',
        type: 'website',
    },
    twitter: { images: ['/twitter-image'],
        card: 'summary_large_image',
        title: 'AlphaClone Integrations | AI Business Execution Layer',
        description: 'One unified platform with public integration status for core apps and AI providers.',
    },
    robots: { index: true, follow: true },
};

export default function Page() {
    return (
        <MarketingLandingShell>
            <EcosystemPage />
        </MarketingLandingShell>
    );
}
