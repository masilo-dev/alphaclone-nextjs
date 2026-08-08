import type { Metadata } from 'next';
import EcosystemPage from '@/components/pages/EcosystemPage';
import MarketingLandingShell from '@/components/landing/MarketingLandingShell';

export const metadata: Metadata = {
    title: 'The AlphaClone Ecosystem | One Unified Business OS Architecture',
    description: 'Explore the AlphaClone Business OS ecosystem, including CRM, finance, Bonnie AI, Hermes, Calendly, LinkedIn, Facebook, DeepSeek, Claude, OpenAI, OpenRouter, Microsoft 365, WhatsApp, and Instagram integration status.',
    keywords: [
        'AlphaClone ecosystem',
        'unified business OS architecture',
        'AI business platform modules',
        'SaaS consolidation platform',
        'AI Growth Agent',
        'Mission Control software',
        'Unified CRM Intelligence',
        'revenue operations platform',
        'Calendly integration',
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
        title: 'The AlphaClone Ecosystem | Unified Business OS Architecture',
        description: 'Integrated modules plus provider status for Calendly, LinkedIn, Facebook, AI APIs, Microsoft 365, WhatsApp, and Instagram.',
        url: 'https://alphaclonesystems.com/ecosystem',
        type: 'website',
    },
    twitter: { images: ['/twitter-image'],
        card: 'summary_large_image',
        title: 'The AlphaClone Ecosystem | Unified Business OS',
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
