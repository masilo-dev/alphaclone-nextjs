'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { dealService, Deal } from '../../services/dealService';
import { UnifiedCRMService } from '../../services/crm/UnifiedCRMService';
import { RefreshCw, Bell, AlertTriangle, CalendarClock, CheckCircle2, CircleDollarSign, Radar, Target } from 'lucide-react';
import toast from 'react-hot-toast';
import { tenantService } from '../../services/tenancy/TenantService';

export default function CRMTab({ userId, userRole }: { userId: string; userRole?: string }) {
    const router = useRouter();
    const canManagePipeline =
        userRole === 'admin' || userRole === 'tenant_admin' || userRole === 'business_dashboard';
    const [deals, setDeals] = useState<Deal[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [crmIntelligenceActions, setCrmIntelligenceActions] = useState<string[]>([]);

    useEffect(() => {
        loadDeals();
        void loadCrmIntelligence();
    }, []);

    const loadCrmIntelligence = async () => {
        try {
            const tenantId = tenantService.getCurrentTenantId();
            if (!tenantId) return;
            const response = await fetch(`/api/intelligence/system?tenantId=${encodeURIComponent(tenantId)}`);
            const payload = await response.json();
            if (!response.ok) return;
            const modules = payload?.data?.modules || [];
            const crmModule = modules.find((moduleRow: any) => moduleRow.module === 'crm');
            const actions = Array.isArray(crmModule?.recommendations) ? crmModule.recommendations : [];
            setCrmIntelligenceActions(actions.slice(0, 3));
        } catch {
            setCrmIntelligenceActions([]);
        }
    };

    const loadDeals = async () => {
        setLoading(true);
        const { deals, error } = await dealService.getDeals();
        if (error) toast.error('Failed to load deals');
        setDeals(deals || []);
        setLoading(false);
    };

    const handleSync = async () => {
        setSyncing(true);
        const toastId = toast.loading('Syncing with external CRM (HubSpot)...');
        try {
            const res = await UnifiedCRMService.pullDeals();
            if (res?.success) {
                toast.success(`Synced ${res.syncedCount} deals successfully`, { id: toastId });
                loadDeals();
            } else {
                toast.error(`Sync failed: ${res?.error || 'Unknown error'}`, { id: toastId });
            }
        } catch (e) {
            toast.error('Sync failed', { id: toastId });
        } finally {
            setSyncing(false);
        }
    };

    const compactNotification = useMemo(() => {
        const overdueOpenDeals = deals.filter((deal) => {
            if (!deal.expectedCloseDate) return false;
            const isClosed = deal.stage === 'closed_won' || deal.stage === 'closed_lost';
            return !isClosed && new Date(deal.expectedCloseDate).getTime() < Date.now();
        }).length;

        const lateStageWithoutDate = deals.filter(
            (deal) => (deal.stage === 'proposal' || deal.stage === 'negotiation') && !deal.expectedCloseDate
        ).length;

        if (overdueOpenDeals > 0) return `${overdueOpenDeals} open deal(s) past expected close date`;
        if (lateStageWithoutDate > 0) return `${lateStageWithoutDate} late-stage deal(s) missing close date`;
        if (crmIntelligenceActions.length > 0) return crmIntelligenceActions[0];
        return 'Pipeline is stable. No urgent CRM alerts.';
    }, [deals, crmIntelligenceActions]);

    const totalOpenDeals = useMemo(() => {
        return deals.filter((deal) => deal.stage !== 'closed_won' && deal.stage !== 'closed_lost').length;
    }, [deals]);

    const crmMetrics = useMemo(() => {
        const now = new Date();
        const openDeals = deals.filter((deal) => deal.stage !== 'closed_won' && deal.stage !== 'closed_lost');
        const weightedPipeline = openDeals.reduce(
            (sum, deal) => sum + ((deal.value || 0) * (deal.probability || 0)) / 100,
            0
        );
        const overdueDeals = openDeals.filter((deal) => deal.expectedCloseDate && new Date(deal.expectedCloseDate) < now);
        const lateStageWithoutDate = openDeals.filter(
            (deal) => (deal.stage === 'proposal' || deal.stage === 'negotiation') && !deal.expectedCloseDate
        );
        const missingNextStep = openDeals.filter((deal) => !deal.nextStep?.trim());
        const unthreadedLateStage = openDeals.filter(
            (deal) => (deal.stage === 'proposal' || deal.stage === 'negotiation') && !deal.contactId
        );

        const actionQueue = openDeals
            .map((deal) => {
                const reasons: string[] = [];
                let urgency = 0;

                if (deal.expectedCloseDate && new Date(deal.expectedCloseDate) < now) {
                    reasons.push('close date slipped');
                    urgency += 4;
                }
                if ((deal.stage === 'proposal' || deal.stage === 'negotiation') && !deal.expectedCloseDate) {
                    reasons.push('missing close date');
                    urgency += 3;
                }
                if (!deal.nextStep?.trim()) {
                    reasons.push('missing next step');
                    urgency += 3;
                }
                if ((deal.intelligenceScore ?? 100) < 55) {
                    reasons.push('low confidence');
                    urgency += 2;
                }
                if ((deal.probability ?? 0) < 40 && (deal.stage === 'proposal' || deal.stage === 'negotiation')) {
                    reasons.push('weak conversion odds');
                    urgency += 2;
                }
                if (!deal.contactId && (deal.stage === 'proposal' || deal.stage === 'negotiation')) {
                    reasons.push('no contact attached');
                    urgency += 1;
                }

                return { deal, reasons, urgency };
            })
            .filter((item) => item.urgency > 0)
            .sort((a, b) => b.urgency - a.urgency || (b.deal.value || 0) - (a.deal.value || 0))
            .slice(0, 5);

        return {
            openDeals,
            overdueDeals,
            lateStageWithoutDate,
            missingNextStep,
            unthreadedLateStage,
            weightedPipeline,
            actionQueue,
        };
    }, [deals]);

    const metricCards = useMemo(() => {
        return [
            {
                label: 'Weighted Pipeline',
                value: `$${Math.round(crmMetrics.weightedPipeline).toLocaleString()}`,
                hint: 'Revenue adjusted by probability',
                icon: CircleDollarSign,
                accent: 'text-emerald-300',
            },
            {
                label: 'Deals At Risk',
                value: crmMetrics.overdueDeals.length,
                hint: 'Open deals past expected close',
                icon: AlertTriangle,
                accent: 'text-amber-300',
            },
            {
                label: 'Missing Next Step',
                value: crmMetrics.missingNextStep.length,
                hint: 'Open deals without a clear action',
                icon: Target,
                accent: 'text-rose-300',
            },
            {
                label: 'Late Stage Gaps',
                value: crmMetrics.lateStageWithoutDate.length,
                hint: 'Proposal/negotiation deals with no date',
                icon: CalendarClock,
                accent: 'text-sky-300',
            },
        ];
    }, [crmMetrics]);

    return (
        <div className="w-full min-w-0 flex flex-col text-white pb-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-white">CRM</h1>
                    <p className="text-slate-400 text-xs sm:text-sm mt-1">
                        Focus on one next action.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                    <button
                        type="button"
                        onClick={() => router.push('/dashboard/deals')}
                        className="flex-1 min-w-[120px] sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-white/10 rounded-xl transition-colors font-medium text-xs sm:text-sm h-10"
                    >
                        Open Deals
                    </button>
                    <button
                        type="button"
                        onClick={() => router.push('/dashboard/leads?source=mcp')}
                        className="flex-1 min-w-[120px] sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-white/10 rounded-xl transition-colors font-medium text-xs sm:text-sm h-10"
                    >
                        MCP Leads
                    </button>
                    {canManagePipeline && (
                        <>
                            <button
                                type="button"
                                onClick={handleSync}
                                disabled={syncing}
                                className="flex-1 min-w-[140px] sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors border border-white/10 disabled:opacity-50 text-xs sm:text-sm h-10"
                            >
                                <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                                {syncing ? 'Syncing...' : 'Sync CRM'}
                            </button>
                        </>
                    )}
                </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                        <Bell className="w-4 h-4 text-teal-400 mt-0.5 shrink-0" />
                        <p className="text-sm text-slate-200 leading-snug">{compactNotification}</p>
                    </div>
                    <div className="flex items-center justify-between gap-3 sm:gap-4 sm:justify-end">
                        <div className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2">
                            <p className="text-[11px] uppercase tracking-wide text-slate-400">Open deals</p>
                            <p className="text-lg font-semibold text-white">{totalOpenDeals}</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => router.push('/dashboard/deals')}
                            className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200"
                        >
                            Open deals
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 mt-4">
                {metricCards.map((card) => {
                    const Icon = card.icon;
                    return (
                        <div key={card.label} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="text-[11px] uppercase tracking-wide text-slate-400">{card.label}</p>
                                    <p className="text-2xl font-semibold text-white mt-2">{card.value}</p>
                                    <p className="text-xs text-slate-500 mt-2">{card.hint}</p>
                                </div>
                                <div className={`rounded-xl border border-white/10 bg-slate-900/80 p-2 ${card.accent}`}>
                                    <Icon className="w-4 h-4" />
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[1.45fr_1fr] gap-4 mt-4">
                <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-4">
                    <div className="flex items-center justify-between gap-3 mb-4">
                        <div>
                            <h2 className="text-sm font-semibold text-white">Revenue Command Queue</h2>
                            <p className="text-xs text-slate-500 mt-1">Deals that need an immediate operator decision.</p>
                        </div>
                        <Radar className="w-4 h-4 text-teal-400" />
                    </div>

                    <div className="space-y-3">
                        {crmMetrics.actionQueue.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-white/10 bg-slate-950/40 px-4 py-5 text-sm text-slate-400">
                                No urgent deal hygiene gaps right now.
                            </div>
                        ) : (
                            crmMetrics.actionQueue.map(({ deal, reasons, urgency }) => (
                                <button
                                    key={deal.id}
                                    type="button"
                                    onClick={() => router.push(`/dashboard/deals?highlight=${deal.id}`)}
                                    className="w-full rounded-xl border border-white/10 bg-slate-950/50 p-4 text-left hover:border-teal-500/40 hover:bg-slate-900/70 transition-colors"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-white truncate">{deal.name}</p>
                                            <p className="text-xs text-slate-400 mt-1">
                                                {deal.stage.replace('_', ' ')} • ${(deal.value || 0).toLocaleString()} • {deal.probability || 0}% probability
                                            </p>
                                        </div>
                                        <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-amber-200">
                                            P{urgency}
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap gap-2 mt-3">
                                        {reasons.map((reason) => (
                                            <span
                                                key={reason}
                                                className="rounded-full border border-white/10 bg-slate-900/80 px-2 py-1 text-[11px] text-slate-300"
                                            >
                                                {reason}
                                            </span>
                                        ))}
                                    </div>
                                    <p className="text-xs text-slate-500 mt-3">
                                        Next step: {deal.nextStep?.trim() || 'No next step captured yet'}
                                    </p>
                                </button>
                            ))
                        )}
                    </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-4">
                    <div className="flex items-center justify-between gap-3 mb-4">
                        <div>
                            <h2 className="text-sm font-semibold text-white">Pipeline Weaknesses</h2>
                            <p className="text-xs text-slate-500 mt-1">The pain points competitors usually hide in separate tools.</p>
                        </div>
                        <CheckCircle2 className="w-4 h-4 text-teal-400" />
                    </div>

                    <div className="space-y-3">
                        {[
                            {
                                label: 'Overdue expected closes',
                                value: crmMetrics.overdueDeals.length,
                                detail: 'Deals slipping without being requalified.',
                            },
                            {
                                label: 'Late-stage deals without close dates',
                                value: crmMetrics.lateStageWithoutDate.length,
                                detail: 'Proposal and negotiation records with weak forecasting discipline.',
                            },
                            {
                                label: 'Late-stage deals without contact linkage',
                                value: crmMetrics.unthreadedLateStage.length,
                                detail: 'Revenue is exposed when no accountable buyer thread is attached.',
                            },
                            {
                                label: 'Open deals without next step',
                                value: crmMetrics.missingNextStep.length,
                                detail: 'Pipeline volume without action ownership turns into false confidence.',
                            },
                        ].map((item) => (
                            <div key={item.label} className="rounded-xl border border-white/10 bg-slate-950/50 p-4">
                                <div className="flex items-center justify-between gap-3">
                                    <p className="text-sm text-slate-200">{item.label}</p>
                                    <span className="text-lg font-semibold text-white">{item.value}</span>
                                </div>
                                <p className="text-xs text-slate-500 mt-2">{item.detail}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

