'use client';

import React, { useState, useEffect } from 'react';
import { 
    Bookmark, 
    Link2, 
    Plus, 
    Trash2, 
    ExternalLink, 
    Facebook, 
    Linkedin, 
    Globe, 
    Search, 
    Eye, 
    Loader2, 
    AlertCircle,
    CheckCircle2,
    RefreshCw,
    Video,
    Zap,
    Copy,
    ChevronRight,
    Twitter,
    MessageSquare,
    Users,
    Activity as ActivityIcon,
    Sparkles,
    Brain,
    Bot
} from 'lucide-react';
import { useTenant } from '@/contexts/TenantContext';
import toast from 'react-hot-toast';
import { ModuleIntelligenceCard } from '../ModuleIntelligenceCard';
import { xaiVideoGenerationService, VideoScriptOutput } from '@/services/ai/xaiVideoGenerationService';

interface BookmarkRow {
    id: string;
    title: string;
    url: string;
    platform: string;
    category: string;
    notes: string;
}

interface WatchlistItem {
    id: string;
    name: string;
    url: string;
    platform: string;
    last_checked_at: string | null;
    last_post_summary: string | null;
    is_active: boolean;
}

export default function SocialCommandCenter() {
    const { currentTenant } = useTenant();
    const [bookmarks, setBookmarks] = useState<BookmarkRow[]>([]);
    const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
    const [xIntegration, setXIntegration] = useState<any>(null);
    const [recentInteractions, setRecentInteractions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Form state for Boookmark
    const [newBookmark, setNewBookmark] = useState({
        title: '',
        url: '',
        platform: 'facebook',
        category: 'group',
        notes: ''
    });
    
    // Form state for Watchlist
    const [newWatchlist, setNewWatchlist] = useState({
        name: '',
        url: '',
        platform: 'linkedin'
    });

    const [isAddingBookmark, setIsAddingBookmark] = useState(false);
    const [isAddingWatchlist, setIsAddingWatchlist] = useState(false);
    const [scrapingId, setScrapingId] = useState<string | null>(null);
    const [featureWarning, setFeatureWarning] = useState<string | null>(null);

    // Video Generator State
    const [videoTopic, setVideoTopic] = useState('');
    const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
    const [videoResult, setVideoResult] = useState<VideoScriptOutput | null>(null);
    const [videoIntensity, setVideoIntensity] = useState<'standard' | 'high'>('high');

    // Nexus Intelligence State
    const [isHunting, setIsHunting] = useState(false);
    const [isIntelligenceRunning, setIsIntelligenceRunning] = useState(false);
    const [nexusLog, setNexusLog] = useState<any>(null);
    const [suggestedLeads, setSuggestedLeads] = useState<any[]>([]);

    const loadData = async () => {
        if (!currentTenant?.id) return;
        setLoading(true);
        setFeatureWarning(null);
        try {
            const res = await fetch(`/api/social/command-center?tenantId=${encodeURIComponent(currentTenant.id)}`);
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(payload.error || 'Failed to load social workspace');
            setBookmarks(payload.bookmarks || []);
            setWatchlist(payload.watchlist || []);
            setXIntegration(payload.xIntegration || null);
            setRecentInteractions(payload.recentInteractions || []);
            if (payload.warning) {
                setFeatureWarning('Social workspace is being prepared. Core business areas remain fully available.');
            }
        } catch (error) {
            console.error('Failed to load social data:', error);
            toast.error('Failed to load command center data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [currentTenant?.id]);

    const handleAddBookmark = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentTenant?.id) return;
        
        try {
            const res = await fetch('/api/social/command-center', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tenantId: currentTenant.id,
                    mode: 'add_bookmark',
                    ...newBookmark,
                }),
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(payload.error || 'Failed to add bookmark');
            
            toast.success('Bookmark added');
            setNewBookmark({ title: '', url: '', platform: 'facebook', category: 'group', notes: '' });
            setIsAddingBookmark(false);
            loadData();
        } catch (error) {
            toast.error('Failed to add bookmark');
        }
    };

    const handleDeleteBookmark = async (id: string) => {
        if (!confirm('Are you sure you want to delete this bookmark?')) return;
        try {
            const res = await fetch('/api/social/command-center', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tenantId: currentTenant?.id,
                    mode: 'delete_bookmark',
                    id,
                }),
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(payload.error || 'Failed to delete bookmark');
            toast.success('Bookmark deleted');
            loadData();
        } catch {
            toast.error('Failed to delete bookmark');
        }
    };

    const handleAddWatchlist = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentTenant?.id) return;
        
        try {
            const res = await fetch('/api/social/command-center', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tenantId: currentTenant.id,
                    mode: 'add_watchlist',
                    ...newWatchlist,
                }),
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(payload.error || 'Failed to add to watchlist');
            
            toast.success('Added to watchlist');
            setNewWatchlist({ name: '', url: '', platform: 'linkedin' });
            setIsAddingWatchlist(false);
            loadData();
        } catch (error) {
            toast.error('Failed to add to watchlist');
        }
    };

    const handleDeleteWatchlist = async (id: string) => {
        if (!confirm('Stop monitoring this target?')) return;
        try {
            const res = await fetch('/api/social/command-center', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tenantId: currentTenant?.id,
                    mode: 'delete_watchlist',
                    id,
                }),
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(payload.error || 'Failed to remove');
            toast.success('Removed from watchlist');
            loadData();
        } catch {
            toast.error('Failed to remove');
        }
    };

    const runScraper = async (item: WatchlistItem) => {
        setScrapingId(item.id);
        toast.promise(
            (async () => {
                // In a real app, this would trigger a background worker or an AI agent
                // For this demo, we simulate the AI "looking" at the URL
                const res = await fetch('/api/ai/scrape-social', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: item.url, itemId: item.id })
                });
                if (!res.ok) throw new Error('Scraper failed');
                await loadData();
            })(),
            {
                loading: `AI is visiting ${item.name}'s profile...`,
                success: 'Insights updated!',
                error: 'Could not fetch latest posts'
            }
        ).finally(() => setScrapingId(null));
    };

    const handleGenerateVideo = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!videoTopic) return;
        setIsGeneratingVideo(true);
        try {
            const result = await xaiVideoGenerationService.generateViralScript(videoTopic, videoIntensity);
            setVideoResult(result);
            toast.success('Viral script generated with Grok!');
        } catch (error) {
            toast.error('Failed to generate script');
        } finally {
            setIsGeneratingVideo(false);
        }
    };

    const handleStartLeadHunt = async () => {
        if (!currentTenant?.id) return;
        setIsHunting(true);
        try {
            const res = await fetch('/api/social/command-center', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tenantId: currentTenant.id, mode: 'start_lead_hunt' })
            });
            const data = await res.json();
            if (data.success) {
                setSuggestedLeads(data.suggestedLeads);
                toast.success('AlphaClone Nexus has identified new lead opportunities!');
            }
        } catch (error) {
            toast.error('Lead hunt failed');
        } finally {
            setIsHunting(false);
        }
    };

    const handleTriggerNexusIntelligence = async () => {
        if (!currentTenant?.id) return;
        setIsIntelligenceRunning(true);
        try {
            const res = await fetch('/api/social/command-center', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tenantId: currentTenant.id, mode: 'trigger_nexus_intelligence' })
            });
            const data = await res.json();
            if (data.success) {
                setNexusLog(data.nexusLog);
                toast.success('Nexus Intelligence session complete.');
            }
        } catch (error) {
            toast.error('Intelligence session failed');
        } finally {
            setIsIntelligenceRunning(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <ModuleIntelligenceCard moduleKey="socialMedia" title="Social Intelligence" />
            
            {/* X (TWITTER) ENGAGEMENT SECTION */}
            <section className="space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <Twitter className="w-5 h-5 text-[#1DA1F2]" />
                            X (Twitter) Engagement
                        </h2>
                        <p className="text-sm text-slate-400">Manage your connected X account and track automated interactions.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={handleTriggerNexusIntelligence}
                            disabled={isIntelligenceRunning}
                            className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-400 rounded-lg text-xs font-bold border border-slate-800 transition-all"
                        >
                            {isIntelligenceRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Brain className="w-3 h-3 text-violet-400" />}
                            Optimize Strategy
                        </button>
                        {xIntegration ? (
                            <div className="flex items-center gap-3 px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-sm font-bold text-white">@{xIntegration.x_username}</span>
                            </div>
                        ) : (
                            <button 
                                onClick={() => window.location.href = '/api/auth/x'}
                                className="flex items-center gap-2 px-4 py-2 bg-[#1DA1F2] hover:bg-[#1a8cd8] text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-[#1DA1F2]/20"
                            >
                                <Twitter className="w-4 h-4" />
                                Connect X Account
                            </button>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Stats / Status Card */}
                    <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
                        <div className="flex items-center gap-3 text-slate-400">
                            <ActivityIcon className="w-4 h-4" />
                            <span className="text-xs font-bold uppercase tracking-widest">Automation Status</span>
                        </div>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-slate-500">Lead Hunting</span>
                                <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">ACTIVE</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-slate-500">Auto-Responder</span>
                                <span className="text-xs font-bold text-slate-500 bg-slate-800 px-2 py-0.5 rounded-md">STANDBY</span>
                            </div>
                        </div>
                    </div>

                    {/* Recent Interactions Card */}
                    <div className="md:col-span-2 p-6 bg-slate-900 border border-slate-800 rounded-2xl">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3 text-slate-400">
                                <MessageSquare className="w-4 h-4" />
                                <span className="text-xs font-bold uppercase tracking-widest">Recent Interactions</span>
                            </div>
                            <button onClick={loadData} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-500 transition-colors">
                                <RefreshCw className="w-3.5 h-3.5" />
                            </button>
                        </div>
                        
                        <div className="space-y-3">
                            {recentInteractions.length === 0 ? (
                                <div className="py-4 text-center border border-dashed border-slate-800 rounded-xl">
                                    <p className="text-xs text-slate-600 italic">No recent interactions logged.</p>
                                </div>
                            ) : (
                                recentInteractions.map((si, idx) => (
                                    <div key={si.id || idx} className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800 hover:border-slate-700 transition-all">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-lg ${si.interaction_type === 'direct_message' ? 'bg-blue-500/10 text-blue-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                                                {si.interaction_type === 'direct_message' ? <MessageSquare className="w-3.5 h-3.5" /> : <Twitter className="w-3.5 h-3.5" />}
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-white capitalize">{si.interaction_type.replace('_', ' ')}</p>
                                                <p className="text-[10px] text-slate-500">{new Date(si.created_at).toLocaleString()}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-[10px] font-black text-slate-600 uppercase tracking-tighter">SUCCESS</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </section>

            {/* BOOKMARKS SECTION */}
            <section className="space-y-4">
                {featureWarning && (
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
                        {featureWarning}
                    </div>
                )}
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <Bookmark className="w-5 h-5 text-teal-400" />
                            Social Bookmarks
                        </h2>
                        <p className="text-sm text-slate-400">Quick access to groups and profiles you manage manually.</p>
                    </div>
                    <button 
                        onClick={() => setIsAddingBookmark(!isAddingBookmark)}
                        className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-sm font-semibold transition-all"
                    >
                        <Plus className="w-4 h-4" />
                        Add Link
                    </button>
                </div>

                {isAddingBookmark && (
                    <form onSubmit={handleAddBookmark} className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-4 animate-in slide-in-from-top-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-400 uppercase">Title</label>
                                <input 
                                    required
                                    value={newBookmark.title}
                                    onChange={e => setNewBookmark({...newBookmark, title: e.target.value})}
                                    placeholder="e.g. Marketing Experts Group"
                                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-teal-500"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-400 uppercase">URL</label>
                                <input 
                                    required
                                    type="url"
                                    value={newBookmark.url}
                                    onChange={e => setNewBookmark({...newBookmark, url: e.target.value})}
                                    placeholder="https://facebook.com/groups/..."
                                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-teal-500"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-400 uppercase">Platform</label>
                                <select 
                                    value={newBookmark.platform}
                                    onChange={e => setNewBookmark({...newBookmark, platform: e.target.value})}
                                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-teal-500"
                                >
                                    <option value="facebook">Facebook</option>
                                    <option value="linkedin">LinkedIn</option>
                                    <option value="twitter">Twitter / X</option>
                                    <option value="instagram">Instagram</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-400 uppercase">Category</label>
                                <select 
                                    value={newBookmark.category}
                                    onChange={e => setNewBookmark({...newBookmark, category: e.target.value})}
                                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-teal-500"
                                >
                                    <option value="group">Group</option>
                                    <option value="profile">Profile</option>
                                    <option value="competitor">Competitor</option>
                                    <option value="prospect">Prospect</option>
                                </select>
                            </div>
                            <div className="flex items-end">
                                <button type="submit" className="w-full py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl font-bold transition-colors">
                                    Save Bookmark
                                </button>
                            </div>
                        </div>
                    </form>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {bookmarks.length === 0 && !isAddingBookmark && (
                        <div className="col-span-full py-12 border border-dashed border-slate-800 rounded-2xl text-center">
                            <Link2 className="w-10 h-10 text-slate-700 mx-auto mb-3" />
                            <p className="text-slate-500">No bookmarks saved yet.</p>
                        </div>
                    )}
                    {bookmarks.map(bm => (
                        <div key={bm.id} className="group p-4 bg-slate-900 border border-slate-800 rounded-2xl hover:border-teal-500/50 transition-all flex flex-col justify-between">
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 bg-slate-800 rounded-md text-slate-400">
                                        {bm.platform}
                                    </span>
                                    <div className="flex items-center gap-1">
                                        <a href={bm.url} target="_blank" rel="noopener noreferrer" className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-white transition-colors">
                                            <ExternalLink className="w-3.5 h-3.5" />
                                        </a>
                                        <button onClick={() => handleDeleteBookmark(bm.id)} className="p-1.5 hover:bg-red-500/10 rounded-lg text-slate-500 hover:text-red-400 transition-colors">
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                                <h3 className="font-bold text-white mb-1">{bm.title}</h3>
                                <p className="text-xs text-slate-500 truncate mb-3">{bm.url}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs px-2 py-0.5 bg-teal-500/10 text-teal-400 rounded-lg border border-teal-500/20">
                                    {bm.category}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* WATCHLIST SECTION */}
            <section className="space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <Eye className="w-5 h-5 text-violet-400" />
                            AI Watchlist
                        </h2>
                        <p className="text-sm text-slate-400">AI monitors these profiles and alerts you when they post.</p>
                    </div>
                    <div className="flex gap-2">
                        <button 
                            onClick={handleStartLeadHunt}
                            disabled={isHunting}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-teal-400 rounded-xl text-sm font-bold border border-slate-800 transition-all shadow-lg shadow-teal-900/10"
                        >
                            {isHunting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                            Discover Leads
                        </button>
                        <button 
                            onClick={() => setIsAddingWatchlist(!isAddingWatchlist)}
                            className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-violet-900/20"
                        >
                            <Plus className="w-4 h-4" />
                            Watch Profile
                        </button>
                    </div>
                </div>

                {isAddingWatchlist && (
                    <form onSubmit={handleAddWatchlist} className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-4 animate-in slide-in-from-top-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-400 uppercase">Target Name</label>
                                <input 
                                    required
                                    value={newWatchlist.name}
                                    onChange={e => setNewWatchlist({...newWatchlist, name: e.target.value})}
                                    placeholder="e.g. Satya Nadella"
                                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-violet-500"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-slate-400 uppercase">Profile URL</label>
                                <input 
                                    required
                                    type="url"
                                    value={newWatchlist.url}
                                    onChange={e => setNewWatchlist({...newWatchlist, url: e.target.value})}
                                    placeholder="https://linkedin.com/in/..."
                                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-violet-500"
                                />
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <button type="submit" className="px-8 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-bold transition-colors">
                                Start Monitoring
                            </button>
                        </div>
                    </form>
                )}

                <div className="space-y-3">
                    {watchlist.length === 0 && !isAddingWatchlist && (
                        <div className="py-12 border border-dashed border-slate-800 rounded-2xl text-center">
                            <Search className="w-10 h-10 text-slate-700 mx-auto mb-3" />
                            <p className="text-slate-500">Add targets to have AI monitor their public activity.</p>
                        </div>
                    )}
                    {watchlist.map((item: any) => (
                        <div key={item.id} className="p-5 bg-slate-900 border border-slate-800 rounded-2xl hover:border-violet-500/30 transition-all">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center border border-slate-700">
                                        {item.platform === 'linkedin' ? <Linkedin className="w-6 h-6 text-sky-400" /> : <Globe className="w-6 h-6 text-slate-500" />}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-white text-lg">{item.name}</h3>
                                        <p className="text-xs text-slate-500">{item.url}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={() => runScraper(item)}
                                        disabled={scrapingId === item.id}
                                        className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-semibold border border-slate-700 disabled:opacity-50"
                                    >
                                        {scrapingId === item.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                                        Analyze Latest
                                    </button>
                                    <button onClick={() => handleDeleteWatchlist(item.id)} className="p-2 hover:bg-red-500/10 rounded-xl text-slate-500 hover:text-red-400 transition-colors">
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                            
                            {item.last_post_summary ? (
                                <div className="mt-4 p-4 bg-slate-950 rounded-xl border border-slate-800">
                                    <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-violet-400">
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        Latest Update (AI Summary)
                                    </div>
                                    <p className="text-sm text-slate-300 leading-relaxed italic">
                                        "{item.last_post_summary}"
                                    </p>
                                    <p className="mt-3 text-xs text-slate-600">
                                        Last checked: {item.last_checked_at ? new Date(item.last_checked_at).toLocaleString() : 'Never'}
                                    </p>
                                </div>
                            ) : (
                                <div className="mt-4 p-4 border border-dashed border-slate-800 rounded-xl flex items-center gap-3 text-slate-500">
                                    <AlertCircle className="w-4 h-4" />
                                    <p className="text-xs">No analysis data yet. Click "Analyze Latest" to peek at their profile.</p>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </section>
            {/* VIRAL VIDEO GENERATOR SECTION */}
            <section className="space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <Video className="w-5 h-5 text-rose-400" />
                            Viral Video Intelligence (Grok)
                        </h2>
                        <p className="text-sm text-slate-400">Generate high-engagement video hooks designed to stop the scroll.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-1 space-y-4">
                        <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-4 shadow-xl">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Video Topic / Niche</label>
                                <textarea 
                                    value={videoTopic}
                                    onChange={e => setVideoTopic(e.target.value)}
                                    placeholder="e.g. Why most entrepreneurs fail in their first year..."
                                    className="w-full h-32 px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-rose-500 transition-all resize-none text-sm"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Controversy Level</label>
                                <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
                                    <button 
                                        onClick={() => setVideoIntensity('standard')}
                                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${videoIntensity === 'standard' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                                    >
                                        Standard
                                    </button>
                                    <button 
                                        onClick={() => setVideoIntensity('high')}
                                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${videoIntensity === 'high' ? 'bg-rose-600 text-white shadow-lg shadow-rose-900/20' : 'text-slate-500 hover:text-slate-300'}`}
                                    >
                                        High Impact
                                    </button>
                                </div>
                            </div>

                            <button 
                                onClick={handleGenerateVideo}
                                disabled={isGeneratingVideo || !videoTopic}
                                className="w-full py-3 bg-gradient-to-r from-rose-600 to-violet-600 hover:from-rose-500 hover:to-violet-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-rose-900/20 flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {isGeneratingVideo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                                Generate Viral Hook
                            </button>
                        </div>
                    </div>

                    <div className="lg:col-span-2">
                        {videoResult ? (
                            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden animate-in fade-in slide-in-from-right-4 duration-500">
                                <div className="p-4 bg-slate-800/50 border-b border-slate-800 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="px-2 py-1 bg-rose-500/10 border border-rose-500/30 rounded text-xs font-bold text-rose-400 uppercase">
                                            Controversy Score: {videoResult.controversyScore}%
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => {
                                            navigator.clipboard.writeText(`${videoResult.hook}\n\n${videoResult.script}`);
                                            toast.success('Copied to clipboard');
                                        }}
                                        className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
                                    >
                                        <Copy className="w-4 h-4" />
                                    </button>
                                </div>
                                <div className="p-6 space-y-6">
                                    <div>
                                        <h4 className="text-xs font-black text-rose-500 uppercase tracking-tighter mb-2 flex items-center gap-2">
                                            <Zap className="w-3 h-3" /> The Hook (Scroll Stopper)
                                        </h4>
                                        <p className="text-lg font-bold text-white leading-tight italic">
                                            "{videoResult.hook}"
                                        </p>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <h4 className="text-xs font-black text-slate-500 uppercase tracking-tighter mb-2">Video Script</h4>
                                            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-sm text-slate-300 leading-relaxed max-h-[300px] overflow-y-auto custom-scrollbar">
                                                {videoResult.script}
                                            </div>
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-black text-slate-500 uppercase tracking-tighter mb-2">Visual Production Cues</h4>
                                            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-sm text-slate-400 italic leading-relaxed">
                                                {videoResult.visualCues}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="h-full min-h-[300px] border border-dashed border-slate-800 rounded-2xl flex flex-col items-center justify-center text-slate-600 p-8 text-center">
                                <Video className="w-12 h-12 mb-4 opacity-20" />
                                <p className="text-sm">Your AI-generated viral script will appear here.</p>
                                <p className="text-xs mt-2 opacity-50">Grok will focus on pattern-interrupt hooks to maximize views.</p>
                            </div>
                        )}
                    </div>
                </div>
            </section>
        </div>
    );
}

