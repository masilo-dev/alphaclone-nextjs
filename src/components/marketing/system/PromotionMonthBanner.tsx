'use client';

import Link from 'next/link';
import { CalendarCheck } from 'lucide-react';
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
      className={`rounded-xl border border-blue-200 bg-blue-50/70 px-4 py-4 sm:px-6 sm:py-5 shadow-sm ${className}`}
      role="note"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="flex items-center gap-2 type-caption font-bold uppercase tracking-wider text-blue-700">
            <CalendarCheck className="h-3.5 w-3.5" aria-hidden />
            {copy.eyebrow}
          </p>
          <p className="mt-1 text-base sm:text-lg font-bold text-slate-950 font-marketing-heading">{copy.title}</p>
          <p className="mt-2 type-card-description text-slate-600 leading-relaxed max-w-3xl">{copy.body}</p>
        </div>
        <Link
          href={`${TRIAL_HREF}&plan=enterprise`}
          className="shrink-0 inline-flex items-center justify-center rounded-lg bg-[#0878f9] hover:bg-[#075fc7] px-4 py-2.5 type-ui font-semibold text-white transition-colors shadow-sm"
        >
          Explore {PREMIUM_UNLIMITED.planName}
        </Link>
      </div>
    </div>
  );
}
