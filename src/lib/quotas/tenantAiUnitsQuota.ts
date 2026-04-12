import type { SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import {
    describeMissingVersusHigherPlans,
    nextUtcMidnightIso,
    pricingUpgradeUrl,
} from '@/config/aiLeadQuotas';
import { getDailyAiUnitsLimit } from '@/config/aiUsageQuotas';

export type TenantAiUnitsConsumeResult =
    | { ok: true; used: number; limit: number; remaining: number }
    | { ok: false; used: number; limit: number; remaining: number };

type RpcRow = {
    ok?: boolean;
    used?: number;
    limit?: number;
    remaining?: number;
    error?: string;
};

function parseRpcPayload(data: unknown): RpcRow | null {
    if (data && typeof data === 'object' && !Array.isArray(data)) {
        return data as RpcRow;
    }
    return null;
}

export async function consumeTenantAiUnits(
    admin: SupabaseClient,
    tenantId: string,
    plan: string | null | undefined,
    units: number
): Promise<TenantAiUnitsConsumeResult> {
    const limit = getDailyAiUnitsLimit(plan);
    const { data, error } = await admin.rpc('consume_tenant_ai_units', {
        p_tenant_id: tenantId,
        p_units: Math.max(0, Math.floor(units)),
        p_daily_limit: limit,
    });

    if (error) {
        console.error('[tenantAiUnits] rpc failed:', error.message);
        return { ok: false, used: 0, limit, remaining: 0 };
    }

    const row = parseRpcPayload(data);
    if (!row || typeof row.ok !== 'boolean') {
        console.error('[tenantAiUnits] unexpected rpc payload:', data);
        return { ok: false, used: 0, limit, remaining: 0 };
    }

    const used = Number(row.used ?? 0);
    const lim = Number(row.limit ?? limit);
    const remaining = Number(row.remaining ?? Math.max(0, lim - used));

    if (row.ok) {
        return { ok: true, used, limit: lim, remaining };
    }
    return { ok: false, used, limit: lim, remaining };
}

export function aiUnitsQuotaExceededJson(plan: string, partial: TenantAiUnitsConsumeResult & { ok: false }) {
    return {
        error: 'Daily AI usage limit reached for your subscription.',
        code: 'AI_USAGE_QUOTA_EXCEEDED' as const,
        plan,
        limit: partial.limit,
        used: partial.used,
        remaining: partial.remaining,
        resetsAt: nextUtcMidnightIso(),
        upgradeUrl: pricingUpgradeUrl(),
        missingFeatures: describeMissingVersusHigherPlans(plan),
    };
}

export async function consumeAiUnitsOr429(
    admin: SupabaseClient,
    tenantId: string,
    plan: string,
    units: number
): Promise<NextResponse | null> {
    const r = await consumeTenantAiUnits(admin, tenantId, plan, units);
    if (!r.ok) {
        return NextResponse.json(aiUnitsQuotaExceededJson(plan, r), { status: 429 });
    }
    return null;
}
