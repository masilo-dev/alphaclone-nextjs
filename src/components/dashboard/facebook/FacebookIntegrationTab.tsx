'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
    Facebook, Users, Megaphone, RefreshCw, CheckCircle2, XCircle,
    ExternalLink, Plus, Send, Image, Link2, Loader2, Eye, Trash2,
    TrendingUp, UserPlus, Mail, Phone, Building2, Filter, ChevronDown, Sparkles,
    Activity, HelpCircle, Code2, Globe, Shield, Zap, AlertCircle, AlertTriangle, MessageCircle,
    ThumbsUp, Repeat2, BarChart3, ChevronRight, X, Calendar, Search
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import MessengerInbox from '../messenger/MessengerInbox';
import MediaStudioModal from './MediaStudioModal';
import toast from 'react-hot-toast';
import { userLearningPreferencesService } from '@/services/userLearningPreferencesService';
import { motion, AnimatePresence } from 'framer-motion';

// Specialized Error Boundary for Third-Party Integrations
class FacebookErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: any, errorInfo: any) { console.error("[FacebookTab] Error:", error, errorInfo); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-12 text-center bg-slate-900/50 rounded-3xl border border-slate-800 backdrop-blur-xl">
          <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Integration Sync Error</h2>
          <p className="text-slate-400 mb-6">Facebook connection expired or blocked.</p>
          <button onClick={() => window.location.reload()} className="px-6 py-2 bg-teal-600 text-white rounded-xl">Retry Connection</button>
        </div>
      );
    }
    return this.props.children;
  }
}

