import type { SubscriptionPlan } from '@/services/tenancy/types';
import { PLAN_PRICING } from '@/services/tenancy/types';

/** Max AI-discovered leads returned per calendar day (UTC) per tenant, by subscription. */
export const AI_LEADS_PER_DAY_BY_PLAN: Record<SubscriptionPlan, number> = {
    free: 50,
    starter: 250,
    pro: 5000,
    enterprise: 50000,
    custom: 100000,
};

export function getDailyAiLeadLimit(plan: string | null | undefined): number {
    const p = (plan || 'free') as SubscriptionPlan;
    if (p in AI_LEADS_PER_DAY_BY_PLAN) {
        return AI_LEADS_PER_DAY_BY_PLAN[p];
    }
    return AI_LEADS_PER_DAY_BY_PLAN.free;
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://alphaclone.tech';

export function pricingUpgradeUrl(): string {
    return `${APP_URL}/pricing`;
}

/**
 * Short copy for quota / digest emails: what higher plans include that this plan lacks.
 */
export function describeMissingVersusHigherPlans(plan: string | null | undefined): string {
    const p = (plan || 'free') as SubscriptionPlan;
    const cur = PLAN_PRICING[p]?.features;
    const pro = PLAN_PRICING.pro.features;
    if (!cur) {
        return `See all options at ${pricingUpgradeUrl()}.`;
    }
    const parts: string[] = [];
    if (!cur.aiAssistant && pro.aiAssistant) {
        parts.push('Pro and Enterprise include the AI Sales Assistant with much higher daily AI lead allowances');
    }
    if (!cur.fullCRM && pro.fullCRM) {
        parts.push('full CRM automation');
    }
    if (!cur.workflows && pro.workflows) {
        parts.push('advanced workflows');
    }
    if (!cur.apiAccess && pro.apiAccess) {
        parts.push('API access');
    }
    if (parts.length === 0) {
        return `You are on a strong plan. For custom limits or white-label options, contact sales. ${pricingUpgradeUrl()}`;
    }
    return `${parts.join('; ')}. Compare plans: ${pricingUpgradeUrl()}`;
}

export function nextUtcMidnightIso(): string {
    const d = new Date();
    d.setUTCHours(24, 0, 0, 0);
    return d.toISOString();
}
