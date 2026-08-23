import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SITE_URL } from '@/lib/siteUrl';
import BookDemoContent from './BookDemoContent';

export const metadata: Metadata = {
  title: 'Book a Demo — AlphaClone Systems',
  description:
    'Schedule a free 30-minute walkthrough of AlphaClone Systems. See how our AI Business OS replaces your CRM, invoicing, contracts, and project management stack.',
  alternates: { canonical: `${SITE_URL}/book-demo` },
  openGraph: {
    title: 'Book a Demo — AlphaClone Systems',
    description: 'Schedule a free 30-minute live demo of the AlphaClone platform.',
    url: `${SITE_URL}/book-demo`,
    type: 'website',
    siteName: 'AlphaClone Systems',
  },
  robots: { index: true, follow: true },
};

export default function BookDemoPage() {
  return (
    <Suspense>
      <BookDemoContent />
    </Suspense>
  );
}
