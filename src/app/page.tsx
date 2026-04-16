import React, { Suspense } from 'react';
import HomeClient from '@/components/home/HomeClient';

/**
 * AlphaClone Home Page (Server Component)
 * 
 * Performance Optimized: Fetches initial portfolio data on the server
 * and delegates client-side logic (auth, search params) to HomeClient.
 */
export default async function Home() {
  return (
    <main>
      <Suspense
        fallback={
          <div className="min-h-screen bg-[#020D1A] text-slate-100 flex items-center justify-center px-6">
            <div className="w-full max-w-3xl">
              <div className="h-10 w-64 rounded-md bg-slate-800/70 mb-5" />
              <div className="h-5 w-full rounded bg-slate-800/60 mb-3" />
              <div className="h-5 w-5/6 rounded bg-slate-800/60 mb-10" />
              <div className="h-11 w-40 rounded-md bg-teal-500/30" />
            </div>
          </div>
        }
      >
        <HomeClient initialProjects={[]} />
      </Suspense>
    </main>
  );
}
