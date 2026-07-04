'use client';

import { useState, useEffect } from 'react';
import { Loader2, Plus, Send, Pause, Play, Trash2, BarChart3, Mail, Calendar, Users, X, ChevronDown, ChevronUp, CheckCircle2, Eye, MousePointerClick, AlertCircle } from 'lucide-react';
import { emailCampaignService, type EmailCampaign } from '@/services/emailCampaignService';
import { useAuth } from '@/contexts/AuthContext';
import { StandardStatCard, StandardStatusBadge, resolveStatusVariant, type CardTheme } from '@/components/ui/design-system';

type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'paused' | 'cancelled';

interface CampaignStats {
    totalRecipients: number;
    totalSent: number;
    totalDelivered: number;
    totalOpened: number;
    totalClicked: number;
    totalBounced: number;
    totalUnsubscribed: number;
    openRate: number;
    clickRate: number;
    bounceRate: number;
}

export default function CampaignManager() {
    const { user } = useAuth();
    const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [selectedCampaign, setSelectedCampaign] = useState<EmailCampaign | null>(null);
    const [campaignStats, setCampaignStats] = useState<CampaignStats | null>(null);
    const [newCampaign, setNewCampaign] = useState({
        name: '',
        subject: '',
        fromName: '',
        fromEmail: '',
        scheduledAt: '',
    });
    const [creating, setCreating] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [expandedCampaign, setExpandedCampaign] = useState<string | null>(null);

    useEffect(() => {
        loadCampaigns();
    }, []);

    const loadCampaigns = async () => {
        try {
            setLoading(true);
            setError(null);
            const { campaigns: data, error: err } = await emailCampaignService.getCampaigns();
            if (err) throw new Error(err);
            setCampaigns(data);
        } catch (err) {
            console.error('Failed to load campaigns:', err);
            setError(err instanceof Error ? err.message : 'Failed to load campaigns');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateCampaign = async () => {
        if (!newCampaign.name.trim() || !newCampaign.subject.trim()) return;
        if (!user?.id) {
            setError('You must be logged in to create campaigns');
            return;
        }

        try {
            setCreating(true);
            setError(null);
            const { campaign, error: err } = await emailCampaignService.createCampaign(user.id, {
                name: newCampaign.name,
                subject: newCampaign.subject,
                fromName: newCampaign.fromName || 'AlphaClone Systems',
                fromEmail: newCampaign.fromEmail || 'noreply@alphaclonesystems.com',
                scheduledAt: newCampaign.scheduledAt || undefined,
            });

            if (err || !campaign) throw new Error(err || 'Failed to create campaign');

            setCampaigns(prev => [campaign, ...prev]);
            setShowCreateForm(false);
            setNewCampaign({
                name: '',
                subject: '',
                fromName: '',
                fromEmail: '',
                scheduledAt: '',
            });
        } catch (err) {
            console.error('Failed to create campaign:', err);
            setError(err instanceof Error ? err.message : 'Failed to create campaign');
        } finally {
            setCreating(false);
        }
    };

    const handleSendCampaign = async (campaignId: string) => {
        try {
            setActionLoading(campaignId);
            setError(null);
            const { success, error: err } = await emailCampaignService.sendCampaign(campaignId);
            if (!success) throw new Error(err || 'Failed to send campaign');
            await loadCampaigns();
        } catch (err) {
            console.error('Failed to send campaign:', err);
            setError(err instanceof Error ? err.message : 'Failed to send campaign');
        } finally {
            setActionLoading(null);
        }
    };

    const handleUpdateStatus = async (campaignId: string, status: CampaignStatus) => {
        try {
            setActionLoading(campaignId);
            setError(null);
            const { campaign, error: err } = await emailCampaignService.updateCampaign(campaignId, { status });
            if (err || !campaign) throw new Error(err || 'Failed to update campaign');
            setCampaigns(prev => prev.map(c => c.id === campaignId ? { ...c, status } : c));
        } catch (err) {
            console.error('Failed to update campaign status:', err);
            setError(err instanceof Error ? err.message : 'Failed to update status');
        } finally {
            setActionLoading(null);
        }
    };

    const handleDeleteCampaign = async (campaignId: string) => {
        if (!confirm('Are you sure you want to delete this campaign?')) return;
        try {
            setActionLoading(campaignId);
            setError(null);
            const { success, error: err } = await emailCampaignService.deleteCampaign(campaignId);
            if (!success) throw new Error(err || 'Failed to delete campaign');
            setCampaigns(prev => prev.filter(c => c.id !== campaignId));
        } catch (err) {
            console.error('Failed to delete campaign:', err);
            setError(err instanceof Error ? err.message : 'Failed to delete campaign');
        } finally {
            setActionLoading(null);
        }
    };

    const handleViewStats = async (campaign: EmailCampaign) => {
        setSelectedCampaign(campaign);
        try {
            const { analytics, error: err } = await emailCampaignService.getCampaignAnalytics(campaign.id);
            if (err) throw new Error(err);

            setCampaignStats({
                totalRecipients: campaign.totalRecipients || 0,
                totalSent: campaign.totalSent || 0,
                totalDelivered: campaign.totalDelivered || 0,
                totalOpened: campaign.totalOpened || 0,
                totalClicked: campaign.totalClicked || 0,
                totalBounced: campaign.totalBounced || 0,
                totalUnsubscribed: campaign.totalUnsubscribed || 0,
                openRate: analytics?.openRate || 0,
                clickRate: analytics?.clickRate || 0,
                bounceRate: analytics?.bounceRate || 0,
            });
        } catch (err) {
            console.error('Failed to load stats:', err);
            setCampaignStats({
                totalRecipients: campaign.totalRecipients || 0,
                totalSent: campaign.totalSent || 0,
                totalDelivered: campaign.totalDelivered || 0,
                totalOpened: campaign.totalOpened || 0,
                totalClicked: campaign.totalClicked || 0,
                totalBounced: campaign.totalBounced || 0,
                totalUnsubscribed: campaign.totalUnsubscribed || 0,
                openRate: 0,
                clickRate: 0,
                bounceRate: 0,
            });
        }
    };

    const formatDate = (dateString?: string) => {
        if (!dateString) return 'Not scheduled';
        return new Date(dateString).toLocaleString();
    };

    const formatRate = (rate: number) => `${rate.toFixed(1)}%`;

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold text-white">Email Campaigns</h2>
                    <p className="text-xs text-slate-400">Create and manage email marketing campaigns</p>
                </div>
                <button
                    onClick={() => setShowCreateForm(!showCreateForm)}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    New Campaign
                </button>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">
                    {error}
                </div>
            )}

            {showCreateForm && (
                <div className="bg-slate-800 rounded-xl p-6 space-y-4 border border-slate-700">
                    <h3 className="text-sm font-semibold text-white">Create Email Campaign</h3>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs text-slate-400">Campaign Name *</label>
                            <input
                                type="text"
                                placeholder="Summer Sale 2024"
                                value={newCampaign.name}
                                onChange={(e) => setNewCampaign(prev => ({ ...prev, name: e.target.value }))}
                                className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs text-slate-400">Email Subject *</label>
                            <input
                                type="text"
                                placeholder="Don't miss our summer sale!"
                                value={newCampaign.subject}
                                onChange={(e) => setNewCampaign(prev => ({ ...prev, subject: e.target.value }))}
                                className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs text-slate-400">From Name</label>
                            <input
                                type="text"
                                placeholder="AlphaClone Systems"
                                value={newCampaign.fromName}
                                onChange={(e) => setNewCampaign(prev => ({ ...prev, fromName: e.target.value }))}
                                className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs text-slate-400">From Email</label>
                            <input
                                type="email"
                                placeholder="noreply@alphaclonesystems.com"
                                value={newCampaign.fromEmail}
                                onChange={(e) => setNewCampaign(prev => ({ ...prev, fromEmail: e.target.value }))}
                                className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs text-slate-400">Schedule Send (optional)</label>
                        <input
                            type="datetime-local"
                            value={newCampaign.scheduledAt}
                            onChange={(e) => setNewCampaign(prev => ({ ...prev, scheduledAt: e.target.value }))}
                            className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                        />
                        <p className="text-[10px] text-slate-500">Leave empty to save as draft</p>
                    </div>

                    <div className="flex justify-end gap-3">
                        <button
                            onClick={() => setShowCreateForm(false)}
                            className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleCreateCampaign}
                            disabled={creating || !newCampaign.name.trim() || !newCampaign.subject.trim()}
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                        >
                            {creating ? 'Creating...' : 'Create Campaign'}
                        </button>
                    </div>
                </div>
            )}

            {campaigns.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                    <Mail className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">No campaigns yet</p>
                    <p className="text-xs mt-1">Create your first email campaign</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {campaigns.map(campaign => (
                        <div
                            key={campaign.id}
                            className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden"
                        >
                            <div className="p-5">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-3 mb-2">
                                            <h3 className="text-sm font-semibold text-white truncate">
                                                {campaign.name}
                                            </h3>
                                            <StandardStatusBadge variant={resolveStatusVariant(campaign.status)}>
                                                {campaign.status}
                                            </StandardStatusBadge>
                                        </div>
                                        <p className="text-sm text-slate-300 mb-2">
                                            Subject: {campaign.subject}
                                        </p>
                                        <div className="flex items-center gap-4 text-[10px] text-slate-500">
                                            <span className="flex items-center gap-1">
                                                <Calendar className="w-3 h-3" />
                                                Created: {new Date(campaign.createdAt).toLocaleDateString()}
                                            </span>
                                            {campaign.scheduledAt && (
                                                <span className="flex items-center gap-1 text-blue-400">
                                                    <Calendar className="w-3 h-3" />
                                                    Scheduled: {formatDate(campaign.scheduledAt)}
                                                </span>
                                            )}
                                            {campaign.sentAt && (
                                                <span className="flex items-center gap-1 text-green-400">
                                                    <Send className="w-3 h-3" />
                                                    Sent: {formatDate(campaign.sentAt)}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-4 mt-2 text-[10px] text-slate-400">
                                            <span className="flex items-center gap-1">
                                                <Users className="w-3 h-3" />
                                                {campaign.totalRecipients || 0} recipients
                                            </span>
                                            {campaign.totalSent > 0 && (
                                                <>
                                                    <span>{campaign.totalSent} sent</span>
                                                    <span>{campaign.totalDelivered} delivered</span>
                                                    {campaign.totalOpened > 0 && (
                                                        <span className="text-blue-400">
                                                            {campaign.totalOpened} opens ({formatRate((campaign.totalOpened / campaign.totalDelivered) * 100)})
                                                        </span>
                                                    )}
                                                    {campaign.totalClicked > 0 && (
                                                        <span className="text-purple-400">
                                                            {campaign.totalClicked} clicks ({formatRate((campaign.totalClicked / campaign.totalDelivered) * 100)})
                                                        </span>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 ml-4">
                                        {(campaign.status === 'draft' || campaign.status === 'scheduled') && (
                                            <button
                                                onClick={() => handleSendCampaign(campaign.id)}
                                                disabled={actionLoading === campaign.id}
                                                className="p-2 text-green-400 hover:bg-green-400/10 rounded-lg transition-colors"
                                                title="Send Campaign Now"
                                            >
                                                {actionLoading === campaign.id ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <Send className="w-4 h-4" />
                                                )}
                                            </button>
                                        )}
                                        {campaign.status === 'sending' && (
                                            <button
                                                onClick={() => handleUpdateStatus(campaign.id, 'paused')}
                                                disabled={actionLoading === campaign.id}
                                                className="p-2 text-yellow-400 hover:bg-yellow-400/10 rounded-lg transition-colors"
                                                title="Pause Campaign"
                                            >
                                                {actionLoading === campaign.id ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <Pause className="w-4 h-4" />
                                                )}
                                            </button>
                                        )}
                                        {campaign.status === 'paused' && (
                                            <button
                                                onClick={() => handleUpdateStatus(campaign.id, 'sending')}
                                                disabled={actionLoading === campaign.id}
                                                className="p-2 text-green-400 hover:bg-green-400/10 rounded-lg transition-colors"
                                                title="Resume Campaign"
                                            >
                                                {actionLoading === campaign.id ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <Play className="w-4 h-4" />
                                                )}
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleViewStats(campaign)}
                                            className="p-2 text-blue-400 hover:bg-blue-400/10 rounded-lg transition-colors"
                                            title="View Statistics"
                                        >
                                            <BarChart3 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteCampaign(campaign.id)}
                                            disabled={actionLoading === campaign.id}
                                            className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                                            title="Delete Campaign"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => setExpandedCampaign(expandedCampaign === campaign.id ? null : campaign.id)}
                                            className="p-2 text-slate-400 hover:text-white rounded-lg transition-colors"
                                            title="Toggle Details"
                                        >
                                            {expandedCampaign === campaign.id ? (
                                                <ChevronUp className="w-4 h-4" />
                                            ) : (
                                                <ChevronDown className="w-4 h-4" />
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                            {expandedCampaign === campaign.id && (
                                <div className="border-t border-slate-700 bg-slate-900/50 px-5 py-4">
                                    <div className="grid grid-cols-3 gap-4 text-sm">
                                        <div>
                                            <span className="text-slate-500 text-xs">From:</span>
                                            <p className="text-slate-300">{campaign.fromName || 'Not set'}</p>
                                            <p className="text-slate-400 text-xs">{campaign.fromEmail || 'Not set'}</p>
                                        </div>
                                        <div>
                                            <span className="text-slate-500 text-xs">Reply-To:</span>
                                            <p className="text-slate-300">{campaign.replyTo || campaign.fromEmail || 'Not set'}</p>
                                        </div>
                                        <div>
                                            <span className="text-slate-500 text-xs">Status Details:</span>
                                            <p className="text-slate-300">
                                                {campaign.totalBounced > 0 && (
                                                    <span className="text-red-400">{campaign.totalBounced} bounced</span>
                                                )}
                                                {campaign.totalUnsubscribed > 0 && (
                                                    <span className="text-orange-400 ml-2">{campaign.totalUnsubscribed} unsubscribed</span>
                                                )}
                                                {!campaign.totalBounced && !campaign.totalUnsubscribed && (
                                                    <span className="text-slate-500">No issues</span>
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {selectedCampaign && campaignStats && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-semibold text-white">
                                Campaign Analytics: {selectedCampaign.name}
                            </h3>
                            <button
                                onClick={() => { setSelectedCampaign(null); setCampaignStats(null); }}
                                className="text-slate-400 hover:text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="grid grid-cols-3 gap-4 mb-6">
                            <StandardStatCard
                                label="Total Recipients"
                                value={campaignStats.totalRecipients.toLocaleString()}
                                themeColor="teal"
                                icon={Users}
                                interactive={false}
                            />
                            <StandardStatCard
                                label="Sent"
                                value={campaignStats.totalSent.toLocaleString()}
                                themeColor="blue"
                                icon={Send}
                                interactive={false}
                            />
                            <StandardStatCard
                                label="Delivered"
                                value={campaignStats.totalDelivered.toLocaleString()}
                                themeColor="emerald"
                                icon={CheckCircle2}
                                interactive={false}
                            />
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                            <StandardStatCard
                                label="Open Rate"
                                value={formatRate(campaignStats.openRate)}
                                themeColor="purple"
                                icon={Eye}
                                interactive={false}
                                comparisonText={`${campaignStats.totalOpened.toLocaleString()} opens`}
                            />
                            <StandardStatCard
                                label="Click Rate"
                                value={formatRate(campaignStats.clickRate)}
                                themeColor="amber"
                                icon={MousePointerClick}
                                interactive={false}
                                comparisonText={`${campaignStats.totalClicked.toLocaleString()} clicks`}
                            />
                            <StandardStatCard
                                label="Bounce Rate"
                                value={formatRate(campaignStats.bounceRate)}
                                themeColor="rose"
                                icon={AlertCircle}
                                interactive={false}
                                comparisonText={`${campaignStats.totalBounced.toLocaleString()} bounced`}
                            />
                            <StandardStatCard
                                label="Unsubscribes"
                                value={campaignStats.totalUnsubscribed.toLocaleString()}
                                themeColor="orange"
                                icon={X}
                                interactive={false}
                            />
                        </div>

                        <div className="text-xs text-slate-500 text-center">
                            Campaign sent on {selectedCampaign.sentAt ? formatDate(selectedCampaign.sentAt) : 'Not sent yet'}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
