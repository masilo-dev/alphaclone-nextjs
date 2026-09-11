'use client';

import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { getPromotionMonthBannerCopy, PREMIUM_UNLIMITED } from '@/config/promotionMonth';
import { TRIAL_HREF } from '@/lib/marketing/cta';

export default function PromotionMonthBanner({
  className = '',
  alwaysShow = false,
}: {
  className?: string;
  /** When true, show Premium unlimited copy even outside promotion month (e.g. pricing page). */
  alwaysShow?: boolean;
}) {
  const copy = getPromotionMonthBannerCopy();

  if (!copy.active && !alwaysShow && process.env.NEXT_PUBLIC_PROMO_PREMIUM_UNLIMITED === 'false') {
    return null;
  }

  if (!copy.active && !alwaysShow) {
    return null;
  }

  return (
    <div
      className={`rounded-xl border border-violet-500/25 bg-violet-500/10 px-4 py-4 sm:px-6 sm:py-5 ${className}`}
      role="note"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-violet-300">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            {copy.eyebrow}
          </p>
          <p className="mt-1 text-base sm:text-lg font-semibold text-white">{copy.title}</p>
          <p className="mt-2 text-sm text-slate-300 leading-relaxed max-w-3xl">{copy.body}</p>
        </div>
        <Link
          href={`${TRIAL_HREF}&plan=enterprise`}
          className="shrink-0 inline-flex items-center justify-center rounded-lg bg-violet-600 hover:bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors"
        >
          Explore {PREMIUM_UNLIMITED.planName}
        </Link>
      </div>
    </div>
  );
}
