'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
    Facebook, Users, Megaphone, RefreshCw, CheckCircle2, XCircle,
    ExternalLink, Plus, Send, Image, Link2, Loader2, Eye, Trash2,
    TrendingUp, UserPlus, Mail, Phone, Building2, Filter, ChevronDown, Sparkles,
    Activity, HelpCircle, Code2, Globe, Shield, Zap, AlertCircle, AlertTriangle, MessageCircle,
    ThumbsUp, Repeat2, BarChart3
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import MessengerInbox from '../messenger/MessengerInbox';
import MediaStudioModal from './MediaStudioModal';
import toast from 'react-hot-toast';
import { userLearningPreferencesService } from '@/services/userLearningPreferencesService';

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
          <button onClick={() => window.location.reload()} className="px-6 py-2 bg-blue-600 text-white rounded-xl">Retry Connection</button>
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
    new: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    contacted: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    qualified: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
    converted: 'bg-green-500/20 text-green-400 border-green-500/30',
    disqualified: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const FACEBOOK_TABS = ['leads', 'messenger', 'posts', 'post', 'pages', 'setup'] as const;
const MOBILE_PRIMARY_TABS = ['leads', 'messenger', 'post'] as const;
const MOBILE_SECONDARY_TABS = ['posts', 'pages', 'setup'] as const;
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
    const [hashtags, setHashtags] = useState<string[]>([]);
    const [suggestedHashtags, setSuggestedHashtags] = useState<string[]>(['#AlphaClone', '#AItools', '#founders', '#productivity', '#automation']);
    const [activeQueueFilter, setActiveQueueFilter] = useState<'all' | 'published' | 'scheduled' | 'failed'>('all');
    const imageInputRef = useRef<HTMLInputElement>(null);

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

        const [pagesRes, leadsRes, convRes] = await Promise.all([
            supabase
                .from('facebook_integrations')
                .select('id,page_id,page_name,is_active,connected_at,page_access_token,metadata')
                .eq('user_id', user.id)
                .eq('is_active', true),
            leadsQuery,
            convQuery,
        ]);

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

    // OAuth return: reload integrations before clearing query params (avoid race with router.replace).
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
                    toast.error(
                        `Connected in Facebook, but this app could not load your pages: ${pagesFetchError}. If you are an admin, confirm Supabase migration 20260409_fix_integration_rls_policies is applied.`
                    );
                } else if (activePageCount === 0) {
                    toast.error(
                        'Facebook authorized, but no active pages were found. Create or manage a Facebook Page, grant Page permissions when connecting, or reconnect. If this persists, the connection may not have been saved (check server logs).'
                    );
                } else {
                    toast.success('Facebook connected for this workspace.');
                }
                router.replace('/dashboard/business/facebook', { scroll: false });
            })();
            return () => {
                cancelled = true;
            };
        }
        if (fbErr === 'app_not_configured') {
            toast.error(
                'Facebook is not configured for this deployment. Set FACEBOOK_APP_ID and the callback URL in the server environment (e.g. Vercel).'
            );
            router.replace('/dashboard/business/facebook', { scroll: false });
        } else if (fbErr === 'save_failed') {
            toast.error(
                'Facebook login worked, but saving the connection failed. Ensure the database has a unique index on (user_id, page_id) for facebook_integrations, then try Connect again.'
            );
            router.replace('/dashboard/business/facebook', { scroll: false });
        } else if (fbErr === 'profile_failed') {
            toast.error('Facebook returned an incomplete profile. Try again or check Meta app permissions.');
            router.replace('/dashboard/business/facebook', { scroll: false });
        } else if (fbErr) {
            toast.error('Facebook could not be connected. Please try again or contact support.');
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
        }
    }, [selectedPageId, loadScheduleQueue]);

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
        if (!aiImagePrompt.trim()) return toast.error('Describe the image you want to generate');
        setAiImageGenerating(true);
        setAiGeneratedImageUrl(null);
        try {
            const res = await fetch('/api/ai/image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: aiImagePrompt,
                    size: '1024x1024',
                    provider: 'grok',
                    tenantId: tenant?.id || undefined,
                }),
            });
            const data = await res.json();
            if (!res.ok || !data.url) {
                toast.error(data.error || 'Image generation failed');
                return;
            }
            setAiGeneratedImageUrl(data.url);
            toast.success('AI image generated');
        } catch {
            toast.error('Failed to generate AI image');
        } finally {
            setAiImageGenerating(false);
        }
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
            if (!uploadRes.ok || !uploadData?.success || !uploadData?.asset?.public_url) {
                toast.error(uploadData.error || 'Failed to save generated image', { id: toastId });
                return;
            }
            const mediaUrl = uploadData.asset.public_url as string;
            if (imagePreview.startsWith('blob:')) URL.revokeObjectURL(imagePreview);
            setPostImageFile(null);
            setPostImageUrl(mediaUrl);
            setImagePreview(mediaUrl);
            setAiGeneratedImageUrl(null);
            toast.success('AI image attached to post', { id: toastId });
        } catch {
            toast.error('Failed to attach generated image', { id: toastId });
        } finally {
            setAttachingAiImage(false);
        }
    };

    const handleApplyMediaStudio = (editedFile: File, meta?: { coverFrameFile?: File; coverFrameTimePct?: number }) => {
        if (imagePreview.startsWith('blob:')) URL.revokeObjectURL(imagePreview);
        setPostImageFile(editedFile);
        setImagePreview(URL.createObjectURL(editedFile));
        setVideoCoverFrameFile(meta?.coverFrameFile ?? null);
        setVideoCoverTimePct(meta?.coverFrameTimePct ?? 0);
    };

    const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const isImage = file.type.startsWith('image/');
        const isVideo = file.type.startsWith('video/');
        if (!isImage && !isVideo) return toast.error('Please select an image or video file');
        if (isImage && file.size > 10 * 1024 * 1024) return toast.error('Image must be under 10MB');
        if (isVideo && file.size > 200 * 1024 * 1024) return toast.error('Video must be under 200MB');
        setPostImageFile(file);
        setPostImageUrl('');
        setImagePreview(URL.createObjectURL(file));
    };

    const handlePost = async () => {
        if (!postMessage.trim()) return toast.error('Message is required');
        if (!selectedPageId) return toast.error('Select a Facebook Page');
        const selectedConnection = pages.find((p) => p.page_id === selectedPageId);
        if (selectedConnection?.metadata?.no_pages || !selectedConnection?.page_access_token) {
            try {
                void navigator.clipboard.writeText(postMessage.trim());
            } catch {
                // Ignore clipboard failures; fallback still opens Facebook.
            }
            const shareUrl = postLink?.trim()
                ? `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(postLink.trim())}`
                : 'https://www.facebook.com/';
            window.open(shareUrl, '_blank', 'noopener,noreferrer');
            toast.success('Caption copied. Complete personal-account post in Facebook.');
            return;
        }
        const finalMessage = hashtags.length > 0
            ? `${postMessage}\n\n${hashtags.join(' ')}`
            : postMessage;

        setPosting(true);
        const toastId = toast.loading('Posting to Facebook...');
        try {
            let res: Response;
            if (postImageFile) {
                // Upload photo binary directly to Facebook via multipart route
                const form = new FormData();
                form.append('pageId', selectedPageId);
                form.append('message', finalMessage);
                form.append('file', postImageFile);
                if (videoCoverFrameFile) {
                    form.append('coverFrame', videoCoverFrameFile);
                    form.append('coverTimePct', String(videoCoverTimePct));
                }
                res = await fetch('/api/facebook/upload-photo', { method: 'POST', body: form });
            } else {
                res = await fetch('/api/facebook/post', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        pageId: selectedPageId,
                        message: finalMessage,
                        link: postLink || undefined,
                        imageUrl: postImageUrl || undefined,
                    }),
                });
            }
            const data = await res.json();
            if (data.success) {
                toast.success('Posted to Facebook!', { id: toastId });
                userLearningPreferencesService.recordSocialPost(postMessage.trim());
                setPostMessage('');
                setPostLink('');
                clearImage();
                setActiveTab('posts');
                setTimeout(() => fetchPagePosts(selectedPageId), 2000);
                void loadScheduleQueue();
            } else {
                toast.error(data.error || 'Failed to post', { id: toastId });
            }
        } catch {
            toast.error('Failed to post', { id: toastId });
        } finally {
            setPosting(false);
        }
    };

    const handleSchedulePost = async () => {
        if (!tenant?.id) return toast.error('Workspace is required');
        if (!postMessage.trim()) return toast.error('Message is required');
        if (!selectedPageId) return toast.error('Select a Facebook Page');
        if (!scheduleAt) return toast.error('Select schedule date and time');
        const selectedConnection = pages.find((p) => p.page_id === selectedPageId);
        if (selectedConnection?.metadata?.no_pages || !selectedConnection?.page_access_token) {
            return toast.error('Personal account is connected. Scheduling requires a Facebook Page connection.');
        }

        const finalMessage = hashtags.length > 0
            ? `${postMessage}\n\n${hashtags.join(' ')}`
            : postMessage;

        setPosting(true);
        const toastId = toast.loading('Scheduling Facebook post...');
        try {
            const payload = {
                tenantId: tenant.id,
                caption: finalMessage,
                link_url: postLink || null,
                media_urls: postImageUrl ? [postImageUrl] : [],
                media_types: postImageUrl ? ['image'] : [],
                platforms: ['facebook'],
                facebook_page_id: selectedPageId,
                scheduled_at: new Date(scheduleAt).toISOString(),
                publish_now: false,
            };

            const res = await fetch('/api/social/schedule', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                toast.error(data.error || 'Failed to schedule post', { id: toastId });
                return;
            }
            toast.success('Post scheduled successfully', { id: toastId });
            setScheduleAt('');
            setPostMessage('');
            setPostLink('');
            clearImage();
            void loadScheduleQueue();
        } catch (err) {
            console.error('[Facebook] schedule post failed:', err);
            toast.error('Failed to schedule post', { id: toastId });
        } finally {
            setPosting(false);
        }
    };

    const handleQueueAction = async (postId: string, action: 'publish_now' | 'cancel') => {
        if (!tenant?.id) return toast.error('Workspace is required');
        const toastId = toast.loading(action === 'publish_now' ? 'Publishing now...' : 'Cancelling post...');
        try {
            const res = await fetch('/api/social/schedule', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    postId,
                    tenantId: tenant.id,
                    action,
                }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                toast.error(data.error || 'Action failed', { id: toastId });
                return;
            }
            toast.success(action === 'publish_now' ? 'Post queued for immediate publish' : 'Post cancelled', { id: toastId });
            void loadScheduleQueue();
            if (selectedPageId) {
                setTimeout(() => void fetchPagePosts(selectedPageId), 1500);
            }
        } catch (err) {
            console.error('[Facebook] queue action failed:', err);
            toast.error('Action failed', { id: toastId });
        }
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

    const handleAiGeneratePost = async () => {
        if (!aiTopic.trim()) return toast.error('Describe your post topic first');
        setAiGenerating(true);
        try {
            const promptByType: Record<typeof aiPostType, string> = {
                standard: `Write a ${aiTone} Facebook business post about: "${aiTopic}". 150-400 chars. Conversational, no hashtags (I will add those separately). End with a subtle call-to-action. Return ONLY the post text, nothing else.`,
                facebook_200_words: `Write a ${aiTone} Facebook business post about: "${aiTopic}". The post must be approximately 200 words (180-220 words). Keep it natural and clear, and finish with a practical call-to-action. Return ONLY the post text.`,
                linkedin_article: `Write a ${aiTone} LinkedIn article draft about: "${aiTopic}". Length 500-800 words with a clear headline, intro, 3-5 section headings, practical insights, and closing CTA. Return ONLY the article text.`,
            };
            const res = await fetch('/api/ai/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: promptByType[aiPostType],
                    systemPrompt: 'You are an expert Facebook content strategist for businesses. Write natural, engaging posts that drive interaction. No preamble, no quotes, just the post.',
                    maxTokens: aiPostType === 'linkedin_article' ? 1400 : aiPostType === 'facebook_200_words' ? 500 : 220,
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
        <div className="h-[calc(100vh-140px)] flex flex-col bg-[#0f0f0f] rounded-3xl border border-white/5 overflow-hidden backdrop-blur-sm relative">
            {!isConnected && (
                <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-xl flex items-center justify-center p-8 text-center">
                    <div className="max-w-md space-y-6">
                        <div className="w-20 h-20 bg-blue-600/20 rounded-3xl flex items-center justify-center mx-auto border border-blue-500/30">
                            <Facebook className="w-10 h-10 text-blue-400" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-white mb-2">Connect Facebook</h2>
                            <p className="text-slate-400 text-sm leading-relaxed">
                                Manage multiple pages, schedule content, and track leads across your Facebook ecosystem.
                            </p>
                        </div>
                        <button
                            onClick={handleConnect}
                            className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold shadow-lg shadow-blue-900/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                        >
                            <Facebook size={20} />
                            Connect via Meta
                        </button>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="h-16 border-b border-white/5 bg-[#141414] px-6 flex items-center justify-between z-10 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-600/20">
                        <Facebook size={18} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-sm font-black tracking-widest text-white uppercase">Facebook Manager</h1>
                        <div className="flex items-center gap-2">
                            <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                            <span className="text-[10px] text-gray-500 font-bold uppercase">{isConnected ? 'System Active' : 'Disconnected'}</span>
                        </div>
                    </div>
                </div>
                
                <div className="flex items-center gap-4">
                    {isConnected && (
                        <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-xl border border-white/5">
                            <div className="w-6 h-6 rounded-lg bg-blue-600/20 flex items-center justify-center">
                                <Users size={12} className="text-blue-400" />
                            </div>
                            <select 
                                value={selectedPageId}
                                onChange={(e) => setSelectedPageId(e.target.value)}
                                className="bg-transparent text-xs font-bold text-gray-300 outline-none cursor-pointer pr-2"
                            >
                                {pages.map(p => (
                                    <option key={p.page_id} value={p.page_id} className="bg-[#141414] font-bold">{p.page_name}</option>
                                ))}
                            </select>
                        </div>
                    )}
                    <button 
                        onClick={handleConnect}
                        className="bg-white/5 hover:bg-white/10 text-white px-4 py-2 rounded-xl text-xs font-bold border border-white/10 transition-all flex items-center gap-2"
                    >
                        <RefreshCw size={14} />
                        Sync
                    </button>
                </div>
            </div>

            {/* Main Body */}
            <div className="flex flex-1 overflow-hidden relative">
                <div className="flex w-full divide-x divide-white/5">
                    
                    {/* Sidebar */}
                    <div className="w-64 flex flex-col bg-[#0a0a0a] overflow-y-auto custom-scrollbar pb-12 shrink-0">
                        <div className="p-4 space-y-8">
                            <div>
                                <div className="px-3 text-[10px] font-black text-gray-600 uppercase tracking-widest mb-4">Content Control</div>
                                <div className="space-y-1">
                                    <button onClick={() => setActiveTab('post')} className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all ${activeTab === 'post' ? 'bg-blue-600/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
                                        <Plus size={18} />
                                        <span className="text-xs font-bold text-left">Compose Post</span>
                                    </button>
                                    <button onClick={() => setActiveTab('posts')} className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all ${activeTab === 'posts' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
                                        <Activity size={18} />
                                        <span className="text-xs font-bold text-left">Page Feed</span>
                                    </button>
                                </div>
                            </div>
                            <div>
                                <div className="px-3 text-[10px] font-black text-gray-600 uppercase tracking-widest mb-4">Direct Response</div>
                                <div className="space-y-1">
                                    <button onClick={() => setActiveTab('leads')} className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all ${activeTab === 'leads' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
                                        <Users size={18} />
                                        <span className="text-xs font-bold text-left">Lead Manager</span>
                                        {leads.length > 0 && <span className="ml-auto bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded-full">{leads.length}</span>}
                                    </button>
                                    <button onClick={() => setActiveTab('messenger')} className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all ${activeTab === 'messenger' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
                                        <MessageCircle size={18} />
                                        <span className="text-xs font-bold text-left">Messenger Inbox</span>
                                    </button>
                                </div>
                            </div>

                            <div>
                                <div className="px-3 text-[10px] font-black text-gray-600 uppercase tracking-widest mb-4">Automation</div>
                                <div className="space-y-1">
                                    <button className="w-full flex items-center gap-3 p-3 rounded-2xl text-gray-500 hover:bg-teal-500/5 hover:text-teal-400 transition-all">
                                        <Sparkles size={18} />
                                        <span className="text-xs font-bold text-left">AI Auto-reply</span>
                                    </button>
                                    <button className="w-full flex items-center gap-3 p-3 rounded-2xl text-gray-500 hover:bg-purple-500/5 hover:text-purple-400 transition-all">
                                        <TrendingUp size={18} />
                                        <span className="text-xs font-bold text-left">Lead Outreach</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* PANEL 2: Queue / Main Content */}
                    <div className="flex-1 flex flex-col bg-[#0f0f0f] overflow-y-auto custom-scrollbar p-8 pb-20">
                        <div className="max-w-3xl mx-auto w-full space-y-8">
                            {hasDuplicates && (
                                <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
                                        <AlertTriangle className="w-5 h-5 text-amber-500" />
                                    </div>
                                    <div className="min-w-0">
                                        <h4 className="text-sm font-black text-amber-500 uppercase tracking-wider">Duplicate Content</h4>
                                        <p className="text-xs text-amber-500/60 leading-relaxed">Multiple posts have identical content. Consider reviewing before they go live.</p>
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-black text-white flex items-center gap-2 uppercase tracking-tight">
                                    <Activity className="w-5 h-5 text-blue-500" />
                                    Post Queue
                                </h3>
                                <div className="flex gap-1 bg-black/40 p-1 rounded-xl border border-white/5">
                                    {(['all', 'scheduled', 'published', 'failed'] as const).map(f => (
                                        <button
                                            key={f}
                                            onClick={() => setActiveQueueFilter(f)}
                                            className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeQueueFilter === f ? 'bg-white/10 text-white shadow-lg' : 'text-gray-600 hover:text-gray-400'}`}
                                        >
                                            {f}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-4">
                                {[...scheduledPosts, ...pagePosts]
                                    .filter(p => {
                                        if (activeQueueFilter === 'all') return true;
                                        if (activeQueueFilter === 'scheduled') return p.status === 'scheduled' || p.status === 'queued';
                                        if (activeQueueFilter === 'published') return p.status === 'published' || p.id.startsWith('post');
                                        if (activeQueueFilter === 'failed') return p.status === 'failed';
                                        return true;
                                    })
                                    .map((post, idx) => {
                                        const content = (post.message || post.caption || '').trim();
                                        const isDuplicate = content && duplicateMap[content] > 1;
                                        
                                        return (
                                            <div key={post.id || idx} className="group relative bg-[#141414] border border-white/5 rounded-3xl p-6 transition-all hover:border-white/10 hover:shadow-2xl hover:shadow-black/40">
                                                <div className="flex items-start gap-4">
                                                    <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                                                        {post.status === 'published' || post.id.startsWith('post') ? <CheckCircle2 className="text-green-500 w-5 h-5" /> : <Loader2 className="animate-spin text-blue-500 w-5 h-5" />}
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">
                                                                    {post.scheduled_at ? new Date(post.scheduled_at).toLocaleString() : 'Recently Published'}
                                                                </span>
                                                                {isDuplicate && (
                                                                    <div className="flex items-center gap-1 bg-amber-500/10 text-amber-500 text-[8px] font-black uppercase px-2 py-0.5 rounded border border-amber-500/20">
                                                                        <AlertCircle size={10} /> Duplicate
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${post.status === 'failed' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'}`}>
                                                                {post.status || 'Active'}
                                                            </div>
                                                        </div>
                                                        <p className="text-sm text-gray-300 leading-relaxed mb-4">{post.message || post.caption}</p>
                                                        
                                                        {post.status === 'failed' && post.error_message && (
                                                            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-4 flex items-start gap-2">
                                                                <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                                                                <p className="text-[10px] text-red-400 leading-relaxed">{post.error_message}</p>
                                                            </div>
                                                        )}

                                                        <div className="flex items-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button className="text-[10px] font-black text-gray-500 hover:text-white uppercase tracking-widest flex items-center gap-1">
                                                                <Eye size={12} /> Preview
                                                            </button>
                                                            <button className="text-[10px] font-black text-gray-500 hover:text-white uppercase tracking-widest flex items-center gap-1">
                                                                <Trash2 size={12} /> Remove
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                }
                                
                                {pagePosts.length === 0 && scheduledPosts.length === 0 && !postsLoading && (
                                    <div className="text-center py-20 bg-black/20 rounded-3xl border border-dashed border-white/5">
                                        <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <Activity className="w-8 h-8 text-gray-700" />
                                        </div>
                                        <p className="text-sm text-gray-500 font-medium">No activity to display</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* PANEL 3: Compose Content */}
                    <div className="w-[400px] flex flex-col bg-[#0a0a0a] overflow-y-auto custom-scrollbar pb-20 shrink-0">
                        <div className="p-6 space-y-8">
                            <div>
                                <h3 className="text-sm font-black text-white uppercase tracking-widest mb-6 flex items-center gap-2">
                                    <Send className="w-4 h-4 text-blue-500" />
                                    New Publication
                                </h3>
                                
                                <div className="space-y-6">
                                    <div>
                                        <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-3 block">Publish to</label>
                                        <div className="grid grid-cols-5 gap-2">
                                            {pages.map(page => (
                                                <button
                                                    key={page.page_id}
                                                    onClick={() => setSelectedPageId(page.page_id)}
                                                    className={`aspect-square rounded-xl flex items-center justify-center text-xs font-black transition-all border ${selectedPageId === page.page_id ? 'bg-blue-600 text-white border-blue-400 shadow-lg shadow-blue-600/20' : 'bg-[#1a1a1a] text-gray-600 border-white/5 hover:border-white/10'}`}
                                                >
                                                    {getInitials(page.page_name)}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="relative">
                                            <textarea
                                                value={postMessage}
                                                onChange={(e) => setPostMessage(e.target.value)}
                                                placeholder="What's happening?"
                                                className="w-full bg-[#141414] border border-white/5 rounded-2xl p-4 text-sm text-gray-300 min-h-[160px] outline-none focus:border-blue-500/50 transition-all resize-none shadow-inner"
                                            />
                                            <button 
                                                onClick={() => setShowAiPanel(true)}
                                                className="absolute bottom-4 right-4 p-2 bg-blue-600 text-white rounded-lg shadow-lg hover:scale-110 transition-all active:scale-95"
                                            >
                                                <Sparkles size={16} />
                                            </button>
                                        </div>

                                        <div className="bg-black/40 border border-white/5 rounded-2xl p-4">
                                            <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-3 block">Hashtags</label>
                                            <div className="flex flex-wrap gap-2 mb-4">
                                                {hashtags.map(tag => (
                                                    <span key={tag} className="flex items-center gap-1 bg-blue-600/10 text-blue-400 text-[10px] font-bold px-2 py-1 rounded-lg border border-blue-500/20">
                                                        {tag}
                                                        <button onClick={() => setHashtags(prev => prev.filter(t => t !== tag))}><XCircle size={10} /></button>
                                                    </span>
                                                ))}
                                            </div>
                                            <div className="flex flex-wrap gap-1.5">
                                                {suggestedHashtags.filter(t => !hashtags.includes(t)).map(tag => (
                                                    <button 
                                                        key={tag}
                                                        onClick={() => setHashtags(prev => [...prev, tag])}
                                                        className="text-[10px] text-gray-500 hover:text-blue-400 bg-white/5 px-2 py-1 rounded-md transition-all"
                                                    >
                                                        {tag}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {imagePreview && (
                                            <div className="relative rounded-2xl overflow-hidden border border-white/10 aspect-video bg-black group">
                                                <img src={imagePreview} className="w-full h-full object-cover" alt="Preview" />
                                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                                                    <button onClick={() => setShowMediaStudio(true)} className="p-3 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-md transition-all"><Sparkles size={20} /></button>
                                                    <button onClick={clearImage} className="p-3 bg-red-500/20 hover:bg-red-500/40 rounded-full text-red-500 backdrop-blur-md transition-all"><Trash2 size={20} /></button>
                                                </div>
                                            </div>
                                        )}

                                        <div className="flex gap-2">
                                            <button 
                                                onClick={() => imageInputRef.current?.click()}
                                                className="flex-1 flex items-center justify-center gap-2 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-bold border border-white/5 transition-all"
                                            >
                                                <Image size={16} />
                                                Media
                                            </button>
                                            <input type="file" ref={imageInputRef} onChange={handleImageFileChange} className="hidden" accept="image/*,video/*" />
                                        </div>

                                        <div className="pt-4 border-t border-white/5 space-y-3">
                                            <input 
                                                type="datetime-local" 
                                                value={scheduleAt}
                                                onChange={(e) => setScheduleAt(e.target.value)}
                                                className="w-full bg-[#141414] border border-white/5 rounded-xl px-4 py-2.5 text-xs text-gray-300 outline-none focus:border-blue-500/50"
                                            />
                                            <div className="grid grid-cols-2 gap-3">
                                                <button 
                                                    onClick={handleSchedulePost}
                                                    disabled={posting || !scheduleAt}
                                                    className="py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-bold border border-white/10 disabled:opacity-50 transition-all"
                                                >
                                                    Schedule
                                                </button>
                                                <button 
                                                    onClick={handlePost}
                                                    disabled={posting}
                                                    className="py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-600/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                                                >
                                                    {posting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                                                    Publish
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Status Bar */}
                <div className="absolute bottom-0 left-0 right-0 h-8 bg-[#0a0a0a] border-t border-white/5 flex items-center px-6 z-20">
                    <div className="flex items-center gap-6 w-full">
                        <div className="flex items-center gap-2 shrink-0">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                            <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Meta API Online</span>
                        </div>
                        <div className="h-3 w-px bg-white/10" />
                        <div className="flex items-center gap-4 min-w-0 overflow-x-auto no-scrollbar">
                            {pages.map(p => (
                                <div key={p.page_id} className="flex items-center gap-2 shrink-0">
                                    <div className={`w-1 h-1 rounded-full ${p.is_active ? 'bg-teal-400' : 'bg-red-400'}`} />
                                    <span className="text-[9px] font-bold text-gray-600 truncate max-w-[100px] uppercase tracking-tighter">{p.page_name}</span>
                                </div>
                            ))}
                        </div>
                        <div className="ml-auto flex items-center gap-2 shrink-0">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                            <span className="text-[9px] font-black text-blue-500/80 uppercase tracking-widest">AI Strategist Ready</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* AI Overlay */}
            {showAiPanel && (
                <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in zoom-in duration-200">
                    <div className="bg-[#141414] border border-white/10 w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl">
                        <div className="p-6 border-b border-white/5 flex items-center justify-between">
                            <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-blue-400" />
                                AI Content Strategist
                            </h3>
                            <button onClick={() => setShowAiPanel(false)} className="text-gray-500 hover:text-white transition-colors"><XCircle size={20} /></button>
                        </div>
                        <div className="p-6 space-y-6">
                            <div>
                                <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-2 block">Post Topic</label>
                                <input 
                                    type="text" 
                                    value={aiTopic}
                                    onChange={(e) => setAiTopic(e.target.value)}
                                    placeholder="e.g. Benefits of AI automation in real estate"
                                    className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-sm text-gray-300 outline-none focus:border-blue-500/50"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-2 block">Tone</label>
                                    <select 
                                        value={aiTone}
                                        onChange={(e) => setAiTone(e.target.value as any)}
                                        className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-gray-300 outline-none"
                                    >
                                        <option value="engaging">Engaging</option>
                                        <option value="professional">Professional</option>
                                        <option value="casual">Casual</option>
                                        <option value="promotional">Promotional</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-2 block">Format</label>
                                    <select 
                                        value={aiPostType}
                                        onChange={(e) => setAiPostType(e.target.value as any)}
                                        className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-gray-300 outline-none"
                                    >
                                        <option value="standard">Standard</option>
                                        <option value="facebook_200_words">Long Form</option>
                                    </select>
                                </div>
                            </div>
                            <button 
                                onClick={handleAiGeneratePost}
                                disabled={aiGenerating || !aiTopic.trim()}
                                className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold shadow-lg shadow-blue-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {aiGenerating ? <Loader2 size={18} className="animate-spin" /> : <Zap size={18} />}
                                Generate Content
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Media Studio Modal */}
            {showMediaStudio && postImageFile && (
                <MediaStudioModal
                    file={postImageFile}
                    onClose={() => setShowMediaStudio(false)}
                    onApply={handleApplyMediaStudio}
                />
            )}
        </div>
    );
}
