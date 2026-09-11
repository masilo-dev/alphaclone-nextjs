'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Instagram,
  Link2,
  RefreshCw,
  Loader2,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Image as ImageIcon,
  Send,
} from 'lucide-react';
import Link from 'next/link';
import { useTenant } from '@/contexts/TenantContext';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import { WORKSPACE } from '@/constants/design';

interface InstagramIntegrationRow {
  id: string;
  instagram_account_id: string;
  username: string | null;
  account_name: string | null;
  facebook_page_id: string | null;
  facebook_page_name: string | null;
  followers_count: number | null;
  media_count: number | null;
  is_active: boolean;
  connected_at: string;
  expires_at: string | null;
}

const IG_ERROR_MESSAGES: Record<string, string> = {
  app_not_configured: 'Facebook App ID is not configured on the server.',
  no_pages: 'No Facebook Pages found on your account.',
  no_instagram_business_account:
    'No Instagram Business account is linked to your Facebook Page. Link one in Meta Business Suite first.',
  token_exchange_failed: 'Meta token exchange failed. Check OAuth redirect URIs in your Meta app.',
  token_refresh_failed: 'Could not refresh the long-lived token.',
  pages_fetch_failed: 'Could not load your Facebook Pages.',
  profile_failed: 'Could not load your Facebook profile.',
  session_mismatch: 'Session expired. Log in again and retry.',
  missing_params: 'OAuth callback was incomplete.',
};

function formatIgError(code: string): string {
  return IG_ERROR_MESSAGES[code] || code.replace(/_/g, ' ');
}

