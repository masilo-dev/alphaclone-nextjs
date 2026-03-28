import { SubscriptionPlan } from '@/services/tenancy/types';

// All plans include ALL features.
// The only difference between plans is the usage quotas below.
export interface PlanLimits {
    users: number;             // -1 = unlimited
    storage: number;           // GB
    projects: number;          // -1 = unlimited
    aiQueriesPerMonth: number; // AI assistant queries — scales per plan
    aiGrowthAgentRuns: number; // Autonomous agent runs/mo — scales per plan
    contractTemplates: number; // -1 = unlimited
    teamMembers: number;       // -1 = unlimited
    apiCallsPerMonth: number;  // -1 = unlimited
    supportSla: string;        // human-readable SLA label
}

export const PLAN_LIMITS: Record<SubscriptionPlan, PlanLimits> = {
    free: {
        users: 1,
        storage: 1,
        projects: 3,
        aiQueriesPerMonth: 10,
        aiGrowthAgentRuns: 0,
        contractTemplates: 3,
        teamMembers: 1,
        apiCallsPerMonth: 100,
        supportSla: 'Community',
    },
    starter: {
        users: 5,
        storage: 5,
        projects: 10,
        aiQueriesPerMonth: 50,
        aiGrowthAgentRuns: 10,
        contractTemplates: 10,
        teamMembers: 5,
        apiCallsPerMonth: 1000,
        supportSla: 'Standard (48h)',
    },
    pro: {
        users: 25,
        storage: 25,
        projects: 100,
        aiQueriesPerMonth: 500,
        aiGrowthAgentRuns: 200,
        contractTemplates: 100,
        teamMembers: 25,
        apiCallsPerMonth: 25000,
        supportSla: 'Priority (12h)',
    },
    enterprise: {
        users: -1,
        storage: 100,
        projects: -1,
        aiQueriesPerMonth: -1,
        aiGrowthAgentRuns: -1,
        contractTemplates: -1,
        teamMembers: -1,
        apiCallsPerMonth: -1,
        supportSla: 'Dedicated (4h)',
    },
    custom: {
        users: -1,
        storage: -1,
        projects: -1,
        aiQueriesPerMonth: -1,
        aiGrowthAgentRuns: -1,
        contractTemplates: -1,
        teamMembers: -1,
        apiCallsPerMonth: -1,
        supportSla: 'Dedicated (4h)',
    },
};

export function getPlanLimits(plan: SubscriptionPlan): PlanLimits {
    return PLAN_LIMITS[plan];
}

// All features are available on all plans — check quotas instead
export function canAccessFeature(
    _plan: SubscriptionPlan,
    _feature: keyof PlanLimits
): boolean {
    return true;
}

export function isWithinQuota(
    plan: SubscriptionPlan,
    resource: keyof PlanLimits,
    currentUsage: number
): boolean {
    const limits = getPlanLimits(plan);
    const limit = limits[resource] as number;
    if (limit === -1) return true;
    return currentUsage < limit;
}

export function isWithinLimit(
    plan: SubscriptionPlan,
    resource: 'users' | 'storage' | 'projects',
    currentCount: number
): boolean {
    const limits = getPlanLimits(plan);
    const limit = limits[resource];
    if (limit === -1) return true;
    return currentCount < limit;
}

export function formatLimit(value: number, unit = ''): string {
    if (value === -1) return 'Unlimited';
    return `${value.toLocaleString()}${unit ? ' ' + unit : ''}`;
}
