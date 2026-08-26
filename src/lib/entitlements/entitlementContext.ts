import {
  FREE_DAILY_LIMIT,
  PRO_DAILY_LIMIT,
  getDailyLimitForPlan,
  isUnlimitedPlan,
  normalizePlanId,
  type NormalizedPlanId,
} from '@/lib/entitlements/planEntitlements';

/** When the new usage/pricing system rolled out — pre-rollout accounts get legacy access. */
export const USAGE_ROLLOUT_ISO = '2026-08-24T00:00:00.000Z';

/** Legacy unrestricted access ends 31 Aug 2026 23:59:59 UTC (account timezone fallback handled at display). */
export const LEGACY_ACCESS_DEADLINE_ISO = '2026-08-31T23:59:59.000Z';

export const TRIAL_DURATION_DAYS = 14;

export type EntitlementAccessMode =
  | 'legacy_unrestricted'
  | 'trial_premium'
  | 'paid_unlimited'
  | 'paid_pro'
  | 'paid_free'
  | 'free';

export type TenantEntitlementSnapshot = {
  tenantId: string;
  rawPlan: string;
  normalizedPlan: NormalizedPlanId;
  subscriptionStatus: string;
  createdAt: Date | null;
  trialStartedAt: Date | null;
  trialEndsAt: Date | null;
  legacyAccessUntil: Date | null;
  stripeSubscriptionId: string | null;
};

export type ResolvedEntitlementContext = {
  accessMode: EntitlementAccessMode;
  quotaEnforced: boolean;
  unlimited: boolean;
  dailyLimit: number | null;
  displayPlan: string;
  legacyAccessUntil: Date | null;
  trialEndsAt: Date | null;
  bannerMessage: string | null;
};

function parseDate(value: unknown): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function resolveEntitlementContext(snapshot: TenantEntitlementSnapshot): ResolvedEntitlementContext {
  const now = Date.now();
  const rawPlan = String(snapshot.rawPlan || 'free').toLowerCase();
  const normalizedPlan = normalizePlanId(rawPlan);
  const status = String(snapshot.subscriptionStatus || 'free').toLowerCase();
  const trialEndsAt = parseDate(snapshot.trialEndsAt);
  const legacyAccessUntil =
    parseDate(snapshot.legacyAccessUntil) ??
    (snapshot.createdAt && snapshot.createdAt < new Date(USAGE_ROLLOUT_ISO)
      ? new Date(LEGACY_ACCESS_DEADLINE_ISO)
      : null);

  const paidActive = status === 'active' && Boolean(snapshot.stripeSubscriptionId);
  const premiumPaid = paidActive && isUnlimitedPlan(rawPlan);
  const legacyActive =
    !paidActive && legacyAccessUntil !== null && legacyAccessUntil.getTime() >= now;
  const trialActive =
    !paidActive && status === 'trial' && trialEndsAt !== null && trialEndsAt.getTime() > now;

  if (legacyActive) {
    return {
      accessMode: 'legacy_unrestricted',
      quotaEnforced: false,
      unlimited: true,
      dailyLimit: null,
      displayPlan: getPublicDisplayPlan(rawPlan, status),
      legacyAccessUntil,
      trialEndsAt,
      bannerMessage: `Legacy access active until ${legacyAccessUntil!.toLocaleDateString(undefined, {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })}`,
    };
  }

  if (trialActive) {
    return {
      accessMode: 'trial_premium',
      quotaEnforced: false,
      unlimited: true,
      dailyLimit: null,
      displayPlan: 'Premium Trial',
      legacyAccessUntil: null,
      trialEndsAt,
      bannerMessage: null,
    };
  }

  if (premiumPaid || isUnlimitedPlan(rawPlan)) {
    return {
      accessMode: 'paid_unlimited',
      quotaEnforced: false,
      unlimited: true,
      dailyLimit: null,
      displayPlan: 'Premium',
      legacyAccessUntil: null,
      trialEndsAt: null,
      bannerMessage: null,
    };
  }

  if (paidActive || normalizedPlan === 'pro') {
    return {
      accessMode: 'paid_pro',
      quotaEnforced: true,
      unlimited: false,
      dailyLimit: PRO_DAILY_LIMIT,
      displayPlan: 'Pro',
      legacyAccessUntil: null,
      trialEndsAt: null,
      bannerMessage: null,
    };
  }

  return {
    accessMode: 'free',
    quotaEnforced: true,
    unlimited: false,
    dailyLimit: FREE_DAILY_LIMIT,
    displayPlan: 'Free',
    legacyAccessUntil: null,
    trialEndsAt: null,
    bannerMessage: null,
  };
}

function getPublicDisplayPlan(rawPlan: string, status: string): string {
  if (status === 'trial') return 'Premium Trial';
  const normalized = normalizePlanId(rawPlan);
  if (normalized === 'premium') return 'Premium';
  if (normalized === 'pro') return 'Pro';
  return 'Free';
}

export function shouldEnforceDailyQuota(context: ResolvedEntitlementContext): boolean {
  return context.quotaEnforced && !context.unlimited;
}