export default function InstagramIntegrationTab() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentTenant } = useTenant();
  const [accounts, setAccounts] = useState<InstagramIntegrationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [caption, setCaption] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');

  const loadAccounts = useCallback(async () => {
    if (!currentTenant?.id) {
      setAccounts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('instagram_integrations')
      .select(
        'id, instagram_account_id, username, account_name, facebook_page_id, facebook_page_name, followers_count, media_count, is_active, connected_at, expires_at'
      )
      .eq('tenant_id', currentTenant.id)
      .eq('is_active', true)
      .order('connected_at', { ascending: false });

    if (error) {
      console.error('[Instagram] load failed:', error);
      toast.error('Failed to load Instagram connections');
      setAccounts([]);
    } else {
      const rows = (data as InstagramIntegrationRow[]) || [];
      setAccounts(rows);
      setSelectedAccountId((prev) => prev || rows[0]?.instagram_account_id || '');
    }
    setLoading(false);
  }, [currentTenant?.id]);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    const connected = searchParams?.get('ig_connected');
    const err = searchParams?.get('ig_error');
    if (connected === 'true') {
      toast.success('Instagram Business account connected');
      void loadAccounts();
      router.replace('/dashboard/business/instagram', { scroll: false });
    } else if (err) {
      toast.error(formatIgError(err));
      router.replace('/dashboard/business/instagram', { scroll: false });
    }
  }, [searchParams, loadAccounts, router]);

  const handleConnect = () => {
    const tid = currentTenant?.id;
    window.location.href = tid
      ? `/api/auth/instagram/connect?tenant_id=${encodeURIComponent(tid)}`
      : '/api/auth/instagram/connect';
  };

  const handleDisconnect = async (instagramAccountId: string) => {
    if (!currentTenant?.id) return;
    if (!confirm('Disconnect this Instagram Business account?')) return;
    try {
      const res = await fetch('/api/instagram/disconnect', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: currentTenant.id, instagramAccountId }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Disconnect failed');
      toast.success('Instagram disconnected');
      await loadAccounts();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Disconnect failed');
    }
  };

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTenant?.id || !caption.trim() || !imageUrl.trim()) {
      toast.error('Caption and image URL are required');
      return;
    }
    setPosting(true);
    try {
      const res = await fetch('/api/instagram/post', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: currentTenant.id,
          caption: caption.trim(),
          imageUrl: imageUrl.trim(),
          instagramAccountId: selectedAccountId || undefined,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Post failed');
      toast.success('Posted to Instagram');
      setCaption('');
      setImageUrl('');
      if (payload.live_url) window.open(payload.live_url, '_blank', 'noopener,noreferrer');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Post failed');
    } finally {
      setPosting(false);
    }
  };

  if (loading) {
    return (
      <div className="relative flex flex-col min-h-0 ac-scroll-full ac-enterprise-module max-w-5xl mx-auto p-4 ac-safe-bottom lg:pb-4">
        <div className={`${WORKSPACE.panel.base} ${WORKSPACE.panel.radius} p-10 flex items-center justify-center gap-3 text-slate-400`}>
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span className="text-sm font-medium">Loading Instagram workspace...</span>
        </div>
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="relative flex flex-col min-h-0 ac-scroll-full ac-enterprise-module max-w-4xl mx-auto p-4 ac-safe-bottom lg:pb-4">
        <div className={`${WORKSPACE.panel.base} ${WORKSPACE.panel.radius} p-8`}>
          <div className="flex items-start gap-4 mb-6">
            <div className="w-14 h-14 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center">
              <Instagram className="w-7 h-7 text-pink-300" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Instagram Business</h1>
              <p className="text-slate-400 text-sm mt-1">
                Connect a Professional Instagram account linked to your Facebook Page to publish photos and reels.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-700/80 bg-slate-950/60 px-4 py-3 text-slate-300 text-sm mb-6 space-y-2">
            <p className="font-semibold text-white">Before you connect</p>
            <ul className="list-disc pl-5 space-y-1 text-slate-400">
              <li>Your Instagram must be a Business or Creator account.</li>
              <li>It must be linked to a Facebook Page in Meta Business Suite.</li>
              <li>Your Meta app needs <code className="text-pink-200">instagram_content_publish</code> approved.</li>
            </ul>
          </div>

          <button
            type="button"
            onClick={handleConnect}
            className="inline-flex items-center gap-2 h-12 px-6 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-bold"
          >
            <Link2 className="w-5 h-5" />
            Connect Instagram Business
          </button>

          <Link
            href="/dashboard/business/facebook"
            className="mt-4 inline-flex items-center gap-2 text-sm text-teal-400 hover:text-teal-300"
          >
            Open Facebook &amp; Instagram Inbox
            <ExternalLink className="w-3.5 h-3.5 opacity-70" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col min-h-0 ac-scroll-full ac-enterprise-module max-w-5xl mx-auto p-4 ac-safe-bottom lg:pb-4 space-y-6">
      {accounts.map((account) => (
        <div key={account.id} className={`${WORKSPACE.panel.base} ${WORKSPACE.panel.radius} p-6`}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-12 h-12 rounded-2xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center shrink-0">
                <Instagram className="w-6 h-6 text-pink-300" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-bold text-white truncate">
                    @{account.username || account.account_name || 'instagram'}
                  </h2>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    <CheckCircle2 className="w-3 h-3" />
                    Connected
                  </span>
                </div>
                <p className="text-slate-400 text-sm mt-1">
                  Linked to Facebook Page: {account.facebook_page_name || account.facebook_page_id || '—'}
                </p>
                <p className="text-slate-500 text-xs mt-1">
                  {account.followers_count ?? 0} followers · {account.media_count ?? 0} posts
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => void loadAccounts()}
                className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-slate-700 bg-slate-950 text-slate-200 hover:bg-slate-900"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
              <button
                type="button"
                onClick={() => void handleDisconnect(account.instagram_account_id)}
                className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-rose-500/30 text-rose-300 hover:bg-rose-500/10"
              >
                Disconnect
              </button>
            </div>
          </div>
        </div>
      ))}

      <div className={`${WORKSPACE.panel.base} ${WORKSPACE.panel.radius} p-6`}>
        <h3 className="text-lg font-bold text-white mb-1">Publish a photo</h3>
        <p className="text-slate-400 text-sm mb-4">
          Instagram requires an image for feed posts. Use a public HTTPS image URL.
        </p>

        {accounts.length > 1 && (
          <label className="block mb-4">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Account</span>
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="mt-1 w-full h-11 rounded-xl border border-slate-700 bg-slate-950 px-3 text-white"
            >
              {accounts.map((a) => (
                <option key={a.instagram_account_id} value={a.instagram_account_id}>
                  @{a.username || a.account_name || a.instagram_account_id}
                </option>
              ))}
            </select>
          </label>
        )}

        <form onSubmit={handlePost} className="space-y-4">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Caption</span>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={4}
              placeholder="Write your caption..."
              className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white resize-y"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Image URL</span>
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://..."
              className="mt-1 w-full h-11 rounded-xl border border-slate-700 bg-slate-950 px-3 text-white"
            />
          </label>
          <button
            type="submit"
            disabled={posting}
            className="inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-pink-600 hover:bg-pink-500 disabled:opacity-50 text-white font-bold"
          >
            {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Post to Instagram
          </button>
        </form>

        <div className="mt-4 flex items-start gap-2 text-xs text-slate-500">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            Reels, carousels, and scheduled posts are available via Social Compose and MCP tools once connected.
          </span>
        </div>
      </div>

      <Link
        href="/dashboard/business/social/compose"
        className="inline-flex items-center gap-2 text-sm text-teal-400 hover:text-teal-300"
      >
        <ImageIcon className="w-4 h-4" />
        Open Social Compose
        <ExternalLink className="w-3.5 h-3.5 opacity-70" />
      </Link>
    </div>
  );
}
