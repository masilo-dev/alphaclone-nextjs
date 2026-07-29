<<<<<<< HEAD
import type { ReactNode } from 'react';
import MarketingLandingShell from '@/components/landing/MarketingLandingShell';

export default function AIArchitectLayout({ children }: { children: ReactNode }) {
  return <MarketingLandingShell>{children}</MarketingLandingShell>;
}
=======
import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/siteUrl';

export const metadata: Metadata = {
  title: 'AI Architect | AlphaClone',
  description: 'AI Architect generates technical architecture, stack recommendations, and implementation guidance for your projects.',
  alternates: { canonical: `${SITE_URL}/tools/ai-architect` },
  openGraph: {
    title: 'AI Architect | AlphaClone',
    description: 'Generate architecture and implementation guidance with AI Architect.',
    url: `${SITE_URL}/tools/ai-architect`,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI Architect | AlphaClone',
    description: 'Generate architecture and implementation guidance with AI Architect.',
  },
};

export default function AiArchitectLayout({ children }: { children: React.ReactNode }) {
  return children;
}

>>>>>>> origin/main
