'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
    Bookmark, Link2, Plus, Trash2, ExternalLink, Facebook, Linkedin, Globe, 
    Search, Eye, Loader2, AlertCircle, CheckCircle2, RefreshCw, Video, Zap, 
    Copy, ChevronRight, Twitter, MessageSquare, Users, Activity as ActivityIcon, 
    Sparkles, Brain, Bot, Calendar, Camera, Image as ImageIcon, X, Sliders, 
    BarChart2, Settings, HelpCircle, Clock, ArrowLeft, History, User, Building, 
    ChevronDown, Repeat, Paperclip, AlertTriangle
} from 'lucide-react';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import { ModuleIntelligenceCard } from '../ModuleIntelligenceCard';
import { xaiVideoGenerationService, VideoScriptOutput } from '@/services/ai/xaiVideoGenerationService';
import { motion, AnimatePresence } from 'framer-motion';

interface SocialPost {
    id: string;
    title: string | null;
    caption: string;
    platforms: string[];
    media_urls: string[];
    media_types: string[];
    hashtags: string[];
    status: string;
    scheduled_at: string | null;
    published_at: string | null;
    facebook_post_id: string | null;
    linkedin_post_urn: string | null;
    error_message: string | null;
    created_at: string;
}

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

interface LinkedInIntegration {
    linkedin_member_id: string;
    linkedin_person_urn: string;
    scopes: string[] | null;
    is_active: boolean;
}

interface FacebookPage {
    page_id: string;
    page_name: string;
}

