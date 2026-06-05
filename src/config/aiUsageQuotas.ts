import type { SubscriptionPlan } from '@/services/tenancy/types';

/** Max weighted AI units per UTC day per tenant, by subscription (shared across generate, chat, vision, leads AI passes, etc.). */
export const AI_UNITS_PER_DAY_BY_PLAN: Record<SubscriptionPlan, number> = {
    free: 250,
    starter: 2500,
    pro: 100_000,
    enterprise: 500_000,
    custom: 2_000_000,
};

export function getDailyAiUnitsLimit(plan: string | null | undefined): number {
    const p = (plan || 'free') as SubscriptionPlan;
    if (p in AI_UNITS_PER_DAY_BY_PLAN) {
        return AI_UNITS_PER_DAY_BY_PLAN[p];
    }
    return AI_UNITS_PER_DAY_BY_PLAN.free;
}

export function unitsForTextGeneration(maxTokens?: number): number {
    const mt = maxTokens ?? 2048;
    return Math.min(30, Math.max(1, Math.ceil(mt / 256)));
}

export const UNITS_PER_CHAT_TURN = 4;
export const UNITS_PER_IMAGE = 25;
// Video generation is by far the most expensive AI operation (long polling, GPU minutes).
export const UNITS_PER_VIDEO = 80;
export const UNITS_PER_VISION = 10;
export const UNITS_PER_LEAD_AI_PASS = 14;
export const UNITS_PER_OUTREACH_EMAIL = 4;
