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

/** Plans that include AI image generation (logos, social AI images, AI Studio). */
export const IMAGE_GENERATION_PLANS = new Set(['pro', 'enterprise', 'custom']);

/** Promo: all plans can generate images free through end of June 2026. */
export const IMAGE_GENERATION_FREE_UNTIL = new Date('2026-06-30T23:59:59.999Z');

export function isImageGenerationPromoActive(now: Date = new Date()): boolean {
    return now.getTime() <= IMAGE_GENERATION_FREE_UNTIL.getTime();
}

export function planIncludesImageGeneration(plan: string | null | undefined): boolean {
    if (isImageGenerationPromoActive()) return true;
    return IMAGE_GENERATION_PLANS.has((plan || 'free').toLowerCase());
}
// Video generation is by far the most expensive AI operation (long polling, GPU minutes).
export const UNITS_PER_VIDEO = 80;
export const UNITS_PER_VISION = 10;
export const UNITS_PER_LEAD_AI_PASS = 14;
export const UNITS_PER_OUTREACH_EMAIL = 4;
