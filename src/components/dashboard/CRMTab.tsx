import React, { useState, useEffect } from 'react';
import { dealService, Deal, DealStage } from '../../services/dealService';
import { UnifiedCRMService } from '../../services/crm/UnifiedCRMService';
import { RefreshCw, Plus, MoreHorizontal, DollarSign, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';

const STAGES: { id: DealStage; label: string; color: string }[] = [
    { id: 'lead', label: 'Lead', color: 'bg-slate-500' },
    { id: 'qualified', label: 'Qualified', color: 'bg-blue-500' },
    { id: 'proposal', label: 'Proposal', color: 'bg-yellow-500' },
    { id: 'negotiation', label: 'Negotiation', color: 'bg-orange-500' },
    { id: 'closed_won', label: 'Closed Won', color: 'bg-green-500' },
    { id: 'closed_lost', label: 'Closed Lost', color: 'bg-red-500' },
];

export default function CRMTab({ userId, userRole }: { userId: string; userRole?: string }) {
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

    return (
        <div className="h-full flex flex-col bg-slate-900 text-white p-6">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-lg font-bold">CRM Pipeline</h1>
                    <p className="text-slate-400 text-sm">Manage deals and sync with external platforms</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={handleSync}
                        disabled={syncing}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors border border-slate-700 disabled:opacity-50"
                    >
                        <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                        {syncing ? 'Syncing...' : 'Sync CRM'}
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 rounded-lg transition-colors font-medium">
                        <Plus className="w-4 h-4" />
                        New Deal
                    </button>
                </div>
            </div>

            {/* Kanban Board */}
            <div className="flex-1 overflow-x-auto">
                <div className="flex gap-4 min-w-max h-full pb-4">
                    {STAGES.map(stage => (
                        <div key={stage.id} className="w-80 flex flex-col bg-slate-800/50 rounded-xl border border-slate-700/50">
                            {/* Stage Header */}
                            <div className={`p-3 border-b border-slate-700 flex justify-between items-center ${stage.color} bg-opacity-10`}>
                                <div className="flex items-center gap-2">
                                    <div className={`w-3 h-3 rounded-full ${stage.color}`} />
                                    <span className="font-semibold">{stage.label}</span>
                                    <span className="bg-slate-800 text-xs px-2 py-0.5 rounded-full text-slate-400">
                                        {getStageDeals(stage.id).length}
                                    </span>
                                </div>
                            </div>

                            {/* Deals List */}
                            <div className="flex-1 p-2 overflow-y-auto space-y-2 custom-scrollbar">
                                {loading ? (
                                    <div className="animate-pulse space-y-2">
                                        <div className="h-24 bg-slate-800 rounded-lg" />
                                        <div className="h-24 bg-slate-800 rounded-lg" />
                                    </div>
                                ) : (
                                    getStageDeals(stage.id).map(deal => (
                                        <div key={deal.id} className="bg-slate-800 p-3 rounded-lg border border-slate-700 hover:border-teal-500/50 transition-colors cursor-pointer group shadow-sm">
                                            <div className="flex justify-between items-start mb-2">
                                                <h3 className="font-medium text-sm text-slate-200 line-clamp-2">{deal.name}</h3>
                                                <button className="text-slate-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <MoreHorizontal className="w-4 h-4" />
                                                </button>
                                            </div>
                                            
                                            <div className="flex items-center gap-1 text-slate-400 text-xs mb-2">
                                                <DollarSign className="w-3 h-3" />
                                                <span className="font-mono text-emerald-400">
                                                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: deal.currency || 'USD' }).format(deal.value || 0)}
                                                </span>
                                            </div>

                                            {deal.description && (
                                                <p className="text-xs text-slate-500 mb-3 line-clamp-2">{deal.description}</p>
                                            )}

                                            <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-700/50">
                                                <div className="flex items-center gap-1 text-slate-500 text-[10px]">
                                                    <Calendar className="w-3 h-3" />
                                                    <span>{deal.expectedCloseDate ? new Date(deal.expectedCloseDate).toLocaleDateString() : 'No Date'}</span>
                                                </div>
                                                {deal.source && (
                                                    <span className="text-[10px] px-1.5 py-0.5 bg-slate-700 rounded text-slate-400 capitalize">
                                                        {deal.source}
                                                    </span>
                                                )}
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
