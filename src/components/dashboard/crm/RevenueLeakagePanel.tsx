'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useTenant } from '@/contexts/TenantContext';
import { CrmNextStepsPanel } from './CrmNextStepsPanel';
import { buildCombinedCrmNextSteps } from '@/lib/crmNextSteps';
import { computeRevenueLeakage, computePipelineHealthScore, type RevenueLeakageInput } from '@/lib/revenueLifecycle';
import type { Deal } from '@/services/dealService';

type RevenueLeakagePanelProps = {
    /** When provided, merges pipeline next-steps with leakage (e.g. Deals tab). */
    deals?: Array<{
        id: string;
        name: string;
        stage: string;
        value?: number;
        updated_at?: string;
        updatedAt?: string;
        expectedCloseDate?: string;
        expected_close_date?: string;
    }>;
    heading?: string;
    subheading?: string;
    /** Leakage-only mode (Sales Console home). */
    leakageOnly?: boolean;
};

function toDealServiceShape(
    rows: RevenueLeakagePanelProps['deals']
): Deal[] {
    if (!rows?.length) return [];
    return rows.map((d) => ({
        id: d.id,
        name: d.name,
        stage: d.stage as Deal['stage'],
        value: d.value,
        currency: 'USD',
        probability: 0,
        updatedAt: d.updatedAt || d.updated_at || '',
        expectedCloseDate: d.expectedCloseDate || d.expected_close_date,
        createdAt: '',
    }));
}

export function RevenueLeakagePanel({
    deals: dealsProp,
    heading = 'Revenue integrity',
    subheading = 'Where money is stuck or steps were skipped in your find → qualify → propose → contract → invoice → project chain.',
    leakageOnly = false,
}: RevenueLeakagePanelProps) {
    const { currentTenant } = useTenant();
    const [loading, setLoading] = useState(true);
    const [leakageInput, setLeakageInput] = useState<RevenueLeakageInput | null>(null);

    const load = useCallback(async () => {
        const tenantId = currentTenant?.id;
        if (!tenantId) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000).toISOString();
            const [
                dealsRes,
                quotesRes,
                contractsRes,
                projectsRes,
                invoicesRes,
                leadsRes,
                socialRes,
                campaignsRes,
            ] = await Promise.all([
                dealsProp
                    ? Promise.resolve({ data: dealsProp })
                    : supabase.from('deals').select('id, name, stage, value, updated_at, created_at').eq('tenant_id', tenantId),
                supabase.from('quotes').select('id, deal_id, status').eq('tenant_id', tenantId).limit(200),
                supabase.from('contracts').select('id, status, metadata, project_id').eq('tenant_id', tenantId).limit(200),
                supabase.from('projects').select('id, deal_id, contract_id').eq('tenant_id', tenantId).limit(200),
                supabase
                    .from('business_invoices')
                    .select('id, project_id, status, total, total_amount')
                    .eq('tenant_id', tenantId)
                    .limit(200),
                supabase.from('leads').select('id, status, stage, created_at').eq('tenant_id', tenantId).limit(200),
                supabase
                    .from('social_posts')
                    .select('id')
                    .eq('tenant_id', tenantId)
                    .gte('created_at', threeDaysAgo)
                    .limit(1),
                supabase
                    .from('email_campaigns')
                    .select('id, status')
                    .eq('tenant_id', tenantId)
                    .eq('status', 'sent')
                    .limit(50),
            ]);

            const input: RevenueLeakageInput = {
                deals: (dealsRes.data || []) as RevenueLeakageInput['deals'],
                quotes: (quotesRes.data || []) as RevenueLeakageInput['quotes'],
                contracts: (contractsRes.data || []) as RevenueLeakageInput['contracts'],
                projects: (projectsRes.data || []) as RevenueLeakageInput['projects'],
                invoices: (invoicesRes.data || []) as RevenueLeakageInput['invoices'],
                leads: (leadsRes.data || []) as RevenueLeakageInput['leads'],
                recentSocialPostCount: (socialRes.data || []).length,
                sentCampaignCount: (campaignsRes.data || []).length,
            };
            setLeakageInput(input);
        } catch (e) {
            console.error('[RevenueLeakagePanel]', e);
            setLeakageInput(null);
        } finally {
            setLoading(false);
        }
    }, [currentTenant?.id, dealsProp]);

    useEffect(() => {
        void load();
    }, [load]);

    const items = useMemo(() => {
        if (!leakageInput) return [];
        if (leakageOnly) return computeRevenueLeakage(leakageInput);
        const mapped = toDealServiceShape(dealsProp || leakageInput.deals);
        return buildCombinedCrmNextSteps(mapped, leakageInput);
    }, [leakageInput, leakageOnly, dealsProp]);

    const health = useMemo(() => {
        if (!leakageInput) return null;
        return computePipelineHealthScore(leakageInput);
    }, [leakageInput]);

    if (loading) {
        return (
            <div className="flex items-center gap-2 px-4 py-3 mb-4 rounded-xl border border-white/5 bg-slate-900/40">
                <Loader2 className="w-4 h-4 animate-spin text-teal-400" />
                <span className="text-xs text-slate-500">Scanning revenue chain…</span>
            </div>
        );
    }

    return (
        <div className="space-y-2 mb-4">
            {health != null && (
                <div className="rounded-xl border border-white/5 bg-slate-900/50 px-4 py-3">
                    <div className="flex items-center justify-between gap-3 mb-2">
                        <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                            Revenue chain health
                        </span>
                        <span className="text-sm font-black text-teal-400 tabular-nums">{health.score}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                        <div
                            className="h-full bg-teal-500 rounded-full transition-all"
                            style={{ width: `${health.score}%` }}
                        />
                    </div>
                    {health.urgentCount > 0 && (
                        <p className="text-[10px] text-amber-400/90 mt-2">
                            {health.urgentCount} urgent leak{health.urgentCount === 1 ? '' : 's'} — fix below to protect revenue.
                        </p>
                    )}
                </div>
            )}
            <CrmNextStepsPanel
                heading={heading}
                subheading={subheading}
                items={items}
            />
        </div>
    );
}
