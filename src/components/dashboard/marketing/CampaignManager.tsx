'use client';

import { useState, useEffect } from 'react';
import { Loader2, Plus, Send, Pause, Play, Trash2, BarChart3, Mail, MessageSquare, Smartphone } from 'lucide-react';
import { campaignService, type Campaign, type CampaignStatus, type CampaignType, type CampaignChannel } from '@/services/marketing/campaignService';

const STATUS_COLORS: Record<CampaignStatus, string> = {
    draft: 'bg-gray-500',
    scheduled: 'bg-blue-500',
    active: 'bg-green-500',
    paused: 'bg-yellow-500',
    completed: 'bg-purple-500',
    cancelled: 'bg-red-500',
};

const CHANNEL_ICONS: Record<CampaignChannel, React.ReactNode> = {
    email: <Mail className="w-4 h-4" />,
    sms: <MessageSquare className="w-4 h-4" />,
    push: <Smartphone className="w-4 h-4" />,
    in_app: <Smartphone className="w-4 h-4" />,
};

export default function CampaignManager() {
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
    const [campaignStats, setCampaignStats] = useState<any>(null);
    const [newCampaign, setNewCampaign] = useState({
        name: '',
        description: '',
        type: 'email' as CampaignType,
        channels: ['email'] as CampaignChannel[],
        target_audience: '',
        scheduled_at: '',
        messageContent: '',
        messageSubject: '',
    });
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        loadCampaigns();
    }, []);

    const loadCampaigns = async () => {
        try {
            setLoading(true);
            const data = await campaignService.getAll();
            setCampaigns(data);
        } catch (error) {
            console.error('Failed to load campaigns:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateCampaign = async () => {
        if (!newCampaign.name.trim() || !newCampaign.messageContent.trim()) return;

        try {
            setCreating(true);
            const campaign = await campaignService.create({
                name: newCampaign.name,
                description: newCampaign.description,
                type: newCampaign.type,
                channels: newCampaign.channels,
                target_audience: newCampaign.target_audience,
                scheduled_at: newCampaign.scheduled_at || undefined,
                messages: [{
                    channel: newCampaign.channels[0],
                    subject: newCampaign.messageSubject,
                    content: newCampaign.messageContent,
                }],
            });

            setCampaigns(prev => [campaign, ...prev]);
            setShowCreateForm(false);
            setNewCampaign({
                name: '',
                description: '',
                type: 'email',
                channels: ['email'],
                target_audience: '',
                scheduled_at: '',
                messageContent: '',
                messageSubject: '',
            });
        } catch (error) {
            console.error('Failed to create campaign:', error);
        } finally {
            setCreating(false);
        }
    };

    const handleLaunchCampaign = async (campaignId: string) => {
        try {
            await campaignService.launch(campaignId);
            await loadCampaigns();
        } catch (error) {
            console.error('Failed to launch campaign:', error);
        }
    };

    const handleViewStats = async (campaign: Campaign) => {
        setSelectedCampaign(campaign);
        try {
            const stats = await campaignService.getStats(campaign.id);
            setCampaignStats(stats);
        } catch (error) {
            console.error('Failed to load stats:', error);
        }
    };

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
                <h2 className="text-lg font-bold text-white">Marketing Campaigns</h2>
                <button
                    onClick={() => setShowCreateForm(!showCreateForm)}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    New Campaign
                </button>
            </div>

            {showCreateForm && (
                <div className="bg-slate-800 rounded-xl p-6 space-y-4 border border-slate-700">
                    <h3 className="text-sm font-semibold text-white">Create Campaign</h3>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs text-slate-400">Campaign Name</label>
                            <input
                                type="text"
                                placeholder="Summer Sale 2024"
                                value={newCampaign.name}
                                onChange={(e) => setNewCampaign(prev => ({ ...prev, name: e.target.value }))}
                                className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs text-slate-400">Campaign Type</label>
                            <select
                                value={newCampaign.type}
                                onChange={(e) => setNewCampaign(prev => ({ ...prev, type: e.target.value as CampaignType }))}
                                className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                            >
                                <option value="email">Email Campaign</option>
                                <option value="sms">SMS Campaign</option>
                                <option value="multi_channel">Multi-Channel</option>
                            </select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs text-slate-400">Description</label>
                        <textarea
                            placeholder="Campaign description..."
                            value={newCampaign.description}
                            onChange={(e) => setNewCampaign(prev => ({ ...prev, description: e.target.value }))}
                            rows={2}
                            className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs text-slate-400">Target Audience</label>
                            <input
                                type="text"
                                placeholder="All active customers"
                                value={newCampaign.target_audience}
                                onChange={(e) => setNewCampaign(prev => ({ ...prev, target_audience: e.target.value }))}
                                className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs text-slate-400">Schedule (optional)</label>
                            <input
                                type="datetime-local"
                                value={newCampaign.scheduled_at}
                                onChange={(e) => setNewCampaign(prev => ({ ...prev, scheduled_at: e.target.value }))}
                                className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs text-slate-400">Email Subject</label>
                        <input
                            type="text"
                            placeholder="Don't miss our summer sale!"
                            value={newCampaign.messageSubject}
                            onChange={(e) => setNewCampaign(prev => ({ ...prev, messageSubject: e.target.value }))}
                            className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs text-slate-400">Message Content (HTML supported)</label>
                        <textarea
                            placeholder="<h1>Summer Sale!</h1><p>Get 20% off...</p>"
                            value={newCampaign.messageContent}
                            onChange={(e) => setNewCampaign(prev => ({ ...prev, messageContent: e.target.value }))}
                            rows={6}
                            className="w-full px-3 py-2 text-sm bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none font-mono"
                        />
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
                            disabled={creating || !newCampaign.name.trim() || !newCampaign.messageContent.trim()}
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                        >
                            {creating ? 'Creating...' : 'Create Campaign'}
                        </button>
                    </div>
                </div>
            )}

            {campaigns.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                    <Send className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">No campaigns yet</p>
                    <p className="text-xs mt-1">Create your first marketing campaign</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {campaigns.map(campaign => (
                        <div
                            key={campaign.id}
                            className="bg-slate-800 rounded-xl border border-slate-700 p-5 hover:border-slate-600 transition-colors"
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-3 mb-2">
                                        <h3 className="text-sm font-semibold text-white truncate">
                                            {campaign.name}
                                        </h3>
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full text-white ${STATUS_COLORS[campaign.status]}`}>
                                            {campaign.status}
                                        </span>
                                    </div>
                                    {campaign.description && (
                                        <p className="text-xs text-slate-400 mb-2 line-clamp-2">
                                            {campaign.description}
                                        </p>
                                    )}
                                    <div className="flex items-center gap-4 text-[10px] text-slate-500">
                                        <span className="flex items-center gap-1">
                                            {campaign.channels.map(ch => (
                                                <span key={ch} className="flex items-center gap-1">
                                                    {CHANNEL_ICONS[ch]}
                                                    {ch}
                                                </span>
                                            ))}
                                        </span>
                                        <span>
                                            Created: {new Date(campaign.created_at).toLocaleDateString()}
                                        </span>
                                        {campaign.scheduled_at && (
                                            <span>
                                                Scheduled: {new Date(campaign.scheduled_at).toLocaleDateString()}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 ml-4">
                                    {campaign.status === 'draft' && (
                                        <button
                                            onClick={() => handleLaunchCampaign(campaign.id)}
                                            className="p-2 text-green-400 hover:bg-green-400/10 rounded-lg transition-colors"
                                            title="Launch Campaign"
                                        >
                                            <Play className="w-4 h-4" />
                                        </button>
                                    )}
                                    {campaign.status === 'active' && (
                                        <button
                                            onClick={() => campaignService.updateStatus(campaign.id, 'paused')}
                                            className="p-2 text-yellow-400 hover:bg-yellow-400/10 rounded-lg transition-colors"
                                            title="Pause Campaign"
                                        >
                                            <Pause className="w-4 h-4" />
                                        </button>
                                    )}
                                    {campaign.status === 'paused' && (
                                        <button
                                            onClick={() => campaignService.updateStatus(campaign.id, 'active')}
                                            className="p-2 text-green-400 hover:bg-green-400/10 rounded-lg transition-colors"
                                            title="Resume Campaign"
                                        >
                                            <Play className="w-4 h-4" />
                                        </button>
                                    )}
                                    <button
                                        onClick={() => handleViewStats(campaign)}
                                        className="p-2 text-blue-400 hover:bg-blue-400/10 rounded-lg transition-colors"
                                        title="View Statistics"
                                    >
                                        <BarChart3 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {selectedCampaign && campaignStats && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 max-w-lg w-full mx-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-semibold text-white">
                                Campaign Stats: {selectedCampaign.name}
                            </h3>
                            <button
                                onClick={() => { setSelectedCampaign(null); setCampaignStats(null); }}
                                className="text-slate-400 hover:text-white transition-colors"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-slate-900 rounded-lg p-3 text-center">
                                <div className="text-2xl font-bold text-white">{campaignStats.total}</div>
                                <div className="text-xs text-slate-400">Total</div>
                            </div>
                            <div className="bg-slate-900 rounded-lg p-3 text-center">
                                <div className="text-2xl font-bold text-green-400">{campaignStats.sent}</div>
                                <div className="text-xs text-slate-400">Sent</div>
                            </div>
                            <div className="bg-slate-900 rounded-lg p-3 text-center">
                                <div className="text-2xl font-bold text-blue-400">{campaignStats.delivered}</div>
                                <div className="text-xs text-slate-400">Delivered</div>
                            </div>
                            <div className="bg-slate-900 rounded-lg p-3 text-center">
                                <div className="text-2xl font-bold text-yellow-400">{campaignStats.opened}</div>
                                <div className="text-xs text-slate-400">Opened</div>
                            </div>
                            <div className="bg-slate-900 rounded-lg p-3 text-center">
                                <div className="text-2xl font-bold text-purple-400">{campaignStats.clicked}</div>
                                <div className="text-xs text-slate-400">Clicked</div>
                            </div>
                            <div className="bg-slate-900 rounded-lg p-3 text-center">
                                <div className="text-2xl font-bold text-red-400">{campaignStats.bounced}</div>
                                <div className="text-xs text-slate-400">Bounced</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
