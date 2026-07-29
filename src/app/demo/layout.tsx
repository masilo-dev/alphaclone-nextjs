import type { Metadata } from 'next';
<<<<<<< HEAD
import type { ReactNode } from 'react';
import MarketingLandingShell from '@/components/landing/MarketingLandingShell';
=======
>>>>>>> origin/main
import { SITE_URL } from '@/lib/siteUrl';

export const metadata: Metadata = {
  title: 'Product Demo | AlphaClone',
<<<<<<< HEAD
  description:
    'Interactive demo of AlphaClone: CRM, billing, contracts, scheduling, documents, and automation in one platform.',
  alternates: { canonical: `${SITE_URL}/demo` },
  openGraph: { images: [{ url: '/opengraph-image', width: 1200, height: 630 }],
=======
  description: 'Interactive demo of AlphaClone: CRM, billing, contracts, scheduling, documents, and automation in one platform.',
  alternates: { canonical: `${SITE_URL}/demo` },
  openGraph: {
>>>>>>> origin/main
    title: 'Product Demo | AlphaClone',
    description: 'Explore AlphaClone in an interactive demo.',
    url: `${SITE_URL}/demo`,
    type: 'website',
  },
<<<<<<< HEAD
  twitter: { images: ['/twitter-image'],
=======
  twitter: {
>>>>>>> origin/main
    card: 'summary_large_image',
    title: 'Product Demo | AlphaClone',
    description: 'Explore AlphaClone in an interactive demo.',
  },
};

<<<<<<< HEAD
export default function DemoLayout({ children }: { children: ReactNode }) {
  return <MarketingLandingShell>{children}</MarketingLandingShell>;
}
=======
export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return children;
}

>>>>>>> origin/main
