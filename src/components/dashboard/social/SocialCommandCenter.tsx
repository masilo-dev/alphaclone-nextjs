'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
    Bookmark, Link2, Plus, Trash2, ExternalLink, Facebook, Linkedin, Globe, 
    Search, Eye, Loader2, AlertCircle, CheckCircle2, RefreshCw, Video, Zap, 
    Copy, ChevronRight, Twitter, MessageSquare, Users, Activity as ActivityIcon, 
    Sparkles, Brain, Bot, Calendar, Camera, Image as ImageIcon, X, Sliders, 
    BarChart2, Settings, HelpCircle, Clock, ArrowLeft, History, 
    ChevronDown, Repeat, Paperclip, AlertTriangle, Heart, Share2, MousePointerClick
} from 'lucide-react';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import { formatFailureToastMessage } from '@/lib/copy/formatFailureForUser';

function socialActionError(action: string, err: unknown, saved?: string) {
  toast.error(formatFailureToastMessage({ action, rawError: err, saved }));
}
import { ModuleIntelligenceCard } from '../ModuleIntelligenceCard';
import { LinkedInOrgPanel, normalizeLinkedInScopes } from './LinkedInOrgPanel';
import { xaiVideoGenerationService, VideoScriptOutput } from '@/services/ai/xaiVideoGenerationService';
import { motion, AnimatePresence } from 'framer-motion';
import EmptyState, { EmptyStateFromPreset } from '@/components/ui/EmptyState';
import { SocialContentCalendar } from './SocialContentCalendar';
import { SocialAnalyticsStory } from './SocialAnalyticsStory';
import { WORKSPACE } from '@/constants/design';
import { buildBusinessSocialPrompt } from '@/lib/ai/businessContext';

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
    linkedin_stats?: Record<string, any> | null;
    error_message: string | null;
    created_at: string;
}

interface PostMetrics {
    impressions: number;
    reactions: number;
    comments: number;
    clicks: number;
    shares: number;
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
    metadata?: {
        company_pages?: Array<{
            id: string;
            name: string | null;
            vanityName: string | null;
            logoUrl: string | null;
        }>;
        company_pages_diagnostics?: {
            hint?: string | null;
            apiForbidden?: boolean;
            missingOrgScopes?: boolean;
            grantedScopes?: string[];
        } | null;
    } | null;
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
    const [activeSubView, setActiveSubView] = useState<'queue' | 'published' | 'publishing' | 'analytics'>('queue');
    const [queueDisplayMode, setQueueDisplayMode] = useState<'list' | 'week' | 'month'>('list');
    const [calendarAnchor, setCalendarAnchor] = useState(() => new Date());
    
    // State lists
    const [posts, setPosts] = useState<SocialPost[]>([]);
    const [bookmarks, setBookmarks] = useState<BookmarkRow[]>([]);
    const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
    const [xIntegration, setXIntegration] = useState<any>(null);
    const [fbPages, setFbPages] = useState<FacebookPage[]>([]);
    const [linkedinIntegrations, setLinkedinIntegrations] = useState<LinkedInIntegration[]>([]);
    const [recentInteractions, setRecentInteractions] = useState<any[]>([]);
    const [postMetrics, setPostMetrics] = useState<Record<string, PostMetrics>>({});
    const [loading, setLoading] = useState(true);
    const [syncingMetrics, setSyncingMetrics] = useState(false);
    const [metricsSyncedAt, setMetricsSyncedAt] = useState<string | null>(null);

    // Detail Bottom Sheet
    const [selectedPost, setSelectedPost] = useState<SocialPost | null>(null);
    
    // Compose Modal Full-screen
    const [isComposeOpen, setIsComposeOpen] = useState(false);
    const [composeCaption, setComposeCaption] = useState('');
    const [composePlatforms, setComposePlatforms] = useState<string[]>(['linkedin']);
    const [composeMedia, setComposeMedia] = useState<string[]>([]);
    const [composeMediaUrl, setComposeMediaUrl] = useState('');
    const [composeScheduledAt, setComposeScheduledAt] = useState('');
    const [composeIsScheduled, setComposeIsScheduled] = useState(false);
    const [selectedLinkedInId, setSelectedLinkedInId] = useState('');
    const [selectedLinkedInIdentity, setSelectedLinkedInIdentity] = useState<'personal' | 'company'>('personal');
    const [selectedLinkedInOrganizationId, setSelectedLinkedInOrganizationId] = useState('');
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

