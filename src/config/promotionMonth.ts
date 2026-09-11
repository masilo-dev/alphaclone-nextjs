/**
 * Premium / promotion-month messaging — factual, no fabricated urgency.
 *
 * Premium plan: unlimited AlphaClone daily execution (see pricingPlans.ts).
 * External provider limits and safety safeguards still apply — always disclose.
 *
 * Set NEXT_PUBLIC_PROMO_PREMIUM_UNLIMITED=false to hide the monthly highlight banner.
 */

import { PUBLIC_PRICING_PLANS } from '@/config/pricingPlans';

const premiumPlan = PUBLIC_PRICING_PLANS.find((p) => p.id === 'premium');

export const PREMIUM_UNLIMITED = {
  planName: premiumPlan?.name ?? 'Premium',
  priceMonthly: premiumPlan?.price ?? 80,
  /** Accurate product claim — matches planEntitlements / pricing page FAQ */
  headline: 'Premium: unlimited execution on AlphaClone',
  shortLine:
    'Premium removes AlphaClone daily action caps — usage is tracked, not blocked by plan quota.*',
  footnote:
    '*Subject to connected provider API limits and platform anti-abuse safeguards. See pricing FAQ.',
} as const;

/** Calendar month when we highlight Premium unlimited (factual product focus, not a fake discount). */
export const PROMOTION_MONTH_CALENDAR = {
  /** 0-indexed month — September */
  monthIndex: 8,
  label: 'September',
  focus: 'Premium unlimited execution',
} as const;

export function isPremiumPromotionMonthActive(now: Date = new Date()): boolean {
  if (process.env.NEXT_PUBLIC_PROMO_PREMIUM_UNLIMITED === 'false') return false;
  return now.getMonth() === PROMOTION_MONTH_CALENDAR.monthIndex;
}

export function getPromotionMonthBannerCopy(now: Date = new Date()): {
  active: boolean;
  eyebrow: string;
  title: string;
  body: string;
} {
  const active = isPremiumPromotionMonthActive(now);
  return {
    active,
    eyebrow: active
      ? `${PROMOTION_MONTH_CALENDAR.label} focus · ${PREMIUM_UNLIMITED.planName}`
      : PREMIUM_UNLIMITED.planName,
    title: PREMIUM_UNLIMITED.headline,
    body: active
      ? `${PROMOTION_MONTH_CALENDAR.label} promotion month: explore ${PREMIUM_UNLIMITED.planName} at $${PREMIUM_UNLIMITED.priceMonthly}/mo for unlimited daily execution across CRM, outreach, documents, automations, and MCP actions. ${PREMIUM_UNLIMITED.footnote}`
      : `${PREMIUM_UNLIMITED.shortLine} ${PREMIUM_UNLIMITED.footnote}`,
  };
}
