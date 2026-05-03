'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Linkedin, RefreshCw, ExternalLink, MessageCircle, ThumbsUp, AlertTriangle, Loader2, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';

import { xaiVideoGenerationService } from '@/services/ai/xaiVideoGenerationService';

type LinkedInStatusFilter = 'all' | 'published' | 'scheduled' | 'failed' | 'cancelled';

interface LinkedInPostRow {
  id: string;
  caption: string;
  status: string;
  scheduled_at: string | null;
  published_at: string | null;
  created_at: string;
  linkedin_post_urn: string | null;
  linkedin_member_id: string | null;
  external_id?: string | null;
  analytics?: Record<string, unknown> | null;
  error_message: string | null;
}

interface LinkedInIntegrationRow {
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
  } | null;
}

interface LinkedInCommentRow {
  commentUrn: string;
  text: string;
  actor: string;
  createdAt: number | null;
}

interface LinkedInEngagement {
  likesCount: number;
  commentsCount: number;
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

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-slate-700/50 text-slate-300 border-slate-700',
  scheduled: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  queued: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  publishing: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  published: 'bg-green-500/15 text-green-300 border-green-500/30',
  failed: 'bg-red-500/15 text-red-300 border-red-500/30',
  cancelled: 'bg-slate-600/20 text-slate-400 border-slate-600/30',
};

function isMissingRelationOrColumn(error: any, name: string) {
  if (!error) return false;
  const msg = String(error.message || '');
  return (
    (error.code === '42P01' && msg.includes(name)) ||
    (error.code === '42703' && msg.includes(name)) ||
    msg.includes(name)
  );
}