    const selectedLinkedInIntegration = useMemo(
        () => linkedinIntegrations.find((row) => row.linkedin_member_id === selectedLinkedInId) || null,
        [linkedinIntegrations, selectedLinkedInId],
    );
    const linkedInCompanyPages = useMemo(
        () =>
            Array.isArray(selectedLinkedInIntegration?.metadata?.company_pages)
                ? selectedLinkedInIntegration.metadata.company_pages
                : [],
        [selectedLinkedInIntegration],
    );
    const hasLinkedInOrgScope = useMemo(
        () => normalizeLinkedInScopes(selectedLinkedInIntegration?.scopes).includes('w_organization_social'),
        [selectedLinkedInIntegration],
    );
    const hasLinkedInOrgReadScope = useMemo(() => {
        const scopes = normalizeLinkedInScopes(selectedLinkedInIntegration?.scopes);
        return (
            scopes.includes('r_organization_admin') ||
            scopes.includes('r_organization_social') ||
            scopes.includes('rw_organization_admin')
        );
    }, [selectedLinkedInIntegration]);
    const linkedInCompanyPagesHint = useMemo(() => {
        const diagnostics = selectedLinkedInIntegration?.metadata?.company_pages_diagnostics;
        if (diagnostics?.hint) return diagnostics.hint;
        if (diagnostics?.apiForbidden) {
            return 'LinkedIn blocked organization page lookup. Your LinkedIn Developer app may need the Community Management API product approved.';
        }
        if (selectedLinkedInIntegration?.is_active && linkedInCompanyPages.length === 0) {
            return hasLinkedInOrgReadScope
                ? 'LinkedIn returned zero pages. Use Link page manually below with your company URL.'
                : 'Reconnect and approve organization permissions (r_organization_admin / rw_organization_admin).';
        }
        return null;
    }, [selectedLinkedInIntegration, linkedInCompanyPages.length, hasLinkedInOrgReadScope]);
    const grantedLinkedInScopes = useMemo(
        () => normalizeLinkedInScopes(selectedLinkedInIntegration?.scopes),
        [selectedLinkedInIntegration],
    );

    const handleRefreshLinkedInCompanyPages = async () => {
        if (!currentTenant?.id || !selectedLinkedInId) return;
        try {
            const res = await fetch('/api/linkedin/refresh-pages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tenantId: currentTenant.id,
                    linkedinMemberId: selectedLinkedInId,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data?.success) {
            toast.error(data?.error || data?.hint || formatFailureToastMessage({
                action: 'refresh LinkedIn company pages',
                rawError: data?.error,
            }));
                await loadData();
                return;
            }
            toast.success(
                data.companyPagesCount > 0
                    ? `Found ${data.companyPagesCount} company page(s)`
                    : data.hint || 'No pages returned — try linking manually',
            );
            await loadData();
        } catch (error) {
            socialActionError('refresh LinkedIn company pages', error);
        }
    };

    const handleLinkLinkedInCompanyPage = async (companyInput: string) => {
        if (!currentTenant?.id || !selectedLinkedInId) return;
        try {
            const res = await fetch('/api/linkedin/link-company-page', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tenantId: currentTenant.id,
                    linkedinMemberId: selectedLinkedInId,
                    companyInput,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data?.success) {
                toast.error(data?.error || 'Could not link that LinkedIn company page');
                return;
            }
            toast.success(`Linked ${data.companyPage?.name || data.companyPage?.vanityName || 'company page'}`);
            setSelectedLinkedInOrganizationId(String(data.companyPage?.id || ''));
            setSelectedLinkedInIdentity('company');
            await loadData();
        } catch {
            toast.error('Failed to link company page');
        }
    };

    const handleConnectLinkedIn = async () => {
        try {
            const { authService } = await import('@/services/authService');
            const { error } = await authService.connectLinkedInIntegration(
                '/dashboard/business/linkedin',
                currentTenant?.id,
            );
            if (error) toast.error(error);
        } catch {
            toast.error('Failed to start LinkedIn connection');
        }
    };

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
            const [postsRes, pagesRes, linkedinRes, analyticsRes] = await Promise.all([
                supabase.from('social_posts').select('*').eq('tenant_id', currentTenant.id).order('created_at', { ascending: false }).limit(60),
                supabase.from('facebook_integrations').select('page_id,page_name').eq('tenant_id', currentTenant.id).eq('is_active', true),
                supabase.from('linkedin_integrations').select('linkedin_member_id,linkedin_person_urn,scopes,is_active,metadata').eq('tenant_id', currentTenant.id).order('created_at', { ascending: false }),
                supabase.from('social_post_analytics').select('post_id,impressions,clicks,reactions,comments,shares,synced_at,created_at').eq('tenant_id', currentTenant.id).order('created_at', { ascending: false }).limit(250),
            ]);