export default function SocialCommandCenter() {
    const { currentTenant } = useTenant();
    const { user } = useAuth();
    
    // Main UI Tabs: 'manager' is the native client, 'intelligence' is tools (bookmarks, watchlist, etc.)
    const [activeMainTab, setActiveMainTab] = useState<'manager' | 'intelligence'>('manager');
    
    // Social Manager Platform Switcher
    const [activePlatform, setActivePlatform] = useState<'linkedin' | 'facebook' | 'x'>('linkedin');
    // Social Manager Subview Filter: 'queue' (scheduled), 'published', 'analytics'
    const [activeSubView, setActiveSubView] = useState<'queue' | 'published' | 'analytics'>('queue');
    
    // State lists
    const [posts, setPosts] = useState<SocialPost[]>([]);
    const [bookmarks, setBookmarks] = useState<BookmarkRow[]>([]);
    const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
    const [xIntegration, setXIntegration] = useState<any>(null);
    const [fbPages, setFbPages] = useState<FacebookPage[]>([]);
    const [linkedinIntegrations, setLinkedinIntegrations] = useState<LinkedInIntegration[]>([]);
    const [recentInteractions, setRecentInteractions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Detail Bottom Sheet
    const [selectedPost, setSelectedPost] = useState<SocialPost | null>(null);
    
    // Compose Modal Full-screen
    const [isComposeOpen, setIsComposeOpen] = useState(false);
    const [composeCaption, setComposeCaption] = useState('');
    const [composePlatforms, setComposePlatforms] = useState<string[]>(['linkedin']);
    const [composeMedia, setComposeMedia] = useState<string[]>([]);
    const [composeScheduledAt, setComposeScheduledAt] = useState('');
    const [composeIsScheduled, setComposeIsScheduled] = useState(false);
    const [selectedLinkedInId, setSelectedLinkedInId] = useState('');
    const [selectedLinkedInIdentity, setSelectedLinkedInIdentity] = useState<'personal' | 'company'>('personal');
    const [selectedPageId, setSelectedPageId] = useState('');
    
    // X Twitter thread stacks
    const [xThreadPosts, setXThreadPosts] = useState<string[]>([]);
    const [isQuoteTweet, setIsQuoteTweet] = useState(false);
    const [quoteTweetUrl, setQuoteTweetUrl] = useState('');

    // AI Writer Assistant modal inside composer
    const [aiPromptOpen, setAiPromptOpen] = useState(false);
    const [aiPromptText, setAiPromptText] = useState('');
    const [aiGenerating, setAiGenerating] = useState(false);

    // Swipe tracker state mapping postId -> offset (px)
    const [swipeState, setSwipeState] = useState<Record<string, number>>({});
    const [swipeActiveId, setSwipeActiveId] = useState<string | null>(null);
    const touchStartX = useRef<number>(0);

    // Intelligence form states
    const [newBookmark, setNewBookmark] = useState({ title: '', url: '', platform: 'facebook', category: 'group', notes: '' });
    const [newWatchlist, setNewWatchlist] = useState({ name: '', url: '', platform: 'linkedin' });
    const [isAddingBookmark, setIsAddingBookmark] = useState(false);
    const [isAddingWatchlist, setIsAddingWatchlist] = useState(false);
    const [scrapingId, setScrapingId] = useState<string | null>(null);

    // Video Generator State
    const [videoTopic, setVideoTopic] = useState('');
    const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
    const [videoResult, setVideoResult] = useState<VideoScriptOutput | null>(null);
    const [videoIntensity, setVideoIntensity] = useState<'standard' | 'high'>('high');

    // Nexus Lead Hunt State
    const [isHunting, setIsHunting] = useState(false);
    const [isIntelligenceRunning, setIsIntelligenceRunning] = useState(false);
    const [nexusLog, setNexusLog] = useState<any>(null);
    const [suggestedLeads, setSuggestedLeads] = useState<any[]>([]);

    // Analytics state
    const [analyticsDateRange, setAnalyticsDateRange] = useState<'7D' | '30D' | '90D'>('7D');

    const loadData = async () => {
        if (!currentTenant?.id) return;
        setLoading(true);
        try {
            // Load base command center details (bookmarks, watchlist, X, etc.)
            const ccRes = await fetch(`/api/social/command-center?tenantId=${encodeURIComponent(currentTenant.id)}`);
            const ccData = await ccRes.json().catch(() => ({}));
            
            setBookmarks(ccData.bookmarks || []);
            setWatchlist(ccData.watchlist || []);
            setXIntegration(ccData.xIntegration || null);
            setRecentInteractions(ccData.recentInteractions || []);

            // Query social posts, fb pages, and linkedin profiles from DB
            const [postsRes, pagesRes, linkedinRes] = await Promise.all([
                supabase.from('social_posts').select('*').eq('tenant_id', currentTenant.id).order('created_at', { ascending: false }).limit(60),
                supabase.from('facebook_integrations').select('page_id,page_name').eq('user_id', user?.id || '').eq('is_active', true),
                supabase.from('linkedin_integrations').select('linkedin_member_id,linkedin_person_urn,scopes,is_active').eq('tenant_id', currentTenant.id).order('created_at', { ascending: false })
            ]);

            if (!postsRes.error) setPosts(postsRes.data || []);
            if (!pagesRes.error) {
                setFbPages(pagesRes.data || []);
                if (pagesRes.data?.[0]) setSelectedPageId(pagesRes.data[0].page_id);
            }
            if (!linkedinRes.error) {
                setLinkedinIntegrations(linkedinRes.data || []);
                if (linkedinRes.data?.[0]) setSelectedLinkedInId(linkedinRes.data[0].linkedin_member_id);
            }

        } catch (error) {
            console.error('Failed to load social metrics:', error);
            toast.error('Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [currentTenant?.id, user?.id]);

    // Handle swipe gestures
    const handleTouchStart = (e: React.TouchEvent, id: string) => {
        touchStartX.current = e.touches[0].clientX;
        setSwipeActiveId(id);
    };

    const handleTouchMove = (e: React.TouchEvent, id: string) => {
        if (swipeActiveId !== id) return;
        const currentX = e.touches[0].clientX;
        const diff = currentX - touchStartX.current;
        // Limit swipe range to [-70, 70]
        const capped = Math.max(-80, Math.min(80, diff));
        setSwipeState(prev => ({ ...prev, [id]: capped }));
    };

    const handleTouchEnd = (e: React.TouchEvent, id: string) => {
        const finalOffset = swipeState[id] || 0;
        if (finalOffset > 40) {
            // Swipe right: Duplicate action
            setSwipeState(prev => ({ ...prev, [id]: 60 }));
            handleDuplicatePost(posts.find(p => p.id === id)!);
            setTimeout(() => {
                setSwipeState(prev => ({ ...prev, [id]: 0 }));
            }, 800);
        } else if (finalOffset < -40) {
            // Swipe left: Delete action
            setSwipeState(prev => ({ ...prev, [id]: -60 }));
            if (confirm('Delete this post?')) {
                handleDeletePost(id);
            } else {
                setSwipeState(prev => ({ ...prev, [id]: 0 }));
            }
        } else {
            setSwipeState(prev => ({ ...prev, [id]: 0 }));
        }
        setSwipeActiveId(null);
    };

    // CRUD Ops
    const handleDeletePost = async (id: string) => {
        const toastId = toast.loading('Deleting...');
        try {
            const { error } = await supabase.from('social_posts').delete().eq('id', id);
            if (error) throw error;
            toast.success('Post deleted', { id: toastId });
            setPosts(prev => prev.filter(p => p.id !== id));
        } catch {
            toast.error('Failed to delete post', { id: toastId });
        }
    };

    const handleDuplicatePost = (post: SocialPost) => {
        setComposeCaption(post.caption);
        setComposePlatforms(post.platforms);
        setComposeMedia(post.media_urls);
        setComposeScheduledAt(post.scheduled_at ? new Date(post.scheduled_at).toISOString().slice(0, 16) : '');
        setComposeIsScheduled(!!post.scheduled_at);
        setIsComposeOpen(true);
        toast.success('Post details copied into composer');
    };

    const handleSavePost = async () => {
        if (!composeCaption.trim()) return toast.error('Please enter a caption');
        if (composePlatforms.length === 0) return toast.error('Select at least one platform');
        
        const toastId = toast.loading(composeIsScheduled ? 'Scheduling post...' : 'Publishing post...');
        try {
            const payload = {
                tenantId: currentTenant?.id,
                caption: composeCaption,
                platforms: composePlatforms,
                media_urls: composeMedia,
                media_types: composeMedia.map(() => 'image'),
                scheduled_at: composeIsScheduled && composeScheduledAt ? new Date(composeScheduledAt).toISOString() : undefined,
                facebook_page_id: composePlatforms.includes('facebook') ? selectedPageId : undefined,
                linkedin_member_id: composePlatforms.includes('linkedin') ? selectedLinkedInId : undefined,
            };

            const res = await fetch('/api/social/schedule', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error);

            toast.success(composeIsScheduled ? 'Post scheduled!' : 'Post published!', { id: toastId });
            setIsComposeOpen(false);
            setComposeCaption('');
            setComposeMedia([]);
            setXThreadPosts([]);
            loadData();
        } catch (err: any) {
            toast.error(err.message || 'Failed to save post', { id: toastId });
        }
    };

    // AI post generator
    const generateDraftWithAI = async () => {
        if (!aiPromptText.trim()) return toast.error('Enter a topic prompt');
        setAiGenerating(true);
        try {
            const res = await fetch('/api/ai/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: `Write an engaging social media post caption about: "${aiPromptText}". Return only the plain caption text. Keep it under 250 characters.`,
                    systemPrompt: 'You are an expert social media manager. Return ONLY the copy text.',
                })
            });
            const data = await res.json();
            if (data.text) {
                setComposeCaption(data.text);
                setAiPromptOpen(false);
                setAiPromptText('');
                toast.success('Draft generated');
            } else {
                throw new Error(data.error);
            }
        } catch {
            toast.error('AI writer generation failed');
        } finally {
            setAiGenerating(false);
        }
    };

    // Bookmark / Watchlist / Video Script handlers
    const handleAddBookmark = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentTenant?.id) return;
        try {
            const res = await fetch('/api/social/command-center', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tenantId: currentTenant.id, mode: 'add_bookmark', ...newBookmark }),
            });
            if (!res.ok) throw new Error();
            toast.success('Bookmark added');
            setNewBookmark({ title: '', url: '', platform: 'facebook', category: 'group', notes: '' });
            setIsAddingBookmark(false);
            loadData();
        } catch {
            toast.error('Failed to add bookmark');
        }
    };

    const handleDeleteBookmark = async (id: string) => {
        if (!confirm('Are you sure you want to delete this bookmark?')) return;
        try {
            const res = await fetch('/api/social/command-center', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tenantId: currentTenant?.id, mode: 'delete_bookmark', id }),
            });
            if (!res.ok) throw new Error();
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
                body: JSON.stringify({ tenantId: currentTenant.id, mode: 'add_watchlist', ...newWatchlist }),
            });
            if (!res.ok) throw new Error();
            toast.success('Added to watchlist');
            setNewWatchlist({ name: '', url: '', platform: 'linkedin' });
            setIsAddingWatchlist(false);
            loadData();
        } catch {
            toast.error('Failed to add to watchlist');
        }
    };

    const handleDeleteWatchlist = async (id: string) => {
        if (!confirm('Stop monitoring this target?')) return;
        try {
            const res = await fetch('/api/social/command-center', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tenantId: currentTenant?.id, mode: 'delete_watchlist', id }),
            });
            if (!res.ok) throw new Error();
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
                const res = await fetch('/api/ai/scrape-social', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: item.url, itemId: item.id })
                });
                if (!res.ok) throw new Error();
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
        } catch {
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
        } catch {
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
        } catch {
            toast.error('Intelligence session failed');
        } finally {
            setIsIntelligenceRunning(false);
        }
    };

    // Filter posts for lists
    const filteredPosts = posts.filter(post => {
        const matchPlatform = post.platforms.includes(activePlatform);
        if (!matchPlatform) return false;
        
        if (activeSubView === 'queue') {
            return post.status === 'scheduled';
        } else if (activeSubView === 'published') {
            return post.status === 'published';
        }
        return true;
    });

    // Helper: Character countdown and warnings
    const maxChars = activePlatform === 'x' ? 280 : activePlatform === 'linkedin' ? 3000 : 63206;
    const charCount = composeCaption.length;
    const isOverLimit = charCount > maxChars;

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
            </div>
        );
    }

    return (
        <div className="flex flex-col bg-slate-950 rounded-3xl border border-white/5 overflow-hidden backdrop-blur-sm relative min-h-[calc(100vh-140px)]">
            
            {/* Top Workspace Tab Mode Switcher */}
            <div className="flex border-b border-white/5 bg-slate-900/50 p-2 gap-2">
                <button
                    onClick={() => setActiveMainTab('manager')}
                    className={`flex-1 py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${activeMainTab === 'manager' ? 'bg-teal-600 text-white shadow-lg' : 'text-slate-400 hover:bg-white/5'}`}
                >
                    Platform Manager
                </button>
                <button
                    onClick={() => setActiveMainTab('intelligence')}
                    className={`flex-1 py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${activeMainTab === 'intelligence' ? 'bg-teal-600 text-white shadow-lg' : 'text-slate-400 hover:bg-white/5'}`}
                >
                    Nexus Intelligence & Tools
                </button>
            </div>

            {activeMainTab === 'manager' ? (
                /* ----------------------------------------------------
                   MODULE 1: Platform Manager (Native PWA Layout)
                   ---------------------------------------------------- */
                <div className="flex flex-col flex-1 pb-24">
                    
                    {/* Platform Switcher Tab Bar (LinkedIn | Facebook | X) */}
                    <div className="sticky top-0 z-20 flex h-11 bg-slate-900 border-b border-white/5 select-none divide-x divide-white/5">
                        {[
                            { id: 'linkedin', label: 'LinkedIn', icon: Linkedin, color: 'text-sky-400' },
                            { id: 'facebook', label: 'Facebook', icon: Facebook, color: 'text-blue-500' },
                            { id: 'x', label: 'X (Twitter)', icon: Twitter, color: 'text-white' }
                        ].map((plat) => {
                            const Icon = plat.icon;
                            const isActive = activePlatform === plat.id;
                            return (
                                <button
                                    key={plat.id}
                                    onClick={() => setActivePlatform(plat.id as any)}
                                    className="flex-1 flex items-center justify-center gap-2 transition-all relative"
                                    style={{ height: '44px' }}
                                >
                                    <Icon className={`w-4 h-4 ${plat.color}`} />
                                    <span className={`text-[13px] font-bold ${isActive ? 'text-white' : 'text-slate-500'}`}>
                                        {plat.label}
                                    </span>
                                    {isActive && (
                                        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-teal-500" />
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Sub-view Filter Selectors (Queue | Published | Analytics) */}
                    <div className="flex p-3 gap-2 bg-slate-950 border-b border-white/5">
                        {[
                            { id: 'queue', label: 'Scheduled Queue', count: posts.filter(p => p.status === 'scheduled' && p.platforms.includes(activePlatform)).length },
                            { id: 'published', label: 'Published Feed', count: posts.filter(p => p.status === 'published' && p.platforms.includes(activePlatform)).length },
                            { id: 'analytics', label: 'Analytics Insights', count: null }
                        ].map((sub) => {
                            const isActive = activeSubView === sub.id;
                            return (
                                <button
                                    key={sub.id}
                                    onClick={() => setActiveSubView(sub.id as any)}
                                    className={`flex-1 py-1.5 px-3 rounded-full text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${isActive ? 'bg-teal-500/10 text-teal-400 border border-teal-500/30' : 'bg-slate-900 text-slate-400 border border-transparent'}`}
                                >
                                    <span>{sub.label}</span>
                                    {sub.count !== null && (
                                        <span className="text-[10px] px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded-md">
                                            {sub.count}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Main Platform Content */}
                    <div className="flex-1 p-4">
                        {activeSubView === 'analytics' ? (
                            /* Analytics Dashboard */
                            <div className="space-y-6 animate-in fade-in duration-300">
                                <div className="flex justify-between items-center bg-slate-900/50 p-3 rounded-2xl border border-white/5">
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Date Range</span>
                                    <div className="flex bg-slate-950 p-1 rounded-xl border border-white/5">
                                        {['7D', '30D', '90D'].map((range) => (
                                            <button
                                                key={range}
                                                onClick={() => setAnalyticsDateRange(range as any)}
                                                className={`px-3 py-1 text-xs font-bold rounded-lg ${analyticsDateRange === range ? 'bg-teal-600 text-white' : 'text-slate-500'}`}
                                            >
                                                {range}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    {[
                                        { label: 'Impressions', value: '14,204', change: '+12.4%', up: true },
                                        { label: 'Likes & Reactions', value: '1,894', change: '+8.2%', up: true },
                                        { label: 'Comments', value: '342', change: '-2.1%', up: false },
                                        { label: 'Clicks', value: '620', change: '+24.5%', up: true }
                                    ].map((stat, i) => (
                                        <div key={i} className="p-4 bg-slate-900 rounded-2xl border border-white/5 space-y-1">
                                            <span className="text-[11px] font-bold text-slate-500 uppercase">{stat.label}</span>
                                            <div className="text-xl font-bold text-white">{stat.value}</div>
                                            <span className={`text-[10px] font-bold ${stat.up ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                {stat.change} vs last period
                                            </span>
                                        </div>
                                    ))}
                                </div>

                                {/* Custom Tooltip Engagement Chart Mock */}
                                <div className="bg-slate-900 p-5 rounded-3xl border border-white/5 space-y-4">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <span className="text-xs font-bold text-slate-500 uppercase">Average Engagement Rate</span>
                                            <div className="text-2xl font-black text-white">4.82%</div>
                                        </div>
                                        <div className="text-xs text-slate-400 flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20">
                                            <ActivityIcon className="w-3.5 h-3.5" /> High Performance
                                        </div>
                                    </div>
                                    <div className="h-28 flex items-end justify-between pt-6 px-2">
                                        {[40, 60, 45, 90, 75, 110, 85, 130, 95, 140, 115, 160].map((h, idx) => (
                                            <div key={idx} className="group relative flex flex-col items-center w-full">
                                                <div 
                                                    className="w-2.5 bg-teal-500 hover:bg-teal-400 rounded-t transition-all cursor-pointer" 
                                                    style={{ height: `${(h / 160) * 100}%` }}
                                                />
                                                <div className="absolute -top-7 scale-0 group-hover:scale-100 bg-teal-600 text-white font-black text-[9px] px-1.5 py-0.5 rounded transition-all pointer-events-none shadow">
                                                    {(h / 20).toFixed(1)}%
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="flex justify-between text-[9px] font-bold text-slate-600 uppercase tracking-wider pt-2 border-t border-white/5">
                                        <span>Start</span>
                                        <span>Mid Point</span>
                                        <span>Today</span>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            /* Feed List / Queue with Swipe gestures */
                            <div className="space-y-1">
                                {filteredPosts.length === 0 ? (
                                    <div className="py-16 text-center bg-slate-900/10 rounded-2xl border border-dashed border-white/5">
                                        <ActivityIcon className="w-10 h-10 text-slate-700 mx-auto mb-3" />
                                        <h3 className="text-sm font-bold text-slate-400">No posts in this queue</h3>
                                        <p className="text-xs text-slate-600 max-w-xs mx-auto mt-1">Tap the plus button below to craft your first draft.</p>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-white/5 border border-white/5 rounded-2xl bg-slate-900/30 overflow-hidden">
                                        {filteredPosts.map((post) => {
                                            const offset = swipeState[post.id] || 0;
                                            return (
                                                <div 
                                                    key={post.id} 
                                                    className="relative select-none overflow-hidden bg-slate-950"
                                                    onTouchStart={(e) => handleTouchStart(e, post.id)}
                                                    onTouchMove={(e) => handleTouchMove(e, post.id)}
                                                    onTouchEnd={(e) => handleTouchEnd(e, post.id)}
                                                >
                                                    {/* Swipe Left Action Reveal: Delete (Red) */}
                                                    <div className="absolute inset-y-0 right-0 w-24 bg-red-600 flex items-center justify-center gap-1.5 text-white font-bold text-xs">
                                                        <Trash2 className="w-4 h-4" /> Delete
                                                    </div>

                                                    {/* Swipe Right Action Reveal: Duplicate (Green) */}
                                                    <div className="absolute inset-y-0 left-0 w-24 bg-emerald-600 flex items-center justify-center gap-1.5 text-white font-bold text-xs">
                                                        <Repeat className="w-4 h-4" /> Duplicate
                                                    </div>

                                                    {/* Main Post Row */}
                                                    <div 
                                                        onClick={() => setSelectedPost(post)}
                                                        className="relative z-10 flex items-center justify-between p-3.5 bg-slate-900/70 active:bg-slate-800 transition-transform duration-150 cursor-pointer"
                                                        style={{ 
                                                            transform: `translateX(${offset}px)`,
                                                            minHeight: '52px'
                                                        }}
                                                    >
                                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                                            {/* Platform Badge Icon Left */}
                                                            <div className="p-2 rounded-xl bg-slate-950 border border-white/5 flex-shrink-0">
                                                                {activePlatform === 'linkedin' && <Linkedin className="w-5 h-5 text-sky-400" />}
                                                                {activePlatform === 'facebook' && <Facebook className="w-5 h-5 text-blue-500" />}
                                                                {activePlatform === 'x' && <Twitter className="w-5 h-5 text-white" />}
                                                            </div>

                                                            {/* Snippet Detail Center */}
                                                            <div className="flex-1 min-w-0 flex flex-col">
                                                                <span className="text-[14px] text-white font-medium line-clamp-2 leading-snug">
                                                                    {post.caption}
                                                                </span>
                                                                <span className="text-[11px] text-slate-500 font-bold uppercase mt-1 flex items-center gap-1">
                                                                    <Clock className="w-3 h-3" />
                                                                    {post.scheduled_at 
                                                                        ? `Scheduled: ${new Date(post.scheduled_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}` 
                                                                        : `Posted: ${new Date(post.created_at).toLocaleDateString()}`
                                                                    }
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {/* Status Badge & Chevron Right */}
                                                        <div className="flex items-center gap-2.5 ml-3 flex-shrink-0">
                                                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-lg border ${
                                                                post.status === 'published' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                                                post.status === 'scheduled' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                                                post.status === 'failed' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                                                                'bg-slate-800 text-slate-400 border-transparent'
                                                            }`}>
                                                                {post.status}
                                                            </span>
                                                            <ChevronRight className="w-4 h-4 text-slate-600" />
                                                        </div>

                                                        {/* Optional New/Unread Accent Dot */}
                                                        {post.status === 'failed' && (
                                                            <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Floating Compose Trigger FAB */}
                    <button
                        onClick={() => setIsComposeOpen(true)}
                        className="fixed bottom-[74px] right-6 w-14 h-14 bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-400 text-white rounded-full flex items-center justify-center shadow-xl shadow-teal-900/40 z-30 transition-transform active:scale-95"
                    >
                        <Plus className="w-6 h-6" />
                    </button>
                </div>
            ) : (
                /* ----------------------------------------------------
                   MODULE 2: Tools & Intelligence (Existing features)
                   ---------------------------------------------------- */
                <div className="p-4 space-y-8 pb-20 animate-in fade-in duration-300">
                    <ModuleIntelligenceCard moduleKey="socialMedia" title="Social Intelligence" />

                    {/* Watchlist discovey lead panel */}
                    <section className="bg-slate-900 border border-white/5 rounded-3xl p-5 space-y-4">
                        <div className="flex justify-between items-center">
                            <div>
                                <h3 className="text-sm font-bold text-white">AlphaClone Lead Intelligence</h3>
                                <p className="text-xs text-slate-500">Autonomous intelligence agents finding prospective deals.</p>
                            </div>
                            <button
                                onClick={handleTriggerNexusIntelligence}
                                disabled={isIntelligenceRunning}
                                className="px-3.5 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold rounded-xl transition-all"
                            >
                                {isIntelligenceRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Run Nexus Sync'}
                            </button>
                        </div>
                    </section>

                    {/* Bookmarks */}
                    <section className="space-y-3">
                        <div className="flex justify-between items-center">
                            <h3 className="text-sm font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                <Bookmark className="w-4 h-4 text-teal-400" /> Bookmarks & Targets
                            </h3>
                            <button 
                                onClick={() => setIsAddingBookmark(!isAddingBookmark)}
                                className="text-xs text-teal-400 font-bold"
                            >
                                {isAddingBookmark ? 'Close' : 'Add Link'}
                            </button>
                        </div>

                        {isAddingBookmark && (
                            <form onSubmit={handleAddBookmark} className="p-4 bg-slate-900 border border-white/5 rounded-2xl space-y-3">
                                <input 
                                    required
                                    value={newBookmark.title}
                                    onChange={e => setNewBookmark({...newBookmark, title: e.target.value})}
                                    placeholder="Title"
                                    className="w-full px-3 py-2 bg-slate-950 border border-white/5 rounded-xl text-xs text-white focus:outline-none"
                                />
                                <input 
                                    required
                                    type="url"
                                    value={newBookmark.url}
                                    onChange={e => setNewBookmark({...newBookmark, url: e.target.value})}
                                    placeholder="URL Link"
                                    className="w-full px-3 py-2 bg-slate-950 border border-white/5 rounded-xl text-xs text-white focus:outline-none"
                                />
                                <button type="submit" className="w-full py-2 bg-teal-600 text-white rounded-xl text-xs font-bold">
                                    Save
                                </button>
                            </form>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {bookmarks.map(bm => (
                                <div key={bm.id} className="p-3 bg-slate-900 rounded-2xl border border-white/5 flex items-center justify-between">
                                    <div className="min-w-0 flex-1 pr-2">
                                        <h4 className="text-xs font-bold text-white truncate">{bm.title}</h4>
                                        <span className="text-[10px] text-slate-500 truncate block">{bm.url}</span>
                                    </div>
                                    <div className="flex gap-1.5">
                                        <a href={bm.url} target="_blank" rel="noreferrer" className="p-1.5 bg-slate-950 hover:bg-slate-800 text-slate-400 rounded-lg">
                                            <ExternalLink className="w-3.5 h-3.5" />
                                        </a>
                                        <button onClick={() => handleDeleteBookmark(bm.id)} className="p-1.5 bg-slate-950 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded-lg">
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Viral Script Generator */}
                    <section className="bg-slate-900 border border-white/5 rounded-3xl p-5 space-y-4">
                        <h3 className="text-sm font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                            <Video className="w-4 h-4 text-rose-500" /> Viral Hook Generator (Grok)
                        </h3>
                        <textarea
                            value={videoTopic}
                            onChange={e => setVideoTopic(e.target.value)}
                            placeholder="Video niche / topic details..."
                            className="w-full h-20 p-3 bg-slate-950 border border-white/5 rounded-xl text-xs text-white focus:outline-none resize-none"
                        />
                        <button
                            onClick={handleGenerateVideo}
                            disabled={isGeneratingVideo || !videoTopic}
                            className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2"
                        >
                            {isGeneratingVideo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                            Generate script
                        </button>

                        {videoResult && (
                            <div className="p-4 bg-slate-950 border border-white/5 rounded-2xl space-y-3">
                                <div>
                                    <span className="text-[10px] font-bold text-rose-400 uppercase block">Hook</span>
                                    <p className="text-xs text-white font-bold italic">"{videoResult.hook}"</p>
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Script</span>
                                    <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">{videoResult.script}</p>
                                </div>
                            </div>
                        )}
                    </section>
                </div>
            )}

            {/* ----------------------------------------------------
               COMPOSE SHEET (Full Screen Slide Up)
               ---------------------------------------------------- */}
            <AnimatePresence>
                {isComposeOpen && (
                    <motion.div 
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                        className="fixed inset-0 bg-slate-950 z-[100] flex flex-col pb-safe"
                    >
                        {/* Header bar */}
                        <div className="h-14 border-b border-white/5 bg-slate-900 px-4 flex items-center justify-between">
                            <button 
                                onClick={() => setIsComposeOpen(false)}
                                className="text-xs font-bold text-slate-400 px-2 py-1.5"
                            >
                                Cancel
                            </button>
                            <span className="text-[15px] font-bold text-white">Compose Post</span>
                            <button 
                                onClick={handleSavePost}
                                disabled={isOverLimit || !composeCaption.trim()}
                                className="px-4 py-1.5 bg-teal-600 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-full text-xs font-black uppercase tracking-wider"
                            >
                                {composeIsScheduled ? 'Schedule' : 'Share'}
                            </button>
                        </div>

                        {/* Content Area */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-6">
                            
                            {/* Platform Selector Switches */}
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest px-1">Publish platforms</label>
                                <div className="grid grid-cols-3 gap-2 bg-slate-900 p-1.5 rounded-2xl border border-white/5">
                                    {[
                                        { id: 'linkedin', label: 'LinkedIn', icon: Linkedin },
                                        { id: 'facebook', label: 'Facebook', icon: Facebook },
                                        { id: 'x', label: 'X (Twitter)', icon: Twitter }
                                    ].map((plat) => {
                                        const Icon = plat.icon;
                                        const isSelected = composePlatforms.includes(plat.id);
                                        return (
                                            <button
                                                key={plat.id}
                                                type="button"
                                                onClick={() => {
                                                    setComposePlatforms(prev => 
                                                        prev.includes(plat.id) 
                                                            ? prev.filter(x => x !== plat.id) 
                                                            : [...prev, plat.id]
                                                    );
                                                }}
                                                className={`py-2 rounded-xl flex flex-col items-center justify-center gap-1 border text-xs font-bold transition-all ${isSelected ? 'bg-teal-500/10 border-teal-500/40 text-teal-400' : 'bg-slate-950 border-transparent text-slate-500'}`}
                                            >
                                                <Icon className="w-4 h-4" />
                                                <span>{plat.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Platform Specifics Configuration */}
                            {composePlatforms.includes('linkedin') && (
                                <div className="p-4 bg-slate-900/60 rounded-2xl border border-white/5 space-y-3 animate-in slide-in-from-top-1">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-sky-400 flex items-center gap-1.5">
                                            <Linkedin className="w-4 h-4" /> LinkedIn Configuration
                                        </span>
                                    </div>
                                    
                                    {/* Identity Selectors */}
                                    <div className="flex bg-slate-950 p-1 rounded-xl border border-white/5">
                                        <button
                                            type="button"
                                            onClick={() => setSelectedLinkedInIdentity('personal')}
                                            className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all flex items-center justify-center gap-1 ${selectedLinkedInIdentity === 'personal' ? 'bg-slate-800 text-white' : 'text-slate-500'}`}
                                        >
                                            <User className="w-3.5 h-3.5" /> Personal Profile
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setSelectedLinkedInIdentity('company')}
                                            className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all flex items-center justify-center gap-1 ${selectedLinkedInIdentity === 'company' ? 'bg-slate-800 text-white' : 'text-slate-500'}`}
                                        >
                                            <Building className="w-3.5 h-3.5" /> Company Page
                                        </button>
                                    </div>

                                    {/* Warning banner */}
                                    {linkedinIntegrations.length === 0 && (
                                        <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl flex items-start gap-2.5 text-[11px]">
                                            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                            <span>Active connection scopes are required to publish. Please connect your profile in Settings.</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {composePlatforms.includes('facebook') && (
                                <div className="p-4 bg-slate-900/60 rounded-2xl border border-white/5 space-y-3 animate-in slide-in-from-top-1">
                                    <span className="text-xs font-bold text-blue-500 flex items-center gap-1.5">
                                        <Facebook className="w-4 h-4" /> Facebook Configuration
                                    </span>
                                    <div className="space-y-1">
                                        <label className="text-[10px] text-slate-500 uppercase font-black">Publish Target Page</label>
                                        <select
                                            value={selectedPageId}
                                            onChange={e => setSelectedPageId(e.target.value)}
                                            className="w-full h-10 bg-slate-950 border border-white/5 rounded-xl px-3 text-xs text-white outline-none"
                                        >
                                            {fbPages.length === 0 ? (
                                                <option value="">No pages configured</option>
                                            ) : (
                                                fbPages.map(page => (
                                                    <option key={page.page_id} value={page.page_id}>{page.page_name}</option>
                                                ))
                                            )}
                                        </select>
                                    </div>

                                    {/* Link preview card mock */}
                                    <div className="p-3 bg-slate-950 rounded-xl border border-white/5 space-y-1.5">
                                        <div className="w-full h-20 bg-slate-900 rounded-lg flex items-center justify-center text-slate-600 text-xs">
                                            Image preview
                                        </div>
                                        <div>
                                            <span className="text-[10px] text-slate-500 font-bold block uppercase">alphaclonenexus.com</span>
                                            <span className="text-[11px] text-white font-bold block">AlphaClone Business Operations Hub</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {composePlatforms.includes('x') && (
                                <div className="p-4 bg-slate-900/60 rounded-2xl border border-white/5 space-y-4 animate-in slide-in-from-top-1">
                                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                                        <Twitter className="w-4 h-4" /> X Thread stacks
                                    </span>

                                    {/* Thread replies list */}
                                    {xThreadPosts.map((reply, index) => (
                                        <div key={index} className="space-y-1.5 p-3 bg-slate-950 rounded-xl border border-white/5 relative">
                                            <span className="text-[9px] font-bold text-slate-500 uppercase">Reply Post #{index + 1}</span>
                                            <textarea
                                                value={reply}
                                                onChange={e => {
                                                    const updated = [...xThreadPosts];
                                                    updated[index] = e.target.value;
                                                    setXThreadPosts(updated);
                                                }}
                                                placeholder="Thread continuation..."
                                                className="w-full bg-transparent text-xs text-white outline-none resize-none h-14"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setXThreadPosts(prev => prev.filter((_, idx) => idx !== index))}
                                                className="absolute top-2 right-2 p-1 hover:bg-white/5 rounded text-slate-500"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    ))}

                                    <button
                                        type="button"
                                        onClick={() => setXThreadPosts(prev => [...prev, ''])}
                                        className="w-full py-2 bg-slate-950 border border-dashed border-white/10 text-[11px] text-slate-400 font-bold rounded-xl hover:border-white/20 transition-all flex items-center justify-center gap-1.5"
                                    >
                                        <Plus className="w-3.5 h-3.5" /> Add Thread Reply
                                    </button>
                                </div>
                            )}

                            {/* Caption Text Area Input */}
                            <div className="space-y-1.5">
                                <div className="flex justify-between items-center px-1">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Post Copy</label>
                                    <span className={`text-[11px] font-bold ${isOverLimit ? 'text-rose-500' : 'text-slate-400'}`}>
                                        {charCount} / {maxChars}
                                    </span>
                                </div>
                                <textarea
                                    value={composeCaption}
                                    onChange={e => setComposeCaption(e.target.value)}
                                    placeholder="What are we sharing today? (Use #hashtags inside caption or bottom bar)"
                                    className="w-full min-h-[140px] p-4 bg-slate-900 border border-white/5 rounded-2xl text-[16px] text-slate-200 outline-none focus:border-teal-500/50 transition-all resize-none placeholder-slate-600"
                                />
                            </div>

                            {/* Scheduled configuration picker */}
                            <div className="bg-slate-900 p-4 rounded-2xl border border-white/5 space-y-3">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <Calendar className="w-4 h-4 text-teal-400" />
                                        <span className="text-xs font-bold text-white">Schedule this post</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setComposeIsScheduled(!composeIsScheduled)}
                                        className={`w-12 h-6 rounded-full p-0.5 transition-colors duration-200 focus:outline-none ${composeIsScheduled ? 'bg-teal-600' : 'bg-slate-800'}`}
                                    >
                                        <div className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-200 ${composeIsScheduled ? 'translate-x-6' : 'translate-x-0'}`} />
                                    </button>
                                </div>

                                {composeIsScheduled && (
                                    <input
                                        type="datetime-local"
                                        value={composeScheduledAt}
                                        onChange={e => setComposeScheduledAt(e.target.value)}
                                        className="w-full h-11 bg-slate-950 border border-white/5 rounded-xl px-4 text-xs text-white outline-none focus:border-teal-500/50"
                                    />
                                )}
                            </div>

                        </div>

                        {/* Floating AI prompt trigger inside Compose Sheet */}
                        <div className="p-4 bg-slate-900 border-t border-white/5 flex items-center justify-between gap-3">
                            <button
                                type="button"
                                onClick={() => setAiPromptOpen(true)}
                                className="flex items-center gap-2 text-xs font-black text-teal-400 uppercase tracking-widest bg-teal-500/10 px-4 py-2 rounded-xl border border-teal-500/20"
                            >
                                <Sparkles className="w-4 h-4" /> Write Draft with AI
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* AI Prompter Dialog Modal inside compose */}
            <AnimatePresence>
                {aiPromptOpen && (
                    <div className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="w-full max-w-sm bg-slate-900 border border-white/5 rounded-3xl p-5 space-y-4"
                        >
                            <div className="flex justify-between items-center">
                                <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider">AI Topic prompt</h3>
                                <button onClick={() => setAiPromptOpen(false)} className="text-slate-500"><X className="w-4 h-4" /></button>
                            </div>
                            <textarea
                                value={aiPromptText}
                                onChange={e => setAiPromptText(e.target.value)}
                                placeholder="e.g. A message welcoming new beta testers for our workspace automation application..."
                                className="w-full h-24 p-3 bg-slate-950 border border-white/5 rounded-xl text-xs text-white outline-none resize-none"
                            />
                            <button
                                onClick={generateDraftWithAI}
                                disabled={aiGenerating || !aiPromptText.trim()}
                                className="w-full py-2.5 bg-teal-600 disabled:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
                            >
                                {aiGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />}
                                Generate Content Draft
                            </button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* ----------------------------------------------------
               DETAIL BOTTOM SHEET
               ---------------------------------------------------- */}
            <AnimatePresence>
                {selectedPost && (
                    <>
                        {/* Overlay backdrop */}
                        <div 
                            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[90]"
                            onClick={() => setSelectedPost(null)}
                        />
                        {/* Bottom sheet */}
                        <motion.div 
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 24, stiffness: 220 }}
                            className="fixed bottom-0 left-0 right-0 max-h-[90vh] bg-slate-900 rounded-t-[32px] border-t border-white/10 z-[100] flex flex-col pb-safe"
                        >
                            {/* Drag handle */}
                            <div className="w-12 h-1.5 bg-slate-700 rounded-full mx-auto my-3 flex-shrink-0" />
                            
                            {/* Header details */}
                            <div className="px-5 pb-3 border-b border-white/5 flex items-center justify-between">
                                <span className="text-xs font-black uppercase text-slate-500 tracking-wider">Post details</span>
                                <button 
                                    onClick={() => setSelectedPost(null)}
                                    className="p-1 hover:bg-slate-800 rounded-lg text-slate-400"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Sheet Scroll area */}
                            <div className="flex-1 overflow-y-auto p-5 space-y-6">
                                
                                {/* Caption Preview */}
                                <div className="space-y-1.5">
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Content caption</span>
                                    <div className="p-4 bg-slate-950 rounded-2xl border border-white/5 text-sm text-slate-200 leading-relaxed font-medium">
                                        {selectedPost.caption}
                                    </div>
                                </div>

                                {/* Platform and Date Info */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-3.5 bg-slate-950 rounded-2xl border border-white/5 flex flex-col justify-center">
                                        <span className="text-[9px] font-bold text-slate-500 uppercase">Platforms</span>
                                        <div className="flex gap-1.5 mt-1">
                                            {selectedPost.platforms.map((plat) => (
                                                <span key={plat} className="px-2 py-0.5 bg-slate-800 text-[10px] text-slate-300 font-bold uppercase rounded">
                                                    {plat}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="p-3.5 bg-slate-950 rounded-2xl border border-white/5 flex flex-col justify-center">
                                        <span className="text-[9px] font-bold text-slate-500 uppercase">Publish Status</span>
                                        <span className="text-xs text-white font-bold uppercase mt-1">
                                            {selectedPost.status}
                                        </span>
                                    </div>
                                </div>

                                {/* statistics grid */}
                                <div className="space-y-2">
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Performance metrics</span>
                                    <div className="grid grid-cols-4 gap-2">
                                        {[
                                            { label: 'Impressions', val: '430' },
                                            { label: 'Likes', val: '24' },
                                            { label: 'Comments', val: '2' },
                                            { label: 'Clicks', val: '8' }
                                        ].map((stat, i) => (
                                            <div key={i} className="p-3 bg-slate-950 rounded-2xl border border-white/5 text-center flex flex-col justify-center">
                                                <span className="text-[17px] font-black text-white">{stat.val}</span>
                                                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tight mt-0.5">{stat.label}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Control Action Actions */}
                                <div className="grid grid-cols-2 gap-3 pt-4">
                                    <button
                                        onClick={() => {
                                            handleDuplicatePost(selectedPost);
                                            setSelectedPost(null);
                                        }}
                                        className="py-3.5 bg-teal-600 hover:bg-teal-500 text-white rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-lg shadow-teal-900/30"
                                    >
                                        <Repeat className="w-4 h-4" /> Duplicate Post
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (confirm('Delete this scheduled post?')) {
                                                handleDeletePost(selectedPost.id);
                                                setSelectedPost(null);
                                            }
                                        }}
                                        className="py-3.5 bg-rose-600/10 hover:bg-rose-600/20 text-rose-400 rounded-2xl text-xs font-black uppercase tracking-wider border border-rose-500/20 flex items-center justify-center gap-1.5"
                                    >
                                        <Trash2 className="w-4 h-4" /> Delete post
                                    </button>
                                </div>

                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

        </div>
    );
}
