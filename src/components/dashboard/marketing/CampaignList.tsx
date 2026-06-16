'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
    Plus, Send, Trash2, BarChart3, Mail,
    Search, Loader2, RefreshCw
} from 'lucide-react';
import { useTenant } from '@/contexts/TenantContext';
import { campaignService, Campaign } from '@/services/campaignService';
import toast from 'react-hot-toast';
import CampaignBuilder from './CampaignBuilder';
import CampaignAnalytics from './CampaignAnalytics';

const STATUS_STYLES: Record<string, { dot: string; badge: string; label: string }> = {
    draft:      { dot: 'bg-slate-500', badge: 'bg-slate-500/15 text-slate-400 border border-slate-500/10', label: 'Draft' },
    scheduled:  { dot: 'bg-blue-400', badge: 'bg-blue-500/10 text-blue-400 border border-blue-500/10', label: 'Scheduled' },
    sending:    { dot: 'bg-yellow-400 animate-pulse', badge: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/10', label: 'Sending' },
    completed:  { dot: 'bg-emerald-500', badge: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/10', label: 'Completed' },
    failed:     { dot: 'bg-red-500', badge: 'bg-red-500/15 text-red-400 border border-red-500/10', label: 'Failed' },
    cancelled:  { dot: 'bg-slate-500', badge: 'bg-slate-800 text-slate-400 border border-transparent', label: 'Cancelled' },
};

const CampaignList: React.FC = () => {
    const { currentTenant } = useTenant();
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [showBuilder, setShowBuilder] = useState(false);
    const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
    const [showAnalytics, setShowAnalytics] = useState(false);

    const loadCampaigns = useCallback(async () => {
        if (!currentTenant?.id) return;
        setLoading(true);
        try {
            const { campaigns: data, error } = await campaignService.getCampaigns();
            if (!error) {
                setCampaigns(data);
            } else {
                console.warn('Failed to load campaigns:', error);
                setCampaigns([]);
            }
        } catch (err) {
            console.warn('Campaign service not available:', err);
            setCampaigns([]);
        }
        setLoading(false);
    }, [currentTenant?.id]);

    useEffect(() => { loadCampaigns(); }, [loadCampaigns]);

    const handleSend = async (id: string) => {
        const toastId = toast.loading('Sending campaign...');
        const { success, error } = await campaignService.sendCampaign(id);
        if (success) {
            toast.success('Campaign sent!', { id: toastId });
            loadCampaigns();
        } else {
            toast.error(error || 'Failed to send', { id: toastId });
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this campaign?')) return;
        const { error } = await campaignService.deleteCampaign(id);
        if (!error) {
            toast.success('Campaign deleted');
            loadCampaigns();
        }
    };

    const filtered = campaigns.filter(c => {
        if (statusFilter !== 'all' && c.status !== statusFilter) return false;
        if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
    });

    const totalSent = campaigns.reduce((s, c) => s + c.total_sent, 0);
    const totalOpened = campaigns.reduce((s, c) => s + c.total_opened, 0);
    const avgOpenRate = totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0;

    if (showBuilder) {
        return (
            <CampaignBuilder
                onClose={() => setShowBuilder(false)}
                onCreated={() => { setShowBuilder(false); loadCampaigns(); }}
            />
        );
    }

    if (showAnalytics && selectedCampaign) {
        return (
            <CampaignAnalytics
                campaign={selectedCampaign}
                onClose={() => { setShowAnalytics(false); setSelectedCampaign(null); }}
            />
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-white">Email Campaigns</h2>
                    <p className="text-sm text-slate-400">{campaigns.length} campaigns · {totalSent.toLocaleString()} total sent</p>
                </div>
                <button
                    onClick={() => setShowBuilder(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-400 text-white rounded-xl font-semibold text-sm transition-colors"
                >
                    <Plus className="w-4 h-4" /> New Campaign
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
                {[
                    { label: 'Total Sent', value: totalSent.toLocaleString(), color: 'text-blue-400' },
                    { label: 'Open Rate', value: `${avgOpenRate}%`, color: 'text-emerald-400' },
                    { label: 'Active', value: campaigns.filter(c => c.status === 'sending' || c.status === 'scheduled').length.toString(), color: 'text-yellow-400' },
                ].map(s => (
                    <div key={s.label} className="bg-slate-900 border border-white/5 rounded-2xl p-4">
                        <div className="text-xs text-slate-500 mb-1">{s.label}</div>
                        <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                    </div>
                ))}
            </div>

            {/* Search & Filter */}
            <div className="flex gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search campaigns..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 text-sm"
                    />
                </div>
                <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-teal-500"
                >
                    <option value="all">All Status</option>
                    <option value="draft">Draft</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="sending">Sending</option>
                    <option value="completed">Completed</option>
                    <option value="failed">Failed</option>
                </select>
                <button onClick={loadCampaigns} className="p-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-400 hover:text-white">
                    <RefreshCw className="w-4 h-4" />
                </button>
            </div>

            {/* Campaign List */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-6 h-6 animate-spin text-teal-400" />
                </div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-20 border border-dashed border-slate-700 rounded-2xl">
                    <Mail className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-400 font-semibold">No campaigns yet</p>
                    <p className="text-slate-600 text-sm mt-1 mb-4">Create your first email campaign to reach your audience.</p>
                    <button
                        onClick={() => setShowBuilder(true)}
                        className="px-4 py-2 bg-teal-500 hover:bg-teal-400 text-white rounded-xl text-sm font-semibold"
                    >
                        Create Campaign
                    </button>
                </div>
            ) : (
                <div className="space-y-3">
                    {filtered.map(campaign => {
                        const style = STATUS_STYLES[campaign.status] || STATUS_STYLES.draft;
                        const openRate = campaign.total_sent > 0 ? Math.round((campaign.total_opened / campaign.total_sent) * 100) : 0;

                        return (
                            <div key={campaign.id} className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 hover:border-slate-700 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-teal-500/10 flex items-center justify-center">
                                        <Mail className="w-5 h-5 text-teal-400" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-semibold text-white text-sm truncate">{campaign.name}</h3>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${style.badge}`}>
                                                <span className={`w-1 h-1 rounded-full ${style.dot}`} />
                                                {style.label}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                                            <span>Subject: {campaign.subject}</span>
                                            <span>·</span>
                                            <span>{campaign.total_recipients} recipients</span>
                                            {campaign.scheduled_at && (
                                                <>
                                                    <span>·</span>
                                                    <span>Scheduled: {new Date(campaign.scheduled_at).toLocaleDateString()}</span>
                                                </>
                                            )}
                                        </div>
                                        {campaign.status === 'completed' && (
                                            <div className="text-xs text-emerald-400 mt-1">{openRate}% opened</div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        {campaign.status === 'draft' && (
                                            <button
                                                onClick={() => handleSend(campaign.id)}
                                                className="p-2 rounded-lg bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 transition-colors"
                                                title="Send now"
                                            >
                                                <Send className="w-4 h-4" />
                                            </button>
                                        )}
                                        {campaign.status === 'completed' && (
                                            <button
                                                onClick={() => { setSelectedCampaign(campaign); setShowAnalytics(true); }}
                                                className="p-2 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 transition-colors"
                                                title="View analytics"
                                            >
                                                <BarChart3 className="w-4 h-4" />
                                            </button>
                                        )}
                                        {(campaign.status === 'draft' || campaign.status === 'failed' || campaign.status === 'cancelled') && (
                                            <button
                                                onClick={() => handleDelete(campaign.id)}
                                                className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                                                title="Delete"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default CampaignList;
