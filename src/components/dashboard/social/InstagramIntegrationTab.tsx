'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Instagram, RefreshCw, CheckCircle2, XCircle, ExternalLink,
  Loader2, Trash2, Image as ImageIcon, Heart, MessageCircle,
  Users, BarChart3, AlertCircle, Camera, Link2, Sparkles, TrendingUp,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';

interface InstagramAccount {
  id: string;
  instagram_account_id: string;
  username: string | null;
  account_name: string | null;
  profile_picture_url: string | null;
  facebook_page_name: string | null;
  followers_count: number | null;
  media_count: number | null;
  is_active: boolean;
  connected_at: string;
  expires_at: string | null;
  metadata?: Record<string, any> | null;
}

const IG_GRADIENT = 'bg-gradient-to-tr from-yellow-500 via-pink-500 to-purple-600';
const IG_GRADIENT_TEXT = 'bg-gradient-to-r from-yellow-400 via-pink-400 to-purple-400 bg-clip-text text-transparent';

export default function InstagramIntegrationTab() {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const searchParams = useSearchParams();

  const [accounts, setAccounts] = useState<InstagramAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);

  // Handle success/error redirects from OAuth
  useEffect(() => {
    const igConnected = searchParams?.get('ig_connected');
    const igError = searchParams?.get('ig_error');
    if (igConnected === 'true') {
      toast.success('Instagram account connected successfully!', { duration: 4000 });
    } else if (igError) {
      const messages: Record<string, string> = {
        token_exchange_failed: 'Token exchange failed. Try again.',
        token_refresh_failed: 'Could not get a long-lived token. Try again.',
        pages_fetch_failed: 'Could not fetch your Facebook Pages. Ensure you have granted all permissions.',
        no_instagram_business_account: 'Your Facebook Pages have no linked Instagram Business Account. In Meta Business Suite, go to Settings → Instagram and link your account.',
        no_pages: 'No Facebook Pages found. You need at least one Facebook Page to connect Instagram.',
        app_not_configured: 'Instagram integration is not yet configured on this server.',
        profile_failed: 'Could not load your Facebook profile.',
      };
      toast.error(messages[igError] || `Connection failed: ${igError}`, { duration: 6000 });
    }
  }, [searchParams]);

  const fetchAccounts = useCallback(async () => {
    if (!currentTenant?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('instagram_integrations')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .eq('is_active', true)
        .order('connected_at', { ascending: false });

      if (error) throw error;
      setAccounts(data || []);
    } catch (err) {
      console.error('[InstagramTab] fetch error:', err);
      toast.error('Failed to load Instagram accounts');
    } finally {
      setLoading(false);
    }
  }, [currentTenant?.id]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const handleConnect = () => {
    if (!currentTenant?.id) return;
    setConnecting(true);
    window.location.href = `/api/auth/instagram/connect?tenant_id=${currentTenant.id}`;
  };

  const handleDisconnect = async (account: InstagramAccount) => {
    if (!confirm(`Disconnect @${account.username || account.account_name}? This won't affect your Instagram account.`)) return;
    try {
      const { error } = await supabase
        .from('instagram_integrations')
        .update({ is_active: false })
        .eq('id', account.id);
      if (error) throw error;
      toast.success('Instagram account disconnected');
      fetchAccounts();
    } catch (err) {
      toast.error('Failed to disconnect account');
    }
  };

  const formatFollowers = (n: number | null) => {
    if (n == null) return '—';
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
  };

  const isExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className={`w-14 h-14 ${IG_GRADIENT} rounded-2xl flex items-center justify-center shadow-lg shadow-pink-900/30`}>
            <Instagram className="w-7 h-7 text-white" />
          </div>
          <div>
            <h2 className={`text-2xl font-bold ${IG_GRADIENT_TEXT}`}>Instagram</h2>
            <p className="text-slate-400 text-sm">Connect your Instagram Business account to publish, track, and engage</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchAccounts}
            disabled={loading}
            className="p-2.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors border border-slate-700/50"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleConnect}
            disabled={connecting}
            className={`flex items-center gap-2 px-5 py-2.5 ${IG_GRADIENT} text-white font-semibold rounded-xl hover:opacity-90 transition-opacity shadow-lg shadow-pink-900/30 disabled:opacity-60`}
          >
            {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
            {connecting ? 'Connecting…' : 'Connect Account'}
          </button>
        </div>
      </div>

      {/* Requirement Info Banner */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 flex gap-3">
        <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-200">
          <span className="font-semibold">Requires Instagram Business or Creator Account</span>
          {' '}linked to a Facebook Page. Personal Instagram accounts cannot be connected via API.{' '}
          <a
            href="https://help.instagram.com/502981923235522"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-white transition-colors"
          >
            Learn more
          </a>
        </div>
      </div>

      {/* Stats Bar */}
      {accounts.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {[
            {
              icon: <Users className="w-5 h-5 text-pink-400" />,
              label: 'Total Followers',
              value: formatFollowers(accounts.reduce((s, a) => s + (a.followers_count ?? 0), 0)),
            },
            {
              icon: <Camera className="w-5 h-5 text-purple-400" />,
              label: 'Total Posts',
              value: accounts.reduce((s, a) => s + (a.media_count ?? 0), 0).toLocaleString(),
            },
            {
              icon: <CheckCircle2 className="w-5 h-5 text-green-400" />,
              label: 'Connected Accounts',
              value: accounts.length,
            },
          ].map(({ icon, label, value }) => (
            <div
              key={label}
              className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 flex flex-col gap-2"
            >
              <div className="flex items-center gap-2 text-slate-400 text-xs font-medium uppercase tracking-wider">
                {icon}
                {label}
              </div>
              <div className="text-2xl font-bold text-white">{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Accounts List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-pink-400 animate-spin" />
        </div>
      ) : accounts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-slate-900/40 border border-slate-800 rounded-3xl">
          <div className={`w-20 h-20 ${IG_GRADIENT} rounded-full flex items-center justify-center mb-6 shadow-lg shadow-pink-900/30`}>
            <Instagram className="w-9 h-9 text-white" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">No Instagram Accounts Connected</h3>
          <p className="text-slate-400 max-w-sm mb-8 text-sm">
            Connect your Instagram Business account to publish content, track analytics, and manage comments — all from AlphaClone.
          </p>
          <button
            onClick={handleConnect}
            disabled={connecting}
            className={`flex items-center gap-2 px-8 py-3 ${IG_GRADIENT} text-white font-semibold rounded-xl hover:opacity-90 transition-opacity shadow-lg shadow-pink-900/30`}
          >
            {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Instagram className="w-5 h-5" />}
            Connect Instagram Account
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Connected Accounts</h3>
          {accounts.map((account) => (
            <div
              key={account.id}
              className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4 hover:border-pink-500/30 transition-colors"
            >
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                {account.profile_picture_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={account.profile_picture_url}
                    alt={account.username || 'Account'}
                    className="w-14 h-14 rounded-full object-cover ring-2 ring-pink-500/40"
                  />
                ) : (
                  <div className={`w-14 h-14 ${IG_GRADIENT} rounded-full flex items-center justify-center ring-2 ring-pink-500/20`}>
                    <Instagram className="w-6 h-6 text-white" />
                  </div>
                )}
                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-slate-900 flex items-center justify-center">
                  <CheckCircle2 className="w-3 h-3 text-white" />
                </div>
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-white font-semibold">
                    {account.username ? `@${account.username}` : account.account_name || 'Instagram Account'}
                  </span>
                  {isExpired(account.expires_at) && (
                    <span className="text-xs bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full">
                      Token Expired
                    </span>
                  )}
                </div>
                {account.facebook_page_name && (
                  <p className="text-slate-400 text-xs mt-0.5">
                    via <span className="text-slate-300">{account.facebook_page_name}</span>
                  </p>
                )}
                <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {formatFollowers(account.followers_count)} followers
                  </span>
                  <span className="flex items-center gap-1">
                    <ImageIcon className="w-3 h-3" />
                    {account.media_count?.toLocaleString() ?? '—'} posts
                  </span>
                  <span>
                    Connected {new Date(account.connected_at).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <a
                  href={`https://www.instagram.com/${account.username || ''}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 text-slate-400 hover:text-pink-400 hover:bg-pink-500/10 rounded-xl transition-colors"
                  title="Open in Instagram"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
                {isExpired(account.expires_at) && (
                  <button
                    onClick={handleConnect}
                    className="px-3 py-1.5 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-xl text-xs font-medium hover:bg-amber-500/20 transition-colors"
                  >
                    Reconnect
                  </button>
                )}
                <button
                  onClick={() => handleDisconnect(account)}
                  className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
                  title="Disconnect"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Capabilities section */}
      {accounts.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          {[
            {
              icon: <Sparkles className="w-5 h-5 text-pink-400" />,
              title: 'AI Content',
              desc: 'Generate captions and hashtags with AI',
              color: 'from-pink-500/10 to-purple-500/10 border-pink-500/20',
            },
            {
              icon: <TrendingUp className="w-5 h-5 text-purple-400" />,
              title: 'Analytics',
              desc: 'Track reach, impressions, and engagement',
              color: 'from-purple-500/10 to-indigo-500/10 border-purple-500/20',
            },
            {
              icon: <MessageCircle className="w-5 h-5 text-yellow-400" />,
              title: 'Comments',
              desc: 'Reply to comments directly from dashboard',
              color: 'from-yellow-500/10 to-orange-500/10 border-yellow-500/20',
            },
          ].map(({ icon, title, desc, color }) => (
            <div key={title} className={`bg-gradient-to-br ${color} border rounded-2xl p-5`}>
              <div className="flex items-center gap-2 mb-2">
                {icon}
                <span className="text-white font-semibold text-sm">{title}</span>
              </div>
              <p className="text-slate-400 text-xs">{desc}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
