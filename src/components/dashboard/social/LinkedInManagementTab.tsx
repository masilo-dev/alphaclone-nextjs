'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Linkedin, RefreshCw, ExternalLink, MessageCircle, ThumbsUp, AlertTriangle, Loader2 } from 'lucide-react';
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
  error_message: string | null;
}

interface LinkedInIntegrationRow {
  linkedin_member_id: string;
  linkedin_person_urn: string;
  scopes: string[] | null;
  is_active: boolean;
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
  const [schemaWarning, setSchemaWarning] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!currentTenant?.id || !user?.id) return;
    setLoading(true);
    setSchemaWarning(null);
    const [postsRes, liRes] = await Promise.all([
      supabase
        .from('social_posts')
        .select('id,caption,status,scheduled_at,published_at,created_at,linkedin_post_urn,linkedin_member_id,error_message,platforms')
        .eq('tenant_id', currentTenant.id)
        .filter('platforms', 'cs', '{"linkedin"}')
        .order('created_at', { ascending: false })
        .limit(100),
      supabase
        .from('linkedin_integrations')
        .select('linkedin_member_id,linkedin_person_urn,scopes,is_active')
        .eq('tenant_id', currentTenant.id)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false }),
    ]);

    if (postsRes.error) {
      let fallback = await supabase
        .from('social_posts')
        .select('id,caption,status,scheduled_at,published_at,created_at,linkedin_post_urn,error_message,platforms')
        .eq('tenant_id', currentTenant.id)
        .filter('platforms', 'cs', '{"linkedin"}')
        .order('created_at', { ascending: false })
        .limit(100);

      if (fallback.error && isMissingRelationOrColumn(fallback.error, 'linkedin_post_urn')) {
        fallback = await supabase
          .from('social_posts')
          .select('id,caption,status,scheduled_at,published_at,created_at,error_message,platforms')
          .eq('tenant_id', currentTenant.id)
          .filter('platforms', 'cs', '{"linkedin"}')
          .order('created_at', { ascending: false })
          .limit(100);
      }

      if (fallback.error) {
        toast.error('Failed to load LinkedIn posts');
      } else {
        const mapped = (fallback.data || []).map((row: any) => ({
          ...row,
          linkedin_post_urn: row.linkedin_post_urn || null,
          linkedin_member_id: null,
        }));
        setPosts(mapped as LinkedInPostRow[]);
        setSchemaWarning('LinkedIn post schema is behind. Apply latest LinkedIn migrations to enable full account-level features.');
      }
    } else {
      setPosts((postsRes.data || []) as LinkedInPostRow[]);
    }

    if (liRes.error) {
      if (isMissingRelationOrColumn(liRes.error, 'linkedin_member_id')) {
        const liFallback = await supabase
          .from('linkedin_integrations')
          .select('linkedin_person_urn,scopes,is_active')
          .eq('tenant_id', currentTenant.id)
          .eq('user_id', user.id)
          .eq('is_active', true)
          .order('created_at', { ascending: false });
        if (!liFallback.error) {
          const rows = (liFallback.data || []).map((row: any) => ({
            ...row,
            linkedin_member_id: row.linkedin_person_urn || 'legacy-linkedin-account',
          })) as LinkedInIntegrationRow[];
          setIntegrations(rows);
          if (rows[0] && !selectedLinkedInMemberId) setSelectedLinkedInMemberId(rows[0].linkedin_member_id);
          setSchemaWarning((prev) => prev || 'LinkedIn integration schema is behind. Apply latest LinkedIn migrations for multi-account selection.');
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
    return scopes.includes('w_member_social');
  }, [integrations, selectedLinkedInMemberId]);

  const handleConnectLinkedIn = async () => {
    try {
      const { authService } = await import('@/services/authService');
      const { error } = await authService.connectLinkedInIntegration('/dashboard/business/linkedin', currentTenant?.id);
      if (error) toast.error(error);
    } catch {
      toast.error('Failed to start LinkedIn connection');
    }
  };

  const handleComment = async (post: LinkedInPostRow) => {
    if (!currentTenant?.id || !post.linkedin_post_urn) return;
    const text = (commentByPost[post.id] || '').trim();
    if (!text) return toast.error('Write a comment first');

    setActionLoading((prev) => ({ ...prev, [`comment-${post.id}`]: true }));
    try {
      const res = await fetch('/api/linkedin/comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: currentTenant.id,
          postUrn: post.linkedin_post_urn,
          text,
          linkedinMemberId: selectedLinkedInMemberId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) return toast.error(data.error || 'Failed to post comment');
      setCommentByPost((prev) => ({ ...prev, [post.id]: '' }));
      toast.success('LinkedIn comment posted');
    } catch {
      toast.error('Failed to post comment');
    } finally {
      setActionLoading((prev) => ({ ...prev, [`comment-${post.id}`]: false }));
    }
  };

  const handleReaction = async (post: LinkedInPostRow) => {
    if (!currentTenant?.id || !post.linkedin_post_urn) return;
    const reactionType = reactionByPost[post.id] || 'LIKE';
    setActionLoading((prev) => ({ ...prev, [`reaction-${post.id}`]: true }));
    try {
      const res = await fetch('/api/linkedin/reaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: currentTenant.id,
          postUrn: post.linkedin_post_urn,
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
              <span className="text-green-300">Active</span>
              {selectedLinkedInMemberId && (
                <span className="text-xs px-2 py-0.5 rounded-full border border-sky-500/40 bg-sky-500/10 text-sky-300">
                  Active account: {selectedLinkedInMemberId}
                </span>
              )}
              {!hasWriteScope && <span className="text-amber-300">Missing write scope</span>}
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
              {post.linkedin_post_urn && (
                <a
                  href={`https://www.linkedin.com/feed/update/${encodeURIComponent(post.linkedin_post_urn)}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-sky-300 hover:underline"
                >
                  <ExternalLink className="w-3 h-3" />
                  View on LinkedIn
                </a>
              )}

              {post.linkedin_post_urn && (
                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-2 pt-2">
                  <input
                    value={commentByPost[post.id] || ''}
                    onChange={(e) => setCommentByPost((prev) => ({ ...prev, [post.id]: e.target.value }))}
                    placeholder="Write a comment..."
                    className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                  />
                  <button
                    onClick={() => handleComment(post)}
                    disabled={!!actionLoading[`comment-${post.id}`]}
                    className="px-3 py-2 rounded-lg text-xs bg-sky-600/20 border border-sky-500/30 text-sky-300 hover:bg-sky-600/30 disabled:opacity-50 inline-flex items-center gap-1"
                  >
                    <MessageCircle className="w-3 h-3" />
                    {actionLoading[`comment-${post.id}`] ? 'Posting...' : 'Comment'}
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
                      disabled={!!actionLoading[`reaction-${post.id}`]}
                      className="px-3 py-2 rounded-lg text-xs bg-slate-700 border border-slate-600 text-slate-200 hover:bg-slate-600 disabled:opacity-50 inline-flex items-center gap-1"
                    >
                      <ThumbsUp className="w-3 h-3" />
                      {actionLoading[`reaction-${post.id}`] ? 'Sending...' : 'React'}
                    </button>
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
