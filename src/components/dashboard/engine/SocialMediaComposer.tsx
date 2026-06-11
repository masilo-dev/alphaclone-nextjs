'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
    Image as ImageIcon, Video, Send, Calendar, Clock, X, Plus, Hash,
    Upload, Loader2, CheckCircle2, Facebook, Globe, Trash2, Eye, Scissors,
    RefreshCw, Link2, Sparkles, Play, Film, AlertTriangle, ExternalLink, Linkedin,
    Mic, MicOff, Wand2, Twitter
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { launchFunnelService } from '@/services/launchFunnelService';
import { userLearningPreferencesService } from '@/services/userLearningPreferencesService';
import VideoEditor from '../../video/VideoEditor';
import { cn, cleanAIJSONResponse } from '../../../lib/utils';
import toast from 'react-hot-toast';
import AIOutputDisclaimer from '@/components/ai/AIOutputDisclaimer';

interface MediaAsset {
    id: string;
    file_name: string;
    asset_type: string;
    public_url: string;
    file_size_bytes: number;
    width: number | null;
    height: number | null;
    duration_secs: number | null;
    created_at: string;
}

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

type TopicDirection = 'same' | 'change';

interface FacebookPage {
    page_id: string;
    page_name: string;
}

interface LinkedInIntegration {
    linkedin_member_id: string;
    linkedin_person_urn: string;
    scopes: string[] | null;
    is_active: boolean;
}

function normalizeScopes(raw: unknown): string[] {
    if (Array.isArray(raw)) {
        return raw
            .flatMap((value) => String(value).split(/[,\s]+/))
            .map((value) => value.trim().toLowerCase())
            .filter(Boolean);
    }
    if (typeof raw === 'string') {
        return raw
            .split(/[,\s]+/)
            .map((value) => value.trim().toLowerCase())
            .filter(Boolean);
    }
    return [];
}

const STATUS_STYLE: Record<string, string> = {
    draft:       'bg-slate-700/50 text-slate-400 border-slate-700',
    scheduled:   'bg-blue-500/15 text-blue-400 border-blue-500/30',
    publishing:  'bg-amber-500/15 text-amber-400 border-amber-500/30',
    published:   'bg-green-500/15 text-green-400 border-green-500/30',
    failed:      'bg-red-500/15 text-red-400 border-red-500/30',
};

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
    facebook: <Facebook className="w-3.5 h-3.5" />,
    linkedin: <Linkedin className="w-3.5 h-3.5" />,
    twitter: <Twitter className="w-3.5 h-3.5" />,
    x: <Twitter className="w-3.5 h-3.5" />,
    platform: <Globe className="w-3.5 h-3.5" />,
};

