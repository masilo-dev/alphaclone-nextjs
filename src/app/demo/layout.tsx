import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/siteUrl';

export const metadata: Metadata = {
  title: 'Product Demo | AlphaClone',
  description: 'Interactive demo of AlphaClone: CRM, billing, contracts, scheduling, documents, and automation in one platform.',
  alternates: { canonical: `${SITE_URL}/demo` },
  openGraph: {
    title: 'Product Demo | AlphaClone',
    description: 'Explore AlphaClone in an interactive demo.',
    url: `${SITE_URL}/demo`,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Product Demo | AlphaClone',
    description: 'Explore AlphaClone in an interactive demo.',
  },
};

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return children;
}

