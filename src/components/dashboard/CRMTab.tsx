'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { dealService, Deal, DealStage } from '../../services/dealService';
import { UnifiedCRMService } from '../../services/crm/UnifiedCRMService';
import { RefreshCw, Plus, MoreHorizontal, DollarSign, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';
import { CrmNextStepsPanel } from './crm/CrmNextStepsPanel';
import { buildCrmOverviewNextSteps } from '../../lib/crmNextSteps';

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
    const [deals, setDeals] = useState<Deal[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);

    useEffect(() => {
        loadDeals();
    }, []);

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

    const getStageDeals = (stage: DealStage) => deals.filter(d => d.stage === stage);

    const overviewNextSteps = useMemo(() => buildCrmOverviewNextSteps(deals), [deals]);

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
                <div className="flex gap-3 w-full sm:w-auto">
                    <button
                        onClick={handleSync}
                        disabled={syncing}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors border border-white/10 disabled:opacity-50 text-sm h-10"
                    >
                        <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                        {syncing ? 'Syncing...' : 'Sync CRM'}
                    </button>
                    <button
                        type="button"
                        onClick={() => router.push('/dashboard/deals')}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-500 rounded-xl transition-colors font-medium text-sm h-10"
                    >
                        <Plus className="w-4 h-4" />
                        New Deal
                    </button>
                </div>
            </div>

            {!loading && (
                <CrmNextStepsPanel
                    heading="What to do next"
                    subheading="Execution beats silos. Work the highest-impact moves toward signed business."
                    items={overviewNextSteps}
                />
            )}

            {/* Kanban Board */}
            <div className="w-full min-w-0">
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 pb-4 items-start">
                    {STAGES.map(stage => (
                        <div key={stage.id} className="min-w-0 flex flex-col bg-slate-800/50 rounded-xl border border-white/5 max-h-[min(75vh,720px)]">
                            {/* Stage Header */}
                            <div className={`px-2 py-2 border-b border-slate-700 flex items-center gap-1.5 ${stage.color} bg-opacity-10`}>
                                <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${stage.color}`} />
                                <span className="font-semibold text-xs truncate">{stage.label}</span>
                                <span className="bg-slate-800 text-[10px] px-1.5 py-0.5 rounded-full text-slate-400 shrink-0 ml-auto">
                                    {getStageDeals(stage.id).length}
                                </span>
                            </div>

                            {/* Deals List */}
                            <div className="flex-1 min-h-0 p-1.5 overflow-y-auto space-y-1.5 custom-scrollbar">
                                {loading ? (
                                    <div className="animate-pulse space-y-2">
                                        <div className="h-24 bg-slate-800 rounded-lg" />
                                        <div className="h-24 bg-slate-800 rounded-lg" />
                                    </div>
                                ) : (
                                    getStageDeals(stage.id).map(deal => (
                                        <div key={deal.id} className="bg-slate-800 p-2 rounded-lg border border-slate-700 hover:border-teal-500/50 transition-colors cursor-pointer group shadow-sm">
                                            <div className="flex justify-between items-start mb-1">
                                                <h3 className="font-medium text-xs text-slate-200 line-clamp-1 leading-tight">{deal.name}</h3>
                                                <button className="text-slate-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-1">
                                                    <MoreHorizontal className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                            
                                            <div className="flex items-center gap-1 text-slate-400 text-[10px]">
                                                <DollarSign className="w-3 h-3 shrink-0" />
                                                <span className="font-mono text-emerald-400 truncate">
                                                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: deal.currency || 'USD', notation: 'compact' }).format(deal.value || 0)}
                                                </span>
                                            </div>

                                            <div className="flex justify-between items-center mt-1.5 pt-1.5 border-t border-slate-700/50">
                                                <div className="flex items-center gap-1 text-slate-500 text-[10px] truncate">
                                                    <Calendar className="w-3 h-3 shrink-0" />
                                                    <span className="truncate">{deal.expectedCloseDate ? new Date(deal.expectedCloseDate).toLocaleDateString() : 'No Date'}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