export default function SocialMediaComposer() {
    const { currentTenant: tenant } = useTenant();
    const { user } = useAuth();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [posts, setPosts] = useState<SocialPost[]>([]);
    const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);
    const [fbPages, setFbPages] = useState<FacebookPage[]>([]);
    const [linkedinIntegrations, setLinkedinIntegrations] = useState<LinkedInIntegration[]>([]);
    const [xIntegration, setXIntegration] = useState<any>(null);
    const [selectedLinkedInMemberId, setSelectedLinkedInMemberId] = useState('');
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'compose' | 'posts' | 'media'>('compose');

    // Composer state
    const [caption, setCaption] = useState('');
    const [platforms, setPlatforms] = useState<string[]>(['facebook']);
    const [selectedMedia, setSelectedMedia] = useState<string[]>([]);
    const [selectedMediaTypes, setSelectedMediaTypes] = useState<string[]>([]);
    const [hashtagInput, setHashtagInput] = useState('');
    const [hashtags, setHashtags] = useState<string[]>([]);
    const [linkUrl, setLinkUrl] = useState('');
    const [scheduledAt, setScheduledAt] = useState('');
    const [selectedPageId, setSelectedPageId] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [showMediaPicker, setShowMediaPicker] = useState(false);

    // AI generation state
    const [showAiPanel, setShowAiPanel] = useState(false);
    const [aiTopic, setAiTopic] = useState('');
    const [aiTone, setAiTone] = useState<'professional' | 'casual' | 'engaging' | 'promotional'>('engaging');
    const [aiContentType, setAiContentType] = useState<'caption' | 'facebook_200_words' | 'linkedin_article'>('caption');
    const [aiGenerating, setAiGenerating] = useState(false);
    const [topicDirection, setTopicDirection] = useState<TopicDirection | null>(null);
    const [retryingPostId, setRetryingPostId] = useState<string | null>(null);

    // Upload state
    const [uploading, setUploading] = useState(false);

    // Voice input state
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef<any>(null);

    // AI Image generation state
    const [showAiImagePanel, setShowAiImagePanel] = useState(false);
    const [aiImagePrompt, setAiImagePrompt] = useState('');
    const [aiImageSize, setAiImageSize] = useState<'1024x1024' | '1792x1024' | '1024x1792'>('1024x1024');
    const [aiImageGenerating, setAiImageGenerating] = useState(false);
    const [aiGeneratedImageUrl, setAiGeneratedImageUrl] = useState<string | null>(null);
    const [attachingImage, setAttachingImage] = useState(false);

    // Video Editing state
    const [editingAsset, setEditingAsset] = useState<MediaAsset | null>(null);
    const [linkedinCommentByPost, setLinkedinCommentByPost] = useState<Record<string, string>>({});
    const [linkedinReactionByPost, setLinkedinReactionByPost] = useState<Record<string, string>>({});
    const [linkedinActionLoading, setLinkedinActionLoading] = useState<Record<string, boolean>>({});
    const [facebookCommentByPost, setFacebookCommentByPost] = useState<Record<string, string>>({});
    const [facebookActionLoading, setFacebookActionLoading] = useState<Record<string, boolean>>({});
    const [aiQuickReplyLoading, setAiQuickReplyLoading] = useState<Record<string, boolean>>({});
    const selectedLinkedInIntegration = linkedinIntegrations.find((row) => row.linkedin_member_id === selectedLinkedInMemberId) || null;
    const selectedLinkedInScopes = normalizeScopes(selectedLinkedInIntegration?.scopes || []);
    const hasSelectedLinkedInWriteScope = selectedLinkedInScopes.includes('w_member_social');
    const isSelectedLinkedInActive = !!selectedLinkedInIntegration?.is_active;
    const recentTopicWindowDays = 5;

    const recentPosts = useMemo(() => {
        const cutoffMs = Date.now() - recentTopicWindowDays * 24 * 60 * 60 * 1000;
        return posts.filter((post) => {
            const createdAtMs = new Date(post.created_at).getTime();
            return Number.isFinite(createdAtMs) && createdAtMs >= cutoffMs;
        });
    }, [posts]);

    const recentTopicHints = useMemo(() => {
        const normalized = new Set<string>();
        for (const post of recentPosts) {
            const text = String(post.caption || '').replace(/\s+/g, ' ').trim();
            if (!text) continue;
            const hashMatches = Array.from(text.matchAll(/#([a-zA-Z0-9_]+)/g)).map((m) => m[1].toLowerCase());
            for (const tag of hashMatches) {
                if (tag.length >= 3) normalized.add(`#${tag}`);
                if (normalized.size >= 6) break;
            }
            if (normalized.size >= 6) break;
            const sentence = text.split(/[.!?]/)[0]?.trim() || text.slice(0, 90).trim();
            if (sentence.length >= 15) normalized.add(sentence.slice(0, 70));
            if (normalized.size >= 6) break;
        }
        return Array.from(normalized).slice(0, 6);
    }, [recentPosts]);

    const loadData = useCallback(async () => {
        if (!tenant?.id || !user) return;
        setLoading(true);
        const [postsRes, mediaRes, pagesRes, linkedinRes, xRes] = await Promise.all([
            supabase.from('social_posts').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending: false }).limit(50),
            supabase.from('media_assets').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending: false }),
            supabase.from('facebook_integrations').select('page_id,page_name').eq('user_id', user.id).eq('is_active', true),
            supabase
                .from('linkedin_integrations')
                .select('linkedin_member_id,linkedin_person_urn,scopes,is_active')
                .eq('tenant_id', tenant.id)
                .eq('user_id', user.id)
                .order('created_at', { ascending: false }),
            supabase.from('x_integrations').select('id, x_username, x_user_id').eq('tenant_id', tenant.id).single(),
        ]);
        if (!postsRes.error) setPosts(postsRes.data || []);
        if (!mediaRes.error) setMediaAssets(mediaRes.data || []);
        if (!pagesRes.error) {
            setFbPages(pagesRes.data || []);
            if (pagesRes.data?.[0]) setSelectedPageId(pagesRes.data[0].page_id);
        }
        if (!linkedinRes.error) {
            const rows = (linkedinRes.data || []) as LinkedInIntegration[];
            setLinkedinIntegrations(rows);
            if (rows[0] && !selectedLinkedInMemberId) setSelectedLinkedInMemberId(rows[0].linkedin_member_id);
        }
        if (!xRes.error) {
            setXIntegration(xRes.data || null);
        }
        const hasIntegration = (pagesRes.data || []).length > 0 || (linkedinRes.data || []).length > 0;
        if (hasIntegration && user?.id) {
            void launchFunnelService.completeStep('integration_connected', user.id, tenant?.id, {
                source: 'social_media_composer_load',
            });
        }
        setLoading(false);
    }, [tenant?.id, user, selectedLinkedInMemberId]);

    useEffect(() => {
        void import('@/services/authService').then(({ authService }) => {
            authService.consumeLinkedInConnectStatusFromUrl();
        });
        loadData();
    }, [loadData]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (!files.length || !tenant?.id) return;
        setUploading(true);
        for (const file of files) {
            const fd = new FormData();
            fd.append('file', file);
            fd.append('tenantId', tenant.id);
            const toastId = toast.loading(`Uploading ${file.name}...`);
            const res = await fetch('/api/social/media/upload', { method: 'POST', body: fd });
            const data = await res.json();
            if (data.success) {
                toast.success('Uploaded!', { id: toastId });
                setMediaAssets(prev => [data.asset, ...prev]);
            } else {
                toast.error(data.error || 'Upload failed', { id: toastId });
            }
        }
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleAddHashtag = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            const tag = hashtagInput.trim().replace(/^#/, '');
            if (tag && !hashtags.includes(tag)) {
                setHashtags(prev => [...prev, tag]);
            }
            setHashtagInput('');
            e.preventDefault();
        }
    };

    const togglePlatform = (p: string) => {
        setPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
    };

    const toggleMediaSelect = (asset: MediaAsset) => {
        if (selectedMedia.includes(asset.public_url)) {
            setSelectedMedia(prev => prev.filter(u => u !== asset.public_url));
            setSelectedMediaTypes(prev => prev.filter((_, i) => selectedMedia[i] !== asset.public_url));
        } else {
            setSelectedMedia(prev => [...prev, asset.public_url]);
            setSelectedMediaTypes(prev => [...prev, asset.asset_type]);
        }
    };

    const handleSubmit = async (publishNow = false) => {
        if (!caption.trim()) return toast.error('Caption is required');
        if (platforms.length === 0) return toast.error('Select at least one platform');
        if (!publishNow && !scheduledAt) return toast.error('Choose "Post Now" or set a schedule date');
        if (platforms.includes('linkedin') && (!isSelectedLinkedInActive || !hasSelectedLinkedInWriteScope)) {
            return toast.error('LinkedIn write scope is missing. Reconnect LinkedIn and approve posting permissions.');
        }

        setSubmitting(true);
        const toastId = toast.loading(publishNow ? 'Publishing...' : 'Scheduling post...');

        const finalCaption = caption + (hashtags.length > 0 ? '\n\n' + hashtags.map(h => `#${h}`).join(' ') : '');

        const res = await fetch('/api/social/schedule', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                tenantId: tenant?.id,
                caption: finalCaption,
                platforms,
                media_urls: selectedMedia,
                media_types: selectedMediaTypes,
                link_url: linkUrl || undefined,
                hashtags,
                scheduled_at: publishNow ? undefined : scheduledAt || undefined,
                publish_now: publishNow,
                facebook_page_id: platforms.includes('facebook') ? selectedPageId : undefined,
                linkedin_member_id: platforms.includes('linkedin') ? (selectedLinkedInMemberId || undefined) : undefined,
            }),
        });
        const data = await res.json();

        if (data.success) {
            toast.success(
                data.publishBlocked ? 'Saved (publishing disabled)' : publishNow ? 'Post sent!' : 'Post scheduled!',
                { id: toastId }
            );
            userLearningPreferencesService.recordSocialPost(finalCaption, aiTone);
            if (!publishNow) {
                await launchFunnelService.completeStep('first_post_scheduled', user?.id, tenant?.id, {
                    source: 'social_composer',
                });
            }
            setCaption('');
            setHashtags([]);
            setHashtagInput('');
            setSelectedMedia([]);
            setSelectedMediaTypes([]);
            setLinkUrl('');
            setScheduledAt('');
            loadData();
            setActiveTab('posts');
        } else {
            toast.error(data.error || 'Failed', { id: toastId });
        }
        setSubmitting(false);
    };

    const handleDeletePost = async (id: string) => {
        if (!confirm('Delete this post?')) return;
        await supabase.from('social_posts').delete().eq('id', id);
        setPosts(prev => prev.filter(p => p.id !== id));
        toast.success('Deleted');
    };

    const handleDeleteMedia = async (asset: MediaAsset) => {
        if (!confirm('Delete this media asset?')) return;
        await supabase.from('media_assets').delete().eq('id', asset.id);
        setMediaAssets(prev => prev.filter(a => a.id !== asset.id));
        toast.success('Deleted');
    };

    const handleConnectLinkedIn = async () => {
        try {
            const { authService } = await import('@/services/authService');
            const { error } = await authService.connectLinkedInIntegration('/dashboard/business/social', tenant?.id);
            if (error) toast.error(error);
        } catch {
            toast.error('Failed to start LinkedIn connection');
        }
    };

    const handleDisconnectLinkedIn = async () => {
        if (!tenant?.id || !selectedLinkedInMemberId) return;
        if (!confirm('Disconnect selected LinkedIn account from this workspace?')) return;
        try {
            const res = await fetch('/api/auth/linkedin/disconnect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tenantId: tenant.id,
                    linkedinMemberId: selectedLinkedInMemberId,
                }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                toast.error(data.error || 'Failed to disconnect LinkedIn');
                return;
            }
            toast.success('LinkedIn disconnected');
            setSelectedLinkedInMemberId('');
            await loadData();
        } catch {
            toast.error('Failed to disconnect LinkedIn');
        }
    };

    const handleLinkedInComment = async (post: SocialPost) => {
        if (!tenant?.id || !post.linkedin_post_urn) return;
        if (!isSelectedLinkedInActive || !hasSelectedLinkedInWriteScope) {
            toast.error('LinkedIn write scope is missing. Reconnect LinkedIn and approve posting permissions.');
            return;
        }
        const text = (linkedinCommentByPost[post.id] || '').trim();
        if (!text) {
            toast.error('Write a comment first');
            return;
        }
        setLinkedinActionLoading((prev) => ({ ...prev, [`comment-${post.id}`]: true }));
        try {
            const res = await fetch('/api/linkedin/comment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tenantId: tenant.id,
                    postUrn: post.linkedin_post_urn,
                    text,
                    linkedinMemberId: selectedLinkedInMemberId || undefined,
                }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                toast.error(data.error || 'Failed to comment on LinkedIn');
                return;
            }
            setLinkedinCommentByPost((prev) => ({ ...prev, [post.id]: '' }));
            toast.success('LinkedIn comment posted');
        } catch {
            toast.error('Failed to comment on LinkedIn');
        } finally {
            setLinkedinActionLoading((prev) => ({ ...prev, [`comment-${post.id}`]: false }));
        }
    };

    const handleLinkedInReaction = async (post: SocialPost) => {
        if (!tenant?.id || !post.linkedin_post_urn) return;
        if (!isSelectedLinkedInActive || !hasSelectedLinkedInWriteScope) {
            toast.error('LinkedIn write scope is missing. Reconnect LinkedIn and approve posting permissions.');
            return;
        }
        const reactionType = linkedinReactionByPost[post.id] || 'LIKE';
        setLinkedinActionLoading((prev) => ({ ...prev, [`reaction-${post.id}`]: true }));
        try {
            const res = await fetch('/api/linkedin/reaction', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tenantId: tenant.id,
                    postUrn: post.linkedin_post_urn,
                    reactionType,
                    linkedinMemberId: selectedLinkedInMemberId || undefined,
                }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                toast.error(data.error || 'Failed to react on LinkedIn');
                return;
            }
            toast.success('LinkedIn reaction sent');
        } catch {
            toast.error('Failed to react on LinkedIn');
        } finally {
            setLinkedinActionLoading((prev) => ({ ...prev, [`reaction-${post.id}`]: false }));
        }
    };

    const handleFacebookComment = async (post: SocialPost) => {
        if (!post.facebook_post_id) return;
        if (!selectedPageId) {
            toast.error('Select a Facebook page first in Compose tab');
            return;
        }
        const text = (facebookCommentByPost[post.id] || '').trim();
        if (!text) {
            toast.error('Write a Facebook comment first');
            return;
        }
        setFacebookActionLoading((prev) => ({ ...prev, [post.id]: true }));
        try {
            const res = await fetch('/api/facebook/comment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pageId: selectedPageId,
                    postId: post.facebook_post_id,
                    message: text,
                }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                toast.error(data.error || 'Failed to post Facebook comment');
                return;
            }
            setFacebookCommentByPost((prev) => ({ ...prev, [post.id]: '' }));
            toast.success('Facebook comment posted');
        } catch {
            toast.error('Failed to post Facebook comment');
        } finally {
            setFacebookActionLoading((prev) => ({ ...prev, [post.id]: false }));
        }
    };

    const generateQuickReply = async (post: SocialPost, target: 'linkedin' | 'facebook') => {
        const key = `${target}-${post.id}`;
        setAiQuickReplyLoading((prev) => ({ ...prev, [key]: true }));
        try {
            const contextText = (post.caption || '').slice(0, 1200);
            const prompt = `Write one short ${target === 'linkedin' ? 'LinkedIn' : 'Facebook'} comment. Tone: witty, friendly, light humor, business-safe. Max 220 characters.

Post context:
${contextText}

Return only the comment text.`;
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
                toast.error(data.error || 'Failed to generate AI quick reply');
                return;
            }
            const text = String(data.text).trim();
            if (target === 'linkedin') {
                setLinkedinCommentByPost((prev) => ({ ...prev, [post.id]: text }));
            } else {
                setFacebookCommentByPost((prev) => ({ ...prev, [post.id]: text }));
            }
            toast.success('AI quick reply ready');
        } catch {
            toast.error('Failed to generate AI quick reply');
        } finally {
            setAiQuickReplyLoading((prev) => ({ ...prev, [key]: false }));
        }
    };

    const handleSaveEditedVideo = async (blob: Blob) => {
        if (!editingAsset || !tenant?.id) return;
        
        const file = new File([blob], `edited_${editingAsset.file_name}`, { type: 'video/mp4' });
        const fd = new FormData();
        fd.append('file', file);
        fd.append('tenantId', tenant.id);

        const toastId = toast.loading('Saving edited video...');
        try {
            const res = await fetch('/api/social/media/upload', { method: 'POST', body: fd });
            const data = await res.json();
            
            if (data.success) {
                toast.success('Edited video saved to library!', { id: toastId });
                setMediaAssets(prev => [data.asset, ...prev]);
                
                // If the original was selected, maybe swap it? 
                // For now just add to library and close editor
                setEditingAsset(null);
            } else {
                throw new Error(data.error);
            }
        } catch (err: any) {
            toast.error(err.message || 'Failed to save edited video', { id: toastId });
        }
    };

    /**
     * Voice-to-text using the Web Speech API.
     * Supported in Chrome and Edge. Appends speech to the existing caption.
     */
    const startVoiceInput = () => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            toast.error('Voice input is not supported in this browser. Please use Chrome or Edge.');
            return;
        }

        // If already listening, stop
        if (isListening && recognitionRef.current) {
            recognitionRef.current.stop();
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        let committedText = caption;

        recognition.onstart = () => setIsListening(true);
        recognition.onend = () => {
            setIsListening(false);
            recognitionRef.current = null;
        };
        recognition.onerror = (e: any) => {
            console.error('Speech recognition error:', e.error);
            if (e.error !== 'aborted') toast.error('Voice input error: ' + e.error);
            setIsListening(false);
            recognitionRef.current = null;
        };
        recognition.onresult = (e: any) => {
            let interim = '';
            for (let i = e.resultIndex; i < e.results.length; i++) {
                const transcript = e.results[i][0].transcript;
                if (e.results[i].isFinal) {
                    committedText += (committedText ? ' ' : '') + transcript.trim();
                } else {
                    interim = transcript;
                }
            }
            setCaption(committedText + (interim ? ' ' + interim : ''));
        };

        recognitionRef.current = recognition;
        recognition.start();
        toast('Listening... speak your caption', { duration: 2000 });
    };

    /**
     * Generate an image via DALL-E 3.
     * Returns a temporary URL — NOT persisted until the user clicks "Attach to Post".
     */
    const generateAIImage = async () => {
        if (!aiImagePrompt.trim()) return toast.error('Describe the image you want to generate');
        setAiImageGenerating(true);
        setAiGeneratedImageUrl(null);
        try {
            const res = await fetch('/api/ai/image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: aiImagePrompt,
                    size: aiImageSize,
                    provider: 'grok',
                    tenantId: tenant?.id || undefined,
                }),
            });
            const data = await res.json();
            if (data.url) {
                setAiGeneratedImageUrl(data.url);
                toast.success('AI image generated!');
            } else {
                toast.error(data.error || 'Image generation failed');
            }
        } catch {
            toast.error('Failed to generate image');
        } finally {
            setAiImageGenerating(false);
        }
    };

    /**
     * Fetch the temporary DALL-E URL and upload it permanently to Supabase storage,
     * then attach it to the current post.
     */
    const attachAIGeneratedImage = async () => {
        if (!aiGeneratedImageUrl || !tenant?.id) return;
        setAttachingImage(true);
        const toastId = toast.loading('Saving image to your library...');
        try {
            const imgRes = await fetch(aiGeneratedImageUrl);
            const blob = await imgRes.blob();
            const fileName = `ai-generated-${Date.now()}.png`;
            const file = new File([blob], fileName, { type: 'image/png' });
            const fd = new FormData();
            fd.append('file', file);
            fd.append('tenantId', tenant.id);
            const res = await fetch('/api/social/media/upload', { method: 'POST', body: fd });
            const data = await res.json();
            if (data.success) {
                toast.success('Image attached to post!', { id: toastId });
                setSelectedMedia(prev => [...prev, data.asset.public_url]);
                setSelectedMediaTypes(prev => [...prev, 'image']);
                setMediaAssets(prev => [data.asset, ...prev]);
                setAiGeneratedImageUrl(null);
                setShowAiImagePanel(false);
                setAiImagePrompt('');
            } else {
                toast.error(data.error || 'Failed to save image', { id: toastId });
            }
        } catch {
            toast.error('Failed to attach image', { id: toastId });
        } finally {
            setAttachingImage(false);
        }
    };

    const generateWithAI = async () => {
        if (!aiTopic.trim()) return toast.error('Describe your post topic first');
        if (recentPosts.length > 0 && !topicDirection) {
            return toast.error('Choose whether to keep the same topic or change topic first.');
        }
        setAiGenerating(true);
        try {
            const businessName = (tenant as any)?.name || 'our business';
            const socialHints = userLearningPreferencesService.getSocialHints();
            const learnedSnippets =
                socialHints?.recentCaptions?.length && socialHints.recentCaptions.length > 0
                    ? ` Prior voice samples from this workspace (paraphrase, do not copy): ${socialHints.recentCaptions
                          .slice(0, 3)
                          .map((s) => s.slice(0, 120))
                          .join(' | ')}.`
                    : '';
            const recentContext = recentTopicHints.length > 0
                ? `Recent topics from the last ${recentTopicWindowDays} days: ${recentTopicHints.join(' | ')}.${learnedSnippets}`
                : `No reliable recent topic hints found.${learnedSnippets}`;
            const directionInstruction =
                topicDirection === 'same'
                    ? 'Continue with a similar topic direction and keep continuity with recent posts while avoiding exact duplicates.'
                    : topicDirection === 'change'
                        ? 'Change topic direction from recent posts and propose a fresh angle that is clearly different.'
                        : 'No topic direction preference provided.';
            const promptByType: Record<typeof aiContentType, string> = {
                caption: `Write a ${aiTone} social media post caption for ${businessName} about: "${aiTopic}". ${recentContext} ${directionInstruction} Also suggest 5-7 relevant hashtags. Format your response as JSON: {"caption": "...", "hashtags": ["tag1", "tag2", ...]}. Caption should be 150-300 chars. Do not include hashtags in the caption itself.`,
                facebook_200_words: `Write a ${aiTone} Facebook business post for ${businessName} about: "${aiTopic}". ${recentContext} ${directionInstruction} The post must be approximately 200 words (between 180 and 220 words). Keep it clear, engaging, and practical. Include a subtle call-to-action at the end. Return ONLY JSON: {"caption":"...","hashtags":["tag1","tag2","tag3"]}.`,
                linkedin_article: `Write a ${aiTone} LinkedIn article draft for ${businessName} about: "${aiTopic}". ${recentContext} ${directionInstruction} Length 500-800 words with: a strong headline, short introduction, 3-5 section headings, actionable insights, and a concise conclusion with CTA. Return ONLY JSON: {"caption":"...","hashtags":["tag1","tag2","tag3","tag4","tag5"]}.`,
            };
            const res = await fetch('/api/ai/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: promptByType[aiContentType],
                    systemPrompt: 'You are an expert social media manager. Write engaging, platform-native content. Return ONLY valid JSON with no markdown or code blocks.',
                    maxTokens: aiContentType === 'linkedin_article' ? 1400 : 500,
                    temperature: 0.8,
                }),
            });
            const data = await res.json();
            if (data.text) {
                try {
                    const cleaned = cleanAIJSONResponse(data.text);
                    const parsed = JSON.parse(cleaned);
                    if (parsed.caption) setCaption(parsed.caption);
                    if (parsed.hashtags?.length) {
                        setHashtags(prev => {
                            const newTags = [...prev];
                            parsed.hashtags.forEach((h: string) => {
                                const tag = h.replace(/^#/, '');
                                if (!newTags.includes(tag)) newTags.push(tag);
                            });
                            return newTags;
                        });
                    }
                    toast.success(aiContentType === 'linkedin_article' ? 'AI generated LinkedIn article draft' : 'AI generated post + hashtags');
                    setShowAiPanel(false);
                    setAiTopic('');
                } catch (err) {
                    console.error('AI Parse error:', err, 'Raw:', data.text);
                    setCaption(data.text);
                    toast.success('AI generated caption!');
                    setShowAiPanel(false);
                }
            } else {
                toast.error(data.error || 'AI generation failed');
            }
        } catch {
            toast.error('AI generation failed');
        } finally {
            setAiGenerating(false);
        }
    };

    const handleRetryPost = async (post: SocialPost) => {
        if (!tenant?.id) return;
        setRetryingPostId(post.id);
        const toastId = toast.loading('Retrying publish...');
        try {
            const res = await fetch('/api/social/schedule', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tenantId: tenant.id,
                    caption: post.caption,
                    platforms: post.platforms || [],
                    media_urls: post.media_urls || [],
                    media_types: post.media_types || [],
                    hashtags: post.hashtags || [],
                    scheduled_at: undefined,
                    facebook_page_id: selectedPageId || undefined,
                    linkedin_member_id: selectedLinkedInMemberId || undefined,
                }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                toast.error(data.error || 'Retry failed', { id: toastId });
                return;
            }
            toast.success('Retry queued successfully', { id: toastId });
            await loadData();
        } catch {
            toast.error('Retry failed', { id: toastId });
        } finally {
            setRetryingPostId(null);
        }
    };

    const charCount = caption.length;
    const fbCharLimit = 63206;
    const charWarning = charCount > 2000;

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <Loader2 className="w-6 h-6 animate-spin text-teal-400" />
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-white">Social Media Composer</h2>
                    <p className="text-sm text-slate-400">Create, schedule and publish posts with images & video</p>
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={async () => {
                            toast.loading('Nexus: Auditing content design...', { id: 'nexus-social' });
                            const res = await fetch('/api/social/command-center', { 
                                method: 'POST', 
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ tenantId: tenant?.id, mode: 'nexus_system_action', systemKey: 'design_audit' })
                            });
                            const data = await res.json();
                            toast.success(data.result.message, { id: 'nexus-social' });
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-violet-400 rounded-xl text-xs font-bold border border-white/5 transition-all shadow-lg shadow-violet-900/5"
                    >
                        <Sparkles className="w-4 h-4" />
                        Nexus Audit
                    </button>
                    <button onClick={loadData} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-400 hover:text-white">
                        <RefreshCw className="w-3 h-3" /> Refresh
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 p-1 bg-slate-800/60 border border-slate-700 rounded-xl w-fit">
                {(['compose', 'posts', 'media'] as const).map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize transition-all ${activeTab === tab ? 'bg-teal-500 text-white' : 'text-slate-400 hover:text-white'}`}>
                        {tab === 'compose' ? 'Composer' : tab === 'posts' ? `Posts (${posts.length})` : `Media (${mediaAssets.length})`}
                    </button>
                ))}
            </div>

            {/* COMPOSE TAB */}
            {activeTab === 'compose' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Main composer */}
                    <div className="lg:col-span-2 space-y-4">
                        {posts.some((p) => p.status === 'failed') && (
                            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                                <p className="text-xs font-semibold text-amber-300 mb-2">
                                    Some posts failed to publish. Review the error and retry.
                                </p>
                                <div className="space-y-2">
                                    {posts.filter((p) => p.status === 'failed').slice(0, 2).map((post) => (
                                        <div key={post.id} className="flex items-start justify-between gap-3 rounded-lg bg-slate-900/40 p-2">
                                            <div>
                                                <p className="text-xs text-slate-200 line-clamp-2">{post.caption}</p>
                                                <p className="text-[11px] text-rose-300 mt-1">{post.error_message || 'Unknown publish error'}</p>
                                            </div>
                                            <button
                                                onClick={() => handleRetryPost(post)}
                                                disabled={retryingPostId === post.id}
                                                className="shrink-0 rounded-lg border border-amber-500/40 px-2.5 py-1 text-xs font-semibold text-amber-200 hover:bg-amber-500/20 disabled:opacity-50"
                                            >
                                                {retryingPostId === post.id ? 'Retrying...' : 'Retry'}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {/* Caption */}
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Caption *</label>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={startVoiceInput}
                                        title={isListening ? 'Stop recording' : 'Voice-type your caption (Chrome/Edge)'}
                                        className={`flex items-center gap-1.5 px-2.5 py-1 border rounded-lg text-xs font-semibold transition-all ${
                                            isListening
                                                ? 'bg-red-500/20 border-red-500/40 text-red-400 animate-pulse'
                                                : 'bg-slate-700/50 hover:bg-slate-700 border-slate-600 text-slate-400 hover:text-white'
                                        }`}
                                    >
                                        {isListening ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                                        {isListening ? 'Stop' : 'Voice'}
                                    </button>
                                    <button
                                        onClick={() => setShowAiPanel(v => !v)}
                                        className="flex items-center gap-1.5 px-2.5 py-1 bg-violet-500/15 hover:bg-violet-500/25 border border-violet-500/30 text-violet-300 rounded-lg text-xs font-semibold transition-colors"
                                    >
                                        <Sparkles className="w-3 h-3" /> AI Write
                                    </button>
                                </div>
                            </div>

                            {/* AI Panel */}
                            {showAiPanel && (
                                <div className="mb-3 p-3 bg-violet-500/10 border border-violet-500/20 rounded-xl space-y-2">
                                    <p className="text-xs font-semibold text-violet-300">AI Caption Generator</p>
                                    <input
                                        value={aiTopic}
                                        onChange={e => setAiTopic(e.target.value)}
                                        placeholder="What is this post about? e.g. 'summer sale, 30% off all services'"
                                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 text-sm"
                                    />
                                    <div className="flex gap-2 flex-wrap">
                                        {(['engaging', 'professional', 'casual', 'promotional'] as const).map(t => (
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
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                        {[
                                            { id: 'caption', label: 'Caption' },
                                            { id: 'facebook_200_words', label: 'Facebook 200 words' },
                                            { id: 'linkedin_article', label: 'LinkedIn article' },
                                        ].map((item) => (
                                            <button
                                                key={item.id}
                                                onClick={() => setAiContentType(item.id as typeof aiContentType)}
                                                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                                                    aiContentType === item.id ? 'bg-teal-500 text-slate-950' : 'bg-slate-800 border border-slate-700 text-slate-400 hover:text-white'
                                                }`}
                                            >
                                                {item.label}
                                            </button>
                                        ))}
                                    </div>
                                    {recentPosts.length > 0 && (
                                        <div className="space-y-2 rounded-lg border border-violet-500/20 bg-slate-900/40 p-2.5">
                                            <p className="text-xs text-violet-200">
                                                Recent posts found in the last {recentTopicWindowDays} days: {recentPosts.length}
                                            </p>
                                            <div className="flex flex-wrap gap-1.5">
                                                <button
                                                    onClick={() => setTopicDirection('same')}
                                                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                                                        topicDirection === 'same'
                                                            ? 'bg-violet-500 text-white'
                                                            : 'bg-slate-800 border border-slate-700 text-slate-300 hover:text-white'
                                                    }`}
                                                >
                                                    Keep same topic flow
                                                </button>
                                                <button
                                                    onClick={() => setTopicDirection('change')}
                                                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                                                        topicDirection === 'change'
                                                            ? 'bg-teal-500 text-slate-950'
                                                            : 'bg-slate-800 border border-slate-700 text-slate-300 hover:text-white'
                                                    }`}
                                                >
                                                    Change topic
                                                </button>
                                            </div>
                                            {recentTopicHints.length > 0 && (
                                                <p className="text-[11px] text-slate-400">
                                                    Recent topic hints: {recentTopicHints.slice(0, 3).join(' | ')}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                    <button
                                        onClick={generateWithAI}
                                        disabled={aiGenerating || !aiTopic.trim() || (recentPosts.length > 0 && !topicDirection)}
                                        className="flex items-center gap-2 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition-colors"
                                    >
                                        {aiGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                                        {aiGenerating
                                            ? 'Generating...'
                                            : aiContentType === 'linkedin_article'
                                                ? 'Generate LinkedIn Article'
                                                : aiContentType === 'facebook_200_words'
                                                    ? 'Generate Facebook 200-word Post'
                                                    : 'Generate Caption + Hashtags'}
                                    </button>
                                </div>
                            )}

                            <textarea
                                value={caption}
                                onChange={e => setCaption(e.target.value)}
                                rows={6}
                                placeholder="Write your post caption here, or use AI Write above..."
                                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 resize-none text-sm"
                            />
                            <p className={`text-xs text-right mt-1 ${charWarning ? 'text-amber-400' : 'text-slate-600'}`}>
                                {charCount.toLocaleString()} chars
                            </p>
                        </div>

                        {/* Media selection */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Media (images / video)</label>
                                <div className="flex gap-2 flex-wrap">
                                    <button onClick={() => fileInputRef.current?.click()}
                                        disabled={uploading}
                                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-300 rounded-lg transition-colors">
                                        {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                                        Upload
                                    </button>
                                    <button onClick={() => setShowMediaPicker(!showMediaPicker)}
                                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-300 rounded-lg transition-colors">
                                        <ImageIcon className="w-3 h-3" /> Library
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowAiImagePanel(v => !v);
                                            if (showAiImagePanel) { setAiGeneratedImageUrl(null); setAiImagePrompt(''); }
                                        }}
                                        className={`flex items-center gap-1.5 text-xs px-3 py-1.5 border rounded-lg transition-all ${
                                            showAiImagePanel
                                                ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
                                                : 'bg-slate-700 hover:bg-slate-600 border-slate-600 text-slate-300 hover:text-white'
                                        }`}
                                    >
                                        <Wand2 className="w-3 h-3" /> AI Image
                                    </button>
                                </div>
                            </div>
                            <input ref={fileInputRef} type="file" multiple accept="image/*,video/*" onChange={handleFileUpload} className="hidden" />

                            {/* AI Image Generator Panel */}
                            {showAiImagePanel && (
                                <div className="mt-3 p-4 bg-indigo-500/5 border border-indigo-500/20 rounded-xl space-y-3">
                                    <div className="flex items-center gap-2">
                                        <Wand2 className="w-4 h-4 text-indigo-400" />
                                        <p className="text-xs font-semibold text-indigo-300">AI Image Generator (DALL-E 3)</p>
                                        <span className="ml-auto text-xs text-slate-500 italic">Images are temporary unless attached</span>
                                    </div>

                                    <textarea
                                        value={aiImagePrompt}
                                        onChange={e => setAiImagePrompt(e.target.value)}
                                        placeholder="Describe the image, e.g. 'A professional team meeting in a modern office, warm lighting, photorealistic'"
                                        rows={2}
                                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-sm resize-none"
                                    />

                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-xs text-slate-500">Size:</span>
                                        {([['1024x1024', 'Square'], ['1792x1024', 'Landscape'], ['1024x1792', 'Portrait']] as const).map(([val, label]) => (
                                            <button
                                                key={val}
                                                onClick={() => setAiImageSize(val)}
                                                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                                                    aiImageSize === val
                                                        ? 'bg-indigo-500 text-white'
                                                        : 'bg-slate-800 border border-slate-700 text-slate-400 hover:text-white'
                                                }`}
                                            >
                                                {label}
                                            </button>
                                        ))}
                                        <button
                                            onClick={generateAIImage}
                                            disabled={aiImageGenerating || !aiImagePrompt.trim()}
                                            className="ml-auto flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition-colors"
                                        >
                                            {aiImageGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                                            {aiImageGenerating ? 'Generating...' : 'Generate'}
                                        </button>
                                    </div>

                                    {/* Generated Image Preview */}
                                    {aiGeneratedImageUrl && (
                                        <div className="relative rounded-xl overflow-hidden border border-indigo-500/30 bg-slate-900">
                                            <img
                                                src={aiGeneratedImageUrl}
                                                alt="AI Generated"
                                                className="w-full max-h-64 object-contain"
                                            />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex items-end p-3 gap-2">
                                                <button
                                                    onClick={attachAIGeneratedImage}
                                                    disabled={attachingImage}
                                                    className="flex items-center gap-2 px-3 py-2 bg-teal-500 hover:bg-teal-400 disabled:opacity-60 text-white rounded-lg text-xs font-bold transition-colors"
                                                >
                                                    {attachingImage ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                                                    {attachingImage ? 'Attaching...' : 'Attach to Post'}
                                                </button>
                                                <button
                                                    onClick={() => { setAiGeneratedImageUrl(null); setAiImagePrompt(''); }}
                                                    className="flex items-center gap-1.5 px-3 py-2 bg-slate-700/80 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition-colors"
                                                >
                                                    <X className="w-3 h-3" /> Discard
                                                </button>
                                                <a
                                                    href={aiGeneratedImageUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="ml-auto flex items-center gap-1.5 px-3 py-2 bg-slate-700/80 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition-colors"
                                                >
                                                    <Eye className="w-3 h-3" /> Full Size
                                                </a>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {selectedMedia.length > 0 && (
                                <div className="flex gap-2 flex-wrap mb-3">
                                    {selectedMedia.map((url, i) => (
                                        <div key={url} className="relative group w-20 h-20 rounded-xl overflow-hidden border border-slate-700">
                                            {selectedMediaTypes[i] === 'video' ? (
                                                <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                                                    <Film className="w-6 h-6 text-slate-400" />
                                                </div>
                                            ) : (
                                                <img src={url} alt="" className="w-full h-full object-cover" />
                                            )}
                                            <button onClick={() => toggleMediaSelect({ public_url: url } as MediaAsset)}
                                                className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                <X className="w-3 h-3 text-white" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {showMediaPicker && (
                                <div className="border border-slate-700 rounded-xl p-3 bg-slate-900/50 max-h-60 overflow-y-auto">
                                    {mediaAssets.length === 0 ? (
                                        <p className="text-slate-500 text-xs text-center py-4">No media uploaded yet</p>
                                    ) : (
                                        <div className="grid grid-cols-4 gap-2">
                                            {mediaAssets.map(asset => (
                                                <button key={asset.id} onClick={() => toggleMediaSelect(asset)}
                                                    className={`relative rounded-lg overflow-hidden border-2 transition-all ${selectedMedia.includes(asset.public_url) ? 'border-teal-500' : 'border-transparent hover:border-slate-600'}`}>
                                                    {asset.asset_type === 'video' ? (
                                                        <div className="w-full aspect-square bg-slate-800 flex items-center justify-center">
                                                            <Film className="w-5 h-5 text-slate-400" />
                                                        </div>
                                                    ) : (
                                                        <img src={asset.public_url} alt={asset.file_name} className="w-full aspect-square object-cover" />
                                                    )}
                                                    {selectedMedia.includes(asset.public_url) && (
                                                        <div className="absolute inset-0 bg-teal-500/20 flex items-center justify-center">
                                                            <CheckCircle2 className="w-5 h-5 text-teal-400" />
                                                        </div>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Hashtags */}
                        <div>
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 block">Hashtags</label>
                            <div className="flex flex-wrap gap-1.5 mb-2">
                                {hashtags.map(tag => (
                                    <span key={tag} className="flex items-center gap-1 px-2 py-0.5 bg-blue-500/15 border border-blue-500/30 text-blue-400 rounded-full text-xs">
                                        #{tag}
                                        <button onClick={() => setHashtags(prev => prev.filter(h => h !== tag))} className="hover:text-red-400">
                                            <X className="w-2.5 h-2.5" />
                                        </button>
                                    </span>
                                ))}
                            </div>
                            <input
                                value={hashtagInput}
                                onChange={e => setHashtagInput(e.target.value)}
                                onKeyDown={handleAddHashtag}
                                placeholder="Type hashtag + Enter (no # needed)"
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 text-sm"
                            />
                        </div>

                        {/* Link */}
                        <div>
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 block">Link (optional)</label>
                            <div className="relative">
                                <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input value={linkUrl} onChange={e => setLinkUrl(e.target.value)}
                                    placeholder="https://yourwebsite.com"
                                    className="w-full pl-9 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 text-sm" />
                            </div>
                        </div>

                        {/* Video editing note */}
                        <div className="flex gap-3 p-3 bg-teal-500/10 border border-teal-500/20 rounded-xl">
                            <Film className="w-4 h-4 text-teal-400 flex-shrink-0 mt-0.5" />
                            <div className="text-xs text-teal-300">
                                <p className="font-semibold mb-0.5">Cloud Video Editor Active</p>
                                <p className="text-teal-400">You can now trim and edit your videos directly in AlphaClone using our open-source processing engine. Click "Edit" on any video in your library.</p>
                            </div>
                        </div>
                    </div>

                    {/* Right panel — platforms + schedule */}
                    <div className="space-y-5">
                        {/* Preview */}
                        <div className="bg-slate-900/50 border border-slate-700 rounded-2xl p-4">
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Preview</p>
                            <div className="bg-slate-800 rounded-xl p-3">
                                {selectedMedia[0] && (
                                    selectedMediaTypes[0] === 'video'
                                        ? <div className="w-full aspect-video bg-slate-900 rounded-lg flex items-center justify-center mb-3"><Film className="w-8 h-8 text-slate-600" /></div>
                                        : <img src={selectedMedia[0]} alt="" className="w-full rounded-lg mb-3 object-cover max-h-48" />
                                )}
                                <p className="text-sm text-white whitespace-pre-line line-clamp-4">{caption || <span className="text-slate-600 italic">Your caption will appear here...</span>}</p>
                                {hashtags.length > 0 && (
                                    <p className="text-xs text-blue-400 mt-2">{hashtags.map(h => `#${h}`).join(' ')}</p>
                                )}
                            </div>
                        </div>

                        {/* Platforms */}
                        <div className="bg-slate-900/50 border border-slate-700 rounded-2xl p-4">
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Platforms</p>
                            {[
                                { id: 'facebook', label: 'Facebook Page', icon: <Facebook className="w-4 h-4 text-blue-400" /> },
                                { id: 'linkedin', label: 'LinkedIn', icon: <Linkedin className="w-4 h-4 text-sky-400" /> },
                                { id: 'twitter', label: 'X (Twitter)', icon: <Twitter className="w-4 h-4 text-[#1DA1F2]" /> },
                                { id: 'platform', label: 'AlphaClone Platform', icon: <Globe className="w-4 h-4 text-teal-400" /> },
                            ].map(p => (
                                <label key={p.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800 cursor-pointer mb-1">
                                    <input type="checkbox" checked={platforms.includes(p.id)} onChange={() => togglePlatform(p.id)}
                                        className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-teal-500 focus:ring-teal-500 focus:ring-offset-0" />
                                    {p.icon}
                                    <span className="text-sm text-slate-300">{p.label}</span>
                                </label>
                            ))}

                            {platforms.includes('twitter') && !xIntegration && (
                                <div className="mt-3 space-y-2">
                                    <p className="text-xs text-amber-400 flex items-center gap-1">
                                        <AlertTriangle className="w-3 h-3" /> Connect X Account first
                                    </p>
                                    <button
                                        onClick={() => window.location.href = '/api/auth/x'}
                                        className="w-full px-3 py-2 text-xs font-semibold rounded-lg bg-[#1DA1F2]/20 border border-[#1DA1F2]/30 text-[#1DA1F2] hover:bg-[#1DA1F2]/30 transition-colors"
                                    >
                                        Connect X
                                    </button>
                                </div>
                            )}

                            {platforms.includes('twitter') && xIntegration && (
                                <div className="mt-3 p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-emerald-400 font-bold">X Connected</span>
                                        <span className="text-xs text-slate-400">@{xIntegration.x_username}</span>
                                    </div>
                                </div>
                            )}

                            {platforms.includes('facebook') && fbPages.length > 0 && (
                                <div className="mt-3">
                                    <label className="text-xs text-slate-500 mb-1 block">Page</label>
                                    <select value={selectedPageId} onChange={e => setSelectedPageId(e.target.value)}
                                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-teal-500">
                                        {fbPages.map(p => <option key={p.page_id} value={p.page_id}>{p.page_name}</option>)}
                                    </select>
                                </div>
                            )}

                            {platforms.includes('facebook') && fbPages.length === 0 && (
                                <p className="text-xs text-amber-400 mt-2 flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3" /> Connect Facebook first
                                </p>
                            )}

                            {platforms.includes('linkedin') && linkedinIntegrations.length === 0 && (
                                <div className="mt-3 space-y-2">
                                    <p className="text-xs text-amber-400 flex items-center gap-1">
                                        <AlertTriangle className="w-3 h-3" /> Connect LinkedIn first
                                    </p>
                                    <button
                                        onClick={handleConnectLinkedIn}
                                        className="w-full px-3 py-2 text-xs font-semibold rounded-lg bg-sky-600/20 border border-sky-500/30 text-sky-300 hover:bg-sky-600/30 transition-colors"
                                    >
                                        Connect LinkedIn
                                    </button>
                                </div>
                            )}

                            {platforms.includes('linkedin') && linkedinIntegrations.length > 0 && (
                                <div className="mt-3 rounded-lg border border-sky-500/20 bg-sky-500/5 p-2.5">
                                    <p className="text-xs font-semibold text-sky-300 mb-2">LinkedIn Scopes</p>
                                    <label className="text-xs text-slate-500 mb-1 block">LinkedIn Account</label>
                                    <select
                                        value={selectedLinkedInMemberId}
                                        onChange={(e) => setSelectedLinkedInMemberId(e.target.value)}
                                        className="w-full px-3 py-2 mb-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-sky-500"
                                    >
                                        {linkedinIntegrations.map((row) => (
                                            <option key={row.linkedin_member_id} value={row.linkedin_member_id}>
                                                {row.linkedin_member_id}
                                            </option>
                                        ))}
                                    </select>
                                    {selectedLinkedInMemberId && (
                                        <p className="text-[11px] text-sky-300 mb-2">Active account: {selectedLinkedInMemberId}</p>
                                    )}
                                    {!isSelectedLinkedInActive && (
                                        <p className="text-xs text-amber-300 mb-2">
                                            Selected account is inactive. Reconnect to activate.
                                        </p>
                                    )}
                                    <button
                                        onClick={handleConnectLinkedIn}
                                        className="w-full mb-2 px-3 py-2 text-xs font-semibold rounded-lg bg-sky-600/20 border border-sky-500/30 text-sky-300 hover:bg-sky-600/30 transition-colors"
                                    >
                                        Reconnect LinkedIn With Write Scope
                                    </button>
                                    <button
                                        onClick={handleDisconnectLinkedIn}
                                        className="w-full mb-2 px-3 py-2 text-xs font-semibold rounded-lg bg-red-600/15 border border-red-500/30 text-red-300 hover:bg-red-600/25 transition-colors"
                                    >
                                        Disconnect LinkedIn
                                    </button>
                                    {(!isSelectedLinkedInActive || !hasSelectedLinkedInWriteScope) && (
                                        <p className="text-xs text-amber-300 mb-2">
                                            Missing write scope `w_member_social`. Reconnect and approve posting permissions.
                                        </p>
                                    )}
                                    <div className="flex flex-wrap gap-1.5">
                                        {(linkedinIntegrations.find((row) => row.linkedin_member_id === selectedLinkedInMemberId)?.scopes || []).length > 0 ? (
                                            (linkedinIntegrations.find((row) => row.linkedin_member_id === selectedLinkedInMemberId)?.scopes || []).map((scope) => (
                                                <span key={scope} className="text-xs px-2 py-0.5 rounded-full border border-slate-600 bg-slate-800 text-slate-300">
                                                    {scope}
                                                </span>
                                            ))
                                        ) : (
                                            <span className="text-xs text-slate-400">No scopes reported by provider metadata.</span>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Schedule */}
                        <div className="bg-slate-900/50 border border-slate-700 rounded-2xl p-4">
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Schedule</p>
                            <div className="mb-3">
                                <AIOutputDisclaimer type="social" />
                            </div>
                            <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-teal-500 text-sm mb-3" />

                            <div className="flex flex-col gap-2">
                                <button
                                    onClick={() => handleSubmit(true)}
                                    disabled={submitting || (platforms.includes('linkedin') && (!isSelectedLinkedInActive || !hasSelectedLinkedInWriteScope))}
                                    className="flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-white rounded-xl font-semibold text-sm transition-colors">
                                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                    Post Now
                                </button>
                                <button
                                    onClick={() => handleSubmit(false)}
                                    disabled={submitting || !scheduledAt || (platforms.includes('linkedin') && (!isSelectedLinkedInActive || !hasSelectedLinkedInWriteScope))}
                                    className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600/30 hover:bg-blue-600/50 disabled:opacity-40 border border-blue-500/30 text-blue-400 rounded-xl font-semibold text-sm transition-colors">
                                    <Calendar className="w-4 h-4" />
                                    Schedule Post
                                </button>
                                <button onClick={async () => {
                                    if (!caption.trim()) return toast.error('Caption required');
                                    const res = await fetch('/api/social/schedule', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ tenantId: tenant?.id, caption, platforms: [], media_urls: selectedMedia, media_types: selectedMediaTypes, hashtags, link_url: linkUrl || undefined, status: 'draft' }),
                                    });
                                    const d = await res.json();
                                    if (d.success) { toast.success('Saved as draft'); loadData(); setActiveTab('posts'); }
                                }} className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-300 rounded-xl text-sm transition-colors">
                                    Save as Draft
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* POSTS TAB */}
            {activeTab === 'posts' && (
                <div className="space-y-3">
                    {posts.length === 0 ? (
                        <div className="text-center py-16 border border-dashed border-slate-700 rounded-2xl">
                            <Send className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                            <p className="text-slate-400 font-semibold">No posts yet</p>
                            <button onClick={() => setActiveTab('compose')} className="mt-3 px-4 py-2 bg-teal-500 hover:bg-teal-400 text-white rounded-xl text-sm font-semibold">Compose your first post</button>
                        </div>
                    ) : posts.map(post => (
                        <div key={post.id} className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap mb-2">
                                        <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_STYLE[post.status] || STATUS_STYLE.draft}`}>
                                            {post.status}
                                        </span>
                                        {post.platforms.map(p => (
                                            <span key={p} className="flex items-center gap-1 text-xs px-2 py-0.5 bg-slate-800 border border-slate-700 rounded-full text-slate-400">
                                                {PLATFORM_ICONS[p]}{p}
                                            </span>
                                        ))}
                                        {post.scheduled_at && (
                                            <span className="text-xs text-blue-400 flex items-center gap-1">
                                                <Clock className="w-3 h-3" />{new Date(post.scheduled_at).toLocaleString()}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm text-slate-300 line-clamp-3 whitespace-pre-line">{post.caption}</p>
                                    {post.media_urls?.length > 0 && (
                                        <div className="flex gap-2 mt-2">
                                            {post.media_urls.slice(0, 3).map((url, i) => (
                                                post.media_types?.[i] === 'video'
                                                    ? <div key={url} className="w-12 h-12 bg-slate-800 rounded-lg flex items-center justify-center"><Film className="w-4 h-4 text-slate-500" /></div>
                                                    : <img key={url} src={url} alt="" className="w-12 h-12 object-cover rounded-lg" />
                                            ))}
                                            {post.media_urls.length > 3 && <div className="w-12 h-12 bg-slate-800 rounded-lg flex items-center justify-center text-xs text-slate-400">+{post.media_urls.length - 3}</div>}
                                        </div>
                                    )}
                                    {post.error_message && (
                                        <p className="text-xs text-red-400 mt-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{post.error_message}</p>
                                    )}
                                    {post.facebook_post_id && (
                                        <div className="mt-2 space-y-2">
                                            <a href={`https://facebook.com/${post.facebook_post_id}`} target="_blank" rel="noopener noreferrer"
                                                className="text-xs text-blue-400 hover:underline flex items-center gap-1">
                                                <ExternalLink className="w-3 h-3" /> View on Facebook
                                            </a>
                                            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2">
                                                <input
                                                    value={facebookCommentByPost[post.id] || ''}
                                                    onChange={(e) => setFacebookCommentByPost((prev) => ({ ...prev, [post.id]: e.target.value }))}
                                                    placeholder="Write a Facebook comment..."
                                                    className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                                                />
                                                <button
                                                    onClick={() => handleFacebookComment(post)}
                                                    disabled={!!facebookActionLoading[post.id]}
                                                    className="px-3 py-2 text-xs rounded-lg bg-blue-600/20 border border-blue-500/30 text-blue-300 hover:bg-blue-600/30 disabled:opacity-50"
                                                >
                                                    {facebookActionLoading[post.id] ? 'Posting...' : 'Comment'}
                                                </button>
                                                <button
                                                    onClick={() => generateQuickReply(post, 'facebook')}
                                                    disabled={!!aiQuickReplyLoading[`facebook-${post.id}`]}
                                                    className="px-3 py-2 text-xs rounded-lg bg-violet-600/20 border border-violet-500/30 text-violet-300 hover:bg-violet-600/30 disabled:opacity-50"
                                                >
                                                    {aiQuickReplyLoading[`facebook-${post.id}`] ? 'Generating...' : 'AI Quick Reply'}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                    {post.linkedin_post_urn && (
                                        <div className="mt-2 space-y-2">
                                            <a
                                                href={`https://www.linkedin.com/feed/update/${encodeURIComponent(post.linkedin_post_urn)}/`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-xs text-sky-400 hover:underline flex items-center gap-1"
                                            >
                                                <ExternalLink className="w-3 h-3" /> View on LinkedIn
                                            </a>
                                            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-2">
                                                <input
                                                    value={linkedinCommentByPost[post.id] || ''}
                                                    onChange={(e) => setLinkedinCommentByPost((prev) => ({ ...prev, [post.id]: e.target.value }))}
                                                    placeholder="Write a LinkedIn comment..."
                                                    className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                                                />
                                                <button
                                                    onClick={() => handleLinkedInComment(post)}
                                                    disabled={!isSelectedLinkedInActive || !hasSelectedLinkedInWriteScope || !!linkedinActionLoading[`comment-${post.id}`]}
                                                    className="px-3 py-2 text-xs rounded-lg bg-sky-600/20 border border-sky-500/30 text-sky-300 hover:bg-sky-600/30 disabled:opacity-50"
                                                >
                                                    {linkedinActionLoading[`comment-${post.id}`] ? 'Posting...' : 'Comment'}
                                                </button>
                                                <button
                                                    onClick={() => generateQuickReply(post, 'linkedin')}
                                                    disabled={!!aiQuickReplyLoading[`linkedin-${post.id}`]}
                                                    className="px-3 py-2 text-xs rounded-lg bg-violet-600/20 border border-violet-500/30 text-violet-300 hover:bg-violet-600/30 disabled:opacity-50"
                                                >
                                                    {aiQuickReplyLoading[`linkedin-${post.id}`] ? 'Generating...' : 'AI Quick Reply'}
                                                </button>
                                                <div className="flex gap-2">
                                                    <select
                                                        value={linkedinReactionByPost[post.id] || 'LIKE'}
                                                        onChange={(e) => setLinkedinReactionByPost((prev) => ({ ...prev, [post.id]: e.target.value }))}
                                                        className="px-2 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-sky-500"
                                                    >
                                                        {['LIKE', 'PRAISE', 'APPRECIATION', 'EMPATHY', 'INTEREST', 'MAYBE'].map((value) => (
                                                            <option key={value} value={value}>{value}</option>
                                                        ))}
                                                    </select>
                                                    <button
                                                        onClick={() => handleLinkedInReaction(post)}
                                                        disabled={!isSelectedLinkedInActive || !hasSelectedLinkedInWriteScope || !!linkedinActionLoading[`reaction-${post.id}`]}
                                                        className="px-3 py-2 text-xs rounded-lg bg-slate-700 border border-slate-600 text-slate-200 hover:bg-slate-600 disabled:opacity-50"
                                                    >
                                                        {linkedinActionLoading[`reaction-${post.id}`] ? 'Sending...' : 'React'}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                    <button onClick={() => handleDeletePost(post.id)}
                                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors">
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* MEDIA LIBRARY TAB */}
            {activeTab === 'media' && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-slate-400">{mediaAssets.length} assets in library</p>
                        <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                            className="flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-white rounded-xl font-semibold text-sm">
                            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                            Upload
                        </button>
                    </div>
                    <input ref={fileInputRef} type="file" multiple accept="image/*,video/*" onChange={handleFileUpload} className="hidden" />

                    {mediaAssets.length === 0 ? (
                        <div className="text-center py-16 border border-dashed border-slate-700 rounded-2xl">
                            <ImageIcon className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                            <p className="text-slate-400 font-semibold">No media yet</p>
                            <p className="text-slate-600 text-sm mt-1">Upload images and videos to use in your posts.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                            {mediaAssets.map(asset => (
                                <div key={asset.id} className="group relative rounded-xl overflow-hidden border border-slate-800 hover:border-slate-600 transition-colors bg-slate-900">
                                    {asset.asset_type === 'video' ? (
                                        <div className="aspect-square bg-slate-800 flex flex-col items-center justify-center gap-1">
                                            <Film className="w-8 h-8 text-slate-500" />
                                            <span className="text-xs text-slate-600">{asset.duration_secs ? `${Math.round(asset.duration_secs)}s` : 'Video'}</span>
                                        </div>
                                    ) : (
                                        <img src={asset.public_url} alt={asset.file_name} className="w-full aspect-square object-cover" />
                                    )}
                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                                        <a href={asset.public_url} target="_blank" rel="noopener noreferrer"
                                            className="p-1.5 bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors">
                                            <Eye className="w-3.5 h-3.5 text-white" />
                                        </a>
                                        <button onClick={() => setEditingAsset(asset)}
                                            className="p-1.5 bg-teal-500/20 rounded-lg hover:bg-teal-500/40 transition-colors">
                                            <Scissors className="w-3.5 h-3.5 text-teal-400" />
                                        </button>
                                        <button onClick={() => handleDeleteMedia(asset)}
                                            className="p-1.5 bg-red-500/20 rounded-lg hover:bg-red-500/40 transition-colors">
                                            <Trash2 className="w-3.5 h-3.5 text-red-400" />
                                        </button>
                                    </div>
                                    <div className="p-2">
                                        <p className="text-xs text-slate-500 truncate">{asset.file_name}</p>
                                        <p className="text-xs text-slate-700">{(asset.file_size_bytes / 1024).toFixed(0)} KB</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Video Editor Modal */}
            {editingAsset && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
                    <div className="w-full max-w-4xl max-h-[90vh]">
                        <VideoEditor 
                            source={editingAsset.public_url}
                            onSave={handleSaveEditedVideo}
                            onCancel={() => setEditingAsset(null)}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
