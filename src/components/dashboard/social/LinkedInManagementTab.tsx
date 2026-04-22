'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Linkedin, RefreshCw, ExternalLink, MessageCircle, ThumbsUp, AlertTriangle, Loader2, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';

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

interface LinkedInInboxItem {
  postId: string;
  postUrn: string;
  postCaption: string;
  commentUrn: string;
  commentText: string;
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
  const [inboxItems, setInboxItems] = useState<LinkedInInboxItem[]>([]);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [inboxReplyByComment, setInboxReplyByComment] = useState<Record<string, string>>({});
  const [inboxActionLoading, setInboxActionLoading] = useState<Record<string, boolean>>({});
  const [inboxAiLoading, setInboxAiLoading] = useState<Record<string, boolean>>({});
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

  const loadInbox = async () => {
    if (!currentTenant?.id) return;
    setInboxLoading(true);
    try {
      const res = await fetch('/api/linkedin/inbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: currentTenant.id,
          linkedinMemberId: selectedLinkedInMemberId || undefined,
          limit: 50,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || 'Failed to load LinkedIn inbox');
        return;
      }
      setInboxItems(Array.isArray(data.items) ? data.items : []);
      if (data.note) {
        toast.success('LinkedIn engagement inbox updated');
      }
    } catch {
      toast.error('Failed to load LinkedIn inbox');
    } finally {
      setInboxLoading(false);
    }
  };

  const handleInboxReply = async (item: LinkedInInboxItem) => {
    if (!currentTenant?.id) return;
    if (!hasWriteScope) {
      toast.error('LinkedIn write scope is missing. Reconnect LinkedIn and approve posting permissions.');
      return;
    }
    const message = (inboxReplyByComment[item.commentUrn] || '').trim();
    if (!message) {
      toast.error('Write a reply first');
      return;
    }
    setInboxActionLoading((prev) => ({ ...prev, [item.commentUrn]: true }));
    try {
      const res = await fetch('/api/linkedin/comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: currentTenant.id,
          postUrn: item.postUrn,
          parentCommentUrn: item.commentUrn,
          text: message,
          linkedinMemberId: selectedLinkedInMemberId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || 'Failed to send LinkedIn reply');
        return;
      }
      setInboxReplyByComment((prev) => ({ ...prev, [item.commentUrn]: '' }));
      toast.success('LinkedIn reply sent');
    } catch {
      toast.error('Failed to send LinkedIn reply');
    } finally {
      setInboxActionLoading((prev) => ({ ...prev, [item.commentUrn]: false }));
    }
  };

  const handleGenerateInboxAiReply = async (item: LinkedInInboxItem) => {
    setInboxAiLoading((prev) => ({ ...prev, [item.commentUrn]: true }));
    try {
      const prompt = `Write one short LinkedIn reply to this inbound comment. Tone: smart, friendly, light humor, professional-safe, no slang. Max 220 characters.

Post caption:
${String(item.postCaption || '').slice(0, 900)}

Inbound comment:
${String(item.commentText || '').slice(0, 500)}

Return only the reply text.`;
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
      setInboxReplyByComment((prev) => ({ ...prev, [item.commentUrn]: String(data.text).trim() }));
      toast.success('AI inbox reply ready');
    } catch {
      toast.error('Failed to generate AI reply');
    } finally {
      setInboxAiLoading((prev) => ({ ...prev, [item.commentUrn]: false }));
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

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-sky-400" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Linkedin className="w-5 h-5 text-sky-400" />
            LinkedIn Manager
          </h2>
          <p className="text-sm text-slate-400">Manage LinkedIn posts, status, comments, and reactions from dashboard.</p>
        </div>
        <button
          onClick={loadData}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs bg-slate-800 border border-slate-700 text-slate-300 hover:text-white"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        {schemaWarning && (
          <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-200">
            {schemaWarning}
          </div>
        )}
        {integrations.length === 0 ? (
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <p className="text-sm text-amber-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              LinkedIn is not connected for this workspace account.
            </p>
            <button
              onClick={handleConnectLinkedIn}
              className="px-3 py-2 rounded-lg text-xs font-semibold bg-sky-600/20 border border-sky-500/30 text-sky-300 hover:bg-sky-600/30"
            >
              Connect LinkedIn
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <span className="font-semibold">Connection:</span>
              <span className={selectedIntegration?.is_active ? 'text-green-300' : 'text-amber-300'}>
                {selectedIntegration?.is_active ? 'Active' : 'Inactive'}
              </span>
              {selectedLinkedInMemberId && (
                <span className="text-xs px-2 py-0.5 rounded-full border border-sky-500/40 bg-sky-500/10 text-sky-300">
                  Active account: {selectedLinkedInMemberId}
                </span>
              )}
              {!hasWriteScope && <span className="text-amber-300">Missing write scope</span>}
              {!selectedIntegration?.is_active && (
                <span className="text-amber-300">Reconnect to activate this account</span>
              )}
            </div>
            <div className="flex items-end gap-2 flex-wrap">
              <div>
              <label className="text-xs text-slate-500 mb-1 block">LinkedIn account</label>
              <select
                value={selectedLinkedInMemberId}
                onChange={(e) => setSelectedLinkedInMemberId(e.target.value)}
                className="w-full md:w-[360px] px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-sky-500"
              >
                {integrations.map((row) => (
                  <option key={row.linkedin_member_id} value={row.linkedin_member_id}>
                    {row.linkedin_member_id}
                  </option>
                ))}
              </select>
              </div>
              <button
                onClick={handleConnectLinkedIn}
                className="px-3 py-2 rounded-lg text-xs font-semibold bg-sky-600/20 border border-sky-500/30 text-sky-300 hover:bg-sky-600/30"
              >
                Reconnect LinkedIn
              </button>
              <button
                onClick={handleDisconnectLinkedIn}
                className="px-3 py-2 rounded-lg text-xs font-semibold bg-red-600/15 border border-red-500/30 text-red-300 hover:bg-red-600/25"
              >
                Disconnect LinkedIn
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(integrations.find((row) => row.linkedin_member_id === selectedLinkedInMemberId)?.scopes || []).length > 0 ? (
                (integrations.find((row) => row.linkedin_member_id === selectedLinkedInMemberId)?.scopes || []).map((scope) => (
                  <span key={scope} className="text-[10px] px-2 py-0.5 rounded-full border border-slate-700 bg-slate-800 text-slate-300">
                    {scope}
                  </span>
                ))
              ) : (
                <span className="text-xs text-slate-500">No scopes available from provider metadata.</span>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-white">Write LinkedIn Post</h3>
          <p className="text-xs text-slate-400">Create and publish from this LinkedIn page directly.</p>
        </div>
        <div className="rounded-lg border border-violet-500/25 bg-violet-500/10 p-3 space-y-2">
          <p className="text-xs font-semibold text-violet-300">AI Content Generator</p>
          <input
            value={aiTopic}
            onChange={(e) => setAiTopic(e.target.value)}
            placeholder="What should this LinkedIn content be about?"
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
          />
          <div className="flex flex-wrap gap-2">
            {(['professional', 'engaging', 'casual', 'promotional'] as const).map((tone) => (
              <button
                key={tone}
                onClick={() => setAiTone(tone)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold capitalize transition-all ${
                  aiTone === tone ? 'bg-violet-500 text-white' : 'bg-slate-800 border border-slate-700 text-slate-400 hover:text-white'
                }`}
              >
                {tone}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setAiContentType('linkedin_post')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                aiContentType === 'linkedin_post' ? 'bg-teal-500 text-slate-950' : 'bg-slate-800 border border-slate-700 text-slate-400 hover:text-white'
              }`}
            >
              LinkedIn Post
            </button>
            <button
              onClick={() => setAiContentType('linkedin_article')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                aiContentType === 'linkedin_article' ? 'bg-teal-500 text-slate-950' : 'bg-slate-800 border border-slate-700 text-slate-400 hover:text-white'
              }`}
            >
              LinkedIn Article
            </button>
            <button
              onClick={handleGenerateLinkedInContent}
              disabled={aiGenerating || !aiTopic.trim()}
              className="ml-auto px-3 py-1.5 rounded-lg text-xs font-semibold bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-50"
            >
              {aiGenerating ? 'Generating...' : 'Generate with AI'}
            </button>
          </div>
        </div>
        <textarea
          value={composeCaption}
          onChange={(e) => setComposeCaption(e.target.value)}
          rows={5}
          placeholder="Write your LinkedIn post..."
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 resize-none"
        />
        <input
          value={composeLinkUrl}
          onChange={(e) => setComposeLinkUrl(e.target.value)}
          placeholder="Optional link URL (https://...)"
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
        />
        <input
          value={composeImageUrl}
          onChange={(e) => setComposeImageUrl(e.target.value)}
          placeholder="Optional media URL (image or video)"
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
        />
        <input
          type="file"
          accept="image/*,video/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleUploadLinkedInMedia(file);
          }}
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white file:mr-3 file:rounded-md file:border-0 file:bg-slate-700 file:px-3 file:py-1.5 file:text-xs file:text-slate-200"
        />
        {mediaUploading && <p className="text-xs text-slate-400">Uploading media...</p>}
        <select
          value={composeMediaType}
          onChange={(e) => setComposeMediaType(e.target.value as 'image' | 'video')}
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-sky-500"
        >
          <option value="image">Image</option>
          <option value="video">Video</option>
        </select>
        <select
          value={selectedLinkedInOrganizationId}
          onChange={(e) => setSelectedLinkedInOrganizationId(e.target.value)}
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-sky-500"
        >
          <option value="">Post as personal profile</option>
          {companyPages.map((page) => (
            <option
              key={page.id}
              value={page.id}
              disabled={!hasOrganizationWriteScope}
            >
              {page.name || page.vanityName || page.id}{!hasOrganizationWriteScope ? ' (requires w_organization_social)' : ''}
            </option>
          ))}
        </select>
        {selectedLinkedInOrganizationId && !hasOrganizationWriteScope && (
          <p className="text-xs text-amber-300">
            Company page posting requires `w_organization_social`. Reconnect LinkedIn and approve organization posting permissions.
          </p>
        )}
        <input
          type="datetime-local"
          value={composeScheduledAt}
          onChange={(e) => setComposeScheduledAt(e.target.value)}
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-sky-500"
        />
        {!canComposeLinkedIn && (
          <p className="text-xs text-amber-300">
            To publish, select an active LinkedIn account with write scope (`w_member_social`).
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleSubmitLinkedInPost(true)}
            disabled={composeSubmitting || !canComposeLinkedIn || !canPostAsSelectedCompany}
            className="px-3 py-2 rounded-lg text-xs font-semibold bg-sky-600/20 border border-sky-500/30 text-sky-300 hover:bg-sky-600/30 disabled:opacity-50"
          >
            {composeSubmitting ? 'Submitting...' : 'Post Now'}
          </button>
          <button
            onClick={() => handleSubmitLinkedInPost(false)}
            disabled={composeSubmitting || !composeScheduledAt || !canComposeLinkedIn || !canPostAsSelectedCompany}
            className="px-3 py-2 rounded-lg text-xs font-semibold bg-slate-700 border border-slate-600 text-slate-200 hover:bg-slate-600 disabled:opacity-50"
          >
            Schedule Post
          </button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {(['all', 'published', 'scheduled', 'failed', 'cancelled'] as LinkedInStatusFilter[]).map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
              statusFilter === status
                ? 'bg-sky-500/20 border-sky-500/40 text-sky-300'
                : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-white">LinkedIn Inbox</h3>
            <p className="text-xs text-slate-400">Review inbound comments on your LinkedIn posts and reply from dashboard.</p>
          </div>
          <button
            onClick={loadInbox}
            disabled={inboxLoading}
            className="px-3 py-2 rounded-lg text-xs font-semibold bg-slate-800 border border-slate-700 text-slate-300 hover:text-white disabled:opacity-50"
          >
            {inboxLoading ? 'Loading...' : 'Load Inbox'}
          </button>
        </div>
        {inboxItems.length === 0 ? (
          <p className="text-xs text-slate-500">No inbox items loaded yet.</p>
        ) : (
          <div className="space-y-2 max-h-[420px] overflow-auto pr-1">
            {inboxItems.map((item) => (
              <div key={`${item.postUrn}-${item.commentUrn}`} className="rounded-lg border border-slate-800 bg-slate-950/50 p-3 space-y-2">
                <p className="text-[11px] text-slate-500">
                  {item.createdAt ? new Date(item.createdAt).toLocaleString() : 'Unknown time'} | {item.actor || 'LinkedIn user'}
                </p>
                <p className="text-xs text-slate-300">
                  <span className="font-semibold text-slate-200">Comment:</span> {item.commentText}
                </p>
                <p className="text-[11px] text-slate-500 line-clamp-2">
                  <span className="font-semibold text-slate-400">Post:</span> {item.postCaption || 'No caption'}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-2">
                  <input
                    value={inboxReplyByComment[item.commentUrn] || ''}
                    onChange={(e) => setInboxReplyByComment((prev) => ({ ...prev, [item.commentUrn]: e.target.value }))}
                    placeholder="Reply to this inbox comment..."
                    className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                  />
                  <button
                    onClick={() => handleInboxReply(item)}
                    disabled={!hasWriteScope || !!inboxActionLoading[item.commentUrn]}
                    className="px-3 py-2 rounded-lg text-xs bg-sky-600/20 border border-sky-500/30 text-sky-300 hover:bg-sky-600/30 disabled:opacity-50"
                  >
                    {inboxActionLoading[item.commentUrn] ? 'Replying...' : 'Reply'}
                  </button>
                  <button
                    onClick={() => handleGenerateInboxAiReply(item)}
                    disabled={!!inboxAiLoading[item.commentUrn]}
                    className="px-3 py-2 rounded-lg text-xs bg-violet-600/20 border border-violet-500/30 text-violet-300 hover:bg-violet-600/30 disabled:opacity-50"
                  >
                    {inboxAiLoading[item.commentUrn] ? 'Generating...' : 'AI Reply'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3">
        {filteredPosts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-700 py-14 text-center">
            <p className="text-slate-400">No LinkedIn posts for selected filter.</p>
          </div>
        ) : (
          filteredPosts.map((post) => (
            <div key={post.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_BADGE[post.status] || STATUS_BADGE.draft}`}>
                  {post.status}
                </span>
                <span className="text-xs text-slate-500">{new Date(post.created_at).toLocaleString()}</span>
              </div>
              <p className="text-sm text-slate-200 whitespace-pre-line line-clamp-3">{post.caption}</p>
              {post.error_message && <p className="text-xs text-red-300">{post.error_message}</p>}
              {post.status === 'published' && !resolveLinkedInPostUrn(post) && (
                <p className="text-xs text-amber-300">
                  Comments unavailable for this item because no LinkedIn post reference was saved yet. Run post reconciliation to backfill LinkedIn URNs for already published posts.
                </p>
              )}
              {resolveLinkedInPostUrn(post) && (
                <a
                  href={`https://www.linkedin.com/feed/update/${encodeURIComponent(resolveLinkedInPostUrn(post) || '')}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-sky-300 hover:underline"
                >
                  <ExternalLink className="w-3 h-3" />
                  View on LinkedIn
                </a>
              )}

              {resolveLinkedInPostUrn(post) && (
                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-2 pt-2">
                  <input
                    value={commentByPost[post.id] || ''}
                    onChange={(e) => setCommentByPost((prev) => ({ ...prev, [post.id]: e.target.value }))}
                    placeholder="Write a comment..."
                    className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                  />
                  <button
                    onClick={() => handleComment(post)}
                    disabled={!hasWriteScope || !!actionLoading[`comment-${post.id}`]}
                    className="px-3 py-2 rounded-lg text-xs bg-sky-600/20 border border-sky-500/30 text-sky-300 hover:bg-sky-600/30 disabled:opacity-50 inline-flex items-center gap-1"
                  >
                    <MessageCircle className="w-3 h-3" />
                    {actionLoading[`comment-${post.id}`] ? 'Posting...' : 'Comment'}
                  </button>
                  <button
                    onClick={() => handleGenerateAiReply(post)}
                    disabled={!!aiReplyLoading[post.id]}
                    className="px-3 py-2 rounded-lg text-xs bg-violet-600/20 border border-violet-500/30 text-violet-300 hover:bg-violet-600/30 disabled:opacity-50 inline-flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" />
                    {aiReplyLoading[post.id] ? 'Generating...' : 'AI Quick Reply'}
                  </button>
                  <div className="flex gap-2">
                    <select
                      value={reactionByPost[post.id] || 'LIKE'}
                      onChange={(e) => setReactionByPost((prev) => ({ ...prev, [post.id]: e.target.value }))}
                      className="px-2 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-sky-500"
                    >
                      {['LIKE', 'PRAISE', 'APPRECIATION', 'EMPATHY', 'INTEREST', 'MAYBE'].map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleReaction(post)}
                      disabled={!hasWriteScope || !!actionLoading[`reaction-${post.id}`]}
                      className="px-3 py-2 rounded-lg text-xs bg-slate-700 border border-slate-600 text-slate-200 hover:bg-slate-600 disabled:opacity-50 inline-flex items-center gap-1"
                    >
                      <ThumbsUp className="w-3 h-3" />
                      {actionLoading[`reaction-${post.id}`] ? 'Sending...' : 'React'}
                    </button>
                  </div>
                  <div className="md:col-span-3 flex items-center gap-3 text-xs text-slate-400">
                    <button
                      onClick={() => loadEngagement(post)}
                      disabled={!!engagementLoading[post.id]}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-white disabled:opacity-50"
                    >
                      {engagementLoading[post.id] ? 'Refreshing...' : 'Load Engagement'}
                    </button>
                    <span className="inline-flex items-center gap-1">
                      <ThumbsUp className="w-3 h-3" />
                      Likes: {engagementByPost[post.id]?.likesCount ?? 0}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MessageCircle className="w-3 h-3" />
                      Comments: {engagementByPost[post.id]?.commentsCount ?? (commentsByPost[post.id]?.length || 0)}
                    </span>
                  </div>
                <div className="md:col-span-3 rounded-lg border border-slate-800 bg-slate-950/40 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-300">Post comments</p>
                    <button
                      onClick={() => loadComments(post)}
                      disabled={!!commentsLoading[post.id]}
                      className="px-2.5 py-1 rounded-lg text-[11px] bg-slate-800 border border-slate-700 text-slate-300 hover:text-white disabled:opacity-50"
                    >
                      {commentsLoading[post.id] ? 'Loading...' : 'Load Comments'}
                    </button>
                  </div>
                  {commentsWarningByPost[post.id] && (
                    <p className="text-xs text-amber-300">{commentsWarningByPost[post.id]}</p>
                  )}
                  {(commentsByPost[post.id] || []).length > 0 ? (
                    <div className="space-y-2">
                      {(commentsByPost[post.id] || []).slice(0, 20).map((comment) => (
                        <div key={comment.commentUrn} className="rounded-lg border border-slate-800 bg-slate-900/70 p-2.5 space-y-2">
                          <p className="text-xs text-slate-300">
                            <span className="font-semibold text-slate-200">{comment.actor || 'LinkedIn user'}:</span>{' '}
                            {comment.text || ''}
                          </p>
                          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-2">
                            <input
                              value={replyByComment[comment.commentUrn] || ''}
                              onChange={(e) => setReplyByComment((prev) => ({ ...prev, [comment.commentUrn]: e.target.value }))}
                              placeholder="Reply to this comment..."
                              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                            />
                            <button
                              onClick={() => handleComment(post, comment.commentUrn, replyByComment[comment.commentUrn])}
                              disabled={!hasWriteScope || !!actionLoading[`reply-${comment.commentUrn}`]}
                              className="px-3 py-2 rounded-lg text-xs bg-sky-600/20 border border-sky-500/30 text-sky-300 hover:bg-sky-600/30 disabled:opacity-50"
                            >
                              {actionLoading[`reply-${comment.commentUrn}`] ? 'Replying...' : 'Reply'}
                            </button>
                            <button
                              onClick={() => handleGenerateAiReply(post, comment.commentUrn, comment.text)}
                              disabled={!!aiReplyLoading[`reply-${comment.commentUrn}`]}
                              className="px-3 py-2 rounded-lg text-xs bg-violet-600/20 border border-violet-500/30 text-violet-300 hover:bg-violet-600/30 disabled:opacity-50"
                            >
                              {aiReplyLoading[`reply-${comment.commentUrn}`] ? 'Generating...' : 'AI Reply'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">No comments loaded yet for this post.</p>
                  )}
                </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
