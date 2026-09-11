import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import MarketingLandingShell from '@/components/landing/MarketingLandingShell';
import { absoluteUrl } from '@/lib/siteUrl';

export const metadata: Metadata = {
  title: 'AI Business Systems Architect',
  description: 'Create an AI-assisted operating-system blueprint for your business workflows, tools, data, and growth goals.',
  alternates: { canonical: absoluteUrl('/tools/ai-architect') },
  robots: { index: true, follow: true },
};

export default function AIArchitectLayout({ children }: { children: ReactNode }) {
  return <MarketingLandingShell>{children}</MarketingLandingShell>;
}
