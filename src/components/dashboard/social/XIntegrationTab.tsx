'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Twitter, Link2, RefreshCw, Send, Loader2 } from 'lucide-react';
import { useTenant } from '@/contexts/TenantContext';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

interface XIntegrationRow {
  id: string;
  x_username: string;
  x_user_id: string;
  created_at: string;
}

export default function XIntegrationTab() {
  const searchParams = useSearchParams();
  const { currentTenant } = useTenant();
  const [integration, setIntegration] = useState<XIntegrationRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [postText, setPostText] = useState('');
  const [posting, setPosting] = useState(false);
  const [tweets, setTweets] = useState<Array<{ id: string; text: string }>>([]);
  const [loadingTweets, setLoadingTweets] = useState(false);

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
    window.location.href = `/api/auth/x${tenantId}`;
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
      <div className="flex items-center justify-center py-20 text-slate-400 gap-3">
        <RefreshCw className="w-5 h-5 animate-spin" />
        Loading X workspace...
      </div>
    );
  }

  if (!integration) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center">
          <Twitter className="w-12 h-12 text-sky-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Connect X (Twitter)</h1>
          <p className="text-slate-400 text-sm mb-6 max-w-md mx-auto">
            Authorize your X account to publish posts and manage outreach from your workspace.
          </p>
          <button
            type="button"
            onClick={handleConnect}
            className="inline-flex items-center gap-2 h-12 px-6 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold"
          >
            <Link2 className="w-5 h-5" />
            Connect X Account
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-4 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">@{integration.x_username}</h1>
          <p className="text-slate-500 text-sm">Connected X account</p>
        </div>
        <button
          type="button"
          onClick={loadTweets}
          disabled={loadingTweets}
          className="p-2 rounded-lg border border-slate-700 text-slate-400 hover:text-white"
        >
          <RefreshCw className={`w-4 h-4 ${loadingTweets ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <form onSubmit={handlePost} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
        <textarea
          value={postText}
          onChange={(e) => setPostText(e.target.value)}
          placeholder="Write a post..."
          maxLength={280}
          rows={4}
          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white text-sm resize-none focus:outline-none focus:border-sky-500"
        />
        <div className="flex justify-between items-center">
          <span className="text-xs text-slate-500">{postText.length}/280</span>
          <button
            type="submit"
            disabled={posting || !postText.trim()}
            className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-bold text-sm"
          >
            {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Post
          </button>
        </div>
      </form>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl divide-y divide-slate-800">
        <div className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
          Recent posts
        </div>
        {loadingTweets ? (
          <div className="p-8 text-center text-slate-500 text-sm">Loading...</div>
        ) : tweets.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">No posts yet.</div>
        ) : (
          tweets.map((t) => (
            <div key={t.id} className="px-4 py-4">
              <p className="text-sm text-slate-200 whitespace-pre-wrap">{t.text}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
