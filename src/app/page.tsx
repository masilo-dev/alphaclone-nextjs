import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import HomeClient from '@/components/home/HomeClient';
import { buildMarketingMetadata } from '@/lib/seo/metadata';
import { EXECUTION_LAYER } from '@/config/marketingPositioning';

export const metadata: Metadata = buildMarketingMetadata({
  title: EXECUTION_LAYER.heroHeadline,
  description: EXECUTION_LAYER.explanatoryLine,
  pathname: '/',
});

/**
 * AlphaClone Home Page (Server Component)
 *
 * Performance Optimized: Fetches initial portfolio data on the server
 * and delegates client-side logic (auth, search params) to HomeClient.
 * FAQ structured data lives on /faq only (canonical FAQPage schema).
 */
export default async function Home() {
  return (
    <Suspense
      fallback={
        <div className="marketing-theme min-h-screen text-[var(--marketing-text-primary)] flex items-center justify-center px-4 sm:px-6">
          <div className="w-full max-w-xs sm:max-w-lg md:max-w-3xl" aria-hidden="true">
            <div className="h-8 sm:h-10 w-3/4 sm:w-64 rounded-md bg-[var(--marketing-surface)] mb-4 sm:mb-5" />
            <div className="h-4 sm:h-5 w-full rounded bg-[var(--marketing-surface)] mb-2 sm:mb-3" />
            <div className="h-4 sm:h-5 w-4/5 sm:w-5/6 rounded bg-[var(--marketing-surface)] mb-6 sm:mb-10" />
            <div className="h-9 sm:h-11 w-32 sm:w-40 rounded-md bg-[var(--marketing-accent-soft)]" />
          </div>
        </div>
      }
    >
      <HomeClient initialProjects={[]} />
    </Suspense>
  );
}
