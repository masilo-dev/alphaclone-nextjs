import React, { Suspense } from 'react';
import HomeClient from '@/components/home/HomeClient';

/**
 * AlphaClone Home Page (Server Component)
 *
 * Performance Optimized: Fetches initial portfolio data on the server
 * and delegates client-side logic (auth, search params) to HomeClient.
 * FAQ structured data lives on /faq only (canonical FAQPage schema).
 */
export default async function Home() {
  return (
    <main>
      <Suspense
        fallback={
          <div className="min-h-screen bg-[#020D1A] text-slate-100 flex items-center justify-center px-4 sm:px-6">
            <div className="w-full max-w-xs sm:max-w-lg md:max-w-3xl">
              <div className="h-8 sm:h-10 w-3/4 sm:w-64 rounded-md bg-slate-800/70 mb-4 sm:mb-5" />
              <div className="h-4 sm:h-5 w-full rounded bg-slate-800/60 mb-2 sm:mb-3" />
              <div className="h-4 sm:h-5 w-4/5 sm:w-5/6 rounded bg-slate-800/60 mb-6 sm:mb-10" />
              <div className="h-9 sm:h-11 w-32 sm:w-40 rounded-md bg-teal-500/30" />
            </div>
          </div>
        }
      >
        <HomeClient initialProjects={[]} />
      </Suspense>
    </main>
  );
}
