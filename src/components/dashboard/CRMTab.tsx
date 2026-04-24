'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { dealService, Deal, DealStage } from '../../services/dealService';
import { UnifiedCRMService } from '../../services/crm/UnifiedCRMService';
import { RefreshCw, Plus, Bell } from 'lucide-react';
import toast from 'react-hot-toast';
import { tenantService } from '../../services/tenancy/TenantService';

const STAGES: { id: DealStage; label: string; color: string }[] = [
    { id: 'lead', label: 'Lead', color: 'bg-slate-500' },
    { id: 'qualified', label: 'Qualified', color: 'bg-blue-500' },
    { id: 'proposal', label: 'Proposal', color: 'bg-yellow-500' },
    { id: 'negotiation', label: 'Negotiation', color: 'bg-orange-500' },
    { id: 'closed_won', label: 'Closed Won', color: 'bg-green-500' },
    { id: 'closed_lost', label: 'Closed Lost', color: 'bg-red-500' },
];

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

    const stageCounts = useMemo(() => {
        return STAGES.reduce<Record<DealStage, number>>((acc, stage) => {
            acc[stage.id] = deals.filter((d) => d.stage === stage.id).length;
            return acc;
        }, {
            lead: 0,
            qualified: 0,
            proposal: 0,
            negotiation: 0,
            closed_won: 0,
            closed_lost: 0,
        });
    }, [deals]);

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

    return (
        <div className="w-full min-w-0 flex flex-col text-white pb-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-white">CRM Pipeline</h1>
                    <p className="text-slate-400 text-xs sm:text-sm mt-1">
                        Turn pipeline data into the next customer action: dates, stages, and revenue outcomes.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                    <button
                        type="button"
                        onClick={() => router.push('/dashboard/leads?source=mcp')}
                        className="flex-1 min-w-[120px] sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-white/10 rounded-xl transition-colors font-medium text-xs sm:text-sm h-10"
                    >
                        MCP Leads
                    </button>
                    <button
                        type="button"
                        onClick={() => router.push('/dashboard/contacts')}
                        className="flex-1 min-w-[120px] sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-white/10 rounded-xl transition-colors font-medium text-xs sm:text-sm h-10"
                    >
                        Contacts
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
                            <button
                                type="button"
                                onClick={() => router.push('/dashboard/deals')}
                                className="flex-1 min-w-[120px] sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 bg-teal-600 hover:bg-teal-500 rounded-xl transition-colors font-medium text-xs sm:text-sm h-10"
                            >
                                <Plus className="w-4 h-4" />
                                New Deal
                            </button>
                            <button
                                type="button"
                                onClick={() => router.push('/dashboard/deals?createFromLead=1')}
                                className="flex-1 min-w-[120px] sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-teal-500/30 text-teal-300 rounded-xl transition-colors font-medium text-xs sm:text-sm h-10"
                            >
                                From Lead
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
        </div>
    );
}
