import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import MarketingLandingShell from '@/components/landing/MarketingLandingShell';
import { SITE_URL } from '@/lib/siteUrl';

export const metadata: Metadata = {
  title: 'Book a Demo | AlphaClone — See It In Action',
  description:
    'Schedule a personalised 30-minute demo of AlphaClone. See how one AI-powered workspace replaces your CRM, invoicing, contracts, scheduling, and more.',
  alternates: { canonical: `${SITE_URL}/book-demo` },
  openGraph: {
    title: 'Book a Demo | AlphaClone',
    description:
      'Schedule a personalised 30-minute demo of AlphaClone. See how one AI-powered workspace replaces your CRM, invoicing, and more.',
    url: `${SITE_URL}/book-demo`,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Book a Demo | AlphaClone',
    description:
      'Schedule a personalised 30-minute demo of AlphaClone. See how one AI-powered workspace replaces your CRM, invoicing, and more.',
  },
};

export default function BookDemoLayout({ children }: { children: ReactNode }) {
  return <MarketingLandingShell>{children}</MarketingLandingShell>;
}
