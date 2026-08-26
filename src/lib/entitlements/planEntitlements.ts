/**
 * Authoritative AlphaClone plan entitlement resolver.
 *
 * Universal rule:
 *   FREE    → 50/day per action category
 *   PRO     → 300/day per action category  (includes legacy "starter")
 *   PREMIUM → unlimited (includes legacy "enterprise" / "custom")
 *
 * Unlimited is represented as `null` in TS and `-1` in RPC/DB — never 9999/1000.
 */

export type QuotaResourceType =
  | 'leads'
  | 'outreach_actions'
  | 'linkedin_posts'
  | 'facebook_posts'
  | 'instagram_posts'
  | 'email_actions'
  | 'emails_sent'
  | 'email_replies'
  | 'email_transactional'
  | 'mcp_executions'
  | 'contracts'
  | 'invoices'
  | 'receipts';

export const FREE_DAILY_LIMIT = 50;
export const PRO_DAILY_LIMIT = 300;

export type NormalizedPlanId = 'free' | 'pro' | 'premium';

/** Every metered daily resource uses the same plan tier limit. */
export const METERED_RESOURCES: QuotaResourceType[] = [
  'leads',
  'outreach_actions',
  'linkedin_posts',
  'facebook_posts',
  'instagram_posts',
  'emails_sent',
  'email_replies',
  'email_transactional',
  'email_actions',
  'mcp_executions',
  'contracts',
  'invoices',
  'receipts',
];

export function normalizePlanId(rawPlan: string | null | undefined): NormalizedPlanId {
  const plan = String(rawPlan || 'free').trim().toLowerCase();
  if (plan === 'enterprise' || plan === 'premium' || plan === 'custom') return 'premium';
  if (plan === 'pro' || plan === 'starter') return 'pro';
  return 'free';
}

export function isUnlimitedPlan(rawPlan: string | null | undefined): boolean {
  return normalizePlanId(rawPlan) === 'premium';
}

/** `null` = unlimited (Premium). Never use arbitrary large numbers. */
export function getDailyLimitForPlan(rawPlan: string | null | undefined): number | null {
  if (isUnlimitedPlan(rawPlan)) return null;
  return normalizePlanId(rawPlan) === 'pro' ? PRO_DAILY_LIMIT : FREE_DAILY_LIMIT;
}

/** Backend/RPC convention: -1 means unlimited. */
export function getDailyLimitRpc(rawPlan: string | null | undefined): number {
  const limit = getDailyLimitForPlan(rawPlan);
  return limit === null ? -1 : limit;
}

export function buildResourceLimitsForPlan(rawPlan: string | null | undefined): Record<QuotaResourceType, number> {
  const rpcLimit = getDailyLimitRpc(rawPlan);
  return METERED_RESOURCES.reduce<Record<QuotaResourceType, number>>((acc, resource) => {
    acc[resource] = rpcLimit;
    return acc;
  }, {} as Record<QuotaResourceType, number>);
}

export const PLAN_RESOURCE_LIMITS: Record<NormalizedPlanId, Record<QuotaResourceType, number>> = {
  free: buildResourceLimitsForPlan('free'),
  pro: buildResourceLimitsForPlan('pro'),
  premium: buildResourceLimitsForPlan('premium'),
};

export function resolveResourceLimits(rawPlan: string | null | undefined): Record<QuotaResourceType, number> {
  return PLAN_RESOURCE_LIMITS[normalizePlanId(rawPlan)];
}

export type EntitlementCheck = {
  allowed: boolean;
  unlimited: boolean;
  limit: number | null;
  remaining: number | null;
  plan: NormalizedPlanId;
  message: string;
};

export function evaluateEntitlement(params: {
  rawPlan: string;
  currentUsage: number;
  resourceLabel?: string;
}): EntitlementCheck {
  const plan = normalizePlanId(params.rawPlan);
  const unlimited = plan === 'premium';
  const limit = getDailyLimitForPlan(params.rawPlan);
  const label = params.resourceLabel || 'actions';

  if (unlimited) {
    return {
      allowed: true,
      unlimited: true,
      limit: null,
      remaining: null,
      plan,
      message: 'Unlimited plan — no AlphaClone subscription quota applies.',
    };
  }

  const numericLimit = limit ?? FREE_DAILY_LIMIT;
  const remaining = Math.max(0, numericLimit - params.currentUsage);
  const allowed = params.currentUsage < numericLimit;

  return {
    allowed,
    unlimited: false,
    limit: numericLimit,
    remaining,
    plan,
    message: allowed
      ? `${remaining} ${label} remaining today on ${plan.toUpperCase()} plan.`
      : formatQuotaExceededMessage({
          plan,
          resourceLabel: label,
          currentUsage: params.currentUsage,
          limit: numericLimit,
        }),
  };
}

export function formatQuotaExceededMessage(params: {
  plan: NormalizedPlanId;
  resourceLabel: string;
  currentUsage: number;
  limit: number;
}): string {
  const upgradeTarget = params.plan === 'free' ? 'Pro or Premium' : 'Premium';
  return (
    `Daily limit reached for ${params.resourceLabel} on your ${params.plan.toUpperCase()} plan ` +
    `(${params.currentUsage}/${params.limit} today). Upgrade to ${upgradeTarget} for more capacity.`
  );
}

export function formatProviderLimitMessage(provider: string): string {
  return (
    `Your AlphaClone plan is unlimited, but your connected ${provider} provider has reached its sending limit. ` +
    `Reconnect or wait for the provider window to reset.`
  );
}

export function formatUsageDisplay(current: number, rawPlan: string, resourceLabel?: string): string {
  if (isUnlimitedPlan(rawPlan)) return 'Unlimited';
  const limit = getDailyLimitForPlan(rawPlan) ?? FREE_DAILY_LIMIT;
  const label = resourceLabel || 'today';
  return `${current} / ${limit} ${label}`;
}

export function getPublicPlanDisplayName(rawPlan: string): string {
  const normalized = normalizePlanId(rawPlan);
  if (normalized === 'premium') return 'Premium';
  if (normalized === 'pro') return 'Pro';
  return 'Free';
}