            if (!postsRes.error) setPosts(postsRes.data || []);
            if (!analyticsRes.error) {
                const latestMetrics: Record<string, PostMetrics> = {};
                let latestSync: string | null = null;
                (analyticsRes.data || []).forEach((row: any) => {
                    if (!latestMetrics[row.post_id]) {
                        latestMetrics[row.post_id] = {
                            impressions: Number(row.impressions || 0),
                            clicks: Number(row.clicks || 0),
                            reactions: Number(row.reactions || 0),
                            comments: Number(row.comments || 0),
                            shares: Number(row.shares || 0),
                        };
                        if (row.synced_at && (!latestSync || row.synced_at > latestSync)) {
                            latestSync = row.synced_at;
                        }
                    }
                });
                setPostMetrics(latestMetrics);
                setMetricsSyncedAt(latestSync);
            }
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
            // Don't show error toast for solo owners, just show empty state
        } finally {
            setLoading(false);
        }
    };

    const compactNumber = (value: number | undefined | null) => {
        const number = Number(value || 0);
        return new Intl.NumberFormat(undefined, { notation: number >= 1000 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(number);
    };

    const detectMediaType = (url: string) => {
        if (/\.(mp4|mov|avi|webm|mkv)(\?|$)/i.test(url)) return 'video';
        if (/\.(gif)(\?|$)/i.test(url)) return 'gif';
        return 'image';
    };

    const getPostMetrics = (post: SocialPost): PostMetrics => {
        const analytics = postMetrics[post.id];
        const stats = post.linkedin_stats || {};
        const impressions = analytics?.impressions ?? stats.impressions ?? stats.totalShareStatistics?.impressionCount ?? 0;
        const reactions = analytics?.reactions ?? stats.reactions ?? stats.likes ?? stats.totalShareStatistics?.likeCount ?? 0;
        const comments = analytics?.comments ?? stats.comments ?? stats.totalShareStatistics?.commentCount ?? 0;
        const clicks = analytics?.clicks ?? stats.clicks ?? stats.totalShareStatistics?.clickCount ?? 0;
        const shares = analytics?.shares ?? stats.shares ?? stats.totalShareStatistics?.shareCount ?? 0;
        return {
            impressions: Number(impressions) || 0,
            reactions: Number(reactions) || 0,
            comments: Number(comments) || 0,
            clicks: Number(clicks) || 0,
            shares: Number(shares) || 0,
        };
    };

    const refreshSocialMetrics = async () => {
        if (!currentTenant?.id || syncingMetrics) return;
        setSyncingMetrics(true);
        try {
            const res = await fetch('/api/social/analytics/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tenantId: currentTenant.id, days: 90, limit: 40 }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success) {
                toast.error(data.error || 'Could not refresh social metrics');
                return;
            }
            toast.success(`Synced metrics for ${data.synced ?? 0} post${data.synced === 1 ? '' : 's'}`);
            await loadData();
        } catch {
            toast.error('Failed to refresh social metrics');
        } finally {
            setSyncingMetrics(false);
        }
    };

    const mergedMetricsByPost = useMemo(() => {
        const merged: Record<string, PostMetrics> = {};
        for (const post of posts) {
            merged[post.id] = getPostMetrics(post);
        }
        return merged;
    }, [posts, postMetrics]);

    const addComposeMediaUrl = () => {
        const url = composeMediaUrl.trim();
        if (!url) return;
        try {
            new URL(url);
        } catch {
            toast.error('Paste a valid media URL');
            return;
        }
        setComposeMedia(prev => prev.includes(url) ? prev : [...prev, url]);
        setComposeMediaUrl('');
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
            if (!currentTenant?.id) throw new Error('Select a workspace first');
            const response = await fetch(`/api/social/schedule?tenantId=${encodeURIComponent(currentTenant.id)}&postId=${encodeURIComponent(id)}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Delete failed');
            toast.success('Post deleted', { id: toastId });
            setPosts(prev => prev.filter(p => p.id !== id));
        } catch (err) {
            toast.error(formatFailureToastMessage({
                action: 'delete social post',
                rawError: err instanceof Error ? err.message : err,
            }), { id: toastId });
        }
    };

    const handleDuplicatePost = (post: SocialPost) => {
        setComposeCaption(post.caption);
        setComposePlatforms(post.platforms);
        setComposeMedia(post.media_urls);
        setComposeMediaUrl('');
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
                media_types: composeMedia.map(detectMediaType),
                scheduled_at: composeIsScheduled && composeScheduledAt ? new Date(composeScheduledAt).toISOString() : undefined,
                facebook_page_id: composePlatforms.includes('facebook') ? selectedPageId : undefined,
                linkedin_member_id: composePlatforms.includes('linkedin') ? selectedLinkedInId : undefined,
                linkedin_organization_id:
                    composePlatforms.includes('linkedin') &&
                    selectedLinkedInIdentity === 'company' &&
                    selectedLinkedInOrganizationId
                        ? selectedLinkedInOrganizationId
                        : undefined,
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
            setComposeMediaUrl('');
            setXThreadPosts([]);
            loadData();
        } catch (err: any) {
            toast.error(err.message || formatFailureToastMessage({
                action: 'save social post',
                rawError: err.message,
                saved: 'Your draft is saved.',
            }), { id: toastId });
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
                    prompt: buildBusinessSocialPrompt({
                        brandName: currentTenant?.name || 'the business',
                        platform: activePlatform,
                        topic: aiPromptText,
                        goal: 'Create a post that feels native to the brand and useful to customers.',
                        tone: 'clear, confident, and human',
                    }),
                    systemPrompt: 'You are an expert social media manager. Return only the caption text and keep it aligned to the client brand.',
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
                    body: JSON.stringify({ tenantId: currentTenant?.id, itemId: item.id })
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
        } else if (activeSubView === 'publishing') {
            return post.status === 'publishing' || (post.status === 'failed' && Boolean(post.error_message));
        }
        return true;
    });

    // Helper: Character countdown and warnings
    const maxChars = activePlatform === 'x' ? 280 : activePlatform === 'linkedin' ? 3000 : 63206;
    const charCount = composeCaption.length;
    const isOverLimit = charCount > maxChars;
    const selectedMetrics = selectedPost ? getPostMetrics(selectedPost) : null;
    const selectedPrimaryMedia = selectedPost?.media_urls?.[0];
    const selectedPrimaryMediaType = selectedPrimaryMedia
        ? (selectedPost?.media_types?.[0] || detectMediaType(selectedPrimaryMedia))
        : '';
    const platformPosts = posts.filter(post => post.platforms.includes(activePlatform));
    const publishedPlatformPosts = platformPosts.filter(post => post.status === 'published');
    if (loading) {
        return (
            <div
                className={`relative min-h-0 flex flex-col ac-scroll-full ac-safe-bottom ${WORKSPACE.panel.base} ${WORKSPACE.panel.radius}`}
            >
                <div className="flex-1 flex items-center justify-center h-64">
                    <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
                </div>
            </div>
        );
    }

    return (
        <div className={`relative min-h-0 flex flex-col ac-scroll-full ac-safe-bottom ${WORKSPACE.panel.base} ${WORKSPACE.panel.radius}`}>
            
            {/* Top Workspace Tab Mode Switcher */}
            <div className="flex gap-2 border-b border-[var(--ws-border)] bg-[var(--ws-toolbar)] p-2">
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
                <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
                    
                    {/* Platform Switcher Tab Bar (LinkedIn | Facebook | X) */}
                    <div className="sticky top-0 z-20 flex h-11 select-none divide-x divide-[var(--ws-border)] border-b border-[var(--ws-border)] bg-[var(--ws-toolbar)]">
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
                            { id: 'publishing', label: 'Publishing / Recovery', count: posts.filter(p => (p.status === 'publishing' || p.status === 'failed') && p.platforms.includes(activePlatform)).length },
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

                    {activeSubView !== 'analytics' && (
                        <div className="flex items-center justify-between gap-2 px-3 py-2 bg-slate-950/80 border-b border-white/5">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                Content calendar
                            </p>
                            <div className="flex bg-slate-900 p-0.5 rounded-lg border border-white/5">
                                {([
                                    { id: 'list', label: 'List' },
                                    { id: 'week', label: 'Week' },
                                    { id: 'month', label: 'Month' },
                                ] as const).map((mode) => (
                                    <button
                                        key={mode.id}
                                        type="button"
                                        onClick={() => setQueueDisplayMode(mode.id)}
                                        className={`px-2.5 py-1 text-[10px] font-bold rounded-md ${
                                            queueDisplayMode === mode.id
                                                ? 'bg-teal-600 text-white'
                                                : 'text-slate-500 hover:text-slate-300'
                                        }`}
                                    >
                                        {mode.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Main Platform Content */}
                    <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 space-y-4 pb-24 ac-safe-bottom">
                        {activePlatform === 'linkedin' && activeSubView !== 'analytics' ? (
                            <LinkedInOrgPanel
                                isConnected={!!selectedLinkedInIntegration?.is_active}
                                companyPages={linkedInCompanyPages}
                                selectedOrgId={
                                    selectedLinkedInIdentity === 'company' ? selectedLinkedInOrganizationId : ''
                                }
                                onSelectOrg={(id) => {
                                    setSelectedLinkedInOrganizationId(id);
                                    setSelectedLinkedInIdentity(id ? 'company' : 'personal');
                                }}
                                hasOrganizationWriteScope={hasLinkedInOrgScope}
                                hasOrganizationReadScope={hasLinkedInOrgReadScope}
                                statusHint={linkedInCompanyPagesHint}
                                grantedScopes={grantedLinkedInScopes}
                                onConnect={handleConnectLinkedIn}
                                onReconnect={handleConnectLinkedIn}
                                onRefreshPages={handleRefreshLinkedInCompanyPages}
                                onLinkCompanyPage={handleLinkLinkedInCompanyPage}
                            />
                        ) : null}
                        {activeSubView === 'analytics' ? (
                            <div className="space-y-3">
                                <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-950/80 px-4 py-3">
                                    <div>
                                        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Provider metrics</p>
                                        <p className="text-[11px] text-slate-500">
                                            {metricsSyncedAt
                                                ? `Last synced ${new Date(metricsSyncedAt).toLocaleString()}`
                                                : 'Not synced yet — pull reach and engagement from Facebook/LinkedIn'}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={refreshSocialMetrics}
                                        disabled={syncingMetrics}
                                        className="inline-flex items-center gap-2 rounded-lg border border-teal-500/30 bg-teal-500/10 px-3 py-2 text-xs font-bold text-teal-300 disabled:opacity-60"
                                    >
                                        {syncingMetrics ? (
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                            <RefreshCw className="h-3.5 w-3.5" />
                                        )}
                                        Refresh metrics
                                    </button>
                                </div>
                                <SocialAnalyticsStory
                                    posts={publishedPlatformPosts}
                                    metricsByPost={mergedMetricsByPost}
                                    platform={activePlatform}
                                    range={analyticsDateRange}
                                    onRangeChange={setAnalyticsDateRange}
                                    onOpenPost={setSelectedPost}
                                />
                            </div>
                        ) : (
                            /* Feed List / Queue with Swipe gestures */
                            <div className="space-y-1">
                                {queueDisplayMode !== 'list' && filteredPosts.length > 0 ? (
                                    <SocialContentCalendar
                                        mode={queueDisplayMode}
                                        anchor={calendarAnchor}
                                        onAnchorChange={setCalendarAnchor}
                                        posts={filteredPosts}
                                        onSelectPost={setSelectedPost}
                                    />
                                ) : null}
                                {filteredPosts.length === 0 ? (
                                    <EmptyStateFromPreset
                                        moduleId="social"
                                        className={`max-w-none py-16 border border-dashed border-[var(--ws-border)] ${WORKSPACE.panel.radius}`}
                                    />
                                ) : queueDisplayMode === 'list' ? (
                                    <div className="space-y-4">
                                        {filteredPosts.map((post) => {
                                            const offset = swipeState[post.id] || 0;
                                            const metrics = getPostMetrics(post);
                                            const primaryMedia = post.media_urls?.[0];
                                            const primaryMediaType = post.media_types?.[0] || (primaryMedia ? detectMediaType(primaryMedia) : '');
                                            const publishedOrCreatedAt = post.published_at || post.created_at;
                                            return (
                                                <div 
                                                    key={post.id} 
                                                    className={`relative select-none overflow-hidden border border-[var(--ws-border)] bg-slate-950 shadow-none touch-pan-y ${WORKSPACE.panel.radius}`}
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
                                                        className="relative z-10 bg-slate-900/90 active:bg-slate-800 transition-transform duration-150 cursor-pointer"
                                                        style={{ 
                                                            transform: `translateX(${offset}px)`,
                                                        }}
                                                    >
                                                        <div className="p-4 space-y-4">
                                                            <div className="flex items-start justify-between gap-3">
                                                                <div className="flex items-center gap-3 min-w-0">
                                                                    <div className="relative w-12 h-12 rounded-full bg-gradient-to-br from-sky-500 via-teal-400 to-violet-500 p-[2px] flex-shrink-0">
                                                                        <div className="w-full h-full rounded-full bg-slate-950 flex items-center justify-center">
                                                                            {activePlatform === 'linkedin' && <Linkedin className="w-5 h-5 text-sky-400" />}
                                                                            {activePlatform === 'facebook' && <Facebook className="w-5 h-5 text-blue-500" />}
                                                                            {activePlatform === 'x' && <Twitter className="w-5 h-5 text-white" />}
                                                                        </div>
                                                                    </div>
                                                                    <div className="min-w-0">
                                                                        <div className="flex items-center gap-2">
                                                                            <h4 className="text-sm font-black text-white truncate">
                                                                                AlphaClone Systems
                                                                            </h4>
                                                                            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-950 text-slate-400 border border-white/5 uppercase font-black">
                                                                                {activePlatform}
                                                                            </span>
                                                                        </div>
                                                                        <p className="text-[11px] text-slate-500 font-bold">
                                                                            {post.scheduled_at
                                                                                ? `Scheduled for ${new Date(post.scheduled_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}`
                                                                                : `Published ${new Date(publishedOrCreatedAt).toLocaleDateString([], { dateStyle: 'medium' })}`}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                                <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-lg border flex-shrink-0 ${
                                                                    post.status === 'published' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                                                    post.status === 'scheduled' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                                                    post.status === 'publishing' ? 'bg-blue-500/10 text-blue-300 border-blue-500/20' :
                                                                    post.status === 'failed' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                                                                    'bg-slate-800 text-slate-400 border-transparent'
                                                                }`}>
                                                                    {post.status}
                                                                </span>
                                                            </div>

                                                            <div className="space-y-3">
                                                                <p className="text-[15px] text-slate-100 font-medium leading-relaxed whitespace-pre-line break-words">
                                                                    {post.caption}
                                                                </p>
                                                                {post.hashtags?.length > 0 && (
                                                                    <div className="flex flex-wrap gap-1.5">
                                                                        {post.hashtags.slice(0, 5).map(tag => (
                                                                            <span key={tag} className="text-xs font-bold text-sky-400">#{tag.replace(/^#/, '')}</span>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {primaryMedia && (
                                                                <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950">
                                                                    {primaryMediaType === 'video' ? (
                                                                        <video
                                                                            src={primaryMedia}
                                                                            className="w-full max-h-[420px] bg-black object-cover"
                                                                            controls
                                                                            playsInline
                                                                            preload="metadata"
                                                                        />
                                                                    ) : (
                                                                        <img
                                                                            src={primaryMedia}
                                                                            alt="Social post media preview"
                                                                            className="w-full max-h-[420px] object-cover"
                                                                            loading="lazy"
                                                                        />
                                                                    )}
                                                                    {post.media_urls.length > 1 && (
                                                                        <div className="px-3 py-2 text-[11px] text-slate-400 font-bold bg-slate-950/90">
                                                                            +{post.media_urls.length - 1} more media item{post.media_urls.length > 2 ? 's' : ''}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}

                                                            <div className="grid grid-cols-4 gap-2 pt-2 border-t border-white/5">
                                                                {[
                                                                    { icon: Eye, label: 'Views', value: metrics.impressions },
                                                                    { icon: Heart, label: 'Likes', value: metrics.reactions },
                                                                    { icon: MessageSquare, label: 'Comments', value: metrics.comments },
                                                                    { icon: MousePointerClick, label: 'Clicks', value: metrics.clicks },
                                                                ].map((metric) => {
                                                                    const Icon = metric.icon;
                                                                    return (
                                                                        <div key={metric.label} className="flex items-center justify-center gap-1.5 rounded-xl bg-slate-950/80 px-2 py-2 text-slate-400">
                                                                            <Icon className="w-3.5 h-3.5" />
                                                                            <span className="text-[11px] font-black text-white">{compactNumber(metric.value)}</span>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>

                                                            <div className="flex items-center justify-between pt-1">
                                                                <div className="flex items-center gap-4 text-[11px] font-bold text-slate-500">
                                                                    <span className="flex items-center gap-1"><Heart className="w-3.5 h-3.5" /> React</span>
                                                                    <span className="flex items-center gap-1"><MessageSquare className="w-3.5 h-3.5" /> Comment</span>
                                                                    <span className="flex items-center gap-1"><Share2 className="w-3.5 h-3.5" /> Share</span>
                                                                </div>
                                                                <ChevronRight className="w-4 h-4 text-slate-600" />
                                                            </div>
                                                        </div>

                                                        {/* Optional New/Unread Accent Dot */}
                                                        {post.status === 'failed' && (
                                                            <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                                                        )}
                                                        {post.status === 'publishing' && (
                                                            <div className="mt-2 rounded-lg border border-blue-500/20 bg-blue-500/5 px-2 py-1 text-[10px] text-blue-200">
                                                                Publishing in progress — platform recovery will retry if this stays stuck for 15+ minutes.
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : null}
                            </div>
                        )}
                    </div>

                    {/* Floating Compose Trigger FAB */}
                    <button
                        onClick={() => setIsComposeOpen(true)}
                        className="ac-fab-above-nav w-14 h-14 bg-teal-600 hover:bg-teal-500 text-white rounded-full flex items-center justify-center shadow-xl shadow-teal-900/40 transition-transform active:scale-95"
                    >
                        <Plus className="w-6 h-6" />
                    </button>
                </div>
            ) : (
                /* ----------------------------------------------------
                   MODULE 2: Tools & Intelligence (Existing features)
                   ---------------------------------------------------- */
                <div className="p-4 space-y-8 pb-24 ac-safe-bottom lg:pb-4 animate-in fade-in duration-300">
                    <ModuleIntelligenceCard moduleKey="socialMedia" title="Social Intelligence" />

                    {/* Watchlist discovey lead panel */}
                    <section className={`space-y-4 p-5 ${WORKSPACE.panel.base} ${WORKSPACE.panel.radius}`}>
                        <div className="flex justify-between items-center">
                            <div>
                                <h3 className="text-sm font-bold text-white">AlphaClone Lead Intelligence</h3>
                                <p className="text-xs text-slate-500">Autonomous intelligence agents finding prospective deals.</p>
                            </div>
                            <button
                                onClick={handleTriggerNexusIntelligence}
                                disabled={isIntelligenceRunning}
                                className={`${WORKSPACE.action.primary} h-9 px-3.5 text-xs`}
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
                            <form onSubmit={handleAddBookmark} className={`space-y-3 p-4 ${WORKSPACE.panel.base} ${WORKSPACE.panel.radius}`}>
                                <input 
                                    required
                                    value={newBookmark.title}
                                    onChange={e => setNewBookmark({...newBookmark, title: e.target.value})}
                                    placeholder="Title"
                                    className="w-full px-3 py-2 bg-[var(--ws-toolbar)] border border-[var(--ws-border)] rounded-lg text-xs text-white focus:outline-none"
                                />
                                <input 
                                    required
                                    type="url"
                                    value={newBookmark.url}
                                    onChange={e => setNewBookmark({...newBookmark, url: e.target.value})}
                                    placeholder="URL Link"
                                    className="w-full px-3 py-2 bg-[var(--ws-toolbar)] border border-[var(--ws-border)] rounded-lg text-xs text-white focus:outline-none"
                                />
                                <button type="submit" className={`${WORKSPACE.action.primary} h-10 w-full text-xs`}>
                                    Save
                                </button>
                            </form>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {bookmarks.map(bm => (
                                <div key={bm.id} className={`flex items-center justify-between p-3 ${WORKSPACE.panel.base} ${WORKSPACE.panel.radius}`}>
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
                    <section className={`space-y-4 p-5 ${WORKSPACE.panel.base} ${WORKSPACE.panel.radius}`}>
                        <h3 className="text-sm font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                            <Video className="w-4 h-4 text-rose-500" /> Viral Hook Generator (Grok)
                        </h3>
                        <textarea
                            value={videoTopic}
                            onChange={e => setVideoTopic(e.target.value)}
                            placeholder="Video niche / topic details..."
                            className="w-full h-20 p-3 bg-[var(--ws-toolbar)] border border-[var(--ws-border)] rounded-lg text-xs text-white focus:outline-none resize-none"
                        />
                        <button
                            onClick={handleGenerateVideo}
                            disabled={isGeneratingVideo || !videoTopic}
                            className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-2"
                        >
                            {isGeneratingVideo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                            Generate script
                        </button>

                        {videoResult && (
                            <div className={`space-y-3 p-4 ${WORKSPACE.panel.base} ${WORKSPACE.panel.radius}`}>
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
                        className="fixed inset-0 bg-slate-950 z-[1100] flex flex-col pb-safe"
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
                                <div className={`grid grid-cols-3 gap-2 p-1.5 ${WORKSPACE.panel.base} ${WORKSPACE.panel.radius}`}>
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
                                <LinkedInOrgPanel
                                    isConnected={!!selectedLinkedInIntegration?.is_active}
                                    companyPages={linkedInCompanyPages}
                                    selectedOrgId={
                                        selectedLinkedInIdentity === 'company'
                                            ? selectedLinkedInOrganizationId
                                            : ''
                                    }
                                    onSelectOrg={(id) => {
                                        setSelectedLinkedInOrganizationId(id);
                                        setSelectedLinkedInIdentity(id ? 'company' : 'personal');
                                    }}
                                    hasOrganizationWriteScope={hasLinkedInOrgScope}
                                    hasOrganizationReadScope={hasLinkedInOrgReadScope}
                                    statusHint={linkedInCompanyPagesHint}
                                    grantedScopes={grantedLinkedInScopes}
                                    onConnect={handleConnectLinkedIn}
                                    onReconnect={handleConnectLinkedIn}
                                    onRefreshPages={handleRefreshLinkedInCompanyPages}
                                    onLinkCompanyPage={handleLinkLinkedInCompanyPage}
                                />
                            )}

                            {composePlatforms.includes('facebook') && (
                                <div className={`space-y-3 p-4 animate-in slide-in-from-top-1 ${WORKSPACE.panel.base} ${WORKSPACE.panel.radius}`}>
                                    <span className="text-xs font-bold text-blue-500 flex items-center gap-1.5">
                                        <Facebook className="w-4 h-4" /> Facebook Configuration
                                    </span>
                                    <div className="space-y-1">
                                        <label className="text-[10px] text-slate-500 uppercase font-black">Publish Target Page</label>
                                        <select
                                            value={selectedPageId}
                                            onChange={e => setSelectedPageId(e.target.value)}
                                            className="w-full h-10 bg-[var(--ws-toolbar)] border border-[var(--ws-border)] rounded-lg px-3 text-xs text-white outline-none"
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

                                    {composeMediaUrl && (
                                        <div className="p-3 bg-slate-950 rounded-xl border border-white/5 space-y-1.5">
                                            <img src={composeMediaUrl} alt="Selected post media preview" className="w-full h-20 object-cover rounded-lg" />
                                            <span className="text-[10px] text-slate-500 font-bold block truncate">{composeMediaUrl}</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {composePlatforms.includes('x') && (
                                <div className={`space-y-4 p-4 animate-in slide-in-from-top-1 ${WORKSPACE.panel.base} ${WORKSPACE.panel.radius}`}>
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
                                    className="w-full min-h-[160px] p-4 bg-[var(--ws-toolbar)] border border-[var(--ws-border)] rounded-lg text-base text-slate-200 outline-none focus:border-teal-500/50 transition-all resize-y placeholder-slate-600"
                                />
                            </div>

                            {/* Media attachment preview */}
                            <div className={`space-y-3 p-4 ${WORKSPACE.panel.base} ${WORKSPACE.panel.radius}`}>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Paperclip className="w-4 h-4 text-teal-400" />
                                        <span className="text-xs font-bold text-white">Attach media URL</span>
                                    </div>
                                    <span className="text-[10px] font-black text-slate-500 uppercase">{composeMedia.length} attached</span>
                                </div>
                                <div className="flex gap-2">
                                    <input
                                        type="url"
                                        value={composeMediaUrl}
                                        onChange={e => setComposeMediaUrl(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                addComposeMediaUrl();
                                            }
                                        }}
                                        placeholder="https://... image, gif, or mp4"
                                        className="flex-1 h-11 bg-[var(--ws-toolbar)] border border-[var(--ws-border)] rounded-lg px-4 text-xs text-white outline-none focus:border-teal-500/50"
                                    />
                                    <button
                                        type="button"
                                        onClick={addComposeMediaUrl}
                                        className={`${WORKSPACE.action.primary} h-11 px-4 text-xs`}
                                    >
                                        Add
                                    </button>
                                </div>

                                {composeMedia.length > 0 && (
                                    <div className="grid grid-cols-2 gap-2">
                                        {composeMedia.map((url) => {
                                            const mediaType = detectMediaType(url);
                                            return (
                                                <div key={url} className="relative overflow-hidden rounded-xl border border-white/10 bg-slate-950">
                                                    {mediaType === 'video' ? (
                                                        <video src={url} className="h-32 w-full object-cover bg-black" controls playsInline preload="metadata" />
                                                    ) : (
                                                        <img src={url} alt="Attached social media" className="h-32 w-full object-cover" loading="lazy" />
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={() => setComposeMedia(prev => prev.filter(item => item !== url))}
                                                        className="absolute top-2 right-2 p-1.5 bg-black/70 hover:bg-rose-600 text-white rounded-full"
                                                    >
                                                        <X className="w-3.5 h-3.5" />
                                                    </button>
                                                    <span className="absolute left-2 bottom-2 px-2 py-0.5 rounded-md bg-black/70 text-[9px] font-black uppercase text-white">
                                                        {mediaType}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Scheduled configuration picker */}
                            <div className={`space-y-3 p-4 ${WORKSPACE.panel.base} ${WORKSPACE.panel.radius}`}>
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
                                        className="w-full h-11 bg-[var(--ws-toolbar)] border border-[var(--ws-border)] rounded-lg px-4 text-xs text-white outline-none focus:border-teal-500/50"
                                    />
                                )}
                            </div>

                        </div>

                        {/* Floating AI prompt trigger inside Compose Sheet */}
                        <div className="flex items-center justify-between gap-3 border-t border-[var(--ws-border)] bg-[var(--ws-toolbar)] p-4">
                            <button
                                type="button"
                                onClick={() => setAiPromptOpen(true)}
                            className="flex items-center gap-2 text-xs font-black text-teal-400 uppercase tracking-widest bg-teal-500/10 px-4 py-2 rounded-lg border border-teal-500/20"
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
                            className={`w-full max-w-sm space-y-4 p-5 ${WORKSPACE.panel.base} ${WORKSPACE.panel.radius}`}
                        >
                            <div className="flex justify-between items-center">
                                <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider">AI Topic prompt</h3>
                                <button onClick={() => setAiPromptOpen(false)} className="text-slate-500"><X className="w-4 h-4" /></button>
                            </div>
                            <textarea
                                value={aiPromptText}
                                onChange={e => setAiPromptText(e.target.value)}
                                placeholder="e.g. A message welcoming new beta testers for our workspace automation application..."
                                className="w-full h-24 p-3 bg-[var(--ws-toolbar)] border border-[var(--ws-border)] rounded-lg text-xs text-white outline-none resize-none"
                            />
                            <button
                                onClick={generateDraftWithAI}
                                disabled={aiGenerating || !aiPromptText.trim()}
                                className="w-full py-2.5 bg-teal-600 disabled:bg-slate-800 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5"
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
                            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[1100]"
                            onClick={() => setSelectedPost(null)}
                        />
                        {/* Bottom sheet */}
                        <motion.div 
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 24, stiffness: 220 }}
                            className="fixed bottom-0 left-0 right-0 z-[1110] flex max-h-[90vh] flex-col border-t border-[var(--ws-border)] bg-slate-900 pb-safe rounded-t-[20px]"
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
                                    <div className={`text-sm leading-relaxed font-medium text-slate-200 p-4 ${WORKSPACE.panel.base} ${WORKSPACE.panel.radius}`}>
                                        {selectedPost.caption}
                                    </div>
                                </div>

                                {selectedPrimaryMedia && (
                                    <div className="space-y-1.5">
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Rendered media</span>
                                        <div className={`overflow-hidden border bg-slate-950 ${WORKSPACE.panel.radius}`} style={{ borderColor: 'var(--ws-border)' }}>
                                            {selectedPrimaryMediaType === 'video' ? (
                                                <video src={selectedPrimaryMedia} className="w-full max-h-[440px] bg-black object-cover" controls playsInline preload="metadata" />
                                            ) : (
                                                <img src={selectedPrimaryMedia} alt="Social post media" className="w-full max-h-[440px] object-cover" loading="lazy" />
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Platform and Date Info */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className={`flex flex-col justify-center p-3.5 ${WORKSPACE.panel.base} ${WORKSPACE.panel.radius}`}>
                                        <span className="text-[9px] font-bold text-slate-500 uppercase">Platforms</span>
                                        <div className="flex gap-1.5 mt-1">
                                            {selectedPost.platforms.map((plat) => (
                                                <span key={plat} className="px-2 py-0.5 bg-slate-800 text-[10px] text-slate-300 font-bold uppercase rounded">
                                                    {plat}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                    <div className={`flex flex-col justify-center p-3.5 ${WORKSPACE.panel.base} ${WORKSPACE.panel.radius}`}>
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
                                            { label: 'Views', val: compactNumber(selectedMetrics?.impressions) },
                                            { label: 'Likes', val: compactNumber(selectedMetrics?.reactions) },
                                            { label: 'Comments', val: compactNumber(selectedMetrics?.comments) },
                                            { label: 'Clicks', val: compactNumber(selectedMetrics?.clicks) }
                                        ].map((stat, i) => (
                                            <div key={i} className={`flex flex-col justify-center p-3 text-center ${WORKSPACE.panel.base} ${WORKSPACE.panel.radius}`}>
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
                                        className={`${WORKSPACE.action.primary} py-3.5 text-xs uppercase tracking-wider flex items-center justify-center gap-1.5`}
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
                                        className="py-3.5 bg-rose-600/10 hover:bg-rose-600/20 text-rose-400 rounded-lg text-xs font-black uppercase tracking-wider border border-rose-500/20 flex items-center justify-center gap-1.5"
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
