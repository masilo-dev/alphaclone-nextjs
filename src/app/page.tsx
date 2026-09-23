import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import HomeClient from '@/components/home/HomeClient';
import { buildMarketingMetadata } from '@/lib/seo/metadata';
import { EXECUTION_LAYER } from '@/config/marketingPositioning';

export const metadata: Metadata = {
  ...buildMarketingMetadata({
    title: EXECUTION_LAYER.heroHeadline,
    description: EXECUTION_LAYER.explanatoryLine,
    pathname: '/',
  }),
  /** Tab title: logo name only — not the long hero headline. */
  title: { absolute: 'AlphaClone' },
};

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
        <div className="marketing-theme min-h-screen bg-white text-slate-950 flex items-center justify-center px-5 sm:px-8">
          <div className="w-full max-w-3xl">
            <p className="mb-4 type-caption font-bold uppercase tracking-caps text-blue-700">AI business execution layer</p>
            <h1 className="font-marketing-heading text-5xl font-bold leading-tight tracking-tight sm:text-7xl">You type. We make it happen.</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">{EXECUTION_LAYER.heroSubhead}</p>
          </div>
        </div>
      }
    >
      <HomeClient initialProjects={[]} />
    </Suspense>
  );
}
