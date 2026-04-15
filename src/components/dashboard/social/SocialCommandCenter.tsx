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
    RefreshCw
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useTenant } from '@/contexts/TenantContext';
import toast from 'react-hot-toast';

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

    const loadData = async () => {
        if (!currentTenant?.id) return;
        setLoading(true);
        try {
            const [bmRes, wlRes] = await Promise.all([
                supabase.from('social_bookmarks').select('*').eq('tenant_id', currentTenant.id).order('created_at', { ascending: false }),
                supabase.from('social_watchlist').select('*').eq('tenant_id', currentTenant.id).order('created_at', { ascending: false })
            ]);

            if (bmRes.error) throw bmRes.error;
            if (wlRes.error) throw wlRes.error;

            setBookmarks(bmRes.data || []);
            setWatchlist(wlRes.data || []);
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
            const { error } = await supabase.from('social_bookmarks').insert({
                tenant_id: currentTenant.id,
                ...newBookmark
            });

            if (error) throw error;
            
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
            await supabase.from('social_bookmarks').delete().eq('id', id);
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
            const { error } = await supabase.from('social_watchlist').insert({
                tenant_id: currentTenant.id,
                ...newWatchlist
            });

            if (error) throw error;
            
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
            await supabase.from('social_watchlist').delete().eq('id', id);
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

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* BOOKMARKS SECTION */}
            <section className="space-y-4">
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
                                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-slate-800 rounded-md text-slate-400">
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
                                <span className="text-[10px] px-2 py-0.5 bg-teal-500/10 text-teal-400 rounded-lg border border-teal-500/20">
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
                    <button 
                        onClick={() => setIsAddingWatchlist(!isAddingWatchlist)}
                        className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-violet-900/20"
                    >
                        <Plus className="w-4 h-4" />
                        Watch Profile
                    </button>
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
                    {watchlist.map(item => (
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
                                    <p className="mt-3 text-[10px] text-slate-600">
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
        </div>
    );
}
