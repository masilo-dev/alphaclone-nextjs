'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
    Facebook, Users, Megaphone, RefreshCw, CheckCircle2, XCircle,
    ExternalLink, Plus, Send, Image, Link2, Loader2, Eye, Trash2,
    TrendingUp, UserPlus, Mail, Phone, Building2, Filter, ChevronDown
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';

interface FacebookPage {
    id: string;
    page_id: string;
    page_name: string;
    is_active: boolean;
    connected_at: string;
}

interface FacebookLead {
    id: string;
    lead_id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    company: string;
    campaign_name: string;
    ad_name: string;
    status: string;
    crm_lead_id: string | null;
    received_at: string;
    field_data: Record<string, string>;
}

const STATUS_COLORS: Record<string, string> = {
    new: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    contacted: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    qualified: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
    converted: 'bg-green-500/20 text-green-400 border-green-500/30',
    disqualified: 'bg-red-500/20 text-red-400 border-red-500/30',
};

export default function FacebookIntegrationTab() {
    const { user } = useAuth();
    const { currentTenant: tenant } = useTenant();
    const [activeTab, setActiveTab] = useState<'leads' | 'post' | 'pages'>('leads');
    const [pages, setPages] = useState<FacebookPage[]>([]);
    const [leads, setLeads] = useState<FacebookLead[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<string>('all');

    // Post form
    const [selectedPageId, setSelectedPageId] = useState('');
    const [postMessage, setPostMessage] = useState('');
    const [postLink, setPostLink] = useState('');
    const [posting, setPosting] = useState(false);

    const isConnected = pages.length > 0;

    const loadData = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        const [pagesRes, leadsRes] = await Promise.all([
            supabase
                .from('facebook_integrations')
                .select('id,page_id,page_name,is_active,connected_at')
                .eq('user_id', user.id)
                .eq('is_active', true),
            supabase
                .from('facebook_leads')
                .select('*')
                .eq('tenant_id', tenant?.id)
                .order('received_at', { ascending: false })
                .limit(100),
        ]);
        if (!pagesRes.error) setPages(pagesRes.data || []);
        if (!leadsRes.error) setLeads(leadsRes.data || []);
        if (pagesRes.data?.[0]) setSelectedPageId(pagesRes.data[0].page_id);
        setLoading(false);
    }, [user, tenant?.id]);

    useEffect(() => { loadData(); }, [loadData]);

    const handleConnect = () => {
        window.location.href = '/api/auth/facebook/connect';
    };

    const handleDisconnect = async (pageId: string) => {
        if (!confirm('Disconnect this Facebook Page?')) return;
        const { error } = await supabase
            .from('facebook_integrations')
            .update({ is_active: false })
            .eq('page_id', pageId)
            .eq('user_id', user?.id);
        if (!error) {
            toast.success('Page disconnected');
            loadData();
        }
    };

    const handlePost = async () => {
        if (!postMessage.trim()) return toast.error('Message is required');
        if (!selectedPageId) return toast.error('Select a Facebook Page');
        setPosting(true);
        const toastId = toast.loading('Posting to Facebook...');
        try {
            const res = await fetch('/api/facebook/post', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pageId: selectedPageId, message: postMessage, link: postLink || undefined }),
            });
            const data = await res.json();
            if (data.success) {
                toast.success('Posted to Facebook!', { id: toastId });
                setPostMessage('');
                setPostLink('');
            } else {
                toast.error(data.error || 'Failed to post', { id: toastId });
            }
        } catch {
            toast.error('Failed to post', { id: toastId });
        }
        setPosting(false);
    };

    const handleUpdateStatus = async (leadId: string, status: string) => {
        const { error } = await supabase
            .from('facebook_leads')
            .update({ status })
            .eq('id', leadId);
        if (!error) {
            setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status } : l));
            toast.success('Status updated');
        }
    };

    const filteredLeads = statusFilter === 'all' ? leads : leads.filter(l => l.status === statusFilter);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-6 h-6 animate-spin text-teal-400" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
                        <Facebook className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-white">Facebook Integration</h2>
                        <p className="text-sm text-slate-400">Lead Ads capture · Page posting · Client discovery</p>
                    </div>
                </div>
                {!isConnected ? (
                    <button
                        onClick={handleConnect}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold text-sm transition-colors"
                    >
                        <Facebook className="w-4 h-4" />
                        Connect Facebook
                    </button>
                ) : (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/30 rounded-lg">
                        <CheckCircle2 className="w-4 h-4 text-green-400" />
                        <span className="text-sm text-green-400 font-medium">Connected</span>
                    </div>
                )}
            </div>

            {!isConnected ? (
                /* Not connected state */
                <div className="border border-dashed border-slate-700 rounded-2xl p-12 text-center">
                    <Facebook className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                    <h3 className="text-lg font-bold text-white mb-2">Connect Your Facebook Account</h3>
                    <p className="text-slate-400 text-sm max-w-md mx-auto mb-6">
                        Automatically capture Facebook Lead Ads into your CRM, post to your business page, 
                        and find potential clients — all from one dashboard.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-lg mx-auto mb-8">
                        {[
                            { icon: UserPlus, label: 'Auto-capture Lead Ads', desc: 'Zero manual entry' },
                            { icon: Megaphone, label: 'Post to Your Page', desc: 'Schedule content' },
                            { icon: TrendingUp, label: 'Find Clients', desc: 'Discover businesses' },
                        ].map(({ icon: Icon, label, desc }) => (
                            <div key={label} className="p-4 bg-slate-800/60 border border-slate-700 rounded-xl text-left">
                                <Icon className="w-5 h-5 text-blue-400 mb-2" />
                                <p className="text-sm font-semibold text-white">{label}</p>
                                <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
                            </div>
                        ))}
                    </div>
                    <button
                        onClick={handleConnect}
                        className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold transition-colors"
                    >
                        Connect with Facebook
                    </button>
                    <p className="text-xs text-slate-600 mt-3">Requires: <code>FACEBOOK_APP_ID</code> + <code>FACEBOOK_APP_SECRET</code> in env vars</p>
                </div>
            ) : (
                <>
                    {/* Tabs */}
                    <div className="flex gap-1 p-1 bg-slate-800/60 border border-slate-700 rounded-xl w-fit">
                        {(['leads', 'post', 'pages'] as const).map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize transition-all ${
                                    activeTab === tab
                                        ? 'bg-teal-500 text-white'
                                        : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                {tab === 'leads' && `Leads (${leads.length})`}
                                {tab === 'post' && 'Post to Page'}
                                {tab === 'pages' && 'Pages'}
                            </button>
                        ))}
                    </div>

                    {/* LEADS TAB */}
                    {activeTab === 'leads' && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Filter className="w-4 h-4 text-slate-400" />
                                    <select
                                        value={statusFilter}
                                        onChange={e => setStatusFilter(e.target.value)}
                                        className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-teal-500"
                                    >
                                        <option value="all">All Leads</option>
                                        <option value="new">New</option>
                                        <option value="contacted">Contacted</option>
                                        <option value="qualified">Qualified</option>
                                        <option value="converted">Converted</option>
                                        <option value="disqualified">Disqualified</option>
                                    </select>
                                </div>
                                <button
                                    onClick={loadData}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-400 hover:text-white transition-colors"
                                >
                                    <RefreshCw className="w-3.5 h-3.5" />
                                    Refresh
                                </button>
                            </div>

                            {filteredLeads.length === 0 ? (
                                <div className="text-center py-16 border border-dashed border-slate-700 rounded-2xl">
                                    <UserPlus className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                                    <p className="text-slate-400 font-semibold">No Facebook leads yet</p>
                                    <p className="text-slate-600 text-sm mt-1">
                                        Leads from your Facebook Lead Ads will appear here automatically.
                                    </p>
                                    <div className="mt-4 p-4 bg-slate-800/60 border border-slate-700 rounded-xl max-w-sm mx-auto text-left text-xs text-slate-400">
                                        <p className="font-semibold text-slate-300 mb-2">Setup checklist:</p>
                                        <ol className="space-y-1 list-decimal list-inside">
                                            <li>Go to Facebook Business Manager</li>
                                            <li>Subscribe your page to lead notifications</li>
                                            <li>Set webhook URL: <code className="text-teal-400">/api/webhooks/facebook/leads</code></li>
                                            <li>Verify token: <code className="text-teal-400">alphaclone_fb_verify</code></li>
                                        </ol>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {filteredLeads.map(lead => (
                                        <div key={lead.id} className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-colors">
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="flex items-start gap-3 min-w-0">
                                                    <div className="w-9 h-9 rounded-full bg-blue-600/20 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
                                                        <span className="text-sm font-bold text-blue-400">
                                                            {(lead.first_name?.[0] || lead.email?.[0] || 'F').toUpperCase()}
                                                        </span>
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="font-semibold text-white text-sm truncate">
                                                            {[lead.first_name, lead.last_name].filter(Boolean).join(' ') || 'Unknown'}
                                                        </p>
                                                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                                                            {lead.email && (
                                                                <span className="text-xs text-slate-400 flex items-center gap-1">
                                                                    <Mail className="w-3 h-3" />{lead.email}
                                                                </span>
                                                            )}
                                                            {lead.phone && (
                                                                <span className="text-xs text-slate-400 flex items-center gap-1">
                                                                    <Phone className="w-3 h-3" />{lead.phone}
                                                                </span>
                                                            )}
                                                            {lead.company && (
                                                                <span className="text-xs text-slate-400 flex items-center gap-1">
                                                                    <Building2 className="w-3 h-3" />{lead.company}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {(lead.campaign_name || lead.ad_name) && (
                                                            <p className="text-xs text-slate-600 mt-1">
                                                                {lead.campaign_name || lead.ad_name}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 flex-shrink-0">
                                                    {lead.crm_lead_id && (
                                                        <span className="text-xs px-2 py-0.5 bg-teal-500/10 border border-teal-500/20 rounded-md text-teal-400">
                                                            In CRM
                                                        </span>
                                                    )}
                                                    <select
                                                        value={lead.status}
                                                        onChange={e => handleUpdateStatus(lead.id, e.target.value)}
                                                        className={`text-xs px-2 py-1 border rounded-lg bg-transparent focus:outline-none cursor-pointer ${STATUS_COLORS[lead.status] || STATUS_COLORS.new}`}
                                                    >
                                                        <option value="new">New</option>
                                                        <option value="contacted">Contacted</option>
                                                        <option value="qualified">Qualified</option>
                                                        <option value="converted">Converted</option>
                                                        <option value="disqualified">Disqualified</option>
                                                    </select>
                                                    <span className="text-xs text-slate-600">
                                                        {new Date(lead.received_at).toLocaleDateString()}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* POST TO PAGE TAB */}
                    {activeTab === 'post' && (
                        <div className="max-w-2xl space-y-4">
                            <div>
                                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 block">
                                    Facebook Page
                                </label>
                                <select
                                    value={selectedPageId}
                                    onChange={e => setSelectedPageId(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-teal-500"
                                >
                                    {pages.map(p => (
                                        <option key={p.page_id} value={p.page_id}>{p.page_name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 block">
                                    Post Message
                                </label>
                                <textarea
                                    value={postMessage}
                                    onChange={e => setPostMessage(e.target.value)}
                                    placeholder="What's on your mind? Share an update, promotion, or insight..."
                                    rows={5}
                                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 resize-none"
                                />
                                <p className="text-xs text-slate-600 mt-1 text-right">{postMessage.length} chars</p>
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 block">
                                    Link (optional)
                                </label>
                                <div className="relative">
                                    <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                    <input
                                        type="url"
                                        value={postLink}
                                        onChange={e => setPostLink(e.target.value)}
                                        placeholder="https://yourwebsite.com"
                                        className="w-full pl-9 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
                                    />
                                </div>
                            </div>
                            <button
                                onClick={handlePost}
                                disabled={posting || !postMessage.trim()}
                                className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-semibold transition-colors"
                            >
                                {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                {posting ? 'Posting...' : 'Post to Facebook'}
                            </button>
                        </div>
                    )}

                    {/* PAGES TAB */}
                    {activeTab === 'pages' && (
                        <div className="space-y-3">
                            {pages.map(page => (
                                <div key={page.id} className="flex items-center justify-between p-4 bg-slate-900/50 border border-slate-800 rounded-xl">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
                                            <Facebook className="w-4 h-4 text-blue-400" />
                                        </div>
                                        <div>
                                            <p className="font-semibold text-white text-sm">{page.page_name}</p>
                                            <p className="text-xs text-slate-500">ID: {page.page_id} · Connected {new Date(page.connected_at).toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <a
                                            href={`https://facebook.com/${page.page_id}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                                        >
                                            <ExternalLink className="w-3.5 h-3.5" />
                                        </a>
                                        <button
                                            onClick={() => handleDisconnect(page.page_id)}
                                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                            <button
                                onClick={handleConnect}
                                className="flex items-center gap-2 px-4 py-2.5 border border-dashed border-slate-700 rounded-xl text-slate-400 hover:text-white hover:border-blue-500 transition-colors text-sm w-full justify-center"
                            >
                                <Plus className="w-4 h-4" />
                                Connect another page
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
