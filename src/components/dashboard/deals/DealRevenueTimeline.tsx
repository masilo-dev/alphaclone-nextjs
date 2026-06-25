'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Circle, Loader2, ArrowRight, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useTenant } from '@/contexts/TenantContext';
import { buildDealRevenueTimeline } from '@/lib/dealRevenueTimeline';

type DealRevenueTimelineProps = {
    dealId: string;
    dealStage: string;
    className?: string;
};

export function DealRevenueTimeline({ dealId, dealStage, className = '' }: DealRevenueTimelineProps) {
    const router = useRouter();
    const { currentTenant } = useTenant();
    const [loading, setLoading] = useState(true);
    const [quotes, setQuotes] = useState<Array<{ id: string; status?: string | null }>>([]);
    const [contracts, setContracts] = useState<Array<{ id: string; status?: string | null }>>([]);
    const [invoices, setInvoices] = useState<Array<{ id: string; status?: string | null }>>([]);
    const [projects, setProjects] = useState<Array<{ id: string; status?: string | null }>>([]);
    const [hasActivity, setHasActivity] = useState(false);

    const load = useCallback(async () => {
        const tenantId = currentTenant?.id;
        if (!tenantId || !dealId) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const [quotesRes, projectsRes, activitiesRes, contractsRes] = await Promise.all([
                supabase.from('quotes').select('id, status').eq('tenant_id', tenantId).eq('deal_id', dealId),
                supabase.from('projects').select('id, status, contract_id').eq('tenant_id', tenantId).eq('deal_id', dealId),
                supabase.from('deal_activities').select('id').eq('deal_id', dealId).limit(1),
                supabase.from('contracts').select('id, status, metadata, project_id').eq('tenant_id', tenantId).limit(100),
            ]);

            const projectRows = (projectsRes.data || []) as Array<{
                id: string;
                status?: string;
                contract_id?: string;
            }>;
            setProjects(projectRows);
            setQuotes((quotesRes.data || []) as typeof quotes);
            setHasActivity((activitiesRes.data || []).length > 0);

            const linkedContracts = ((contractsRes.data || []) as Array<{
                id: string;
                status?: string;
                metadata?: { deal_id?: string } | null;
                project_id?: string;
            }>).filter(
                (c) =>
                    c.metadata?.deal_id === dealId ||
                    projectRows.some((p) => p.contract_id === c.id || p.id === c.project_id)
            );
            setContracts(linkedContracts);

            const projectIds = projectRows.map((p) => p.id);
            if (projectIds.length > 0) {
                const { data: invData } = await supabase
                    .from('business_invoices')
                    .select('id, status')
                    .eq('tenant_id', tenantId)
                    .in('project_id', projectIds);
                setInvoices((invData || []) as typeof invoices);
            } else {
                setInvoices([]);
            }
        } catch (e) {
            console.error('[DealRevenueTimeline]', e);
        } finally {
            setLoading(false);
        }
    }, [currentTenant?.id, dealId]);

    useEffect(() => {
        void load();
    }, [load]);

    const timeline = useMemo(
        () =>
            buildDealRevenueTimeline({
                dealStage,
                quotes,
                contracts,
                invoices,
                projects,
                hasActivity,
            }),
        [dealStage, quotes, contracts, invoices, projects, hasActivity]
    );

    if (loading) {
        return (
            <div className={`flex items-center gap-2 py-4 ${className}`}>
                <Loader2 className="w-4 h-4 animate-spin text-teal-400" />
                <span className="text-xs text-slate-500">Loading revenue chain…</span>
            </div>
        );
    }

    return (
        <div className={`bg-slate-900 border border-teal-500/20 rounded-2xl p-4 space-y-4 ${className}`}>
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h3 className="text-xs font-black uppercase tracking-widest text-teal-400">
                        Revenue chain
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                        Find → qualify → conduct → propose → contract → invoice → project
                    </p>
                </div>
                <div className="text-right shrink-0">
                    <div className="text-lg font-black text-white tabular-nums">{timeline.percent}%</div>
                    <div className="text-[10px] text-slate-500 font-bold">
                        {timeline.completedCount}/10 steps
                    </div>
                </div>
            </div>

            <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                    className="h-full bg-gradient-to-r from-teal-600 to-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: `${timeline.percent}%` }}
                />
            </div>

            {dealStage === 'closed_lost' && (
                <div className="flex items-start gap-2 rounded-lg bg-red-950/30 border border-red-500/20 px-3 py-2">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-red-300/90 leading-relaxed">
                        Deal closed lost. Start a new deal if this opportunity reopens.
                    </p>
                </div>
            )}

            {timeline.nextAction && (
                <button
                    type="button"
                    onClick={() => router.push(timeline.nextAction!.href)}
                    className="w-full flex items-center justify-between gap-3 rounded-xl bg-teal-950/50 border border-teal-500/30 px-3 py-2.5 text-left hover:bg-teal-950/80 transition-colors"
                >
                    <div className="min-w-0">
                        <div className="text-[10px] font-bold uppercase tracking-wide text-teal-400">
                            Next money move
                        </div>
                        <div className="text-sm font-semibold text-white truncate">{timeline.nextAction.label}</div>
                        <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">{timeline.nextAction.detail}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-teal-400 shrink-0" />
                </button>
            )}

            <ol className="space-y-0">
                {timeline.steps.map((item, idx) => {
                    const isLast = idx === timeline.steps.length - 1;
                    const icon =
                        item.state === 'complete' ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : item.state === 'current' ? (
                            <Circle className="w-4 h-4 text-teal-400 fill-teal-400/20" />
                        ) : item.state === 'skipped' ? (
                            <Circle className="w-4 h-4 text-slate-600" />
                        ) : (
                            <Circle className="w-4 h-4 text-slate-600" />
                        );

                    return (
                        <li key={item.step} className="flex gap-3">
                            <div className="flex flex-col items-center">
                                {icon}
                                {!isLast && (
                                    <div
                                        className={`w-0.5 flex-1 min-h-[20px] my-0.5 ${
                                            item.state === 'complete' ? 'bg-emerald-500/40' : 'bg-slate-700'
                                        }`}
                                    />
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={() => router.push(item.href)}
                                className={`flex-1 text-left pb-3 group ${isLast ? 'pb-0' : ''}`}
                            >
                                <div className="flex items-center gap-2">
                                    <span
                                        className={`text-[10px] font-bold tabular-nums ${
                                            item.state === 'current' ? 'text-teal-400' : 'text-slate-600'
                                        }`}
                                    >
                                        {item.index}
                                    </span>
                                    <span
                                        className={`text-sm font-semibold ${
                                            item.state === 'complete'
                                                ? 'text-slate-300'
                                                : item.state === 'current'
                                                  ? 'text-white'
                                                  : item.state === 'skipped'
                                                    ? 'text-slate-600 line-through'
                                                    : 'text-slate-500'
                                        }`}
                                    >
                                        {item.label}
                                    </span>
                                </div>
                                <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed group-hover:text-slate-400">
                                    {item.detail}
                                </p>
                            </button>
                        </li>
                    );
                })}
            </ol>
        </div>
    );
}
