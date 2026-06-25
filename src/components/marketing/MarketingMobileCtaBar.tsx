'use client';

import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';

const BUSINESS_SIGNUP_HREF = '/auth/login?register=true&type=business&plan=starter';

/** Sticky mobile CTA bar — marketing pages only, preserves brand colors. */
export default function MarketingMobileCtaBar() {
  const router = useRouter();

  return (
    <div className="lg:hidden fixed bottom-0 inset-x-0 z-[100] border-t border-slate-800/80 bg-slate-950/95 backdrop-blur-md px-4 py-3 pb-safe marketing-shadow-lg">
      <div className="mx-auto flex max-w-lg items-center gap-3">
        <button
          type="button"
          onClick={() => router.push(BUSINESS_SIGNUP_HREF)}
          className="flex-1 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-cyan-500 text-sm font-bold text-slate-950 shadow-lg shadow-cyan-500/20 transition-colors hover:bg-cyan-400"
        >
          Start Free Trial
          <ArrowRight className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => router.push('/book-demo')}
          className="inline-flex h-12 items-center justify-center rounded-xl border border-slate-700 px-4 text-sm font-semibold text-slate-200 transition-colors hover:border-slate-500 hover:text-white"
        >
          Demo
        </button>
      </div>
    </div>
  );
}