interface FacebookPage {
    id: string;
    page_id: string;
    page_name: string;
    is_active: boolean;
    connected_at: string;
    page_access_token?: string | null;
    metadata?: Record<string, any> | null;
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

interface ScheduledSocialPost {
    id: string;
    caption: string;
    status: 'draft' | 'scheduled' | 'queued' | 'publishing' | 'published' | 'failed' | 'cancelled';
    scheduled_at: string | null;
    created_at: string;
    error_message: string | null;
}

const STATUS_COLORS: Record<string, string> = {
    new: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
    contacted: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
    qualified: 'bg-teal-600/20 text-teal-500 border-teal-600/30',
    converted: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
    disqualified: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
};

const FACEBOOK_TABS = ['leads', 'messenger', 'posts', 'post', 'pages', 'setup'] as const;
const TAB_LABELS: Record<(typeof FACEBOOK_TABS)[number], string> = {
    leads: 'Leads',
    messenger: 'Inbox',
    posts: 'Page Posts',
    post: 'Publish',
    pages: 'Pages',
    setup: 'Setup Guide',
};

interface FacebookIntegrationTabProps {
    user: any;
    tenant: any;
}

const SidebarContent = ({ 
    activeTab, 
    setActiveTab, 
    leadsCount, 
    isMobile 
}: { 
    activeTab: string; 
    setActiveTab: (tab: any) => void; 
    leadsCount: number; 
    isMobile: boolean;
}) => (
    <div className="space-y-8">
        <div>
            <div className="px-3 text-xs font-black text-gray-600 uppercase tracking-widest mb-4">Content Control</div>
            <div className="space-y-1">
                <button onClick={() => setActiveTab('post')} className={`w-full flex items-center gap-3 p-4 rounded-2xl transition-all ${activeTab === 'post' ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20 shadow-lg shadow-teal-500/10' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}>
                    <Plus size={20} />
                    <span className="text-sm font-bold">Compose Post</span>
                </button>
                <button onClick={() => setActiveTab('posts')} className={`w-full flex items-center gap-3 p-4 rounded-2xl transition-all ${activeTab === 'posts' ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20 shadow-lg shadow-teal-500/10' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}>
                    <Activity size={20} />
                    <span className="text-sm font-bold">Page Feed</span>
                </button>
            </div>
        </div>
        <div>
            <div className="px-3 text-xs font-black text-gray-600 uppercase tracking-widest mb-4">Direct Response</div>
            <div className="space-y-1">
                <button onClick={() => setActiveTab('leads')} className={`w-full flex items-center gap-3 p-4 rounded-2xl transition-all ${activeTab === 'leads' ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20 shadow-lg shadow-teal-500/10' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}>
                    <Users size={20} />
                    <span className="text-sm font-bold">Lead Manager</span>
                    {leadsCount > 0 && <span className="ml-auto bg-teal-500 text-white text-xs px-2 py-1 rounded-full font-black">{leadsCount}</span>}
                </button>
                <button onClick={() => setActiveTab('messenger')} className={`w-full flex items-center gap-3 p-4 rounded-2xl transition-all ${activeTab === 'messenger' ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20 shadow-lg shadow-teal-500/10' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}>
                    <MessageCircle size={20} />
                    <span className="text-sm font-bold">Messenger Inbox</span>
                </button>
            </div>
        </div>
        <div>
            <div className="px-3 text-xs font-black text-gray-600 uppercase tracking-widest mb-4">Settings</div>
            <div className="space-y-1">
                <button onClick={() => setActiveTab('pages')} className={`w-full flex items-center gap-3 p-4 rounded-2xl transition-all ${activeTab === 'pages' ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20 shadow-lg shadow-teal-500/10' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}>
                    <Building2 size={20} />
                    <span className="text-sm font-bold">Manage Pages</span>
                </button>
            </div>
        </div>
    </div>
);

export default function FacebookIntegrationTab(props: FacebookIntegrationTabProps) {
  return (
    <FacebookErrorBoundary>
      <InnerFacebookIntegrationTab {...props} />
    </FacebookErrorBoundary>
  );
}

function InnerFacebookIntegrationTab({ user, tenant }: FacebookIntegrationTabProps) {
    const router = useRouter();
    const urlSearch = useSearchParams();
    const { isMobile, isTablet, isDesktop } = useBreakpoint();
    
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
    const [leadSearchQuery, setLeadSearchQuery] = useState('');
    const [graphLeadResults, setGraphLeadResults] = useState<Array<Record<string, unknown>>>([]);
    const [searchingLeads, setSearchingLeads] = useState(false);
    const [reconnectRequired, setReconnectRequired] = useState(false);
    const [integrationLoadError, setIntegrationLoadError] = useState<string | null>(null);

    // Post form
    const [selectedPageId, setSelectedPageId] = useState('');
    const [postMessage, setPostMessage] = useState('');
    const [postLink, setPostLink] = useState('');
    const [postImageUrl, setPostImageUrl] = useState('');
    const [postImageFile, setPostImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState('');
    const [mediaSource, setMediaSource] = useState<'upload' | 'ai'>('upload');
    const [aiImagePrompt, setAiImagePrompt] = useState('');
    const [aiImageGenerating, setAiImageGenerating] = useState(false);
    const [aiGeneratedImageUrl, setAiGeneratedImageUrl] = useState<string | null>(null);
    const [attachingAiImage, setAttachingAiImage] = useState(false);
    const [posting, setPosting] = useState(false);
    const [scheduleAt, setScheduleAt] = useState('');
    const [scheduledPosts, setScheduledPosts] = useState<ScheduledSocialPost[]>([]);
    const [postHistory, setPostHistory] = useState<ScheduledSocialPost[]>([]);
    const [queueLoading, setQueueLoading] = useState(false);
    const [showMediaStudio, setShowMediaStudio] = useState(false);
    const [videoCoverFrameFile, setVideoCoverFrameFile] = useState<File | null>(null);
    const [videoCoverTimePct, setVideoCoverTimePct] = useState<number>(0);
    const [commentByPost, setCommentByPost] = useState<Record<string, string>>({});
    const [replyByComment, setReplyByComment] = useState<Record<string, string>>({});
    const [commentActionLoading, setCommentActionLoading] = useState<Record<string, boolean>>({});
    const [commentsByPost, setCommentsByPost] = useState<Record<string, any[]>>({});
    const [commentsLoadingByPost, setCommentsLoadingByPost] = useState<Record<string, boolean>>({});
    const [commentsErrorByPost, setCommentsErrorByPost] = useState<Record<string, string>>({});
    const [aiReplyLoading, setAiReplyLoading] = useState<Record<string, boolean>>({});
    const [postsNextCursor, setPostsNextCursor] = useState<string | null>(null);
    const [loadingMorePosts, setLoadingMorePosts] = useState(false);
    const [insightsByPost, setInsightsByPost] = useState<Record<string, { loading?: boolean; rows?: { name: string; values?: { value?: number }[] }[]; note?: string }>>({});
    const [capabilitiesByPage, setCapabilitiesByPage] = useState<Record<string, any>>({});
    const [pageInfoByPage, setPageInfoByPage] = useState<Record<string, any>>({});
    const [pageInfoLoadingByPage, setPageInfoLoadingByPage] = useState<Record<string, boolean>>({});
    const [pageInfoErrorByPage, setPageInfoErrorByPage] = useState<Record<string, string>>({});
    const [deletingPostById, setDeletingPostById] = useState<Record<string, boolean>>({});
    const [hashtags, setHashtags] = useState<string[]>([]);
    const [suggestedHashtags, setSuggestedHashtags] = useState<string[]>(['#AlphaClone', '#AItools', '#founders', '#productivity', '#automation']);
    const [activeQueueFilter, setActiveQueueFilter] = useState<'all' | 'published' | 'scheduled' | 'failed'>('all');
    const imageInputRef = useRef<HTMLInputElement>(null);
    
    const handleApplyMediaStudio = (file: File, meta?: any) => {
        setPostImageFile(file);
        setImagePreview(URL.createObjectURL(file));
        if (meta?.coverFrame) {
            setVideoCoverFrameFile(meta.coverFrame);
        }
        if (meta?.coverTimePct) {
            setVideoCoverTimePct(meta.coverTimePct);
        }
        toast.success("Media applied from studio");
    };

    // AI generation state
    const [showAiPanel, setShowAiPanel] = useState(false);
    const [aiTopic, setAiTopic] = useState('');
    const [aiTone, setAiTone] = useState<'engaging' | 'professional' | 'promotional' | 'casual'>('engaging');
    const [aiPostType, setAiPostType] = useState<'standard' | 'facebook_200_words' | 'linkedin_article'>('facebook_200_words');
    const [aiGenerating, setAiGenerating] = useState(false);

    const isConnected = pages.length > 0;
    const hasPublishablePage = pages.some((p) => !!p.page_access_token && !p.metadata?.no_pages);

    const getInitials = (name: string) => {
        if (!name) return '??';
        const cleanName = name.split('<')[0].trim();
        const parts = cleanName.split(' ').filter(p => p.length > 0);
        if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
        if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
        return '??';
    };

    /** Returns page count after fetch so callers (e.g. OAuth return) do not rely on async setState. */
    const loadData = useCallback(async (): Promise<{ activePageCount: number; pagesFetchError: string | null }> => {
        if (!user?.id) {
            setLoading(false);
            setIntegrationLoadError(null);
            return { activePageCount: 0, pagesFetchError: null };
        }
        setLoading(true);
        setIntegrationLoadError(null);
        const tenantId = tenant?.id;
        const leadsQuery = tenantId
            ? supabase
                  .from('facebook_leads')
                  .select('*')
                  .eq('tenant_id', tenantId)
                  .order('received_at', { ascending: false })
                  .limit(100)
            : Promise.resolve({ data: [] as FacebookLead[], error: null });
        const convQuery = tenantId
            ? supabase.from('messenger_conversations').select('id, is_read').eq('tenant_id', tenantId)
            : Promise.resolve({ data: [] as { id: string; is_read: boolean }[], error: null });

        const pagesQueryBase = supabase
            .from('facebook_integrations')
            .select('id,page_id,page_name,is_active,connected_at,page_access_token,metadata')
            .eq('user_id', user.id)
            .eq('is_active', true);

        const pagesQuery = tenantId ? pagesQueryBase.eq('tenant_id', tenantId) : pagesQueryBase;

        const [leadsRes, convRes] = await Promise.all([leadsQuery, convQuery]);
        let pagesRes = await pagesQuery;
        if (pagesRes.error && tenantId && /tenant_id/i.test(pagesRes.error.message)) {
            pagesRes = await pagesQueryBase;
        }

        if (pagesRes.error) {
            console.error('[Facebook] facebook_integrations select:', pagesRes.error);
            setIntegrationLoadError(pagesRes.error.message);
            setPages([]);
        } else {
            setIntegrationLoadError(null);
            const rows = pagesRes.data || [];
            setPages(rows);
            const preferred = rows.find((r: FacebookPage) => !!r.page_access_token && !r.metadata?.no_pages) || rows[0];
            if (preferred) setSelectedPageId(preferred.page_id);
        }
        if (!leadsRes.error) setLeads(leadsRes.data || []);
        if (!convRes.error) setConversations(convRes.data || []);
        setLoading(false);
        return {
            activePageCount: pagesRes.error ? 0 : (pagesRes.data || []).length,
            pagesFetchError: pagesRes.error?.message ?? null,
        };
    }, [user, tenant?.id]);

    const fetchActivity = useCallback(async (pageId: string) => {
        if (!pageId) return;
        setActivityLoading(true);
        try {
            const res = await fetch(`/api/facebook/activity?pageId=${pageId}`);
            if (res.status === 401 || res.status === 403) {
                setReconnectRequired(true);
                toast.error('Facebook session expired. Please re-connect.');
                return;
            }
            const data = await res.json();
            if (data.activity) setActivities(data.activity);
        } catch (err) {
            console.error('[Facebook] Failed to fetch activity:', err);
        } finally {
            setActivityLoading(false);
        }
    }, []);

    const fetchPagePosts = useCallback(async (pageId: string, after?: string | null) => {
        if (!pageId) return;
        const isAppend = !!after;
        if (isAppend) {
            setLoadingMorePosts(true);
        } else {
            setPostsLoading(true);
            setPostsNextCursor(null);
            setCommentsByPost({});
            setCommentsErrorByPost({});
        }
        try {
            const cursorQs = after ? `&after=${encodeURIComponent(after)}` : '';
            const res = await fetch(`/api/facebook/posts?pageId=${pageId}&limit=20${cursorQs}`);
            if (res.status === 401 || res.status === 403) {
                setReconnectRequired(true);
                toast.error('Facebook access denied. Re-authentication required.');
                return;
            }
            const data = await res.json();
            if (data.posts) {
                setPagePosts((prev) => (isAppend ? [...prev, ...data.posts] : data.posts));
            }
            const next = data.paging?.cursors?.next || null;
            setPostsNextCursor(typeof next === 'string' ? next : null);
            setReconnectRequired(false);
        } catch (err) {
            console.error('[Facebook] Failed to fetch page posts:', err);
        } finally {
            setPostsLoading(false);
            setLoadingMorePosts(false);
        }
    }, []);

    const loadPostComments = useCallback(async (postId: string) => {
        if (!selectedPageId) {
            toast.error('Select a Facebook Page first');
            return;
        }

        setCommentsLoadingByPost((prev) => ({ ...prev, [postId]: true }));
        setCommentsErrorByPost((prev) => ({ ...prev, [postId]: '' }));

        try {
            const res = await fetch(
                `/api/facebook/comments?pageId=${encodeURIComponent(selectedPageId)}&postId=${encodeURIComponent(postId)}&limit=50`
            );
            const data = await res.json();
            if (!res.ok || !data.success) {
                const message = data.error || 'Failed to load comments';
                setCommentsErrorByPost((prev) => ({ ...prev, [postId]: message }));
                toast.error(message);
                return;
            }

            const comments = Array.isArray(data.comments) ? data.comments : [];
            setCommentsByPost((prev) => ({ ...prev, [postId]: comments }));
            if (comments.length === 0) {
                toast('No comments found for this post.');
            }
        } catch {
            const message = 'Failed to load comments';
            setCommentsErrorByPost((prev) => ({ ...prev, [postId]: message }));
            toast.error(message);
        } finally {
            setCommentsLoadingByPost((prev) => ({ ...prev, [postId]: false }));
        }
    }, [selectedPageId]);

    const loadPostInsights = useCallback(
        async (postId: string) => {
            if (!selectedPageId) return;
            setInsightsByPost((prev) => ({ ...prev, [postId]: { ...prev[postId], loading: true } }));
            try {
                const res = await fetch(
                    `/api/facebook/post-insights?pageId=${encodeURIComponent(selectedPageId)}&postId=${encodeURIComponent(postId)}`
                );
                const data = await res.json();
                if (!res.ok || !data.success) {
                    setInsightsByPost((prev) => ({
                        ...prev,
                        [postId]: { loading: false, note: data.note || data.error || 'Insights unavailable', rows: [] },
                    }));
                    return;
                }
                setInsightsByPost((prev) => ({
                    ...prev,
                    [postId]: { loading: false, rows: data.insights || [], note: undefined },
                }));
            } catch {
                setInsightsByPost((prev) => ({
                    ...prev,
                    [postId]: { loading: false, note: 'Could not load insights', rows: [] },
                }));
            }
        },
        [selectedPageId]
    );

    const loadPageCapabilities = useCallback(async (pageId: string) => {
        if (!pageId) return;
        try {
            const res = await fetch(`/api/facebook/capabilities?pageId=${encodeURIComponent(pageId)}`);
            const data = await res.json();
            if (res.ok && data.success) {
                setCapabilitiesByPage((prev) => ({ ...prev, [pageId]: data }));
            }
        } catch (err) {
            console.error('[Facebook] Failed to load capabilities:', err);
        }
    }, []);

    const loadPageInfo = useCallback(async (pageId: string) => {
        if (!pageId) return;
        setPageInfoLoadingByPage((prev) => ({ ...prev, [pageId]: true }));
        setPageInfoErrorByPage((prev) => ({ ...prev, [pageId]: '' }));
        try {
            const res = await fetch(`/api/facebook/page-info?pageId=${encodeURIComponent(pageId)}`);
            if (res.status === 401 || res.status === 403) {
                setReconnectRequired(true);
                setPageInfoErrorByPage((prev) => ({ ...prev, [pageId]: 'Re-authentication required' }));
                return;
            }
            const data = await res.json();
            if (!res.ok || !data?.success) {
                setPageInfoErrorByPage((prev) => ({ ...prev, [pageId]: data?.error || 'Failed to load page info' }));
                return;
            }
            setPageInfoByPage((prev) => ({ ...prev, [pageId]: data.page }));
        } catch (err) {
            console.error('[Facebook] Failed to load page info:', err);
            setPageInfoErrorByPage((prev) => ({ ...prev, [pageId]: 'Failed to load page info' }));
        } finally {
            setPageInfoLoadingByPage((prev) => ({ ...prev, [pageId]: false }));
        }
    }, []);

    const deleteFacebookPost = useCallback(async (postId: string) => {
        if (!selectedPageId || !postId) return;
        if (!window.confirm('Delete this Facebook post from the connected Page?')) return;
        setDeletingPostById((prev) => ({ ...prev, [postId]: true }));
        try {
            const res = await fetch('/api/facebook/post/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pageId: selectedPageId, postId }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                if (data.action === 'reconnect') setReconnectRequired(true);
                toast.error(data.error || 'Failed to delete Facebook post');
                return;
            }
            setPagePosts((prev) => prev.filter((post) => post.id !== postId));
            toast.success('Facebook post deleted');
        } catch (err) {
            console.error('[Facebook] Delete post failed:', err);
            toast.error('Failed to delete Facebook post');
        } finally {
            setDeletingPostById((prev) => ({ ...prev, [postId]: false }));
        }
    }, [selectedPageId]);

    const loadScheduleQueue = useCallback(async () => {
        if (!tenant?.id) return;
        setQueueLoading(true);
        try {
            const res = await fetch(`/api/social/schedule?tenantId=${encodeURIComponent(tenant.id)}&pageId=${encodeURIComponent(selectedPageId)}`);
            const data = await res.json();
            if (Array.isArray(data.posts)) {
                const allPosts = data.posts as ScheduledSocialPost[];
                setScheduledPosts(
                    allPosts.filter((p: ScheduledSocialPost) =>
                        p.status === 'scheduled' || p.status === 'queued' || p.status === 'publishing' || p.status === 'failed'
                    )
                );
                setPostHistory(
                    allPosts.filter((p: ScheduledSocialPost) =>
                        p.status === 'published' || p.status === 'failed' || p.status === 'cancelled'
                    )
                );
            }
        } catch (err) {
            console.error('[Facebook] Failed to load social queue:', err);
        } finally {
            setQueueLoading(false);
        }
    }, [tenant?.id, selectedPageId]);

    useEffect(() => { loadData(); }, [loadData]);

    // OAuth return
    useEffect(() => {
        if (!urlSearch) return;
        const fbOk = urlSearch.get('fb_connected');
        const fbErr = urlSearch.get('fb_error');
        if (fbOk === 'true') {
            let cancelled = false;
            void (async () => {
                const { activePageCount, pagesFetchError } = await loadData();
                if (cancelled) return;
                if (pagesFetchError) {
                    toast.error(`Error: ${pagesFetchError}`);
                } else if (activePageCount === 0) {
                    toast.error('No active pages found.');
                } else {
                    toast.success('Facebook connected.');
                }
                router.replace('/dashboard/business/facebook', { scroll: false });
            })();
            return () => { cancelled = true; };
        }
        if (fbErr) {
            toast.error('Facebook connection failed.');
            router.replace('/dashboard/business/facebook', { scroll: false });
        }
    }, [urlSearch, router, loadData]);

    useEffect(() => {
        if (activeTab === 'posts' && selectedPageId) {
            fetchPagePosts(selectedPageId);
        }
    }, [activeTab, selectedPageId, fetchPagePosts]);

    useEffect(() => {
        if (selectedPageId) {
            void loadScheduleQueue();
            void loadPageCapabilities(selectedPageId);
            void loadPageInfo(selectedPageId);
        }
    }, [selectedPageId, loadScheduleQueue, loadPageCapabilities, loadPageInfo]);

    const duplicateMap = useMemo(() => {
        const counts: Record<string, number> = {};
        const allPosts = [...pagePosts, ...scheduledPosts];
        allPosts.forEach(p => {
            const msg = (p.message || p.caption || '').trim();
            if (msg) counts[msg] = (counts[msg] || 0) + 1;
        });
        return counts;
    }, [pagePosts, scheduledPosts]);

    const hasDuplicates = Object.values(duplicateMap).some((count: number) => count > 1);

    const handleConnect = () => {
        const tid = tenant?.id;
        const returnTo = encodeURIComponent('/dashboard/business/facebook');
        window.location.href = tid
            ? `/api/auth/facebook/connect?tenant_id=${encodeURIComponent(tid)}&return_to=${returnTo}`
            : `/api/auth/facebook/connect?return_to=${returnTo}`;
    };

    const handleDisconnect = async (pageId: string) => {
        if (!confirm('Disconnect this Facebook Page?')) return;
        const response = await fetch('/api/facebook/disconnect', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenantId: tenant?.id, pageId }) });
        if (response.ok) {
            toast.success('Page disconnected');
            loadData();
        } else toast.error('Page could not be disconnected');
    };

    const clearImage = () => {
        setPostImageFile(null);
        setVideoCoverFrameFile(null);
        setVideoCoverTimePct(0);
        setPostImageUrl('');
        setAiGeneratedImageUrl(null);
        setHashtags([]);
        if (imagePreview.startsWith('blob:')) URL.revokeObjectURL(imagePreview);
        setImagePreview('');
        if (imageInputRef.current) imageInputRef.current.value = '';
    };

    const generateAiImage = async () => {
        if (!aiImagePrompt.trim()) return toast.error('Describe the image');
        setAiImageGenerating(true);
        try {
            const res = await fetch('/api/ai/image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: aiImagePrompt, provider: 'grok', tenantId: tenant?.id }),
            });
            const data = await res.json();
            if (data.url) setAiGeneratedImageUrl(data.url);
            else toast.error('Generation failed');
        } catch { toast.error('Generation failed'); }
        finally { setAiImageGenerating(false); }
    };

    const attachGeneratedImage = async () => {
        if (!aiGeneratedImageUrl || !tenant?.id) return;
        setAttachingAiImage(true);
        const toastId = toast.loading('Saving AI image...');
        try {
            const sourceResponse = await fetch(aiGeneratedImageUrl);
            const sourceBlob = await sourceResponse.blob();
            const file = new File([sourceBlob], `facebook-ai-${Date.now()}.png`, { type: 'image/png' });
            const fd = new FormData();
            fd.append('file', file);
            fd.append('tenantId', tenant.id);
            const uploadRes = await fetch('/api/social/media/upload', { method: 'POST', body: fd });
            const uploadData = await uploadRes.json();
            if (uploadData?.asset?.public_url) {
                setPostImageUrl(uploadData.asset.public_url);
                setImagePreview(uploadData.asset.public_url);
                setAiGeneratedImageUrl(null);
                toast.success('AI image attached', { id: toastId });
            }
        } catch { toast.error('Failed to attach', { id: toastId }); }
        finally { setAttachingAiImage(false); }
    };

    const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setPostImageFile(file);
        setPostImageUrl('');
        setImagePreview(URL.createObjectURL(file));
    };

    const handlePost = async () => {
        if (!postMessage.trim()) return toast.error('Message is required');
        if (!selectedPageId) return toast.error('Select a Facebook Page');
        setPosting(true);
        const toastId = toast.loading('Posting to Facebook...');
        try {
            let res: Response;
            if (postImageFile) {
                let publicUrl = '';
                // First upload to Supabase storage directly from the client to avoid Vercel's 4.5MB request limit
                try {
                    const ext = postImageFile.name.split('.').pop() || 'bin';
                    const storagePath = `media/${tenant?.id || 'public'}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
                    
                    const { error: uploadError } = await supabase.storage
                        .from('public-assets')
                        .upload(storagePath, postImageFile, {
                            contentType: postImageFile.type,
                            upsert: false,
                        });
                    
                    if (uploadError) throw uploadError;
                    
                    const { data: urlData } = supabase.storage.from('public-assets').getPublicUrl(storagePath);
                    publicUrl = urlData.publicUrl;
                } catch (storageErr) {
                    console.warn('[Facebook Upload] Direct storage upload failed, trying API fallback:', storageErr);
                }

                const form = new FormData();
                form.append('pageId', selectedPageId);
                form.append('message', postMessage);
                if (publicUrl) {
                    form.append('fileUrl', publicUrl);
                    form.append('fileType', postImageFile.type);
                } else {
                    form.append('file', postImageFile);
                }
                res = await fetch('/api/facebook/upload-photo', { method: 'POST', body: form });
            } else {
                res = await fetch('/api/facebook/post', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ pageId: selectedPageId, message: postMessage, link: postLink || undefined, imageUrl: postImageUrl || undefined }),
                });
            }
            const data = await res.json();
            if (data.success) {
                toast.success('Posted!', { id: toastId });
                setPostMessage('');
                clearImage();
                setActiveTab('posts');
                setTimeout(() => fetchPagePosts(selectedPageId), 2000);
            } else toast.error(data.error || 'Failed', { id: toastId });
        } catch { toast.error('Failed', { id: toastId }); }
        finally { setPosting(false); }
    };

    const handleSchedulePost = async () => {
        if (!tenant?.id || !postMessage.trim() || !selectedPageId || !scheduleAt) return toast.error('All fields required');
        setPosting(true);
        const toastId = toast.loading('Scheduling...');
        try {
            const res = await fetch('/api/social/schedule', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tenantId: tenant.id,
                    caption: postMessage,
                    platforms: ['facebook'],
                    facebook_page_id: selectedPageId,
                    scheduled_at: new Date(scheduleAt).toISOString(),
                }),
            });
            if (res.ok) {
                toast.success('Scheduled!', { id: toastId });
                setScheduleAt('');
                setPostMessage('');
                clearImage();
                void loadScheduleQueue();
            }
        } catch { toast.error('Failed', { id: toastId }); }
        finally { setPosting(false); }
    };

