'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useTenant } from '@/contexts/TenantContext';
import { CrmNextStepsPanel } from './CrmNextStepsPanel';
import { RevenueChainNetworkDiagram } from './RevenueChainNetworkDiagram';
import { buildCombinedCrmNextSteps } from '@/lib/crmNextSteps';
import {
    buildRevenueChainNetwork,
    computeRevenueLeakage,
    computePipelineHealthScore,
    type RevenueLeakageInput,
} from '@/lib/revenueLifecycle';
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

    const networkNodes = useMemo(() => {
        if (!leakageInput) return [];
        return buildRevenueChainNetwork(leakageInput, items);
    }, [leakageInput, items]);

    if (loading) {
        return (
            <div className="flex items-center gap-2 px-4 py-3 mb-4 rounded-xl border border-white/5 bg-slate-900/40">
                <Loader2 className="w-4 h-4 animate-spin text-teal-400" />
                <span className="text-xs text-slate-500">Scanning revenue chain…</span>
            </div>
        );
    }

    return (
        <div className="space-y-3 mb-4">
            <div className="rounded-xl border border-white/5 bg-slate-900/50 px-4 py-3">
                <div className="mb-1">
                    <p className="text-sm font-bold text-white">{heading}</p>
                    {subheading && (
                        <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{subheading}</p>
                    )}
                </div>
                {health != null && networkNodes.length > 0 && (
                    <RevenueChainNetworkDiagram
                        nodes={networkNodes}
                        healthScore={health.score}
                        urgentCount={health.urgentCount}
                        className="mt-2"
                    />
                )}
            </div>
            {!leakageOnly && items.length > 0 && (
                <CrmNextStepsPanel
                    heading="Deal next steps"
                    items={items}
                />
            )}
        </div>
    );
}
