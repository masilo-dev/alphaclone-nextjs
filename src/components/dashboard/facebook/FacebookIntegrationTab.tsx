'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
    Facebook, Users, Megaphone, RefreshCw, CheckCircle2, XCircle,
    ExternalLink, Plus, Send, Image, Link2, Loader2, Eye, Trash2,
    TrendingUp, UserPlus, Mail, Phone, Building2, Filter, ChevronDown, Sparkles,
    Activity, HelpCircle, Code2, Globe, Shield, Zap, AlertCircle
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import MessengerInbox from '../messenger/MessengerInbox';
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
    const [activeTab, setActiveTab] = useState<'leads' | 'messenger' | 'posts' | 'post' | 'pages' | 'setup'>('leads');
    const [pages, setPages] = useState<FacebookPage[]>([]);
    const [leads, setLeads] = useState<FacebookLead[]>([]);
    const [activities, setActivities] = useState<any[]>([]);
    const [pagePosts, setPagePosts] = useState<any[]>([]);
    const [conversations, setConversations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activityLoading, setActivityLoading] = useState(false);
    const [postsLoading, setPostsLoading] = useState(false);
    const [statusFilter, setStatusFilter] = useState<string>('all');

    // Post form
    const [selectedPageId, setSelectedPageId] = useState('');
    const [postMessage, setPostMessage] = useState('');
    const [postLink, setPostLink] = useState('');
    const [posting, setPosting] = useState(false);

    // AI generation state
    const [showAiPanel, setShowAiPanel] = useState(false);
    const [aiTopic, setAiTopic] = useState('');
    const [aiTone, setAiTone] = useState<'engaging' | 'professional' | 'promotional' | 'casual'>('engaging');
    const [aiGenerating, setAiGenerating] = useState(false);

    const isConnected = pages.length > 0;

    const loadData = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        const [pagesRes, leadsRes, convRes] = await Promise.all([
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
            supabase
                .from('messenger_conversations')
                .select('id, is_read')
                .eq('tenant_id', tenant?.id)
        ]);
        if (!pagesRes.error) setPages(pagesRes.data || []);
        if (!leadsRes.error) setLeads(leadsRes.data || []);
        if (!convRes.error) setConversations(convRes.data || []);
        if (pagesRes.data?.[0]) setSelectedPageId(pagesRes.data[0].page_id);
        setLoading(false);
    }, [user, tenant?.id]);

    const fetchActivity = useCallback(async (pageId: string) => {
        if (!pageId) return;
        setActivityLoading(true);
        try {
            const res = await fetch(`/api/facebook/activity?pageId=${pageId}`);
            const data = await res.json();
            if (data.activity) setActivities(data.activity);
        } catch (err) {
            console.error('Failed to fetch activity:', err);
        } finally {
            setActivityLoading(false);
        }
    }, []);

    const fetchPagePosts = useCallback(async (pageId: string) => {
        if (!pageId) return;
        setPostsLoading(true);
        try {
            const res = await fetch(`/api/facebook/posts?pageId=${pageId}&limit=20`);
            const data = await res.json();
            if (data.posts) setPagePosts(data.posts);
        } catch (err) {
            console.error('Failed to fetch page posts:', err);
        } finally {
            setPostsLoading(false);
        }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    useEffect(() => {
        if (activeTab === 'posts' && selectedPageId) {
            fetchPagePosts(selectedPageId);
        }
    }, [activeTab, selectedPageId, fetchPagePosts]);

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
                // Refresh posts tab
                setActiveTab('posts');
                setTimeout(() => fetchPagePosts(selectedPageId), 2000);
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

    const generatePostWithAI = async () => {
        if (!aiTopic.trim()) return toast.error('Describe your post topic first');
        setAiGenerating(true);
        try {
            const res = await fetch('/api/ai/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: `Write a ${aiTone} Facebook business post about: "${aiTopic}". 150-400 chars. Conversational, no hashtags (I will add those separately). End with a subtle call-to-action. Return ONLY the post text, nothing else.`,
                    systemPrompt: 'You are an expert Facebook content strategist for businesses. Write natural, engaging posts that drive interaction. No preamble, no quotes, just the post.',
                    maxTokens: 200,
                    temperature: 0.8,
                }),
            });
            const data = await res.json();
            if (data.text) {
                setPostMessage(data.text.trim().replace(/^"|"$/g, ''));
                toast.success('AI generated post!');
                setShowAiPanel(false);
                setAiTopic('');
            } else {
                toast.error(data.error || 'AI generation failed');
            }
        } catch {
            toast.error('AI generation failed');
        } finally {
            setAiGenerating(false);
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
                    <div className="flex gap-1 p-1 bg-slate-800/60 border border-slate-700 rounded-xl overflow-x-auto no-scrollbar max-w-full">
                        {(['leads', 'messenger', 'posts', 'post', 'pages', 'setup'] as const).map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize transition-all relative whitespace-nowrap ${
                                    activeTab === tab
                                        ? 'bg-teal-500 text-white'
                                        : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                {tab === 'leads' && `Leads (${leads.length})`}
                                {tab === 'messenger' && 'Inbox'}
                                {tab === 'posts' && 'Page Posts'}
                                {tab === 'post' && 'Publish'}
                                {tab === 'pages' && 'Pages'}
                                {tab === 'setup' && 'Setup Guide'}
                                
                                {tab === 'messenger' && conversations.some(c => !c.is_read) && (
                                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-blue-500 rounded-full border-2 border-slate-800" />
                                )}
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
                            {/* AI Post Generator */}
                            <div className="p-4 bg-violet-500/10 border border-violet-500/20 rounded-2xl">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <Sparkles className="w-4 h-4 text-violet-400" />
                                        <span className="text-sm font-semibold text-violet-300">AI Post Generator</span>
                                    </div>
                                    <button
                                        onClick={() => setShowAiPanel(v => !v)}
                                        className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
                                    >
                                        {showAiPanel ? 'Hide' : 'Show'}
                                    </button>
                                </div>
                                {showAiPanel && (
                                    <div className="space-y-3">
                                        <input
                                            value={aiTopic}
                                            onChange={e => setAiTopic(e.target.value)}
                                            placeholder="What is this post about? e.g. 'announcing our new service package'"
                                            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 text-sm"
                                        />
                                        <div className="flex gap-2 flex-wrap">
                                            {(['engaging', 'professional', 'promotional', 'casual'] as const).map(t => (
                                                <button
                                                    key={t}
                                                    onClick={() => setAiTone(t)}
                                                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold capitalize transition-all ${
                                                        aiTone === t ? 'bg-violet-500 text-white' : 'bg-slate-800 border border-slate-700 text-slate-400 hover:text-white'
                                                    }`}
                                                >
                                                    {t}
                                                </button>
                                            ))}
                                        </div>
                                        <button
                                            onClick={generatePostWithAI}
                                            disabled={aiGenerating || !aiTopic.trim()}
                                            className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors"
                                        >
                                            {aiGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                                            {aiGenerating ? 'Generating...' : 'Generate Post'}
                                        </button>
                                    </div>
                                )}
                                {!showAiPanel && (
                                    <p className="text-xs text-violet-400/70">Click Show to generate a Facebook post with AI</p>
                                )}
                            </div>

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

                    {/* MESSENGER TAB */}
                    {activeTab === 'messenger' && (
                        <div className="h-[760px]">
                            <MessengerInbox />
                        </div>
                    )}

                    {/* PAGE POSTS TAB */}
                    {activeTab === 'posts' && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                        <Activity className="w-5 h-5 text-blue-400" />
                                        Your Page Posts
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-0.5">Live feed from your Facebook page — saved to your CRM</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <select
                                        value={selectedPageId}
                                        onChange={e => { setSelectedPageId(e.target.value); fetchPagePosts(e.target.value); }}
                                        className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                                    >
                                        {pages.map(p => (
                                            <option key={p.page_id} value={p.page_id}>{p.page_name}</option>
                                        ))}
                                    </select>
                                    <button
                                        onClick={() => fetchPagePosts(selectedPageId)}
                                        disabled={postsLoading}
                                        className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors"
                                    >
                                        <RefreshCw className={`w-4 h-4 ${postsLoading ? 'animate-spin' : ''}`} />
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('post')}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-semibold transition-colors"
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                        New Post
                                    </button>
                                </div>
                            </div>

                            {postsLoading ? (
                                <div className="flex items-center justify-center py-20">
                                    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                                </div>
                            ) : pagePosts.length === 0 ? (
                                <div className="text-center py-20 border border-dashed border-slate-700 rounded-2xl">
                                    <Image className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                                    <p className="text-slate-400 font-semibold">No posts found on this page</p>
                                    <p className="text-slate-600 text-sm mt-1">Create your first post using the Publish tab</p>
                                    <button
                                        onClick={() => setActiveTab('post')}
                                        className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold transition-colors"
                                    >
                                        Create a Post
                                    </button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-4">
                                    {pagePosts.map((post: any) => (
                                        <div key={post.id} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden hover:border-blue-500/30 transition-all group">
                                            <div className="flex gap-4 p-4">
                                                {post.full_picture && (
                                                    <div className="w-28 h-28 rounded-xl overflow-hidden flex-shrink-0 border border-slate-800 bg-slate-950">
                                                        <img
                                                            src={post.full_picture}
                                                            alt="Post"
                                                            referrerPolicy="no-referrer"
                                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                                        />
                                                    </div>
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${
                                                            post.type === 'photo' ? 'bg-blue-500/10 text-blue-400' :
                                                            post.type === 'video' ? 'bg-violet-500/10 text-violet-400' :
                                                            post.type === 'share' ? 'bg-amber-500/10 text-amber-400' :
                                                            'bg-teal-500/10 text-teal-400'
                                                        }`}>
                                                            {post.type || 'Post'}
                                                        </span>
                                                        <span className="text-[10px] text-slate-500">
                                                            {post.created_time ? new Date(post.created_time).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm text-slate-200 line-clamp-3 mb-3 leading-relaxed">
                                                        {post.message || post.story || <span className="italic text-slate-500">No text content</span>}
                                                    </p>
                                                    <div className="flex items-center gap-4 flex-wrap">
                                                        <div className="flex items-center gap-1.5 text-xs text-slate-400">
                                                            <span>👍</span>
                                                            {post.likes?.summary?.total_count ?? 0}
                                                        </div>
                                                        <div className="flex items-center gap-1.5 text-xs text-slate-400">
                                                            <span>💬</span>
                                                            {post.comments?.summary?.total_count ?? 0}
                                                        </div>
                                                        <div className="flex items-center gap-1.5 text-xs text-slate-400">
                                                            <span>🔁</span>
                                                            {post.shares?.count ?? 0}
                                                        </div>
                                                        {post.permalink_url && (
                                                            <a
                                                                href={post.permalink_url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="ml-auto text-xs text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1"
                                                            >
                                                                View on Facebook <ExternalLink className="w-3 h-3" />
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}



                    {/* SETUP TAB */}
                    {activeTab === 'setup' && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-20">
                            {/* Pro Instructions */}
                            <div className="space-y-6">
                                <div className="p-6 bg-blue-600/5 border border-blue-500/20 rounded-3xl">
                                    <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                        <Code2 className="w-6 h-6 text-blue-400" />
                                        Developer Setup Guide
                                    </h3>
                                    <div className="space-y-4">
                                        <div className="flex gap-4">
                                            <div className="w-8 h-8 rounded-full bg-blue-600/20 flex items-center justify-center shrink-0 text-blue-400 font-bold text-sm">1</div>
                                            <div>
                                                <h4 className="text-white font-bold text-sm">App Domains & Redirects</h4>
                                                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                                                    In FB Meta Dashboard, ensure <code className="text-teal-400">alphaclone.io</code> is added to <b>App Domains</b> and <b>Valid OAuth Redirect URIs</b>.
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex gap-4">
                                            <div className="w-8 h-8 rounded-full bg-blue-600/20 flex items-center justify-center shrink-0 text-blue-400 font-bold text-sm">2</div>
                                            <div>
                                                <h4 className="text-white font-bold text-sm">Webhook Configuration</h4>
                                                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                                                    Add <b>Webhooks</b> product. Callback URL: <code className="text-teal-400">https://alphaclone.io/api/webhooks/facebook/leads</code>. 
                                                    Verify Token: <code className="text-teal-400">alphaclone_fb_verify</code>.
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex gap-4">
                                            <div className="w-8 h-8 rounded-full bg-blue-600/20 flex items-center justify-center shrink-0 text-blue-400 font-bold text-sm">3</div>
                                            <div>
                                                <h4 className="text-white font-bold text-sm">Lead Ads Subscription</h4>
                                                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                                                    Under Webhooks, select <b>Page</b> as object and subscribe to <code className="text-blue-400">leadgen</code> fields. This triggers the auto-capture.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-6 bg-teal-600/5 border border-teal-500/20 rounded-3xl">
                                    <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                        <Zap className="w-6 h-6 text-teal-400" />
                                        Testing Tools
                                    </h3>
                                    <div className="space-y-3">
                                        <a 
                                            href="https://developers.facebook.com/tools/lead-ads-testing" 
                                            target="_blank"
                                            className="flex items-center justify-between p-4 bg-slate-900 border border-slate-800 rounded-2xl hover:border-teal-500 transition-all group"
                                        >
                                            <div className="flex items-center gap-3">
                                                <Link2 className="w-5 h-5 text-slate-500 group-hover:text-teal-400" />
                                                <div>
                                                    <p className="text-sm font-bold text-white">Lead Ads Testing Tool</p>
                                                    <p className="text-xs text-slate-500">Create test leads to verify your CRM sync.</p>
                                                </div>
                                            </div>
                                            <ExternalLink className="w-4 h-4 text-slate-600" />
                                        </a>
                                        <a 
                                            href="https://developers.facebook.com/tools/debug/sharing" 
                                            target="_blank"
                                            className="flex items-center justify-between p-4 bg-slate-900 border border-slate-800 rounded-2xl hover:border-teal-500 transition-all group"
                                        >
                                            <div className="flex items-center gap-3">
                                                <Globe className="w-5 h-5 text-slate-500 group-hover:text-teal-400" />
                                                <div>
                                                    <p className="text-sm font-bold text-white">Sharing Debugger</p>
                                                    <p className="text-xs text-slate-500">Fix how your links appear on Facebook.</p>
                                                </div>
                                            </div>
                                            <ExternalLink className="w-4 h-4 text-slate-600" />
                                        </a>
                                    </div>
                                </div>
                            </div>

                            {/* Safety & Status */}
                            <div className="space-y-6">
                                <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl">
                                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                        <Shield className="w-5 h-5 text-slate-400" />
                                        Integration Status
                                    </h3>
                                    <div className="space-y-4">
                                        {[
                                            { label: 'Messenger API', status: 'Active', icon: Mail },
                                            { label: 'Lead Ads Webhook', status: 'Configured', icon: UserPlus },
                                            { label: 'Feed Permissions', status: 'Granted', icon: Activity },
                                        ].map((item) => (
                                            <div key={item.label} className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800">
                                                <div className="flex items-center gap-3">
                                                    <item.icon className="w-4 h-4 text-slate-500" />
                                                    <span className="text-sm text-slate-300">{item.label}</span>
                                                </div>
                                                <span className="text-[10px] font-black uppercase text-teal-400 px-2 py-0.5 bg-teal-500/10 rounded-md">
                                                    {item.status}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-6 pt-6 border-t border-slate-800">
                                        <p className="text-xs text-slate-500 leading-relaxed italic">
                                            "I don't need to even search what can, how where" - AlphaClone's philosophy is total visibility. 
                                            Everything linked to Facebook flows through the Activity Feed and Lead Manager automatically.
                                        </p>
                                    </div>
                                </div>

                                <div className="p-6 bg-amber-500/5 border border-amber-500/20 rounded-3xl">
                                    <h3 className="text-lg font-bold text-amber-200 mb-2 flex items-center gap-2">
                                        <AlertCircle className="w-5 h-5" />
                                        Need to verify Leads?
                                    </h3>
                                    <p className="text-xs text-slate-400 mb-4">
                                        If leads aren't appearing, check your Page Settings {'->'} Advanced Messaging {'->'} Receiver Handlers. 
                                        Ensure AlphaClone is the <b>Primary Receiver</b>.
                                    </p>
                                    <button 
                                        onClick={() => setActiveTab('leads')}
                                        className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black uppercase tracking-widest transition-colors"
                                    >
                                        Check Inbound Leads
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
