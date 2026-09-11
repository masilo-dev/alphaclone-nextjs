'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Twitter, Link2, RefreshCw, Send, Loader2 } from 'lucide-react';
import { useTenant } from '@/contexts/TenantContext';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import { WORKSPACE } from '@/constants/design';

interface XIntegrationRow {
  id: string;
  x_username: string;
  x_user_id: string;
  created_at: string;
}

export default function XIntegrationTab() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentTenant } = useTenant();
  const [integration, setIntegration] = useState<XIntegrationRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [postText, setPostText] = useState('');
  const [posting, setPosting] = useState(false);
  const [tweets, setTweets] = useState<Array<{ id: string; text: string }>>([]);
  const [loadingTweets, setLoadingTweets] = useState(false);
  const [creditsDepleted, setCreditsDepleted] = useState(false);
  const connectedAt = integration?.created_at ? new Date(integration.created_at) : null;
  const remainingChars = 280 - postText.length;

  const loadIntegration = useCallback(async () => {
    if (!currentTenant?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('x_integrations')
      .select('id, x_username, x_user_id, created_at')
      .eq('tenant_id', currentTenant.id)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('[X] load failed:', error);
      toast.error('Failed to load X connection');
    }
    setIntegration((data as XIntegrationRow) || null);
    setLoading(false);
  }, [currentTenant?.id]);

  const loadTweets = useCallback(async () => {
    if (!currentTenant?.id || !integration) return;
    setLoadingTweets(true);
    try {
      const res = await fetch(`/api/x/tweets?tenantId=${encodeURIComponent(currentTenant.id)}`);
      const payload = await res.json();
      if (payload.creditsDepleted) {
        setCreditsDepleted(true);
        setTweets([]);
        return;
      }
      setCreditsDepleted(false);
      if (!res.ok || !payload.success) {
        throw new Error(payload.error || 'Failed to load posts');
      }
      const items = payload.data?.data || [];
      setTweets(
        items.map((t: { id: string; text: string }) => ({
          id: t.id,
          text: t.text || '',
        }))
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load timeline';
      toast.error(message);
    } finally {
      setLoadingTweets(false);
    }
  }, [currentTenant?.id, integration]);

  useEffect(() => {
    loadIntegration();
  }, [loadIntegration]);

  useEffect(() => {
    if (integration) loadTweets();
  }, [integration, loadTweets]);

  useEffect(() => {
    const connected = searchParams?.get('x_connected');
    const err = searchParams?.get('x_error');
    if (connected === '1') {
      toast.success('X account connected');
      loadIntegration();
    } else if (err) {
      toast.error(`X connection failed: ${err.replace(/_/g, ' ')}`);
    }
  }, [searchParams, loadIntegration]);

  const handleConnect = () => {
    const tenantId = currentTenant?.id ? `?tenantId=${encodeURIComponent(currentTenant.id)}` : '';
    router.push(`/api/auth/x${tenantId}`);
  };

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTenant?.id || !postText.trim()) return;
    setPosting(true);
    try {
      const res = await fetch('/api/x/tweets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: currentTenant.id, text: postText.trim() }),
      });
      const payload = await res.json();
      if (payload.creditsDepleted) {
        setCreditsDepleted(true);
        toast.error(payload.error || 'X API credits depleted');
        return;
      }
      if (!res.ok || !payload.success) {
        throw new Error(payload.error || 'Post failed');
      }
      toast.success('Posted to X');
      setPostText('');
      await loadTweets();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to post';
      toast.error(message);
    } finally {
      setPosting(false);
    }
  };

  if (loading) {
    return (
      <div className="relative flex flex-col min-h-0 ac-scroll-full ac-enterprise-module max-w-5xl mx-auto p-4 ac-safe-bottom lg:pb-4 space-y-6">
        <div className="rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6 min-h-[320px] flex items-center justify-center">
          <div className="flex items-center justify-center gap-3 text-slate-400">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span className="text-sm font-medium">Loading X workspace...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!integration) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className={`${WORKSPACE.panel.base} ${WORKSPACE.panel.radius} p-10 text-center`}>
          <Twitter className="w-12 h-12 text-sky-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Connect X (Twitter)</h1>
          <p className="text-slate-400 text-sm mb-6 max-w-md mx-auto">
            Authorize your X account to publish posts and read public profile data from your workspace.
          </p>
          <div className="inline-flex flex-wrap items-center justify-center gap-2 mb-6">
            <span className="px-3 py-1 rounded-full border border-slate-700 bg-slate-950 text-xs text-slate-300">Posting access</span>
            <span className="px-3 py-1 rounded-full border border-slate-700 bg-slate-950 text-xs text-slate-300">Public profile data</span>
            <span className="px-3 py-1 rounded-full border border-slate-700 bg-slate-950 text-xs text-slate-300">No DMs</span>
          </div>
          <button
            type="button"
            onClick={handleConnect}
            className="inline-flex items-center gap-2 h-12 px-6 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold"
          >
            <Link2 className="w-5 h-5" />
            Connect X Account
          </button>
          <p className="text-slate-500 text-xs mt-4 max-w-md mx-auto">
            The connection requests the minimum permissions needed for posting, reading public account data, and keeping your session active.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col min-h-0 ac-scroll-full ac-enterprise-module max-w-5xl mx-auto p-4 ac-safe-bottom lg:pb-4 space-y-6">
      <div className={`${WORKSPACE.panel.base} ${WORKSPACE.panel.radius} p-6`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center shrink-0">
              <Twitter className="w-6 h-6 text-sky-400" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-extrabold text-white truncate">@{integration.x_username}</h1>
              <p className="text-slate-400 text-sm">
                Connected {connectedAt ? `since ${connectedAt.toLocaleDateString()}` : 'to post and read your timeline'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadTweets}
              disabled={loadingTweets}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-slate-700 bg-slate-950 text-slate-200 hover:bg-slate-900 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loadingTweets ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              type="button"
              onClick={handleConnect}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold"
            >
              <Link2 className="w-4 h-4" />
              Reconnect
            </button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className={`${WORKSPACE.panel.base} ${WORKSPACE.panel.radius} p-4 shadow-none`}>
            <div className="text-xs font-bold uppercase tracking-widest text-slate-500">Workspace</div>
            <div className="mt-1 text-sm text-slate-200 truncate">{currentTenant?.name || 'Current workspace'}</div>
          </div>
          <div className={`${WORKSPACE.panel.base} ${WORKSPACE.panel.radius} p-4 shadow-none`}>
            <div className="text-xs font-bold uppercase tracking-widest text-slate-500">Posts Loaded</div>
            <div className="mt-1 text-sm text-slate-200">{tweets.length}</div>
          </div>
          <div className={`${WORKSPACE.panel.base} ${WORKSPACE.panel.radius} p-4 shadow-none`}>
            <div className="text-xs font-bold uppercase tracking-widest text-slate-500">Account ID</div>
            <div className="mt-1 text-sm text-slate-200 truncate">{integration.x_user_id}</div>
          </div>
        </div>
      </div>

      {creditsDepleted && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Your X developer account has no API credits left. Timeline and posting are paused until you add credits at{' '}
          <a href="https://developer.x.com" target="_blank" rel="noopener noreferrer" className="underline font-semibold">
            developer.x.com
          </a>
          .
        </div>
      )}

      <form onSubmit={handlePost} className={`${WORKSPACE.panel.base} ${WORKSPACE.panel.radius} p-5 space-y-4`}>
        <div className="flex items-center justify-between">
          <div className="text-sm font-bold text-white">Compose</div>
          <div className={`text-xs font-semibold ${remainingChars < 20 ? 'text-amber-300' : 'text-slate-400'}`}>
            {remainingChars} left
          </div>
        </div>

        <textarea
          value={postText}
          onChange={(e) => setPostText(e.target.value)}
          placeholder="Write a post..."
          maxLength={280}
          rows={4}
          className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-white text-sm resize-none focus:outline-none focus:border-sky-500"
        />
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-sky-500"
              style={{ width: `${Math.min(100, (postText.length / 280) * 100)}%` }}
            />
          </div>
          <button
            type="submit"
            disabled={posting || !postText.trim()}
            className="inline-flex items-center gap-2 h-10 px-6 rounded-2xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-extrabold text-sm shrink-0"
          >
            {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Post
          </button>
        </div>
      </form>

      <div className={`${WORKSPACE.panel.base} ${WORKSPACE.panel.radius} overflow-hidden`}>
        <div className="px-5 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Recent posts
          </div>
          <div className="text-xs text-slate-500">
            {loadingTweets ? 'Loading…' : `${tweets.length} items`}
          </div>
        </div>
        {loadingTweets ? (
          <div className="p-8 text-center text-slate-500 text-sm">Loading...</div>
        ) : tweets.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">No posts yet.</div>
        ) : (
          tweets.map((t) => (
            <div key={t.id} className="px-5 py-4 border-b border-slate-800 last:border-b-0">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center shrink-0">
                  <Twitter className="w-4 h-4 text-sky-400" />
                </div>
                <p className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">{t.text}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