<<<<<<< HEAD
    const handleAiGeneratePost = async () => {
        if (!aiTopic.trim()) return toast.error('Describe topic');
=======
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

    const handleFacebookComment = async (postId: string, parentCommentId?: string) => {
        if (!selectedPageId) {
            toast.error('Select a Facebook Page first');
            return;
        }
        const key = parentCommentId ? `reply-${parentCommentId}` : `post-${postId}`;
        const message = (parentCommentId ? replyByComment[parentCommentId] : commentByPost[postId])?.trim();
        if (!message) {
            toast.error(parentCommentId ? 'Write a reply first' : 'Write a comment first');
            return;
        }

        setCommentActionLoading((prev) => ({ ...prev, [key]: true }));
        try {
            const res = await fetch('/api/facebook/comment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pageId: selectedPageId,
                    postId: parentCommentId ? undefined : postId,
                    parentCommentId: parentCommentId || undefined,
                    message,
                }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                toast.error(data.error || 'Failed to publish comment');
                return;
            }

            if (parentCommentId) {
                setReplyByComment((prev) => ({ ...prev, [parentCommentId]: '' }));
                toast.success('Reply posted');
            } else {
                setCommentByPost((prev) => ({ ...prev, [postId]: '' }));
                toast.success('Comment posted');
            }

            await fetchPagePosts(selectedPageId);
        } catch {
            toast.error('Failed to publish comment');
        } finally {
            setCommentActionLoading((prev) => ({ ...prev, [key]: false }));
        }
    };

    const handleLike = async (targetId: string) => {
        if (!selectedPageId) {
            toast.error('Select a Facebook Page first');
            return;
        }
        
        const key = `like-${targetId}`;
        setCommentActionLoading((prev) => ({ ...prev, [key]: true }));
        try {
            const res = await fetch('/api/facebook/like', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pageId: selectedPageId,
                    targetId,
                }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                toast.error(data.error || 'Failed to like');
                return;
            }
            toast.success('Liked!');
            // Refresh posts to see updated counts if available
            await fetchPagePosts(selectedPageId);
        } catch {
            toast.error('Failed to like');
        } finally {
            setCommentActionLoading((prev) => ({ ...prev, [key]: false }));
        }
    };

    const generateFacebookQuickReply = async (post: any, parentCommentId?: string, parentCommentText?: string) => {
        const key = parentCommentId ? `reply-${parentCommentId}` : `post-${post.id}`;
        setAiReplyLoading((prev) => ({ ...prev, [key]: true }));
        try {
            const postText = String(post?.message || post?.story || '').slice(0, 1200);
            const parentContext = parentCommentText
                ? `Comment to reply to:\n${String(parentCommentText).slice(0, 700)}\n\n`
                : '';
            const prompt = `Write one short Facebook comment reply. Tone: witty, friendly, light humor, professional-safe. Max 220 characters.

Post context:
${postText}

${parentContext}Return only the reply text.`;

            const res = await fetch('/api/ai/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt,
                    model: 'grok-2-latest',
                    temperature: 0.95,
                    maxTokens: 120,
                    tenantId: tenant?.id || undefined,
                }),
            });
            const data = await res.json();
            if (!res.ok || !data.text) {
                toast.error(data.error || 'Failed to generate AI reply');
                return;
            }
            if (parentCommentId) {
                setReplyByComment((prev) => ({ ...prev, [parentCommentId]: String(data.text).trim() }));
            } else {
                setCommentByPost((prev) => ({ ...prev, [post.id]: String(data.text).trim() }));
            }
            toast.success('AI quick reply ready');
        } catch {
            toast.error('Failed to generate AI reply');
        } finally {
            setAiReplyLoading((prev) => ({ ...prev, [key]: false }));
        }
    };

    const generatePostWithAI = async () => {
        if (!aiTopic.trim()) return toast.error('Describe your post topic first');
>>>>>>> d657f822 (feat: implement Autonomous Business Operator suite with Grok, Claude, and OpenAI strengths-based routing)
        setAiGenerating(true);
        try {
            const res = await fetch('/api/ai/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: `Write a ${aiTone} Facebook post about ${aiTopic}`, maxTokens: 300 }),
            });
            const data = await res.json();
            if (data.text) {
                setPostMessage(data.text.trim());
                setShowAiPanel(false);
            }
        } catch { toast.error('AI failed'); }
        finally { setAiGenerating(false); }
    };

    const filteredLeads = statusFilter === 'all' ? leads : leads.filter(l => l.status === statusFilter);

    const handleLeadSearch = async () => {
        if (!tenant?.id) return;
        setSearchingLeads(true);
        try {
            const res = await fetch(
                `/api/facebook/leads/search?tenantId=${encodeURIComponent(tenant.id)}&q=${encodeURIComponent(leadSearchQuery.trim())}`
            );
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.error || 'Search failed');
            setLeads(data.local || []);
            setGraphLeadResults(data.graph || []);
            toast.success(`Found ${data.total || 0} Facebook lead(s)`);
        } catch (err: any) {
            toast.error(err.message || 'Facebook lead search failed');
        } finally {
            setSearchingLeads(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-6 h-6 animate-spin text-teal-400" />
            </div>
        );
    }

    return (
        <div className={`flex flex-col bg-[#0f0f0f] rounded-2xl md:rounded-3xl border border-white/5 overflow-hidden backdrop-blur-sm relative ${isMobile ? 'h-auto min-h-[calc(100dvh-120px)]' : 'h-[calc(100dvh-140px)]'}`}>
            {!isConnected && (
                <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-xl flex items-center justify-center p-8 text-center">
                    <div className="max-w-md space-y-8">
                        <div className="w-24 h-24 bg-blue-600/20 rounded-[32px] flex items-center justify-center mx-auto border border-blue-500/30">
                            <Facebook className="w-12 h-12 text-blue-400" />
                        </div>
                        <div className="space-y-3">
                            <h2 className="text-3xl font-black text-white leading-tight">Sync Facebook</h2>
                            <p className="text-slate-400 text-sm leading-relaxed px-4">
                                Automate your content, manage leads, and respond to customers directly from AlphaClone.
                            </p>
                        </div>
                        <button
                            onClick={handleConnect}
                            className="w-full py-5 bg-teal-600 hover:bg-teal-500 text-white rounded-2xl font-bold shadow-2xl shadow-teal-900/40 transition-all active:scale-95 flex items-center justify-center gap-3 text-lg"
                        >
                            <Facebook size={24} />
                            Connect Meta Account
                        </button>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="h-20 border-b border-white/5 bg-[#141414] px-4 sm:px-6 flex items-center justify-between z-10 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 bg-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-teal-600/20">
                        <Facebook size={24} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-sm font-black tracking-widest text-white uppercase truncate max-w-[120px] sm:max-w-none">Facebook</h1>
                        <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                            <span className="text-xs text-teal-400 font-bold uppercase">{isConnected ? 'Active' : 'Offline'}</span>
                        </div>
                    </div>
                </div>
                
                <div className="flex items-center gap-3">
                    {isConnected && !isMobile && (
                        <div className="flex items-center gap-2 bg-black/40 px-3 py-2 rounded-xl border border-white/5">
                            <Users size={14} className="text-teal-400" />
                            <select 
                                value={selectedPageId}
                                onChange={(e) => setSelectedPageId(e.target.value)}
                                className="bg-transparent text-xs font-bold text-gray-300 outline-none cursor-pointer pr-2"
                            >
                                {pages.map(p => (
                                    <option key={p.page_id} value={p.page_id} className="bg-[#141414]">{p.page_name}</option>
                                ))}
                            </select>
                        </div>
                    )}
                    <button 
                        onClick={handleConnect}
                        className="w-11 h-11 sm:w-auto sm:px-4 sm:py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-bold border border-white/10 transition-all flex items-center justify-center gap-2"
                    >
                        <RefreshCw size={16} />
                        <span className="hidden sm:inline">Sync</span>
                    </button>
                </div>
            </div>

            {/* Main Content Areas */}
            <div className="flex flex-1 overflow-hidden relative">
                {/* Desktop Sidebar */}
                {!isMobile && (
                    <div className="w-72 flex flex-col bg-[#0a0a0a] overflow-y-auto custom-scrollbar border-r border-white/5 p-4 shrink-0">
                        <SidebarContent 
                            activeTab={activeTab} 
                            setActiveTab={setActiveTab} 
                            leadsCount={leads.length} 
                            isMobile={isMobile} 
                        />
                    </div>
                )}

                {/* Main Content Area */}
                <div className="flex-1 flex flex-col bg-[#0f0f0f] overflow-y-auto custom-scrollbar p-4 sm:p-8 pb-32">
                    <div className="max-w-5xl mx-auto w-full space-y-8">
                        {/* Tab Switcher for Mobile */}
                        {isMobile && (
                            <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar -mx-4 px-4 scroll-smooth">
                                {(['leads', 'messenger', 'posts', 'post', 'pages'] as const).map((tab) => (
                                    <button
                                        key={tab}
                                        onClick={() => setActiveTab(tab)}
                                        className={`px-5 py-3 rounded-xl text-xs font-black border whitespace-nowrap transition-all ${
                                            activeTab === tab
                                                ? 'bg-teal-600 border-teal-500 text-white shadow-lg shadow-teal-900/20'
                                                : 'bg-white/5 border-white/5 text-gray-500 hover:text-gray-300'
                                        }`}
                                    >
                                        {TAB_LABELS[tab]}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Leads View */}
                        {activeTab === 'leads' && (
                            <div className="space-y-6">
                                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                                    <div className="relative flex-1">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                        <input
                                            value={leadSearchQuery}
                                            onChange={(e) => setLeadSearchQuery(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && void handleLeadSearch()}
                                            placeholder="Search Facebook leads by name, email, phone, company…"
                                            className="w-full pl-10 pr-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white text-sm placeholder:text-slate-500 focus:border-teal-500/50 outline-none"
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => void handleLeadSearch()}
                                        disabled={searchingLeads}
                                        className="px-5 py-3 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {searchingLeads ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                                        Search
                                    </button>
                                </div>
                                <div className="flex items-center justify-between">
                                    <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-3">
                                        <Users className="text-blue-500" />
                                        Recent Leads
                                    </h2>
                                    <div className="flex items-center gap-2 bg-black/40 p-1 rounded-xl border border-white/5">
                                        {['all', 'new', 'qualified'].map(f => (
                                            <button 
                                                key={f}
                                                onClick={() => setStatusFilter(f)}
                                                className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest ${statusFilter === f ? 'bg-white/10 text-white' : 'text-gray-600'}`}
                                            >
                                                {f}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-4">
                                    {filteredLeads.map(lead => (
                                        <div key={lead.id} className="bg-[#141414] border border-white/5 rounded-3xl p-5 sm:p-6 transition-all hover:border-white/10 group">
                                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-teal-600/10 border border-teal-500/20 flex items-center justify-center text-teal-400 font-black text-lg">
                                                        {getInitials(`${lead.first_name} ${lead.last_name}`)}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <h4 className="text-base font-black text-white truncate">{lead.first_name} {lead.last_name}</h4>
                                                        <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">{lead.company || 'Private Individual'}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                                                    <span className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase border ${STATUS_COLORS[lead.status] || STATUS_COLORS.new}`}>
                                                        {lead.status}
                                                    </span>
                                                    <button className="w-11 h-11 flex items-center justify-center rounded-xl bg-white/5 text-white sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <ChevronRight size={20} />
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="mt-4 pt-4 border-t border-white/5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                <div className="flex items-center gap-3 text-xs text-gray-400 bg-black/20 p-3 rounded-xl border border-white/5">
                                                    <Mail size={14} className="text-blue-500" />
                                                    <span className="truncate">{lead.email}</span>
                                                </div>
                                                <div className="flex items-center gap-3 text-xs text-gray-400 bg-black/20 p-3 rounded-xl border border-white/5">
                                                    <Phone size={14} className="text-green-500" />
                                                    <span>{lead.phone || 'No phone'}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {filteredLeads.length === 0 && graphLeadResults.length === 0 && (
                                        <p className="text-sm text-slate-500 text-center py-8">No leads yet. Connect Facebook and run a search above.</p>
                                    )}
                                </div>
                                {graphLeadResults.length > 0 && (
                                    <div className="space-y-3">
                                        <h3 className="text-sm font-black uppercase tracking-wider text-slate-400">Live from Facebook Graph</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {graphLeadResults.map((g, idx) => (
                                                <div key={String(g.lead_id || idx)} className="bg-[#141414] border border-blue-500/20 rounded-2xl p-4">
                                                    <p className="font-bold text-white">{String(g.name || 'Lead')}</p>
                                                    <p className="text-xs text-slate-400 mt-1">{String(g.email || 'No email')} · {String(g.phone || 'No phone')}</p>
                                                    <p className="text-[10px] text-slate-500 mt-2">{String(g.form_name || 'Lead form')} · {String(g.page_name || 'Facebook')}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Compose View */}
                        {activeTab === 'post' && (
                            <div className="max-w-2xl mx-auto w-full space-y-6">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-xl font-black text-white uppercase tracking-tight">Create Post</h2>
                                    <button onClick={() => setShowAiPanel(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-black uppercase shadow-lg shadow-blue-600/20 active:scale-95 transition-all">
                                        <Sparkles size={14} />
                                        AI Writer
                                    </button>
                                </div>

                                <div className="space-y-6 bg-[#141414] border border-white/5 rounded-[32px] p-6 sm:p-8">
                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-gray-600 uppercase tracking-widest px-2">Page Selection</label>
                                        <div className="flex flex-wrap gap-2">
                                            {pages.map(p => (
                                                <button 
                                                    key={p.page_id}
                                                    onClick={() => setSelectedPageId(p.page_id)}
                                                    className={`h-12 px-4 rounded-xl text-xs font-black border transition-all ${selectedPageId === p.page_id ? 'bg-blue-600 border-blue-500 text-white shadow-lg' : 'bg-white/5 border-white/10 text-gray-500'}`}
                                                >
                                                    {p.page_name}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <textarea
                                            value={postMessage}
                                            onChange={(e) => setPostMessage(e.target.value)}
                                            placeholder="What's happening on your page?"
                                            className="w-full bg-black/40 border border-white/5 rounded-2xl p-5 text-base text-white min-h-[200px] outline-none focus:border-blue-500/50 transition-all resize-none"
                                        />
                                        
                                        {imagePreview && (
                                            <div className="relative rounded-2xl overflow-hidden aspect-video group border border-white/10">
                                                <img src={imagePreview} alt="" className="w-full h-full object-cover" />
                                                <button onClick={clearImage} className="absolute top-4 right-4 w-11 h-11 bg-black/60 backdrop-blur-md rounded-full text-white flex items-center justify-center border border-white/20">
                                                    <X size={24} />
                                                </button>
                                            </div>
                                        )}

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <button 
                                                onClick={() => imageInputRef.current?.click()}
                                                className="flex items-center justify-center gap-3 py-4 bg-white/5 hover:bg-white/10 text-white rounded-2xl text-sm font-bold border border-white/10 transition-all"
                                            >
                                                <Image size={20} />
                                                Add Media
                                            </button>
                                            <input type="file" ref={imageInputRef} onChange={handleImageFileChange} className="hidden" accept="image/*,video/*" />
                                            
                                            <div className="relative">
                                                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={20} />
                                                <input 
                                                    type="datetime-local"
                                                    value={scheduleAt}
                                                    onChange={(e) => setScheduleAt(e.target.value)}
                                                    className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-sm text-white outline-none focus:border-blue-500/50 [color-scheme:dark]"
                                                />
                                            </div>
                                        </div>

                                        <div className="pt-6 border-t border-white/5 flex flex-col sm:flex-row gap-4">
                                            <button 
                                                onClick={handleSchedulePost}
                                                disabled={posting || !scheduleAt}
                                                className="flex-1 py-5 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-black uppercase text-sm border border-white/10 disabled:opacity-50 transition-all"
                                            >
                                                Schedule Post
                                            </button>
                                            <button 
                                                onClick={handlePost}
                                                disabled={posting}
                                                className="flex-[2] py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black uppercase text-sm shadow-2xl shadow-blue-900/40 disabled:opacity-50 transition-all flex items-center justify-center gap-3"
                                            >
                                                {posting ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                                                Publish Now
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'messenger' && (
                            <MessengerInbox />
                        )}

                        {activeTab === 'posts' && (
                            <div className="space-y-6">
                                <div className="flex flex-col gap-4 rounded-[28px] border border-white/5 bg-[#141414] p-5 sm:p-6">
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                        <div>
                                            <h2 className="text-xl font-black text-white uppercase tracking-tight">Page Posts</h2>
                                            <p className="text-sm text-gray-500">Live posts, queued items, and publish diagnostics for the selected page.</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => {
                                                    void loadScheduleQueue();
                                                    if (selectedPageId) void fetchPagePosts(selectedPageId);
                                                }}
                                                className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-black uppercase text-white"
                                            >
                                                <RefreshCw size={14} className={(postsLoading || queueLoading) ? 'animate-spin' : ''} />
                                                Refresh
                                            </button>
                                        </div>
                                    </div>

                                    {reconnectRequired && (
                                        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                                            Facebook access needs attention. Reconnect the page to resume publishing and inbox sync.
                                        </div>
                                    )}

                                    {selectedPageId && capabilitiesByPage[selectedPageId] && (
                                        <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
                                            <div className="mb-3 flex items-center justify-between gap-3">
                                                <div>
                                                    <p className="text-xs font-black uppercase tracking-widest text-gray-500">Granted Page Capabilities</p>
                                                    <p className="mt-1 text-sm text-gray-300">{capabilitiesByPage[selectedPageId].note}</p>
                                                </div>
                                                <span className="rounded-lg border border-blue-500/20 bg-blue-500/10 px-2 py-1 text-xs font-black uppercase text-blue-200">
                                                    {capabilitiesByPage[selectedPageId].scope_mode}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                                {Object.entries(capabilitiesByPage[selectedPageId].capabilities || {}).map(([key, enabled]) => (
                                                    <div key={key} className={`rounded-xl border px-3 py-2 text-xs ${enabled ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200' : 'border-rose-500/20 bg-rose-500/10 text-rose-200'}`}>
                                                        <span className="font-black uppercase">{String(key).replace(/_/g, ' ')}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {selectedPageId && (
                                        <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
                                            <div className="mb-3 flex items-center justify-between gap-3">
                                                <div>
                                                    <p className="text-xs font-black uppercase tracking-widest text-gray-500">Page Profile</p>
                                                    <p className="mt-1 text-sm text-gray-300">
                                                        {pageInfoErrorByPage[selectedPageId]
                                                            ? pageInfoErrorByPage[selectedPageId]
                                                            : pageInfoByPage[selectedPageId]?.name || 'Loading page details...'}
                                                    </p>
                                                </div>
                                                {pageInfoByPage[selectedPageId]?.picture?.data?.url && (
                                                    <img
                                                        src={pageInfoByPage[selectedPageId].picture.data.url}
                                                        alt=""
                                                        className="h-10 w-10 rounded-xl border border-white/10 object-cover"
                                                    />
                                                )}
                                            </div>
                                            {pageInfoLoadingByPage[selectedPageId] ? (
                                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                                    <Loader2 size={14} className="animate-spin" />
                                                    Loading...
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                                    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-gray-300">
                                                        <span className="block text-[10px] font-black uppercase tracking-widest text-gray-500">Followers</span>
                                                        <span className="mt-1 block text-sm font-black text-white">
                                                            {Number(pageInfoByPage[selectedPageId]?.followers_count || 0).toLocaleString()}
                                                        </span>
                                                    </div>
                                                    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-gray-300">
                                                        <span className="block text-[10px] font-black uppercase tracking-widest text-gray-500">Talking</span>
                                                        <span className="mt-1 block text-sm font-black text-white">
                                                            {Number(pageInfoByPage[selectedPageId]?.talking_about_count || 0).toLocaleString()}
                                                        </span>
                                                    </div>
                                                    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-gray-300">
                                                        <span className="block text-[10px] font-black uppercase tracking-widest text-gray-500">Category</span>
                                                        <span className="mt-1 block truncate text-sm font-black text-white">
                                                            {String(pageInfoByPage[selectedPageId]?.category || '—')}
                                                        </span>
                                                    </div>
                                                    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-gray-300">
                                                        <span className="block text-[10px] font-black uppercase tracking-widest text-gray-500">Username</span>
                                                        <span className="mt-1 block truncate text-sm font-black text-white">
                                                            {pageInfoByPage[selectedPageId]?.username ? `@${pageInfoByPage[selectedPageId].username}` : '—'}
                                                        </span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <div className="flex flex-wrap gap-2">
                                        {pages.map((p) => (
                                            <button
                                                key={p.page_id}
                                                onClick={() => setSelectedPageId(p.page_id)}
                                                className={`rounded-xl border px-4 py-2 text-xs font-black uppercase transition-all ${
                                                    selectedPageId === p.page_id
                                                        ? 'border-blue-500 bg-blue-600 text-white'
                                                        : 'border-white/10 bg-white/5 text-gray-400'
                                                }`}
                                            >
                                                {p.page_name}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid gap-6 lg:grid-cols-[0.95fr,1.05fr]">
                                    <div className="space-y-4 rounded-[28px] border border-white/5 bg-[#141414] p-5 sm:p-6">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-sm font-black uppercase tracking-widest text-white">Queue</h3>
                                            <div className="flex gap-2">
                                                {(['all', 'scheduled', 'published', 'failed'] as const).map((filter) => (
                                                    <button
                                                        key={filter}
                                                        onClick={() => setActiveQueueFilter(filter)}
                                                        className={`rounded-lg px-3 py-1 text-xs font-black uppercase ${
                                                            activeQueueFilter === filter ? 'bg-white/10 text-white' : 'text-gray-500'
                                                        }`}
                                                    >
                                                        {filter}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {queueLoading ? (
                                            <div className="flex items-center justify-center py-16 text-gray-500">
                                                <Loader2 className="animate-spin" size={20} />
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                {[...scheduledPosts, ...postHistory]
                                                    .filter((post) => activeQueueFilter === 'all' || post.status === activeQueueFilter)
                                                    .slice(0, 8)
                                                    .map((post) => (
                                                        <div key={post.id} className="rounded-2xl border border-white/5 bg-black/20 p-4">
                                                            <div className="mb-2 flex items-center justify-between gap-3">
                                                                <span className="truncate text-xs font-black uppercase tracking-widest text-white">
                                                                    {post.status}
                                                                </span>
                                                                <span className="text-xs text-gray-500">
                                                                    {new Date(post.scheduled_at || post.created_at).toLocaleString()}
                                                                </span>
                                                            </div>
                                                            <p className="line-clamp-3 text-sm text-gray-300">{post.caption}</p>
                                                            {post.error_message && (
                                                                <p className="mt-2 text-xs text-rose-300">{post.error_message}</p>
                                                            )}
                                                        </div>
                                                    ))}
                                                {scheduledPosts.length === 0 && postHistory.length === 0 && (
                                                    <div className="rounded-2xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-gray-500">
                                                        No posts in the publishing queue yet.
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-4 rounded-[28px] border border-white/5 bg-[#141414] p-5 sm:p-6">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-sm font-black uppercase tracking-widest text-white">Recent Feed</h3>
                                            {postsNextCursor && (
                                                <button
                                                    onClick={() => {
                                                        if (selectedPageId && postsNextCursor) void fetchPagePosts(selectedPageId, postsNextCursor);
                                                    }}
                                                    disabled={loadingMorePosts}
                                                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-black uppercase text-white disabled:opacity-50"
                                                >
                                                    {loadingMorePosts ? 'Loading...' : 'Load More'}
                                                </button>
                                            )}
                                        </div>

                                        {postsLoading && pagePosts.length === 0 ? (
                                            <div className="flex items-center justify-center py-16 text-gray-500">
                                                <Loader2 className="animate-spin" size={20} />
                                            </div>
<<<<<<< HEAD
                                        ) : (
                                            <div className="space-y-4">
                                                {pagePosts.map((post: any) => (
                                                    <div key={post.id} className="rounded-2xl border border-white/5 bg-black/20 p-4">
                                                        <div className="mb-3 flex items-start justify-between gap-3">
                                                            <div>
                                                                <p className="text-xs font-black uppercase tracking-widest text-gray-500">
                                                                    {post.created_time ? new Date(post.created_time).toLocaleString() : 'Recent'}
                                                                </p>
                                                                <p className="mt-2 whitespace-pre-wrap text-sm text-gray-200">
                                                                    {post.message || post.story || 'Post published without text.'}
                                                                </p>
                                                            </div>
                                                            {duplicateMap[(post.message || '').trim()] > 1 && (
                                                                <span className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-xs font-black uppercase text-amber-200">
                                                                    Duplicate copy
                                                                </span>
                                                            )}
                                                        </div>

                                                        {post.full_picture && (
                                                            <img src={post.full_picture} alt="" className="mb-3 max-h-72 w-full rounded-2xl object-cover" />
=======
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
                                <div className="mb-3 flex items-center justify-between">
                                    <h4 className="text-sm font-semibold text-white">Post History</h4>
                                    <span className="text-xs text-slate-500">Tracks published, failed, and cancelled</span>
                                </div>
                                {queueLoading ? (
                                    <div className="flex items-center gap-2 text-sm text-slate-400">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Loading history...
                                    </div>
                                ) : postHistory.length === 0 ? (
                                    <p className="text-sm text-slate-500">No post history yet.</p>
                                ) : (
                                    <div className="space-y-2">
                                        {postHistory.slice(0, 12).map((item) => (
                                            <div key={`history-${item.id}`} className="rounded-xl border border-slate-800 p-3">
                                                <div className="mb-1 flex items-center justify-between gap-2">
                                                    <span className="text-xs uppercase tracking-wide text-slate-400">{item.status}</span>
                                                    <span className="text-xs text-slate-500">
                                                        {new Date(item.created_at).toLocaleString()}
                                                    </span>
                                                </div>
                                                <p className="line-clamp-2 text-sm text-slate-200">{item.caption}</p>
                                                {item.error_message && (
                                                    <p className="mt-1 text-xs text-red-400">{item.error_message}</p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
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
                                            <p className="text-[11px] text-slate-400">
                                                {page.metadata?.no_pages || !page.page_access_token
                                                    ? 'Personal account connection (read-only tools)'
                                                    : 'Facebook Page connection (publishing enabled)'}
                                            </p>
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
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                <div>
                                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                        <Activity className="w-5 h-5 text-blue-400" />
                                        Your Page Posts
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-0.5">Live feed from your Facebook page — saved to your CRM</p>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
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
                                                            onError={(e) => {
                                                                // Suppress broken Facebook CDN images that cause 403 console errors
                                                                (e.target as HTMLImageElement).parentElement?.remove();
                                                            }}
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
                                                            {post.created_time ? new Date(post.created_time).toLocaleDateString() : ''}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm text-slate-200 line-clamp-3 mb-3 leading-relaxed">
                                                        {post.message || post.story || <span className="italic text-slate-500">No text content</span>}
                                                    </p>
                                                    <div className="flex items-center gap-4 flex-wrap">
                                                         <div className="flex items-center gap-1.5 text-xs text-slate-400">
1529:                                                             <button 
1530:                                                                 onClick={() => handleLike(post.id)}
1531:                                                                 disabled={!!commentActionLoading[`like-${post.id}`]}
1532:                                                                 className="hover:scale-110 active:scale-95 transition-transform"
1533:                                                             >
1534:                                                                 {commentActionLoading[`like-${post.id}`] ? '⏳' : '👍'}
1535:                                                             </button>
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
>>>>>>> d657f822 (feat: implement Autonomous Business Operator suite with Grok, Claude, and OpenAI strengths-based routing)
                                                        )}

                                                        <div className="flex flex-wrap gap-2">
                                                            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black uppercase text-white">
                                                                Reach {post.insights?.post_impressions_unique ?? post.reactions?.summary?.total_count ?? 0}
                                                            </div>
                                                            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black uppercase text-white">
                                                                Comments {post.comments?.summary?.total_count ?? 0}
                                                            </div>
                                                            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black uppercase text-white">
                                                                Shares {post.shares?.count ?? 0}
                                                            </div>
                                                            <button
                                                                onClick={() => loadPostComments(post.id)}
                                                                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black uppercase text-white"
                                                            >
                                                                Comments
                                                            </button>
                                                            <button
                                                                onClick={() => loadPostInsights(post.id)}
                                                                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black uppercase text-white"
                                                            >
                                                                Insights
                                                            </button>
                                                            {post.permalink_url && (
                                                                <a
                                                                    href={post.permalink_url}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black uppercase text-white"
                                                                >
                                                                    Open Post
                                                                </a>
                                                            )}
                                                            <button
                                                                onClick={() => deleteFacebookPost(post.id)}
                                                                disabled={!!deletingPostById[post.id]}
                                                                className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs font-black uppercase text-rose-200 disabled:opacity-50"
                                                            >
                                                                <Trash2 className="mr-1 inline h-3 w-3" />
                                                                {deletingPostById[post.id] ? 'Deleting' : 'Delete'}
                                                            </button>
                                                        </div>

<<<<<<< HEAD
                                                        {commentsLoadingByPost[post.id] && (
                                                            <div className="mt-3 text-xs text-gray-500">Loading comments...</div>
                                                        )}
                                                        {commentsErrorByPost[post.id] && (
                                                            <div className="mt-3 text-xs text-rose-300">{commentsErrorByPost[post.id]}</div>
                                                        )}
                                                        {commentsByPost[post.id]?.length > 0 && (
                                                            <div className="mt-3 space-y-2">
                                                                {commentsByPost[post.id].slice(0, 3).map((comment: any) => (
                                                                    <div key={comment.id} className="rounded-xl border border-white/5 bg-white/[0.03] p-3 text-sm text-gray-300">
                                                                        <div className="mb-1 text-xs font-black uppercase tracking-widest text-gray-500">
                                                                            {comment.from?.name || 'Comment'}
=======
                                                        {(post.comments?.data || []).length > 0 ? (
                                                            <div className="space-y-2">
                                                                {(post.comments?.data || []).slice(0, 5).map((comment: any) => (
                                                                    <div key={comment.id} className="rounded-lg border border-slate-800 bg-slate-900/70 p-2.5">
                                                                        <p className="text-xs text-slate-200">
                                                                            <span className="font-semibold text-slate-300">
                                                                                {comment.from?.name || 'User'}:
                                                                            </span>{' '}
                                                                            {comment.message || ''}
                                                                        </p>
                                                                        <div className="mt-2 flex gap-2">
                                                                            <input
                                                                                value={replyByComment[comment.id] || ''}
                                                                                onChange={(e) =>
                                                                                    setReplyByComment((prev) => ({
                                                                                        ...prev,
                                                                                        [comment.id]: e.target.value,
                                                                                    }))
                                                                                }
                                                                                placeholder="Reply to this comment..."
                                                                                className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                                                                            />
                                                                            <button
                                                                                onClick={() => void handleFacebookComment(post.id, comment.id)}
                                                                                disabled={!!commentActionLoading[`reply-${comment.id}`]}
                                                                                className="rounded-lg bg-slate-700 px-2.5 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-600 disabled:opacity-50"
                                                                            >
                                                                                {commentActionLoading[`reply-${comment.id}`] ? 'Replying...' : 'Reply'}
                                                                            </button>
                                                                             <button
                                                                                 onClick={() =>
                                                                                     void generateFacebookQuickReply(
                                                                                         post,
                                                                                         comment.id,
                                                                                         comment.message
                                                                                     )
                                                                                 }
                                                                                 disabled={!!aiReplyLoading[`reply-${comment.id}`]}
                                                                                 className="rounded-lg bg-violet-600/20 border border-violet-500/30 px-2.5 py-1.5 text-xs font-semibold text-violet-300 hover:bg-violet-600/30 disabled:opacity-50"
                                                                             >
                                                                                 {aiReplyLoading[`reply-${comment.id}`] ? 'Generating...' : 'AI Reply'}
                                                                             </button>
                                                                             <button
                                                                                 onClick={() => handleLike(comment.id)}
                                                                                 disabled={!!commentActionLoading[`like-${comment.id}`]}
                                                                                 className="p-1.5 rounded-lg bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 transition-colors"
                                                                             >
                                                                                 {commentActionLoading[`like-${comment.id}`] ? <Loader2 className="w-3 h-3 animate-spin" /> : '👍'}
                                                                             </button>
>>>>>>> d657f822 (feat: implement Autonomous Business Operator suite with Grok, Claude, and OpenAI strengths-based routing)
                                                                        </div>
                                                                        {comment.message || 'No comment text returned.'}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                        {insightsByPost[post.id]?.rows && insightsByPost[post.id].rows!.length > 0 && (
                                                            <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                                                {insightsByPost[post.id].rows!.slice(0, 4).map((row) => (
                                                                    <div key={row.name} className="rounded-xl border border-white/5 bg-white/[0.03] p-3">
                                                                        <div className="text-xs font-black uppercase tracking-widest text-gray-500">{row.name}</div>
                                                                        <div className="mt-1 text-sm text-white">{row.values?.[0]?.value ?? 0}</div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                        {insightsByPost[post.id]?.note && (
                                                            <div className="mt-3 text-xs text-gray-500">{insightsByPost[post.id]?.note}</div>
                                                        )}
                                                    </div>
                                                ))}

                                                {pagePosts.length === 0 && (
                                                    <div className="rounded-2xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-gray-500">
                                                        No page posts returned yet for this page.
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Bottom Status Bar for Mobile - Positioned above BottomNav to avoid collision */}
            {isMobile && isConnected && (
                <div className="absolute bottom-0 left-0 right-0 bg-[#0a0a0a]/95 border-t border-white/10 px-6 py-4 flex items-center justify-between z-[40] backdrop-blur-xl native-bottom-bar">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse" />
                        <span className="text-xs font-black text-gray-400 uppercase tracking-widest truncate max-w-[120px]">
                            {pages.find(p => p.page_id === selectedPageId)?.page_name || 'No Page'}
                        </span>
                    </div>
                    <button onClick={() => setActiveTab('pages')} className="text-xs font-black text-teal-400 uppercase tracking-widest py-2 px-4 bg-teal-500/10 rounded-lg border border-teal-500/20">Switch Page</button>
                </div>
            )}

            {/* AI Overlay */}
            <AnimatePresence>
                {showAiPanel && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[1100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6"
                    >
                        <motion.div 
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="bg-[#141414] border border-white/10 w-full max-w-lg rounded-[32px] overflow-hidden shadow-2xl relative"
                        >
                            <div className="p-6 sm:p-8 border-b border-white/5 flex items-center justify-between bg-black/20">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-teal-600/20 rounded-xl flex items-center justify-center">
                                        <Sparkles className="w-5 h-5 text-teal-400" />
                                    </div>
                                    <h3 className="text-lg font-black text-white uppercase tracking-tight">AI Writer</h3>
                                </div>
                                <button onClick={() => setShowAiPanel(false)} className="w-11 h-11 flex items-center justify-center rounded-full bg-white/5 text-gray-400 hover:text-white transition-colors">
                                    <X size={24} />
                                </button>
                            </div>
                            <div className="p-6 sm:p-8 space-y-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-gray-600 uppercase tracking-widest px-2">Post Topic</label>
                                    <input 
                                        type="text" 
                                        value={aiTopic}
                                        onChange={(e) => setAiTopic(e.target.value)}
                                        placeholder="What should the post be about?"
                                        className="w-full bg-black/40 border border-white/5 rounded-2xl px-5 py-4 text-sm text-white outline-none focus:border-blue-500/50 transition-all"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-gray-600 uppercase tracking-widest px-2">Tone</label>
                                        <select 
                                            value={aiTone}
                                            onChange={(e) => setAiTone(e.target.value as any)}
                                            className="w-full h-14 bg-black/40 border border-white/5 rounded-2xl px-4 text-sm text-white outline-none focus:border-blue-500/50"
                                        >
                                            <option value="engaging">Engaging</option>
                                            <option value="professional">Professional</option>
                                            <option value="casual">Casual</option>
                                            <option value="promotional">Promotional</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-gray-600 uppercase tracking-widest px-2">Format</label>
                                        <select 
                                            value={aiPostType}
                                            onChange={(e) => setAiPostType(e.target.value as any)}
                                            className="w-full h-14 bg-black/40 border border-white/5 rounded-2xl px-4 text-sm text-white outline-none focus:border-blue-500/50"
                                        >
                                            <option value="standard">Short Post</option>
                                            <option value="facebook_200_words">Long Form</option>
                                        </select>
                                    </div>
                                </div>
                                <button 
                                    onClick={handleAiGeneratePost}
                                    disabled={aiGenerating || !aiTopic.trim()}
                                    className="w-full py-5 bg-teal-600 hover:bg-teal-500 text-white rounded-2xl font-black uppercase shadow-2xl shadow-teal-900/40 disabled:opacity-50 transition-all flex items-center justify-center gap-3 text-base"
                                >
                                    {aiGenerating ? <Loader2 size={24} className="animate-spin" /> : <Zap size={24} />}
                                    Generate Draft
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Media Studio Modal */}
            {showMediaStudio && postImageFile && (
                <MediaStudioModal
                    file={postImageFile}
                    onClose={() => setShowMediaStudio(false)}
                    onApply={(file, meta) => {
                        handleApplyMediaStudio(file, meta);
                        setShowMediaStudio(false);
                    }}
                />
            )}
        </div>
    );
}
