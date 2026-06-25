'use client';

import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';

const BUSINESS_SIGNUP_HREF = '/auth/login?register=true&type=business&plan=starter';

/** Sticky mobile CTA bar — marketing pages only, preserves brand colors. */
export default function MarketingMobileCtaBar() {
  const router = useRouter();

  return (
    <div className="lg:hidden fixed bottom-0 inset-x-0 z-[100] border-t border-slate-800/80 bg-slate-950/95 backdrop-blur-md px-4 py-3 pb-safe marketing-shadow-lg">
      <div className="mx-auto max-w-lg">
        <button
          type="button"
          onClick={() => router.push(BUSINESS_SIGNUP_HREF)}
          className="w-full inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-cyan-500 text-sm font-bold text-slate-950 shadow-lg shadow-cyan-500/20 transition-colors hover:bg-cyan-400 active:scale-[0.98]"
        >
          Start Free Trial
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
