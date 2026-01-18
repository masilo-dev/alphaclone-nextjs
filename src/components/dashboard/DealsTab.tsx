import React, { useEffect, useState } from 'react';
import { TrendingUp, Plus, DollarSign, Calendar, User, Target } from 'lucide-react';
import { dealService, Deal, DealStage } from '../../services/dealService';
import { Button, Modal, Input } from '../ui/UIComponents';
import { CardSkeleton } from '../ui/Skeleton';
import { EmptyState } from '../ui/EmptyState';
import toast from 'react-hot-toast';

interface DealsTabProps {
    userId: string;
    userRole: string;
}

const DealsTab: React.FC<DealsTabProps> = ({ userId, userRole }) => {
    const [deals, setDeals] = useState<Deal[]>([]);
    const [loading, setLoading] = useState(true);
    const [pipelineStats, setPipelineStats] = useState<any[]>([]);
    const [weightedValue, setWeightedValue] = useState(0);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Create deal form state
    const [dealForm, setDealForm] = useState({
        name: '',
        value: '',
        probability: '50',
        expectedCloseDate: '',
        description: ''
    });

    const stages: DealStage[] = ['lead', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost'];
    const stageLabels: Record<DealStage, string> = {
        lead: 'Lead',
        qualified: 'Qualified',
        proposal: 'Proposal',
        negotiation: 'Negotiation',
        closed_won: 'Won',
        closed_lost: 'Lost',
    };

    useEffect(() => {
        loadDeals();
        loadPipelineStats();
    }, [userId, userRole]);

    const loadDeals = async () => {
        setLoading(true);
        try {
            const filters = userRole === 'client' ? { contactId: userId } : {};
            const { deals: loadedDeals, error } = await dealService.getDeals(filters);

            if (error) {
                toast.error(`Error loading deals: ${error}`);
                setDeals([]);
            } else {
                setDeals(loadedDeals);
            }
        } catch (err) {
            toast.error('Failed to load deals');
            setDeals([]);
        } finally {
            setLoading(false);
        }
    };

    const loadPipelineStats = async () => {
        try {
            const { stats, error } = await dealService.getPipelineStats();
            if (!error) {
                setPipelineStats(stats);
            }

            const { value, error: valueError } = await dealService.getWeightedPipelineValue();
            if (!valueError) {
                setWeightedValue(value);
            }
        } catch (err) {
            console.error('Failed to load pipeline stats', err);
        }
    };

    const handleStageChange = async (dealId: string, newStage: DealStage) => {
        try {
            const { error } = await dealService.updateDeal(dealId, { stage: newStage });
            if (error) {
                toast.error(`Error updating deal: ${error}`);
            } else {
                toast.success('Deal stage updated');
                loadDeals();
                loadPipelineStats();
            }
        } catch (err) {
            toast.error('Failed to update deal');
        }
    };

    const handleCreateDeal = async () => {
        if (!dealForm.name.trim()) {
            toast.error('Deal name is required');
            return;
        }

        setIsSubmitting(true);

        try {
            const { error } = await dealService.createDeal(userId, {
                name: dealForm.name,
                value: dealForm.value ? parseFloat(dealForm.value) : undefined,
                probability: parseInt(dealForm.probability) || 50,
                expectedCloseDate: dealForm.expectedCloseDate || undefined,
                description: dealForm.description || undefined
            });

            if (error) {
                toast.error(`Failed to create deal: ${error}`);
            } else {
                toast.success('Deal created successfully!');
                setShowCreateModal(false);
                // Reset form
                setDealForm({
                    name: '',
                    value: '',
                    probability: '50',
                    expectedCloseDate: '',
                    description: ''
                });
                loadDeals();
                loadPipelineStats();
            }
        } catch (err) {
            toast.error('Failed to create deal');
        } finally {
            setIsSubmitting(false);
        }
    };

    const getDealsByStage = (stage: DealStage) => {
        return deals.filter((d) => d.stage === stage);
    };

    const getStageColor = (stage: DealStage) => {
        switch (stage) {
            case 'lead':
                return 'bg-slate-500/10 text-slate-400';
            case 'qualified':
                return 'bg-blue-500/10 text-blue-400';
            case 'proposal':
                return 'bg-purple-500/10 text-purple-400';
            case 'negotiation':
                return 'bg-yellow-500/10 text-yellow-400';
            case 'closed_won':
                return 'bg-green-500/10 text-green-400';
            case 'closed_lost':
                return 'bg-red-500/10 text-red-400';
            default:
                return 'bg-slate-500/10 text-slate-400';
        }
    };

    const formatCurrency = (value?: number) => {
        if (!value) return '$0';
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
    };

    return (
        <div className="space-y-6 animate-fade-in h-full flex flex-col">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                    <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-violet-500 flex items-center gap-3">
                        <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8 text-teal-400" /> Sales Pipeline
                    </h2>
                    <p className="text-slate-400 mt-1 text-xs sm:text-sm">
                        {deals.length} deals | Weighted Value: {formatCurrency(weightedValue)}
                    </p>
                </div>
                {userRole === 'admin' && (
                    <Button onClick={() => setShowCreateModal(true)}>
                        <Plus className="w-5 h-5 mr-2" /> Create Deal
                    </Button>
                )}
            </div>

            {/* Pipeline Stats Summary */}
            {userRole === 'admin' && pipelineStats.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    {pipelineStats.slice(0, 4).map((stat) => (
                        <div key={stat.stage} className="glass-panel p-4 rounded-xl border border-white/5">
                            <div className="text-slate-400 text-xs uppercase mb-1">{stageLabels[stat.stage]}</div>
                            <div className="text-2xl font-bold text-white">{stat.dealCount}</div>
                            <div className="text-teal-400 text-sm">{formatCurrency(stat.totalValue)}</div>
                        </div>
                    ))}
                </div>
            )}

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <CardSkeleton key={i} />
                    ))}
                </div>
            ) : deals.length === 0 ? (
                <EmptyState
                    icon={TrendingUp}
                    title="No Deals Yet"
                    description="Create your first deal to start tracking your sales pipeline."
                />
            ) : (
                <div className="flex gap-4 overflow-x-auto pb-4">
                    {stages.slice(0, 4).map((stage) => {
                        const stageDeals = getDealsByStage(stage);
                        return (
                            <div key={stage} className="flex-shrink-0 w-80">
                                <div className="glass-panel p-3 rounded-xl border border-white/5 mb-3">
                                    <div className="flex items-center justify-between">
                                        <h3 className="font-bold text-white">{stageLabels[stage]}</h3>
                                        <span className="bg-slate-800 text-slate-300 px-2 py-1 rounded-full text-xs font-bold">
                                            {stageDeals.length}
                                        </span>
                                    </div>
                                </div>

                                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                                    {stageDeals.map((deal) => (
                                        <div key={deal.id} className="glass-panel p-4 rounded-xl border border-white/5 hover:border-teal-500/30 transition-all">
                                            <h4 className="font-bold text-white mb-2">{deal.name}</h4>

                                            {deal.value && (
                                                <div className="flex items-center gap-2 text-teal-400 text-sm mb-2">
                                                    <DollarSign className="w-4 h-4" />
                                                    <span>{formatCurrency(deal.value)}</span>
                                                </div>
                                            )}

                                            {deal.expectedCloseDate && (
                                                <div className="flex items-center gap-2 text-slate-400 text-xs mb-2">
                                                    <Calendar className="w-4 h-4" />
                                                    <span>{new Date(deal.expectedCloseDate).toLocaleDateString()}</span>
                                                </div>
                                            )}

                                            <div className="flex items-center gap-2 text-slate-400 text-xs mb-3">
                                                <Target className="w-4 h-4" />
                                                <span>Probability: {deal.probability}%</span>
                                            </div>

                                            {userRole === 'admin' && (
                                                <select
                                                    value={deal.stage}
                                                    onChange={(e) => handleStageChange(deal.id, e.target.value as DealStage)}
                                                    className="w-full px-3 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-white text-xs"
                                                >
                                                    {stages.map((s) => (
                                                        <option key={s} value={s}>
                                                            {stageLabels[s]}
                                                        </option>
                                                    ))}
                                                </select>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Create Deal Modal */}
            {showCreateModal && (
                <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Create New Deal">
                    <div className="space-y-4">
                        <Input
                            label="Deal Name *"
                            value={dealForm.name}
                            onChange={(e) => setDealForm({ ...dealForm, name: e.target.value })}
                            placeholder="Enter deal name"
                            required
                        />

                        <Input
                            label="Deal Value (USD)"
                            type="number"
                            value={dealForm.value}
                            onChange={(e) => setDealForm({ ...dealForm, value: e.target.value })}
                            placeholder="0.00"
                            step="0.01"
                            min="0"
                        />

                        <Input
                            label="Probability (%)"
                            type="number"
                            value={dealForm.probability}
                            onChange={(e) => setDealForm({ ...dealForm, probability: e.target.value })}
                            placeholder="50"
                            min="0"
                            max="100"
                        />

                        <Input
                            label="Expected Close Date"
                            type="date"
                            value={dealForm.expectedCloseDate}
                            onChange={(e) => setDealForm({ ...dealForm, expectedCloseDate: e.target.value })}
                        />

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5">Description</label>
                            <textarea
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all"
                                rows={3}
                                value={dealForm.description}
                                onChange={(e) => setDealForm({ ...dealForm, description: e.target.value })}
                                placeholder="Deal description (optional)"
                            />
                        </div>

                        <div className="pt-4 flex justify-end gap-3">
                            <Button variant="outline" onClick={() => setShowCreateModal(false)}>Cancel</Button>
                            <Button onClick={handleCreateDeal} disabled={isSubmitting}>
                                {isSubmitting ? 'Creating...' : 'Create Deal'}
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default DealsTab;
