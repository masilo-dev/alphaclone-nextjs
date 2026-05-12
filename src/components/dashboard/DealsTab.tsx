'use client';

import { supabase } from '../../lib/supabase';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { TrendingUp, Plus, DollarSign, Calendar, User, Target, UserPlus, BarChart2, PieChart as PieChartIcon, Heart, AlertTriangle, CheckCircle } from 'lucide-react';
import { dealService, Deal, DealStage } from '../../services/dealService';
import { leadService, Lead } from '../../services/leadService';
import { Button, Modal, Input } from '../ui/UIComponents';
import { CardSkeleton } from '../ui/Skeleton';
import { EmptyState } from '../ui/EmptyState';
import LeadSelector from '../common/LeadSelector';
import LeadDetailModal from './leads/LeadDetailModal';
import DealDetailModal from './deals/DealDetailModal';
import { fileUploadService } from '../../services/fileUploadService';
import toast from 'react-hot-toast';
import { FileText, Download, Trash2, Eye } from 'lucide-react';
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
import { ChartContainer } from '../ui/ChartContainer';
import { CrmNextStepsPanel } from './crm/CrmNextStepsPanel';
import { getForwardDealStages } from '../../lib/stageProgression';

interface DealsTabProps {
    userId: string;
    userRole: string;
}

