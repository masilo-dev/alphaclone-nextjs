'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Instagram, Link2, MessageCircle, RefreshCw, ExternalLink } from 'lucide-react';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import Link from 'next/link';

interface InstagramIntegrationRow {
  id: string;
  instagram_account_id: string;
  username: string | null;
  is_active: boolean;
  created_at: string;
}

export default function InstagramIntegrationTab() {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const [integrations, setIntegrations] = useState<InstagramIntegrationRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!currentTenant?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('instagram_integrations')
      .select('id, instagram_account_id, username, is_active, created_at')
      .eq('tenant_id', currentTenant.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Instagram] load failed:', error);
      toast.error('Failed to load Instagram connections');
      setIntegrations([]);
    } else {
      setIntegrations((data as InstagramIntegrationRow[]) || []);
    }
    setLoading(false);
  }, [currentTenant?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleConnect = () => {
    if (!user?.id) {
      toast.error('Sign in to connect Instagram');
      return;
    }
    const tenantParam = currentTenant?.id ? `&tenant_id=${encodeURIComponent(currentTenant.id)}` : '';
    window.location.href = `/api/auth/instagram/connect${tenantParam}`;
  };

  const isConnected = integrations.some((i) => i.is_active);

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-4 pb-20">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8">
        <div className="flex items-start gap-4 mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center">
            <Instagram className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Instagram Business</h1>
            <p className="text-slate-400 text-sm mt-1">
              Connect your Instagram Business account for direct messages and publishing through the Meta Graph API.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-3 text-slate-400 py-8">
            <RefreshCw className="w-5 h-5 animate-spin" />
            Loading connections...
          </div>
        ) : isConnected ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-emerald-300 text-sm font-medium">
              Connected. Instagram direct messages are handled in the Facebook Inbox.
            </div>
            <ul className="space-y-2">
              {integrations.filter((i) => i.is_active).map((ig) => (
                <li
                  key={ig.id}
                  className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 px-4 py-3"
                >
                  <span className="text-white font-medium">
                    @{ig.username || ig.instagram_account_id}
                  </span>
                  <span className="text-xs text-slate-500 uppercase tracking-wider">Active</span>
                </li>
              ))}
            </ul>
            <Link
              href="/dashboard/business/facebook"
              className="inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-sm transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              Open Facebook and Instagram Inbox
              <ExternalLink className="w-3.5 h-3.5 opacity-70" />
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-slate-400 text-sm">
              Link a Facebook Page with an Instagram Business account. After authorization, inbound DMs appear in the unified inbox.
            </p>
            <button
              type="button"
              onClick={handleConnect}
              className="inline-flex items-center gap-2 h-12 px-6 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 hover:opacity-90 text-white font-bold transition-opacity"
            >
              <Link2 className="w-5 h-5" />
              Connect Instagram Business
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
