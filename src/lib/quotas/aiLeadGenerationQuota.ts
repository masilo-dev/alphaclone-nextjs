import type { SupabaseClient } from '@supabase/supabase-js';
import {
    getDailyAiLeadLimit,
    nextUtcMidnightIso,
} from '@/config/aiLeadQuotas';

const TABLE = 'ai_lead_generation_daily';

export type AiLeadQuotaStatus = {
    allowed: boolean;
    limit: number;
    used: number;
    remaining: number;
    resetsAt: string;
};

function utcToday(): string {
    return new Date().toISOString().split('T')[0];
}

export async function getAiLeadUsageForDay(
    admin: SupabaseClient,
    tenantId: string,
    dateYmd: string
): Promise<number> {
    const { data, error } = await admin
        .from(TABLE)
        .select('leads_count')
        .eq('tenant_id', tenantId)
        .eq('usage_date', dateYmd)
        .maybeSingle();

    if (error) {
        console.warn('[aiLeadQuota] read failed:', error.message);
        return 0;
    }
    return Number(data?.leads_count ?? 0);
}

export async function getAiLeadQuotaStatus(
    admin: SupabaseClient,
    tenantId: string,
    plan: string | null | undefined
): Promise<AiLeadQuotaStatus> {
    const limit = getDailyAiLeadLimit(plan);
    const day = utcToday();
    const used = await getAiLeadUsageForDay(admin, tenantId, day);
    const remaining = Math.max(0, limit - used);
    return {
        allowed: remaining > 0,
        limit,
        used,
        remaining,
        resetsAt: nextUtcMidnightIso(),
    };
}

/**
 * Reserves capacity for up to `maxRequested` leads. Returns how many may be returned this call.
 */
export async function reserveAiLeadBatch(
    admin: SupabaseClient,
    tenantId: string,
    plan: string | null | undefined,
    maxRequested: number
): Promise<{ allowed: boolean; capThisBatch: number; status: AiLeadQuotaStatus }> {
    const status = await getAiLeadQuotaStatus(admin, tenantId, plan);
    if (!status.allowed) {
        return { allowed: false, capThisBatch: 0, status };
    }
    const capThisBatch = Math.min(maxRequested, status.remaining);
    if (capThisBatch <= 0) {
        return {
            allowed: false,
            capThisBatch: 0,
            status: { ...status, allowed: false, remaining: 0 },
        };
    }
    return { allowed: true, capThisBatch, status };
}

export async function recordAiLeadsGenerated(
    admin: SupabaseClient,
    tenantId: string,
    count: number
): Promise<void> {
    if (count <= 0) return;
    const day = utcToday();
    const used = await getAiLeadUsageForDay(admin, tenantId, day);
    const next = used + count;

    const { error } = await admin.from(TABLE).upsert(
        {
            tenant_id: tenantId,
            usage_date: day,
            leads_count: next,
            updated_at: new Date().toISOString(),
        },
        { onConflict: 'tenant_id,usage_date' }
    );

    if (error) {
        console.error('[aiLeadQuota] upsert failed:', error);
    }
}