const DealsTab: React.FC<DealsTabProps> = ({ userId, userRole }) => {
    const searchParams = useSearchParams();
    const router = useRouter();
    const canManagePipeline =
        userRole === 'admin' || userRole === 'tenant_admin' || userRole === 'business_dashboard';

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
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [dealToDelete, setDealToDelete] = useState<Deal | null>(null);
    const [showDocumentsModal, setShowDocumentsModal] = useState(false);
    const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
    const [selectedDealForDetail, setSelectedDealForDetail] = useState<Deal | null>(null);
    const [dealDocuments, setDealDocuments] = useState<any[]>([]);
    const [dealPrefillLeadId, setDealPrefillLeadId] = useState<string | null>(null);

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

    // Calculate deal health score (0-100)
    const calculateDealHealth = (deal: Deal): { score: number; status: 'healthy' | 'warning' | 'critical' } => {
        let score = 100;
        
        // Factor 1: Probability (0-30 points)
        score += (deal.probability / 100) * 30 - 30;
        
        // Factor 2: Stage time (0-25 points)
        // Deals that linger too long in early stages lose points
        const daysInStage = deal.updatedAt ? 
            Math.floor((Date.now() - new Date(deal.updatedAt).getTime()) / (1000 * 60 * 60 * 24)) : 0;
        
        const stageTimeThresholds: Record<DealStage, number> = {
            lead: 30,      // 30 days
            qualified: 45, // 45 days
            proposal: 30,  // 30 days
            negotiation: 14, // 14 days
            closed_won: 0,
            closed_lost: 0
        };
        
        const threshold = stageTimeThresholds[deal.stage] || 30;
        if (daysInStage > threshold) {
            const overage = daysInStage - threshold;
            score -= Math.min(25, overage * 2); // Lose 2 points per day over threshold, max 25
        }
        
        // Factor 3: Expected close date proximity (0-20 points)
        if (deal.expectedCloseDate && deal.stage !== 'closed_won' && deal.stage !== 'closed_lost') {
            const daysUntilClose = Math.floor((new Date(deal.expectedCloseDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            
            if (daysUntilClose < 0) {
                score -= 20; // Overdue
            } else if (daysUntilClose < 7) {
                score -= 10; // Closing soon but no activity
            } else if (daysUntilClose > 90 && deal.stage === 'lead') {
                score -= 15; // Lead with far-off close date
            }
        }
        
        // Factor 4: Value consideration (0-15 points)
        // Higher value deals get slightly better scores (engagement incentive)
        if (deal.value && deal.value > 100000) {
            score += 15;
        } else if (deal.value && deal.value > 50000) {
            score += 10;
        } else if (deal.value && deal.value > 10000) {
            score += 5;
        }
        
        // Factor 5: Stage progression (0-10 points)
        // Deals in later stages are healthier
        const stageProgression: Record<DealStage, number> = {
            lead: 0,
            qualified: 3,
            proposal: 6,
            negotiation: 9,
            closed_won: 10,
            closed_lost: 0
        };
        score += stageProgression[deal.stage];
        
        // Clamp score between 0 and 100
        score = Math.max(0, Math.min(100, score));
        
        // Determine status
        let status: 'healthy' | 'warning' | 'critical' = 'healthy';
        if (score < 40) status = 'critical';
        else if (score < 70) status = 'warning';
        
        return { score, status };
    };

    const dealAttentionItems = useMemo(() => {
        if (loading) return [];
        const open = deals.filter(
            (d) => d.stage !== 'closed_won' && d.stage !== 'closed_lost'
        );
        const scored = open
            .map((d) => ({ deal: d, ...calculateDealHealth(d) }))
            .filter((x) => x.status !== 'healthy')
            .sort((a, b) => a.score - b.score)
            .slice(0, 5);
        if (scored.length > 0) {
            return scored.map((x) => ({
                id: x.deal.id,
                tone: (x.status === 'critical' ? 'urgent' : 'normal') as 'urgent' | 'normal',
                title: x.deal.name,
                detail: `Health score ${x.score}. ${
                    x.status === 'critical'
                        ? 'Update stage, close date, or probability today so the team executes on truth.'
                        : 'Confirm the next customer action and a dated follow-up.'
                }`,
                actionLabel: 'Open deal',
                onAction: () => setSelectedDealForDetail(x.deal),
            }));
        }
        if (deals.length === 0) {
            return [
                {
                    id: 'no-deals-yet',
                    tone: 'normal' as const,
                    title: 'No revenue opportunities in the system',
                    detail: 'Create deals with value and expected close. Outcomes require explicit opportunities, not only contact lists.',
                    actionLabel: 'Create deal',
                    onAction: () => setShowCreateModal(true),
                },
            ];
        }
        return [
            {
                id: 'healthy-pipeline',
                tone: 'success' as const,
                title: 'No deals flagged as off-track',
                detail: 'Push the highest weighted opportunities: decision criteria, paperwork, and a committed timeline.',
                actionLabel: 'Go to board',
                onAction: () =>
                    document
                        .getElementById('deal-execution-board')
                        ?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
            },
        ];
    }, [deals, loading]);

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
            if (!error) {
                toast.success(`Deal stage updated to ${stageLabels[newStage]}`);
                loadDeals();
                loadPipelineStats();
            } else {
                toast.error(`Error updating stage: ${error}`);
            }
        } catch (err) {
            toast.error('Failed to update deal stage');
        }
    };

    const handleDeleteDeal = async () => {
        if (!dealToDelete) return;

        setIsSubmitting(true);
        try {
            const { success, error } = await dealService.deleteDeal(dealToDelete.id);
            if (success) {
                toast.success('Deal and associated storage deleted successfully');
                setShowDeleteModal(false);
                setDealToDelete(null);
                loadDeals();
            } else {
                toast.error(`Error deleting deal: ${error}`);
            }
        } catch (err) {
            toast.error('Failed to delete deal');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleViewDocuments = async (deal: Deal) => {
        setSelectedDeal(deal);
        setShowDocumentsModal(true);
        try {
            const { files, error } = await fileUploadService.getEntityFiles('deal', deal.id);
            if (!error) {
                setDealDocuments(files || []);
            }
        } catch (err) {
            toast.error('Failed to load documents');
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

    const handleLeadSelected = useCallback((lead: Lead) => {
        setSelectedLead(lead);
        setDealForm({
            name: `${lead.businessName} - ${lead.industry || 'Deal'}`,
            value: lead.value != null && lead.value > 0 ? String(lead.value) : '',
            probability: '50',
            expectedCloseDate: '',
            description: `Lead from ${lead.source || 'pipeline'}. Contact: ${lead.email || lead.phone || 'N/A'}`,
        });
    }, []);

    useEffect(() => {
        if (!searchParams) return;
        const open =
            searchParams.get('createFromLead') === '1' ||
            searchParams.get('fromLead') === 'true' ||
            searchParams.get('createFromLead') === 'true';
        const lid = searchParams.get('leadId');
        if (!open) return;
        setShowCreateFromLeadModal(true);
        if (lid) setDealPrefillLeadId(lid);
        router.replace('/dashboard/deals', { scroll: false });
    }, [searchParams, router]);

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
                });

                toast.success('Deal created from lead.');
                setShowCreateFromLeadModal(false);
                setSelectedLead(null);
                setDealPrefillLeadId(null);
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
        <div className="space-y-6 animate-fade-in min-h-0">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div className="flex-1">
                    <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-violet-500 flex items-center gap-3">
                        <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8 text-teal-400" /> Sales Pipeline
                    </h2>
                    <p className="text-slate-400 mt-1 text-xs sm:text-sm">
                        {deals.length} deals | Weighted Value: {formatCurrency(weightedValue)}
                    </p>
                </div>
                {canManagePipeline && (
                    <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                        <Button
                            variant="outline"
                            onClick={() => setShowCreateFromLeadModal(true)}
                            className="flex-1 sm:flex-none border-teal-500/50 text-teal-400 hover:bg-teal-500/10 text-xs sm:text-sm h-10 px-3"
                        >
                            <UserPlus className="w-4 h-4 mr-2" /> From Lead
                        </Button>
                        <Button
                            onClick={() => setShowCreateModal(true)}
                            className="flex-1 sm:flex-none text-xs sm:text-sm h-10 px-3"
                        >
                            <Plus className="w-4 h-4 mr-2" /> Create Deal
                        </Button>
                    </div>
                )}
            </div>

            {!loading && (
                <CrmNextStepsPanel
                    heading="What to do next"
                    subheading="Close business by working dated next steps on real opportunities—not by staring at charts."
                    items={dealAttentionItems}
                />
            )}

            {/* Top Stats Summary */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="glass-panel p-4 rounded-xl border border-white/5 bg-teal-500/5">
                    <div className="flex items-center justify-between mb-2">
                        <DollarSign className="w-5 h-5 text-teal-400" />
                        {winRateData && (
                            <span className="text-xs bg-teal-500/20 text-teal-400 px-2 py-0.5 rounded-full">
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
                        <span className="text-xs bg-violet-500/20 text-violet-400 px-2 py-0.5 rounded-full">Active</span>
                    </div>
                    <div className="text-2xl font-bold text-white">{deals.length}</div>
                    <div className="text-slate-400 text-xs uppercase tracking-wider">Total Deals</div>
                </div>

                <div className="glass-panel p-4 rounded-xl border border-white/5 bg-blue-500/5">
                    <div className="flex items-center justify-between mb-2">
                        <BarChart2 className="w-5 h-5 text-blue-400" />
                        {forecastData.length > 0 && (
                            <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">
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
                        <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">Avg</span>
                    </div>
                    <div className="text-2xl font-bold text-white">
                        {deals.length > 0 ? (deals.reduce((sum, d) => sum + (d.probability || 0), 0) / deals.length).toFixed(0) : 0}%
                    </div>
                    <div className="text-slate-400 text-xs uppercase tracking-wider">Avg. Probability</div>
                </div>
            </div>

            {/* Sales Analytics Section */}
            {canManagePipeline && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    <div className="glass-panel p-4 md:p-6 rounded-2xl border border-white/5 bg-slate-900/50">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="font-bold text-white flex items-center gap-2">
                                <BarChart2 className="w-4 h-4 text-teal-400" /> Sales Forecast
                            </h3>
                            <div className="text-xs text-slate-500">Weighted value by month</div>
                        </div>
                        <div className="h-64 w-full relative" style={{ minHeight: '256px' }}>
                            <ChartContainer className="h-64">
                                <ResponsiveContainer width="100%" height={250} minWidth={0} minHeight={250}>
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
                                        tickFormatter={(value: number) => `$${value >= 1000 ? (value / 1000).toFixed(0) + 'k' : value}`}
                                    />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px' }}
                                        itemStyle={{ color: '#2dd4bf' }}
                                        formatter={(value: any) => [formatCurrency(Number(value || 0)), 'Weighted Value']}
                                    />
                                    <Bar dataKey="value" fill="#14b8a6" radius={[4, 4, 0, 0]} barSize={30} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </ChartContainer>
                        </div>
                    </div>

                    <div className="glass-panel p-4 md:p-6 rounded-2xl border border-white/5 bg-slate-900/50">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="font-bold text-white flex items-center gap-2">
                                <TrendingUp className="w-4 h-4 text-violet-400" /> Win/Loss Trends
                            </h3>
                            <div className="text-xs text-slate-500">Historical performance</div>
                        </div>
                        <div className="h-64 w-full relative" style={{ minHeight: '256px' }}>
                            <ChartContainer className="h-64">
                                <ResponsiveContainer width="100%" height={250} minWidth={0} minHeight={250}>
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
                            </ChartContainer>
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
                    title="The pipeline is quiet. Too quiet."
                    description="Stop waiting for permission. Create a deal and let's go."
                    action={
                        <Button 
                            onClick={() => setShowCreateModal(true)}
                            className="bg-teal-600 hover:bg-teal-500 uppercase tracking-widest font-black"
                        >
                            Hunt a Deal
                        </Button>
                    }
                />
            ) : (
                <div
                    id="deal-execution-board"
                    className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4 pb-8"
                >
                    {stages.map((stage) => {
                        const stageDeals = getDealsByStage(stage);
                        return (
                            <div key={stage} className="min-w-0">
                                <div className="glass-panel p-3 rounded-xl border border-white/5 mb-3">
                                    <div className="flex items-center justify-between">
                                        <h3 className="font-bold text-white">{stageLabels[stage]}</h3>
                                        <span className="bg-slate-800 text-slate-300 px-2 py-1 rounded-full text-xs font-bold">
                                            {stageDeals.length}
                                        </span>
                                    </div>
                                </div>

                                <div className="space-y-3 max-h-[800px] overflow-y-auto custom-scrollbar">
                                    {stageDeals.map((deal) => {
                                        const health = calculateDealHealth(deal);
                                        const healthColors = {
                                            healthy: 'bg-green-500/20 text-green-400 border-green-500/30',
                                            warning: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
                                            critical: 'bg-red-500/20 text-red-400 border-red-500/30'
                                        };
                                        const healthIcon = {
                                            healthy: CheckCircle,
                                            warning: Heart,
                                            critical: AlertTriangle
                                        };
                                        const HealthIcon = healthIcon[health.status];

                                        return (
                                        <div
                                            key={deal.id}
                                            onClick={() => typeof setSelectedDealForDetail === 'function' && setSelectedDealForDetail(deal)}
                                            className="glass-panel p-3 rounded-xl border border-white/5 hover:border-teal-500/30 transition-all group relative cursor-pointer"
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <h4 className="font-bold text-white pr-6">{deal.name}</h4>
                                                <div className="flex items-center gap-2">
                                                    <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold uppercase border ${healthColors[health.status]}`}>
                                                        <HealthIcon className="w-3 h-3" />
                                                        {health.score}
                                                    </div>
                                                    <div className="flex gap-1 shrink-0">
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleViewDocuments(deal);
                                                            }}
                                                            className="p-1 text-slate-400 hover:text-teal-400"
                                                            title="Documents"
                                                        >
                                                            <FileText className="w-4 h-4" />
                                                        </button>
                                                        {canManagePipeline && (
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setDealToDelete(deal);
                                                                    setShowDeleteModal(true);
                                                                }}
                                                                className="p-1 text-slate-400 hover:text-red-400"
                                                                title="Delete Deal"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {deal.value && (
                                                <div className="flex items-center gap-2 text-teal-400 text-sm mb-2">
                                                    <DollarSign className="w-4 h-4" />
                                                    <span>{formatCurrency(deal.value)}</span>
                                                </div>
                                            )}

                                            <div className="flex items-center gap-2 text-slate-400 text-xs mb-3">
                                                <Target className="w-4 h-4" />
                                                <span>Probability: {deal.probability}%</span>
                                            </div>

                                            {deal.intelligenceState?.superposition && (
                                                <div className="grid grid-cols-2 gap-2 text-xs text-slate-400 mb-3">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span>Close this quarter</span>
                                                        <span className="text-white/80">
                                                            {Math.round(Number(deal.intelligenceState.superposition.close_this_quarter || 0) * 100)}%
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span>Close next quarter</span>
                                                        <span className="text-white/80">
                                                            {Math.round(Number(deal.intelligenceState.superposition.close_next_quarter || 0) * 100)}%
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span>Lost</span>
                                                        <span className="text-white/80">
                                                            {Math.round(Number(deal.intelligenceState.superposition.lost_forever || 0) * 100)}%
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span>Stalled</span>
                                                        <span className="text-white/80">
                                                            {Math.round(Number(deal.intelligenceState.superposition.stalled_indefinitely || 0) * 100)}%
                                                        </span>
                                                    </div>
                                                </div>
                                            )}

                                            {deal.expectedCloseDate && (
                                                <div className="flex items-center gap-2 text-slate-400 text-xs mb-2">
                                                    <Calendar className="w-4 h-4" />
                                                    <span>{new Date(deal.expectedCloseDate).toLocaleDateString()}</span>
                                                </div>
                                            )}


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

                                            {canManagePipeline && (
                                                <select
                                                    value={deal.stage}
                                                    onClick={(e) => e.stopPropagation()}
                                                    onChange={(e) => handleStageChange(deal.id, e.target.value as DealStage)}
                                                    className="w-full px-3 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-white text-xs"
                                                    title="Forward-only: use Closed lost to exit."
                                                >
                                                    {(getForwardDealStages(deal.stage) as DealStage[]).map((s) => (
                                                        <option key={s} value={s}>
                                                            {stageLabels[s]}
                                                        </option>
                                                    ))}
                                                </select>
                                            )}
                                        </div>
                                        );
                                    })}
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
                        setDealPrefillLeadId(null);
                    }} title="Create Deal from Lead">
                        <div className="space-y-4">
                            {/* Lead Selector */}
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Select Lead *
                                </label>
                                <LeadSelector
                                    key={dealPrefillLeadId || 'selector'}
                                    initialLeadId={dealPrefillLeadId}
                                    onSelect={handleLeadSelected}
                                    filter="all"
                                    placeholder="Choose a lead to convert..."
                                />
                                {selectedLead && (
                                    <div className="mt-2 p-3 bg-teal-500/10 border border-teal-500/20 rounded-lg">
                                        <p className="text-xs text-teal-400">
                                            Selected: {selectedLead.businessName}
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
                                    setDealPrefillLeadId(null);
                                }}>Cancel</Button>
                                <Button onClick={handleCreateDealFromLead} disabled={isSubmitting || !selectedLead}>
                                    {isSubmitting ? 'Creating...' : 'Create Deal'}
                                </Button>
                            </div>
                        </div>
                    </Modal>
                )
            }

            {/* Delete Confirmation Modal */}
            {showDeleteModal && (
                <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Delete Deal">
                    <div className="p-4 space-y-4">
                        <div className="flex items-center gap-3 text-red-400 bg-red-400/10 p-4 rounded-xl border border-red-400/20">
                            <Trash2 className="w-6 h-6 shrink-0" />
                            <div>
                                <p className="font-bold">Are you sure?</p>
                                <p className="text-sm opacity-80">This will permanently delete "{dealToDelete?.name}" and all associated documents. This action cannot be undone.</p>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3">
                            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>Cancel</Button>
                            <Button variant="danger" onClick={handleDeleteDeal} disabled={isSubmitting}>
                                {isSubmitting ? 'Deleting...' : 'Delete Permanently'}
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Documents Modal */}
            {showDocumentsModal && selectedDeal && (
                <Modal
                    isOpen={showDocumentsModal}
                    onClose={() => setShowDocumentsModal(false)}
                    title={`Documents: ${selectedDeal.name}`}
                >
                    <div className="space-y-4">
                        {dealDocuments.length === 0 ? (
                            <div className="text-center py-8 bg-slate-900/50 rounded-xl border border-white/5">
                                <FileText className="w-12 h-12 text-slate-600 mx-auto mb-3 opacity-20" />
                                <p className="text-slate-400 text-sm font-medium">No documents attached to this deal</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {dealDocuments.map((doc) => (
                                    <div key={doc.id} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-xl border border-white/5 hover:bg-slate-900 transition-colors">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className="w-10 h-10 bg-teal-500/10 rounded-lg flex items-center justify-center shrink-0">
                                                <FileText className="w-5 h-5 text-teal-400" />
                                            </div>
                                            <div className="overflow-hidden">
                                                <p className="text-white text-sm font-medium truncate">{doc.original_filename}</p>
                                                <p className="text-slate-500 text-xs uppercase">{(doc.file_size / 1024).toFixed(1)} KB</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-1 shrink-0">
                                            <button
                                                onClick={() => {
                                                    const proxiedUrl = fileUploadService.getProxiedUrl('uploads', doc.storage_path);
                                                    window.open(proxiedUrl, '_blank');
                                                }}
                                                className="p-2 text-slate-400 hover:text-teal-400 transition-colors"
                                                title="View"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={async () => {
                                                    try {
                                                        const { success, error } = await fileUploadService.deleteFile(doc.id);
                                                        if (success) {
                                                            toast.success('File deleted');
                                                            if (selectedDeal) handleViewDocuments(selectedDeal);
                                                        } else {
                                                            toast.error(`Delete failed: ${error}`);
                                                        }
                                                    } catch (err) {
                                                        toast.error('Error deleting file');
                                                    }
                                                }}
                                                className="p-2 text-slate-400 hover:text-red-400 transition-colors"
                                                title="Delete"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="pt-4 border-t border-white/5 flex justify-end">
                            <Button variant="outline" onClick={() => setShowDocumentsModal(false)}>Close</Button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Lead Detail Modal */}
            {selectedLeadForDetail && (
                <LeadDetailModal
                    isOpen={!!selectedLeadForDetail}
                    onClose={() => setSelectedLeadForDetail(null)}
                    lead={selectedLeadForDetail}
                    onLeadUpdate={loadDeals}
                />
            )}

            {/* Deal Detail Modal */}
            {selectedDealForDetail && (
                <DealDetailModal
                    isOpen={!!selectedDealForDetail}
                    onClose={() => {
                        setSelectedDealForDetail(null);
                        loadDeals();
                        loadPipelineStats();
                    }}
                    deal={selectedDealForDetail}
                    onDealUpdate={() => {
                        loadDeals();
                        loadPipelineStats();
                    }}
                />
            )}
        </div>
    );
};

export default DealsTab;

