import React, { useEffect, useState } from 'react';
import { TrendingUp, Plus, DollarSign, Calendar, User, Target, UserPlus, BarChart2, PieChart as PieChartIcon, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { dealService, Deal, DealStage } from '../../services/dealService';
import { leadService, Lead } from '../../services/leadService';
import { Button, Modal, Input } from '../ui/UIComponents';
import { CardSkeleton } from '../ui/Skeleton';
import { EmptyState } from '../ui/EmptyState';
import LeadSelector from '../common/LeadSelector';
import LeadDetailModal from './leads/LeadDetailModal';
import toast from 'react-hot-toast';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    AreaChart,
    Area,
    Cell,
    PieChart,
    Pie
} from 'recharts';

interface DealsTabProps {
    userId: string;
    userRole: string;
}

const DealsTab: React.FC<DealsTabProps> = ({ userId, userRole }) => {
    const [deals, setDeals] = useState<Deal[]>([]);
    const [loading, setLoading] = useState(true);
    const [pipelineStats, setPipelineStats] = useState<any[]>([]);
    const [weightedValue, setWeightedValue] = useState(0);
    const [forecastData, setForecastData] = useState<any[]>([]);
    const [trendData, setTrendData] = useState<any[]>([]);
    const [winRateData, setWinRateData] = useState<any>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showCreateFromLeadModal, setShowCreateFromLeadModal] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
    const [selectedLeadForDetail, setSelectedLeadForDetail] = useState<Lead | null>(null);

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
        loadAnalytics();
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

    const loadAnalytics = async () => {
        try {
            const [forecastRes, trendRes, winRateRes] = await Promise.all([
                dealService.getSalesForecast(),
                dealService.getWinLossTrends(),
                dealService.getWinRate()
            ]);

            if (!forecastRes.error) setForecastData(forecastRes.forecast);
            if (!trendRes.error) setTrendData(trendRes.trends);
            if (!winRateRes.error) setWinRateData(winRateRes);
        } catch (err) {
            console.error('Failed to load analytics', err);
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

    const handleLeadSelected = (lead: Lead) => {
        setSelectedLead(lead);
        // Pre-fill form with lead data
        setDealForm({
            name: `${lead.businessName} - ${lead.industry || 'Deal'}`,
            value: '',
            probability: '50',
            expectedCloseDate: '',
            description: `Lead from ${lead.source}. Contact: ${lead.email || lead.phone || 'N/A'}`
        });
    };

    const handleViewLead = async (leadId: string) => {
        const { lead, error } = await leadService.getLeadById(leadId);
        if (lead) setSelectedLeadForDetail(lead);
        else toast.error('Linked lead not found');
    };

    const handleCreateDealFromLead = async () => {
        if (!selectedLead) {
            toast.error('Please select a lead');
            return;
        }

        if (!dealForm.name.trim()) {
            toast.error('Deal name is required');
            return;
        }

        setIsSubmitting(true);

        try {
            // Create deal with lead information pre-filled
            const { error } = await dealService.createDeal(userId, {
                name: dealForm.name,
                value: dealForm.value ? parseFloat(dealForm.value) : undefined,
                probability: parseInt(dealForm.probability) || 50,
                expectedCloseDate: dealForm.expectedCloseDate || undefined,
                description: dealForm.description || undefined,
                metadata: { leadId: selectedLead.id }
            });

            if (error) {
                toast.error(`Failed to create deal: ${error}`);
            } else {
                // Mark lead as converted
                await leadService.updateLead(selectedLead.id, {
                    stage: 'qualified',
                    status: 'Converted to Deal'
                });

                toast.success('Deal created from lead successfully!');
                setShowCreateFromLeadModal(false);
                setSelectedLead(null);
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
            toast.error('Failed to create deal from lead');
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
                {(userRole === 'admin' || userRole === 'tenant_admin') && (
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            onClick={() => setShowCreateFromLeadModal(true)}
                            className="border-teal-500/50 text-teal-400 hover:bg-teal-500/10"
                        >
                            <UserPlus className="w-5 h-5 mr-2" /> From Lead
                        </Button>
                        <Button onClick={() => setShowCreateModal(true)}>
                            <Plus className="w-5 h-5 mr-2" /> Create Deal
                        </Button>
                    </div>
                )}
            </div>

            {/* Top Stats Summary */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="glass-panel p-4 rounded-xl border border-white/5 bg-teal-500/5">
                    <div className="flex items-center justify-between mb-2">
                        <DollarSign className="w-5 h-5 text-teal-400" />
                        {winRateData && (
                            <span className="text-[10px] bg-teal-500/20 text-teal-400 px-2 py-0.5 rounded-full">
                                {winRateData.winRate.toFixed(1)}% Win Rate
                            </span>
                        )}
                    </div>
                    <div className="text-2xl font-bold text-white">{formatCurrency(weightedValue)}</div>
                    <div className="text-slate-400 text-xs uppercase tracking-wider">Weighted Pipeline</div>
                </div>

                <div className="glass-panel p-4 rounded-xl border border-white/5 bg-violet-500/5">
                    <div className="flex items-center justify-between mb-2">
                        <TrendingUp className="w-5 h-5 text-violet-400" />
                        <span className="text-[10px] bg-violet-500/20 text-violet-400 px-2 py-0.5 rounded-full">Active</span>
                    </div>
                    <div className="text-2xl font-bold text-white">{deals.length}</div>
                    <div className="text-slate-400 text-xs uppercase tracking-wider">Total Deals</div>
                </div>

                <div className="glass-panel p-4 rounded-xl border border-white/5 bg-blue-500/5">
                    <div className="flex items-center justify-between mb-2">
                        <BarChart2 className="w-5 h-5 text-blue-400" />
                        {forecastData.length > 0 && (
                            <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">
                                Next {forecastData.length} mo.
                            </span>
                        )}
                    </div>
                    <div className="text-2xl font-bold text-white">
                        {formatCurrency(forecastData.reduce((sum, d) => sum + d.value, 0))}
                    </div>
                    <div className="text-slate-400 text-xs uppercase tracking-wider">Projected Revenue</div>
                </div>

                <div className="glass-panel p-4 rounded-xl border border-white/5 bg-emerald-500/5">
                    <div className="flex items-center justify-between mb-2">
                        <PieChartIcon className="w-5 h-5 text-emerald-400" />
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">Avg</span>
                    </div>
                    <div className="text-2xl font-bold text-white">
                        {deals.length > 0 ? (deals.reduce((sum, d) => sum + (d.probability || 0), 0) / deals.length).toFixed(0) : 0}%
                    </div>
                    <div className="text-slate-400 text-xs uppercase tracking-wider">Avg. Probability</div>
                </div>
            </div>

            {/* Sales Analytics Section */}
            {(userRole === 'admin' || userRole === 'tenant_admin') && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    <div className="glass-panel p-4 md:p-6 rounded-2xl border border-white/5 bg-slate-900/50">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="font-bold text-white flex items-center gap-2">
                                <BarChart2 className="w-4 h-4 text-teal-400" /> Sales Forecast
                            </h3>
                            <div className="text-[10px] text-slate-500">Weighted value by month</div>
                        </div>
                        <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%" minHeight={256}>
                                <BarChart data={forecastData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                    <XAxis
                                        dataKey="month"
                                        stroke="#64748b"
                                        fontSize={10}
                                        tickLine={false}
                                        axisLine={false}
                                    />
                                    <YAxis
                                        stroke="#64748b"
                                        fontSize={10}
                                        tickLine={false}
                                        axisLine={false}
                                        tickFormatter={(value) => `$${value >= 1000 ? (value / 1000).toFixed(0) + 'k' : value}`}
                                    />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px' }}
                                        itemStyle={{ color: '#2dd4bf' }}
                                        formatter={(value: any) => [formatCurrency(Number(value || 0)), 'Weighted Value']}
                                    />
                                    <Bar dataKey="value" fill="#14b8a6" radius={[4, 4, 0, 0]} barSize={30} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="glass-panel p-4 md:p-6 rounded-2xl border border-white/5 bg-slate-900/50">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="font-bold text-white flex items-center gap-2">
                                <TrendingUp className="w-4 h-4 text-violet-400" /> Win/Loss Trends
                            </h3>
                            <div className="text-[10px] text-slate-500">Historical performance</div>
                        </div>
                        <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%" minHeight={256}>
                                <AreaChart data={trendData}>
                                    <defs>
                                        <linearGradient id="colorWon" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="colorLost" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                    <XAxis
                                        dataKey="month"
                                        stroke="#64748b"
                                        fontSize={10}
                                        tickLine={false}
                                        axisLine={false}
                                    />
                                    <YAxis
                                        stroke="#64748b"
                                        fontSize={10}
                                        tickLine={false}
                                        axisLine={false}
                                    />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px' }}
                                    />
                                    <Area type="monotone" dataKey="won" stroke="#10b981" fillOpacity={1} fill="url(#colorWon)" strokeWidth={2} />
                                    <Area type="monotone" dataKey="lost" stroke="#ef4444" fillOpacity={1} fill="url(#colorLost)" strokeWidth={2} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
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

                                            {deal.metadata?.leadId && (
                                                <div className="mb-3 pt-2 border-t border-white/5">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleViewLead(deal.metadata.leadId);
                                                        }}
                                                        className="text-xs text-teal-400 hover:text-teal-300 flex items-center gap-1 w-full"
                                                    >
                                                        <User className="w-3 h-3" /> View Lead Source
                                                    </button>
                                                </div>
                                            )}

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
            )
            }

            {/* Create Deal Modal */}
            {
                showCreateModal && (
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
                )
            }

            {/* Create Deal from Lead Modal */}
            {
                showCreateFromLeadModal && (
                    <Modal isOpen={showCreateFromLeadModal} onClose={() => {
                        setShowCreateFromLeadModal(false);
                        setSelectedLead(null);
                    }} title="Create Deal from Lead">
                        <div className="space-y-4">
                            {/* Lead Selector */}
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Select Lead *
                                </label>
                                <LeadSelector
                                    onSelect={handleLeadSelected}
                                    filter="all"
                                    placeholder="Choose a lead to convert..."
                                />
                                {selectedLead && (
                                    <div className="mt-2 p-3 bg-teal-500/10 border border-teal-500/20 rounded-lg">
                                        <p className="text-xs text-teal-400">
                                            ✓ Selected: {selectedLead.businessName}
                                        </p>
                                        {selectedLead.email && (
                                            <p className="text-xs text-slate-400 mt-1">
                                                {selectedLead.email}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>

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
                                <Button variant="outline" onClick={() => {
                                    setShowCreateFromLeadModal(false);
                                    setSelectedLead(null);
                                }}>Cancel</Button>
                                <Button onClick={handleCreateDealFromLead} disabled={isSubmitting || !selectedLead}>
                                    {isSubmitting ? 'Creating...' : 'Create Deal'}
                                </Button>
                            </div>
                        </div>
                    </Modal>
                )
            }

            {/* Lead Detail Modal */}
            {
                selectedLeadForDetail && (
                    <LeadDetailModal
                        isOpen={!!selectedLeadForDetail}
                        onClose={() => setSelectedLeadForDetail(null)}
                        lead={selectedLeadForDetail}
                    />
                )
            }
        </div >
    );
};

export default DealsTab;