async function loadLinkedInPostsWithSchemaFallback(tenantId: string) {
  try {
    const res = await fetch(`/api/linkedin/posts?tenantId=${encodeURIComponent(tenantId)}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.success) {
      return {
        data: [] as LinkedInPostRow[],
        error: { message: data?.error || 'Failed to load LinkedIn posts' },
        selectUsed: null as string | null,
      };
    }
    return {
      data: (Array.isArray(data.posts) ? data.posts : []) as LinkedInPostRow[],
      error: null,
      selectUsed: typeof data.selectUsed === 'string' ? data.selectUsed : null,
    };
  } catch (error) {
    return {
      data: [] as LinkedInPostRow[],
      error: { message: error instanceof Error ? error.message : 'Failed to load LinkedIn posts' },
      selectUsed: null as string | null,
    };
  }
}

function isLinkedInPostSchemaBehind(selectUsed: string | null): boolean {
  if (!selectUsed) return true;
  const fields = new Set(
    selectUsed
      .split(',')
      .map((field) => field.trim())
      .filter(Boolean)
  );
  const required = [
    'id',
    'caption',
    'status',
    'created_at',
    'platforms',
  ];
  return required.some((field) => !fields.has(field));
}

export default function LinkedInManagementTab() {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<LinkedInPostRow[]>([]);
  const [integrations, setIntegrations] = useState<LinkedInIntegrationRow[]>([]);
  const [selectedLinkedInMemberId, setSelectedLinkedInMemberId] = useState('');
  const [statusFilter, setStatusFilter] = useState<LinkedInStatusFilter>('all');
  const [commentByPost, setCommentByPost] = useState<Record<string, string>>({});
  const [reactionByPost, setReactionByPost] = useState<Record<string, string>>({});
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [aiReplyLoading, setAiReplyLoading] = useState<Record<string, boolean>>({});
  const [commentsByPost, setCommentsByPost] = useState<Record<string, LinkedInCommentRow[]>>({});
  const [commentsLoading, setCommentsLoading] = useState<Record<string, boolean>>({});
  const [commentsWarningByPost, setCommentsWarningByPost] = useState<Record<string, string>>({});
  const [engagementByPost, setEngagementByPost] = useState<Record<string, LinkedInEngagement>>({});
  const [engagementLoading, setEngagementLoading] = useState<Record<string, boolean>>({});
  const [replyByComment, setReplyByComment] = useState<Record<string, string>>({});
  const [schemaWarning, setSchemaWarning] = useState<string | null>(null);
  const [composeCaption, setComposeCaption] = useState('');
  const [composeLinkUrl, setComposeLinkUrl] = useState('');
  const [composeImageUrl, setComposeImageUrl] = useState('');
  const [composeMediaType, setComposeMediaType] = useState<'image' | 'video'>('image');
  const [mediaUploading, setMediaUploading] = useState(false);
  const [selectedLinkedInOrganizationId, setSelectedLinkedInOrganizationId] = useState('');
  const [composeScheduledAt, setComposeScheduledAt] = useState('');
  const [composeSubmitting, setComposeSubmitting] = useState(false);
  const [aiTopic, setAiTopic] = useState('');
  const [aiTone, setAiTone] = useState<'professional' | 'casual' | 'engaging' | 'promotional'>('professional');
  const [isViralGenerating, setIsViralGenerating] = useState(false);
  const [aiContentType, setAiContentType] = useState<'linkedin_post' | 'linkedin_article'>('linkedin_post');
  const [aiGenerating, setAiGenerating] = useState(false);

  const loadData = useCallback(async () => {
    if (!currentTenant?.id || !user?.id) return;
    setLoading(true);
    setSchemaWarning(null);
    const [postsRes, liRes] = await Promise.all([
      loadLinkedInPostsWithSchemaFallback(currentTenant.id),
      supabase
        .from('linkedin_integrations')
        .select('linkedin_member_id,linkedin_person_urn,scopes,is_active,metadata')
        .eq('tenant_id', currentTenant.id)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
    ]);

    if (postsRes.error) {
      toast.error('Failed to load LinkedIn posts');
    } else {
      setPosts(postsRes.data || []);
      if (isLinkedInPostSchemaBehind(postsRes.selectUsed)) {
        setSchemaWarning(
          'LinkedIn post schema is partially behind. Apply latest social_posts migrations to unlock full LinkedIn tracking fields.'
        );
      }
    }

    if (liRes.error) {
      if (isMissingRelationOrColumn(liRes.error, 'linkedin_member_id')) {
        const liFallback = await supabase
          .from('linkedin_integrations')
          .select('linkedin_person_urn,scopes,is_active,metadata')
          .eq('tenant_id', currentTenant.id)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        if (!liFallback.error) {
          const rows = (liFallback.data || []).map((row: any) => ({
            ...row,
            linkedin_member_id: row.linkedin_person_urn || 'legacy-linkedin-account',
          })) as LinkedInIntegrationRow[];
          setIntegrations(rows);
          if (rows[0] && !selectedLinkedInMemberId) setSelectedLinkedInMemberId(rows[0].linkedin_member_id);
        } else {
          setIntegrations([]);
          setSchemaWarning((prev) => prev || 'LinkedIn integration table is missing in database. Apply latest LinkedIn migration.');
        }
      } else {
        setIntegrations([]);
        setSchemaWarning((prev) => prev || 'LinkedIn integration table is missing in database. Apply latest LinkedIn migration.');
      }
    } else {
      const rows = (liRes.data || []) as LinkedInIntegrationRow[];
      setIntegrations(rows);
      if (rows[0] && !selectedLinkedInMemberId) setSelectedLinkedInMemberId(rows[0].linkedin_member_id);
    }
    setLoading(false);
  }, [currentTenant?.id, user?.id, selectedLinkedInMemberId]);

  useEffect(() => {
    void import('@/services/authService').then(({ authService }) => {
      authService.consumeLinkedInConnectStatusFromUrl();
    });
    loadData();
  }, [loadData]);

  const filteredPosts = useMemo(() => {
    const accountPosts = selectedLinkedInMemberId
      ? posts.filter((post) => !post.linkedin_member_id || post.linkedin_member_id === selectedLinkedInMemberId)
      : posts;
    if (statusFilter === 'all') return accountPosts;
    return accountPosts.filter((post) => post.status === statusFilter);
  }, [posts, statusFilter, selectedLinkedInMemberId]);

  const duplicateGroups = useMemo(() => {
    const groups: Record<string, string[]> = {};
    posts.forEach((p) => {
      const cap = (p.caption || '').trim().toLowerCase();
      if (!cap || cap.length < 10) return;
      if (!groups[cap]) groups[cap] = [];
      groups[cap].push(p.id);
    });
    const filtered: Record<string, string[]> = {};
    Object.entries(groups).forEach(([text, ids]) => {
      if (ids.length > 1) filtered[text] = ids;
    });
    return filtered;
  }, [posts]);

  const duplicateCount = useMemo(() => Object.values(duplicateGroups).length, [duplicateGroups]);

  const hasWriteScope = useMemo(() => {
    const scopes = integrations.find((row) => row.linkedin_member_id === selectedLinkedInMemberId)?.scopes || [];
    return normalizeScopes(scopes).includes('w_member_social');
  }, [integrations, selectedLinkedInMemberId]);
  const selectedIntegration = useMemo(
    () => integrations.find((row) => row.linkedin_member_id === selectedLinkedInMemberId) || null,
    [integrations, selectedLinkedInMemberId]
  );
  const canComposeLinkedIn = !!currentTenant?.id && !!selectedLinkedInMemberId && !!selectedIntegration?.is_active && hasWriteScope;
  const companyPages = useMemo(
    () => (Array.isArray(selectedIntegration?.metadata?.company_pages) ? selectedIntegration?.metadata?.company_pages || [] : []),
    [selectedIntegration]
  );
  const hasOrganizationWriteScope = useMemo(() => {
    const scopes = integrations.find((row) => row.linkedin_member_id === selectedLinkedInMemberId)?.scopes || [];
    return normalizeScopes(scopes).includes('w_organization_social');
  }, [integrations, selectedLinkedInMemberId]);
  const canPostAsSelectedCompany = !selectedLinkedInOrganizationId || hasOrganizationWriteScope;

  const handleConnectLinkedIn = async () => {
    try {
      const { authService } = await import('@/services/authService');
      const { error } = await authService.connectLinkedInIntegration('/dashboard/business/linkedin', currentTenant?.id);
      if (error) toast.error(error);
    } catch {
      toast.error('Failed to start LinkedIn connection');
    }
  };

  const resolveLinkedInPostUrn = useCallback((post: LinkedInPostRow): string | null => {
    const directUrn = String(post.linkedin_post_urn || '').trim();
    if (directUrn) return directUrn;

    const analyticsUrn = String((post.analytics as Record<string, unknown> | null)?.linkedin_post_urn || '').trim();
    if (analyticsUrn) return analyticsUrn;

    const externalId = String(post.external_id || '').trim();
    if (externalId.startsWith('urn:li:')) return externalId;
    return null;
  }, []);

  const handleDisconnectLinkedIn = async () => {
    if (!currentTenant?.id || !selectedLinkedInMemberId) return;
    if (!window.confirm('Disconnect selected LinkedIn account from this workspace?')) return;
    try {
      const res = await fetch('/api/auth/linkedin/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: currentTenant.id,
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

  const handleComment = async (post: LinkedInPostRow, targetUrn?: string, replyText?: string) => {
    if (!currentTenant?.id) return;
    const resolvedPostUrn = resolveLinkedInPostUrn(post);
    if (!resolvedPostUrn) {
      toast.error('This post is missing a LinkedIn post reference. Sync published posts and retry.');
      return;
    }
    if (!hasWriteScope) {
      toast.error('LinkedIn write scope is missing. Reconnect LinkedIn and approve posting permissions.');
      return;
    }
    const text = (replyText ?? commentByPost[post.id] ?? '').trim();
    if (!text) return toast.error('Write a comment first');

    const actionKey = targetUrn ? `reply-${targetUrn}` : `comment-${post.id}`;
    setActionLoading((prev) => ({ ...prev, [actionKey]: true }));
    try {
      const res = await fetch('/api/linkedin/comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: currentTenant.id,
          postUrn: resolvedPostUrn,
          parentCommentUrn: targetUrn || undefined,
          text,
          linkedinMemberId: selectedLinkedInMemberId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) return toast.error(data.error || 'Failed to post comment');
      if (targetUrn) {
        setReplyByComment((prev) => ({ ...prev, [targetUrn]: '' }));
        toast.success('LinkedIn reply posted');
      } else {
        setCommentByPost((prev) => ({ ...prev, [post.id]: '' }));
        toast.success('LinkedIn comment posted');
      }
      await loadComments(post);
    } catch {
      toast.error('Failed to post comment');
    } finally {
      setActionLoading((prev) => ({ ...prev, [actionKey]: false }));
    }
  };

  const handleReaction = async (post: LinkedInPostRow) => {
    if (!currentTenant?.id) return;
    const resolvedPostUrn = resolveLinkedInPostUrn(post);
    if (!resolvedPostUrn) {
      toast.error('This post is missing a LinkedIn post reference. Sync published posts and retry.');
      return;
    }
    if (!hasWriteScope) {
      toast.error('LinkedIn write scope is missing. Reconnect LinkedIn and approve posting permissions.');
      return;
    }
    const reactionType = reactionByPost[post.id] || 'LIKE';
    setActionLoading((prev) => ({ ...prev, [`reaction-${post.id}`]: true }));
    try {
      const res = await fetch('/api/linkedin/reaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: currentTenant.id,
          postUrn: resolvedPostUrn,
          reactionType,
          linkedinMemberId: selectedLinkedInMemberId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) return toast.error(data.error || 'Failed to send reaction');
      toast.success('LinkedIn reaction sent');
    } catch {
      toast.error('Failed to send reaction');
    } finally {
      setActionLoading((prev) => ({ ...prev, [`reaction-${post.id}`]: false }));
    }
  };

  const handleGenerateAiReply = async (post: LinkedInPostRow, parentCommentUrn?: string, parentCommentText?: string) => {
    const aiKey = parentCommentUrn ? `reply-${parentCommentUrn}` : post.id;
    setAiReplyLoading((prev) => ({ ...prev, [aiKey]: true }));
    try {
      const contextCaption = (post.caption || '').slice(0, 1200);
      const parentContext = parentCommentText
        ? `Comment to reply to:\n${String(parentCommentText).slice(0, 700)}\n\n`
        : '';
      const prompt = `Write one short LinkedIn comment reply. Tone: smart, friendly, light humor, business-safe, no slang. Max 220 characters.

Post caption:
${contextCaption}

${parentContext}Return only the comment text.`;

      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          model: 'grok-2-latest',
          temperature: 0.9,
          maxTokens: 120,
          tenantId: currentTenant?.id || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.text) {
        toast.error(data.error || 'Failed to generate AI reply');
        return;
      }
      if (parentCommentUrn) {
        setReplyByComment((prev) => ({ ...prev, [parentCommentUrn]: String(data.text).trim() }));
      } else {
        setCommentByPost((prev) => ({ ...prev, [post.id]: String(data.text).trim() }));
      }
      toast.success('AI quick reply ready');
    } catch {
      toast.error('Failed to generate AI reply');
    } finally {
      setAiReplyLoading((prev) => ({ ...prev, [aiKey]: false }));
    }
  };

  const loadComments = async (post: LinkedInPostRow) => {
    if (!currentTenant?.id) return;
    const resolvedPostUrn = resolveLinkedInPostUrn(post);
    if (!resolvedPostUrn) return;
    setCommentsLoading((prev) => ({ ...prev, [post.id]: true }));
    setCommentsWarningByPost((prev) => ({ ...prev, [post.id]: '' }));
    try {
      const res = await fetch('/api/linkedin/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: currentTenant.id,
          postUrn: resolvedPostUrn,
          linkedinMemberId: selectedLinkedInMemberId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || 'Failed to load LinkedIn comments');
        return;
      }
      if (typeof data.warning === 'string' && data.warning.trim()) {
        setCommentsWarningByPost((prev) => ({ ...prev, [post.id]: data.warning }));
        toast.error(data.warning);
      }
      setCommentsByPost((prev) => ({
        ...prev,
        [post.id]: Array.isArray(data.comments) ? data.comments : [],
      }));
    } catch {
      toast.error('Failed to load LinkedIn comments');
    } finally {
      setCommentsLoading((prev) => ({ ...prev, [post.id]: false }));
    }
  };

  const loadEngagement = async (post: LinkedInPostRow) => {
    if (!currentTenant?.id) return;
    const resolvedPostUrn = resolveLinkedInPostUrn(post);
    if (!resolvedPostUrn) return;
    setEngagementLoading((prev) => ({ ...prev, [post.id]: true }));
    try {
      const res = await fetch('/api/linkedin/engagement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: currentTenant.id,
          postUrn: resolvedPostUrn,
          linkedinMemberId: selectedLinkedInMemberId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) return;
      setEngagementByPost((prev) => ({
        ...prev,
        [post.id]: {
          likesCount: Number(data.likesCount || 0),
          commentsCount: Number(data.commentsCount || 0),
        },
      }));
    } catch {
      // ignore transient engagement fetch errors
    } finally {
      setEngagementLoading((prev) => ({ ...prev, [post.id]: false }));
    }
  };


  const handleSubmitLinkedInPost = async (publishNow: boolean) => {
    if (!currentTenant?.id) return;
    const caption = composeCaption.trim();
    if (!caption) {
      toast.error('Write post content first');
      return;
    }
    if (!selectedLinkedInMemberId) {
      toast.error('Select a LinkedIn account first');
      return;
    }
    if (!selectedIntegration?.is_active || !hasWriteScope) {
      toast.error('LinkedIn write scope is missing. Reconnect LinkedIn and approve posting permissions.');
      return;
    }
    if (!publishNow && !composeScheduledAt) {
      toast.error('Select schedule date/time or use Post Now');
      return;
    }

    setComposeSubmitting(true);
    const toastId = toast.loading(publishNow ? 'Posting to LinkedIn...' : 'Scheduling LinkedIn post...');
    try {
      const res = await fetch('/api/social/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: currentTenant.id,
          caption,
          platforms: ['linkedin'],
          link_url: composeLinkUrl.trim() || undefined,
          media_urls: composeImageUrl.trim() ? [composeImageUrl.trim()] : undefined,
          media_types: composeImageUrl.trim() ? [composeMediaType] : undefined,
          scheduled_at: publishNow ? undefined : composeScheduledAt,
          linkedin_member_id: selectedLinkedInMemberId,
          linkedin_organization_id: selectedLinkedInOrganizationId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || 'Failed to submit LinkedIn post', { id: toastId });
        return;
      }
      toast.success(publishNow ? 'LinkedIn post submitted' : 'LinkedIn post scheduled', { id: toastId });
      setComposeCaption('');
      setComposeLinkUrl('');
      setComposeImageUrl('');
      setComposeMediaType('image');
      setComposeScheduledAt('');
      await loadData();
    } catch {
      toast.error('Failed to submit LinkedIn post', { id: toastId });
    } finally {
      setComposeSubmitting(false);
    }
  };

  const handleUploadLinkedInMedia = async (file: File) => {
    if (!currentTenant?.id) return;
    setMediaUploading(true);
    try {
      const fd = new FormData();
      fd.append('tenantId', currentTenant.id);
      fd.append('file', file);
      const res = await fetch('/api/social/media/upload', {
        method: 'POST',
        body: fd,
      });
      const data = await res.json();
      if (!res.ok || !data?.success || !data?.asset?.public_url) {
        toast.error(data?.error || 'Failed to upload media');
        return;
      }
      const uploadedType = String(data.asset.asset_type || '').toLowerCase();
      setComposeMediaType(uploadedType === 'video' ? 'video' : 'image');
      setComposeImageUrl(String(data.asset.public_url));
      toast.success('Media uploaded');
    } catch {
      toast.error('Failed to upload media');
    } finally {
      setMediaUploading(false);
    }
  };

  const handleGenerateLinkedInContent = async () => {
    if (!currentTenant?.id) return;
    if (!aiTopic.trim()) {
      toast.error('Describe the topic first');
      return;
    }
    setAiGenerating(true);
    try {
      const promptByType: Record<typeof aiContentType, string> = {
        linkedin_post: `Write a ${aiTone} LinkedIn post about: "${aiTopic}". Keep it practical, clear, and native to LinkedIn. Length 160-320 words. End with a subtle call-to-action. Return ONLY JSON: {"caption":"...","hashtags":["tag1","tag2","tag3","tag4","tag5"]}.`,
        linkedin_article: `Write a ${aiTone} LinkedIn article draft about: "${aiTopic}". Length 500-900 words with a strong title line, short intro, 3-5 section headings, practical insights, and concise CTA ending. Return ONLY JSON: {"caption":"...","hashtags":["tag1","tag2","tag3","tag4","tag5"]}.`,
      };
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptByType[aiContentType],
          systemPrompt: 'You are an expert LinkedIn content strategist for business users. Return only valid JSON.',
          maxTokens: aiContentType === 'linkedin_article' ? 1400 : 550,
          temperature: 0.8,
          model: 'grok-2-latest',
          tenantId: currentTenant.id,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.text) {
        toast.error(data.error || 'Failed to generate LinkedIn content');
        return;
      }
      try {
        const parsed = JSON.parse(String(data.text).trim());
        const caption = typeof parsed.caption === 'string' ? parsed.caption.trim() : '';
        if (caption) setComposeCaption(caption);
      } catch {
        setComposeCaption(String(data.text).trim());
      }
      toast.success(aiContentType === 'linkedin_article' ? 'AI article draft generated' : 'AI LinkedIn post generated');
    } catch {
      toast.error('Failed to generate LinkedIn content');
    } finally {
      setAiGenerating(false);
    }
  };

  const handleGenerateViralHook = async () => {
    if (!aiTopic.trim()) {
      toast.error('Describe the video topic first');
      return;
    }
    setIsViralGenerating(true);
    try {
      const result = await xaiVideoGenerationService.generateViralScript(aiTopic, 'high');
      setComposeCaption(`${result.hook}\n\n${result.script}\n\n${result.visualCues ? `[Visual Cues: ${result.visualCues}]` : ''}`);
      toast.success('Viral business hook generated!');
    } catch {
      toast.error('Failed to generate viral hook');
    } finally {
      setIsViralGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="h-64 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
        <p className="text-xs text-slate-500 font-medium animate-pulse">Syncing LinkedIn data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Topbar ────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl bg-slate-900/40 border border-slate-800/60 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-sky-600/20 flex items-center justify-center border border-sky-500/30">
            <Linkedin className="w-6 h-6 text-sky-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">LinkedIn manager</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <div className={`w-2 h-2 rounded-full ${selectedIntegration?.is_active ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]'}`} />
              <p className="text-xs text-slate-400 font-medium">
                {selectedIntegration?.is_active 
                  ? `${selectedLinkedInMemberId} — personal profile` 
                  : 'Disconnected — reconnect required'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!selectedIntegration?.is_active && (
            <button
              onClick={handleConnectLinkedIn}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-500 text-white transition-colors shadow-lg shadow-red-900/20"
            >
              Connect
            </button>
          )}
          <button
            onClick={loadData}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 transition-all flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
          <button
            onClick={() => {
              const el = document.getElementById('compose-section');
              el?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-950 hover:bg-white transition-all flex items-center gap-1.5"
          >
            <span className="text-sm font-bold">+</span>
            New post
          </button>
        </div>
      </div>

      {schemaWarning && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200 flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          {schemaWarning}
        </div>
      )}

      {/* ── Main Layout ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6 items-start">
        
        {/* ── Left Column: Queue ─────────────────────────────────────── */}
        <div className="space-y-4">
          <div className="px-1">
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider opacity-60">Post queue</h3>
            <p className="text-xs text-slate-500 mt-1">Scheduled and published posts</p>
          </div>

          {duplicateCount > 0 && (
            <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0 border border-amber-500/30">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-amber-200">
                  {duplicateCount === 1 
                    ? '2 posts with identical content detected — review before publishing' 
                    : `${duplicateCount * 2} posts with duplicate content detected`}
                </p>
                <p className="text-xs text-amber-400/80 mt-0.5">Duplicates are flagged in your queue below.</p>
              </div>
            </div>
          )}

          <div className="flex gap-2 flex-wrap pb-2">
            {(['all', 'published', 'scheduled', 'failed', 'cancelled'] as LinkedInStatusFilter[]).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${
                  statusFilter === status
                    ? 'bg-sky-600 border-sky-500 text-white shadow-lg shadow-sky-900/20'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700'
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>

          <div className="space-y-1 bg-slate-900/40 rounded-2xl border border-slate-800/60 overflow-hidden divide-y divide-slate-800/60">
            {filteredPosts.length === 0 ? (
              <div className="py-20 text-center">
                <Linkedin className="w-10 h-10 text-slate-700 mx-auto mb-3 opacity-20" />
                <p className="text-slate-500 text-sm">No LinkedIn posts for selected filter.</p>
              </div>
            ) : (
              filteredPosts.map((post) => {
                const isDup = Object.values(duplicateGroups).some(ids => ids.includes(post.id));
                return (
                  <div 
                    key={post.id} 
                    className={`p-5 transition-all group relative ${isDup ? 'bg-amber-500/[0.03]' : 'hover:bg-white/[0.02]'}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex flex-col gap-1.5 shrink-0">
                        {isDup && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 uppercase tracking-tighter">
                            Duplicate
                          </span>
                        )}
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-tighter w-fit ${STATUS_BADGE[post.status] || STATUS_BADGE.draft}`}>
                          {post.status}
                        </span>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium leading-relaxed ${isDup ? 'text-slate-100' : 'text-slate-300'} line-clamp-2 mb-1 group-hover:line-clamp-none transition-all`}>
                          {post.caption}
                        </p>
                        <div className="flex items-center gap-3 text-[11px] text-slate-500 font-medium">
                          <span>{new Date(post.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                          <span className="opacity-30">—</span>
                          <span>{new Date(post.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
                          
                          {resolveLinkedInPostUrn(post) && (
                            <>
                              <span className="opacity-30">—</span>
                              <a
                                href={`https://www.linkedin.com/feed/update/${encodeURIComponent(resolveLinkedInPostUrn(post) || '')}/`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sky-400 hover:text-sky-300 hover:underline flex items-center gap-1"
                              >
                                View on LinkedIn
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => loadComments(post)}
                          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-all"
                          title="View comments"
                        >
                          <MessageCircle className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => loadEngagement(post)}
                          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-all"
                          title="Refresh stats"
                        >
                          <ThumbsUp className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Quick Engagement Stats */}
                    {(engagementByPost[post.id] || (commentsByPost[post.id]?.length > 0)) && (
                      <div className="mt-3 flex items-center gap-4 text-[10px] text-slate-500 font-bold uppercase tracking-widest pl-[60px]">
                        <span className="flex items-center gap-1">
                          <ThumbsUp className="w-3 h-3 text-slate-600" />
                          {engagementByPost[post.id]?.likesCount ?? 0} Likes
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageCircle className="w-3 h-3 text-slate-600" />
                          {engagementByPost[post.id]?.commentsCount ?? (commentsByPost[post.id]?.length || 0)} Comments
                        </span>
                      </div>
                    )}

                    {/* Inline Comments Area (Expanding) */}
                    {commentsByPost[post.id] && (
                      <div className="mt-4 pl-[60px] space-y-3 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Recent Comments</p>
                          <button onClick={() => setCommentsByPost(prev => { const n = {...prev}; delete n[post.id]; return n; })} className="text-[10px] text-slate-600 hover:text-slate-400">Close</button>
                        </div>
                        {commentsByPost[post.id].length === 0 ? (
                          <p className="text-xs text-slate-600 italic">No comments found.</p>
                        ) : (
                          commentsByPost[post.id].slice(0, 5).map(c => (
                            <div key={c.commentUrn} className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.05] space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-sky-400">{c.actor || 'LinkedIn User'}</span>
                                <span className="text-[9px] text-slate-600">{c.createdAt ? new Date(c.createdAt).toLocaleDateString() : ''}</span>
                              </div>
                              <p className="text-xs text-slate-300">{c.text}</p>
                              <div className="flex gap-2">
                                <input 
                                  value={replyByComment[c.commentUrn] || ''}
                                  onChange={(e) => setReplyByComment(prev => ({...prev, [c.commentUrn]: e.target.value}))}
                                  placeholder="Type reply..." 
                                  className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white focus:border-sky-500 focus:outline-none"
                                />
                                <button 
                                  onClick={() => handleComment(post, c.commentUrn)}
                                  className="px-2 py-1 rounded-lg bg-sky-600/20 text-sky-400 text-[10px] font-bold hover:bg-sky-600/30"
                                >
                                  Reply
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── Right Column: Compose ──────────────────────────────────── */}
        <div id="compose-section" className="space-y-4 lg:sticky lg:top-6">
          <div className="px-1 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider opacity-60">Compose</h3>
              <p className="text-xs text-slate-500 mt-1">
                Post as {selectedLinkedInOrganizationId ? 'company' : 'personal profile'}
              </p>
            </div>
            <div className="px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-violet-400" />
              <span className="text-[10px] font-bold text-violet-300 uppercase tracking-tighter">AI draft</span>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800/60 space-y-5">
            {/* AI Controls */}
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Tone</label>
                <div className="flex flex-wrap gap-1.5">
                  {(['Professional', 'Engaging', 'Casual', 'Promotional'] as const).map((tone) => (
                    <button
                      key={tone}
                      onClick={() => setAiTone(tone.toLowerCase() as any)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        aiTone === tone.toLowerCase() 
                          ? 'bg-sky-600 text-white shadow-lg shadow-sky-900/20' 
                          : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {tone}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Format</label>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setAiContentType('linkedin_post')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      aiContentType === 'linkedin_post' 
                        ? 'bg-sky-600 text-white shadow-lg shadow-sky-900/20' 
                        : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    LinkedIn post
                  </button>
                  <button
                    onClick={() => setAiContentType('linkedin_article')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      aiContentType === 'linkedin_article' 
                        ? 'bg-sky-600 text-white shadow-lg shadow-sky-900/20' 
                        : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Article
                  </button>
                  <button
                    onClick={handleGenerateViralHook}
                    disabled={isViralGenerating || !aiTopic.trim()}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-800 text-slate-400 hover:text-slate-200 border border-transparent hover:border-rose-500/30 transition-all disabled:opacity-30"
                  >
                    {isViralGenerating ? '...' : 'Viral hook'}
                  </button>
                  <button
                    onClick={handleGenerateLinkedInContent}
                    disabled={aiGenerating || !aiTopic.trim()}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-800 text-slate-400 hover:text-slate-200 transition-all disabled:opacity-30"
                  >
                    {aiGenerating ? '...' : 'Standard AI'}
                  </button>
                </div>
              </div>
            </div>

            <div className="relative group">
              <textarea
                value={aiTopic}
                onChange={(e) => setAiTopic(e.target.value)}
                placeholder="What should this post be about? Describe it or let AI draft it..."
                rows={3}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-white placeholder-slate-600 focus:border-sky-500/50 focus:outline-none transition-all resize-none group-hover:border-slate-700"
              />
            </div>

            <div className="space-y-3 pt-2">
              <div className="group relative">
                <textarea
                  value={composeCaption}
                  onChange={(e) => setComposeCaption(e.target.value)}
                  placeholder="Post content will appear here..."
                  rows={6}
                  className="w-full bg-transparent border-b border-slate-800 py-2 text-sm text-slate-300 placeholder-slate-700 focus:border-sky-500 focus:outline-none transition-all resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <input
                  value={composeLinkUrl}
                  onChange={(e) => setComposeLinkUrl(e.target.value)}
                  placeholder="Link URL (option)"
                  className="bg-slate-800/50 border border-slate-700/50 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:border-sky-500 focus:outline-none"
                />
                <input
                  value={composeImageUrl}
                  onChange={(e) => setComposeImageUrl(e.target.value)}
                  placeholder="Media URL (option)"
                  className="bg-slate-800/50 border border-slate-700/50 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:border-sky-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <div className="flex-1 relative">
                  <input
                    type="datetime-local"
                    value={composeScheduledAt}
                    onChange={(e) => setComposeScheduledAt(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:border-sky-500 focus:outline-none [color-scheme:dark]"
                  />
                </div>
                <button
                  onClick={() => handleSubmitLinkedInPost(false)}
                  disabled={composeSubmitting || !composeScheduledAt || !canComposeLinkedIn}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-white text-slate-950 hover:bg-slate-100 disabled:opacity-20 transition-all"
                >
                  Schedule
                </button>
              </div>

              <button
                onClick={() => handleSubmitLinkedInPost(true)}
                disabled={composeSubmitting || !canComposeLinkedIn}
                className="w-full py-3 rounded-xl text-sm font-bold bg-sky-600 hover:bg-sky-500 text-white shadow-lg shadow-sky-900/40 transition-all disabled:opacity-50"
              >
                {composeSubmitting ? 'Publishing...' : 'Publish now'}
              </button>

              <div className="pt-2 border-t border-slate-800/50">
                 <select
                  value={selectedLinkedInOrganizationId}
                  onChange={(e) => setSelectedLinkedInOrganizationId(e.target.value)}
                  className="w-full bg-transparent text-[10px] font-bold text-slate-500 uppercase tracking-widest focus:outline-none cursor-pointer hover:text-slate-300 transition-colors"
                >
                  <option value="" className="bg-slate-900">Personal Profile</option>
                  {companyPages.map((page) => (
                    <option key={page.id} value={page.id} className="bg-slate-900">
                      Company: {page.name || page.vanityName}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
