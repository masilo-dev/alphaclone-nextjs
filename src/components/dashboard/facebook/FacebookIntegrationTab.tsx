'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
    Facebook, Users, Megaphone, RefreshCw, CheckCircle2, XCircle,
    ExternalLink, Plus, Send, Image, Link2, Loader2, Eye, Trash2,
    TrendingUp, UserPlus, Mail, Phone, Building2, Filter, ChevronDown, Sparkles,
    Activity, HelpCircle, Code2, Globe, Shield, Zap, AlertCircle, MessageCircle
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import MessengerInbox from '../messenger/MessengerInbox';
import MediaStudioModal from './MediaStudioModal';
import toast from 'react-hot-toast';

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
    const [aiReplyLoading, setAiReplyLoading] = useState<Record<string, boolean>>({});
    const imageInputRef = useRef<HTMLInputElement>(null);

    // AI generation state
    const [showAiPanel, setShowAiPanel] = useState(false);
    const [aiTopic, setAiTopic] = useState('');
    const [aiTone, setAiTone] = useState<'engaging' | 'professional' | 'promotional' | 'casual'>('engaging');
    const [aiGenerating, setAiGenerating] = useState(false);

    const isConnected = pages.length > 0;
    const hasPublishablePage = pages.some((p) => !!p.page_access_token && !p.metadata?.no_pages);

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

    const fetchPagePosts = useCallback(async (pageId: string) => {
        if (!pageId) return;
        setPostsLoading(true);
        try {
            const res = await fetch(`/api/facebook/posts?pageId=${pageId}&limit=20`);
            if (res.status === 401 || res.status === 403) {
                setReconnectRequired(true);
                toast.error('Facebook access denied. Re-authentication required.');
                return;
            }
            const data = await res.json();
            if (data.posts) setPagePosts(data.posts);
            setReconnectRequired(false); // Reset if successful
        } catch (err) {
            console.error('[Facebook] Failed to fetch page posts:', err);
        } finally {
            setPostsLoading(false);
        }
    }, []);

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
        if ((activeTab === 'post' || activeTab === 'posts') && selectedPageId) {
            void loadScheduleQueue();
        }
    }, [activeTab, selectedPageId, loadScheduleQueue]);

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
        setPosting(true);
        const toastId = toast.loading('Posting to Facebook...');
        try {
            let res: Response;
            if (postImageFile) {
                // Upload photo binary directly to Facebook via multipart route
                const form = new FormData();
                form.append('pageId', selectedPageId);
                form.append('message', postMessage);
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
                        message: postMessage,
                        link: postLink || undefined,
                        imageUrl: postImageUrl || undefined,
                    }),
                });
            }
            const data = await res.json();
            if (data.success) {
                toast.success('Posted to Facebook!', { id: toastId });
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

        setPosting(true);
        const toastId = toast.loading('Scheduling Facebook post...');
        try {
            const payload = {
                tenantId: tenant.id,
                caption: postMessage,
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
        <>
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
                        <Facebook className="w-5 h-5 text-blue-400" />
                    </div>
                    <div className="min-w-0">
                        <h2 className="text-xl font-bold text-white">Facebook Integration</h2>
                        <p className="text-sm text-slate-400">
                            Connect your Facebook profile and Pages. Each team member can connect their own account.
                        </p>
                    </div>
                </div>
                {isConnected && !reconnectRequired ? (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/30 rounded-lg self-start md:self-auto">
                        <CheckCircle2 className="w-4 h-4 text-green-400" />
                        <span className="text-sm text-green-400 font-medium">Connected</span>
                    </div>
                ) : isConnected && reconnectRequired ? (
                    <button
                        onClick={handleConnect}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-semibold text-sm transition-colors animate-pulse self-start md:self-auto"
                    >
                        <AlertCircle className="w-4 h-4" />
                        Re-connect Facebook
                    </button>
                ) : (
                    <button
                        onClick={handleConnect}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold text-sm transition-colors self-start md:self-auto"
                    >
                        <Facebook className="w-4 h-4" />
                        Connect Facebook
                    </button>
                )}
            </div>

            {!isConnected ? (
                /* Not connected state */
                <div className="border border-dashed border-slate-700 rounded-2xl p-12 text-center">
                    {integrationLoadError && (
                        <div
                            className="mb-6 mx-auto max-w-lg rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-left text-sm text-amber-200"
                            role="alert"
                        >
                            <p className="font-semibold text-amber-100">Could not load Facebook connection</p>
                            <p className="mt-1 text-amber-200/90">{integrationLoadError}</p>
                            <p className="mt-2 text-xs text-amber-200/70">
                                This is often fixed by applying the latest Supabase RLS migration for facebook_integrations (auth.uid() policies). Try Refresh after your admin deploys it.
                            </p>
                        </div>
                    )}
                    <Facebook className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                    <h3 className="text-lg font-bold text-white mb-2">Connect your Facebook account</h3>
                    <p className="text-slate-400 text-sm max-w-md mx-auto mb-6">
                        Link your own Facebook profile and pages. Lead Ads and Messenger use your workspace; posting and tokens stay tied to you.
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
                </div>
            ) : (
                <>
                    {/* Tabs */}
                    <div className="hidden sm:flex gap-1 p-1 bg-slate-800/60 border border-slate-700 rounded-xl overflow-x-auto no-scrollbar max-w-full">
                        {FACEBOOK_TABS.map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize transition-all relative whitespace-nowrap ${
                                    activeTab === tab
                                        ? 'bg-teal-500 text-white'
                                        : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                {tab === 'leads' ? `${TAB_LABELS[tab]} (${leads.length})` : TAB_LABELS[tab]}
                                
                                {tab === 'messenger' && conversations.some(c => !c.is_read) && (
                                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-blue-500 rounded-full border-2 border-slate-800" />
                                )}
                            </button>
                        ))}
                    </div>
                    <div className="sm:hidden space-y-2">
                        <div className="flex gap-1 p-1 bg-slate-800/60 border border-slate-700 rounded-xl overflow-x-auto no-scrollbar max-w-full">
                            {MOBILE_PRIMARY_TABS.map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all relative whitespace-nowrap ${
                                        activeTab === tab
                                            ? 'bg-teal-500 text-white'
                                            : 'text-slate-400 hover:text-white'
                                    }`}
                                >
                                    {tab === 'leads' ? `${TAB_LABELS[tab]} (${leads.length})` : TAB_LABELS[tab]}
                                    {tab === 'messenger' && conversations.some(c => !c.is_read) && (
                                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-blue-500 rounded-full border-2 border-slate-800" />
                                    )}
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500">More:</span>
                            {(() => {
                                const isSecondaryTab =
                                    activeTab === 'posts' || activeTab === 'pages' || activeTab === 'setup';
                                return (
                            <select
                                value={isSecondaryTab ? activeTab : ''}
                                onChange={(e) => setActiveTab(e.target.value as typeof activeTab)}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-teal-500"
                            >
                                <option value="">Select section</option>
                                {MOBILE_SECONDARY_TABS.map((tab) => (
                                    <option key={tab} value={tab}>
                                        {TAB_LABELS[tab]}
                                    </option>
                                ))}
                            </select>
                                );
                            })()}
                        </div>
                    </div>

                    {/* LEADS TAB */}
                    {activeTab === 'leads' && (
                        <div className="space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
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
                                    Publishing Target
                                </label>
                                <select
                                    value={selectedPageId}
                                    onChange={e => setSelectedPageId(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-teal-500"
                                >
                                    {pages.map(p => (
                                        <option key={p.page_id} value={p.page_id}>
                                            {p.page_name}{p.metadata?.no_pages || !p.page_access_token ? ' (Personal profile - read only)' : ''}
                                        </option>
                                    ))}
                                </select>
                                {!hasPublishablePage && (
                                    <p className="mt-2 text-xs text-amber-300">
                                        Personal account connected successfully. To publish posts, connect at least one Facebook Page.
                                    </p>
                                )}
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

                            {/* Media Section */}
                            <div>
                                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 block">
                                    Media (optional)
                                </label>
                                <div className="space-y-2">
                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            type="button"
                                            onClick={() => { setMediaSource('upload'); setAiGeneratedImageUrl(null); }}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                                                mediaSource === 'upload'
                                                    ? 'bg-teal-500 text-white'
                                                    : 'bg-slate-800 border border-slate-700 text-slate-400 hover:text-white'
                                            }`}
                                        >
                                            Upload
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { setMediaSource('ai'); setPostImageFile(null); setPostImageUrl(''); if (imagePreview.startsWith('blob:')) URL.revokeObjectURL(imagePreview); setImagePreview(''); }}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                                                mediaSource === 'ai'
                                                    ? 'bg-violet-500 text-white'
                                                    : 'bg-slate-800 border border-slate-700 text-slate-400 hover:text-white'
                                            }`}
                                        >
                                            Generate with AI
                                        </button>
                                    </div>
                                    {mediaSource === 'upload' && (
                                        <>
                                    <div className="flex items-center gap-3">
                                        <input
                                            ref={imageInputRef}
                                            type="file"
                                            accept="image/*,video/*"
                                            onChange={handleImageFileChange}
                                            className="hidden"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => imageInputRef.current?.click()}
                                            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-slate-300 text-sm transition-colors"
                                        >
                                            <Image className="w-4 h-4" />
                                            Upload Media
                                        </button>
                                        <span className="text-slate-600 text-xs">image/video file, or image URL</span>
                                        {postImageFile && (
                                            <button
                                                type="button"
                                                onClick={() => setShowMediaStudio(true)}
                                                className="rounded-xl border border-violet-500/40 bg-violet-500/10 px-3 py-2 text-xs font-semibold text-violet-200 hover:bg-violet-500/20"
                                            >
                                                Edit in Media Studio
                                            </button>
                                        )}
                                    </div>
                                    {!postImageFile && (
                                        <div className="relative">
                                            <Image className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                            <input
                                                type="url"
                                                value={postImageUrl}
                                                onChange={e => setPostImageUrl(e.target.value)}
                                                placeholder="https://example.com/image.jpg"
                                                className="w-full pl-9 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
                                            />
                                        </div>
                                    )}
                                        </>
                                    )}
                                    {mediaSource === 'ai' && (
                                        <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-3 space-y-2">
                                            <input
                                                value={aiImagePrompt}
                                                onChange={(e) => setAiImagePrompt(e.target.value)}
                                                placeholder="Describe the image to generate for this post"
                                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
                                            />
                                            <div className="flex gap-2">
                                                <button
                                                    type="button"
                                                    onClick={generateAiImage}
                                                    disabled={aiImageGenerating || !aiImagePrompt.trim()}
                                                    className="px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-semibold"
                                                >
                                                    {aiImageGenerating ? 'Generating...' : 'Generate Image'}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={attachGeneratedImage}
                                                    disabled={attachingAiImage || !aiGeneratedImageUrl}
                                                    className="px-3 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-xs font-semibold"
                                                >
                                                    {attachingAiImage ? 'Attaching...' : 'Attach to Post'}
                                                </button>
                                            </div>
                                            {aiGeneratedImageUrl && (
                                                <img src={aiGeneratedImageUrl} alt="AI generated preview" className="w-full max-h-52 object-contain rounded-lg border border-slate-700" />
                                            )}
                                        </div>
                                    )}
                                    {imagePreview && (
                                        <div className="relative rounded-xl overflow-hidden border border-slate-700 bg-slate-900">
                                            {postImageFile?.type.startsWith('video/') ? (
                                                <video
                                                    src={imagePreview}
                                                    controls
                                                    className="w-full max-h-52 object-contain"
                                                />
                                            ) : (
                                                <img src={imagePreview} alt="Preview" className="w-full max-h-52 object-contain" />
                                            )}
                                            <button
                                                type="button"
                                                onClick={clearImage}
                                                className="absolute top-2 right-2 p-1 bg-slate-900/80 rounded-lg text-slate-400 hover:text-red-400 transition-colors"
                                            >
                                                <XCircle className="w-4 h-4" />
                                            </button>
                                            <p className="text-xs text-slate-500 px-3 py-1.5 truncate">{postImageFile?.name}</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div>
                                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 block">
                                        Schedule (optional)
                                    </label>
                                    <input
                                        type="datetime-local"
                                        value={scheduleAt}
                                        onChange={e => setScheduleAt(e.target.value)}
                                        className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-teal-500"
                                    />
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        onClick={handlePost}
                                        disabled={posting || !postMessage.trim()}
                                        className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-semibold transition-colors"
                                    >
                                        {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                        {posting
                                            ? 'Posting...'
                                            : (pages.find((p) => p.page_id === selectedPageId)?.metadata?.no_pages ||
                                               !pages.find((p) => p.page_id === selectedPageId)?.page_access_token)
                                                ? 'Open in Facebook'
                                                : 'Post Now'}
                                    </button>
                                    <button
                                        onClick={handleSchedulePost}
                                        disabled={posting || !postMessage.trim() || !scheduleAt}
                                        className="flex items-center gap-2 px-6 py-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-semibold transition-colors"
                                    >
                                        {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                                        Schedule Post
                                    </button>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
                                <div className="mb-3 flex items-center justify-between">
                                    <h4 className="text-sm font-semibold text-white">Publishing Queue</h4>
                                    <button
                                        onClick={() => void loadScheduleQueue()}
                                        className="text-xs text-slate-400 hover:text-white transition-colors"
                                    >
                                        Refresh queue
                                    </button>
                                </div>
                                <div className="mb-3 flex flex-wrap gap-2 text-[11px]">
                                    <span className="rounded-md border border-blue-500/40 bg-blue-500/10 px-2 py-0.5 text-blue-300">scheduled</span>
                                    <span className="rounded-md border border-violet-500/40 bg-violet-500/10 px-2 py-0.5 text-violet-300">queued</span>
                                    <span className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-amber-300">publishing</span>
                                    <span className="rounded-md border border-green-500/40 bg-green-500/10 px-2 py-0.5 text-green-300">published</span>
                                    <span className="rounded-md border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-red-300">failed</span>
                                    <span className="rounded-md border border-slate-600 bg-slate-800 px-2 py-0.5 text-slate-300">cancelled</span>
                                </div>
                                {queueLoading ? (
                                    <div className="flex items-center gap-2 text-sm text-slate-400">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Loading queue...
                                    </div>
                                ) : scheduledPosts.length === 0 ? (
                                    <p className="text-sm text-slate-500">No scheduled or queued posts.</p>
                                ) : (
                                    <div className="space-y-2">
                                        {scheduledPosts.slice(0, 8).map((item) => (
                                            <div key={item.id} className="rounded-xl border border-slate-800 p-3">
                                                <div className="mb-1 flex items-center justify-between gap-2">
                                                    <span className="text-xs uppercase tracking-wide text-slate-400">{item.status}</span>
                                                    <span className="text-xs text-slate-500">
                                                        {item.scheduled_at ? new Date(item.scheduled_at).toLocaleString() : 'Immediate'}
                                                    </span>
                                                </div>
                                                <p className="line-clamp-2 text-sm text-slate-200">{item.caption}</p>
                                                {item.error_message && (
                                                    <p className="mt-1 text-xs text-red-400">{item.error_message}</p>
                                                )}
                                                <div className="mt-2 flex gap-2">
                                                    {(item.status === 'scheduled' || item.status === 'failed') && (
                                                        <button
                                                            onClick={() => void handleQueueAction(item.id, 'publish_now')}
                                                            className="rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-500 transition-colors"
                                                        >
                                                            Publish now
                                                        </button>
                                                    )}
                                                    {(item.status === 'scheduled' || item.status === 'queued') && (
                                                        <button
                                                            onClick={() => void handleQueueAction(item.id, 'cancel')}
                                                            className="rounded-lg bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition-colors"
                                                        >
                                                            Cancel
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
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
                                                    <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                                                        <div className="mb-2 flex items-center gap-1.5 text-xs text-slate-400">
                                                            <MessageCircle className="w-3.5 h-3.5" />
                                                            Engagement
                                                        </div>
                                                        <div className="mb-3 flex gap-2">
                                                            <input
                                                                value={commentByPost[post.id] || ''}
                                                                onChange={(e) =>
                                                                    setCommentByPost((prev) => ({ ...prev, [post.id]: e.target.value }))
                                                                }
                                                                placeholder="Write a comment on this post..."
                                                                className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                                                            />
                                                            <button
                                                                onClick={() => void handleFacebookComment(post.id)}
                                                                disabled={!!commentActionLoading[`post-${post.id}`]}
                                                                className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
                                                            >
                                                                {commentActionLoading[`post-${post.id}`] ? 'Posting...' : 'Comment'}
                                                            </button>
                                                            <button
                                                                onClick={() => void generateFacebookQuickReply(post)}
                                                                disabled={!!aiReplyLoading[`post-${post.id}`]}
                                                                className="rounded-lg bg-violet-600/20 border border-violet-500/30 px-3 py-2 text-xs font-semibold text-violet-300 hover:bg-violet-600/30 disabled:opacity-50"
                                                            >
                                                                {aiReplyLoading[`post-${post.id}`] ? 'Generating...' : 'AI Quick Reply'}
                                                            </button>
                                                        </div>

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
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <p className="text-xs text-slate-500">No comments yet for this post.</p>
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
        {showMediaStudio && postImageFile && (
            <MediaStudioModal
                file={postImageFile}
                onClose={() => setShowMediaStudio(false)}
                onApply={handleApplyMediaStudio}
            />
        )}
        </>
    );
}
