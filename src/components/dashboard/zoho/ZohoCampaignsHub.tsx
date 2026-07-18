'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BarChart3,
  Loader2,
  Mail,
  Megaphone,
  Plus,
  RefreshCw,
  Send,
  Users,
  AlertCircle,
  ExternalLink,
  Sparkles,
  TrendingUp,
  ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { ModulePageLayout } from '@/components/ui/ModulePageLayout';
import type { ZohoCampaignSummary, ZohoMailingList } from '@/services/zoho/ZohoCampaignsService';

type Tab = 'campaigns' | 'lists' | 'compose';

interface ZohoCampaignsHubProps {
  userId: string;
}

export default function ZohoCampaignsHub({ userId }: ZohoCampaignsHubProps) {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('campaigns');
  const [loading, setLoading] = useState(true);
  const [campaignsReady, setCampaignsReady] = useState(false);
  const [baseConnected, setBaseConnected] = useState(false);
  const [campaigns, setCampaigns] = useState<ZohoCampaignSummary[]>([]);
  const [lists, setLists] = useState<ZohoMailingList[]>([]);
  const [reports, setReports] = useState<Record<string, { openRate?: number; clickRate?: number; sentCount?: number }>>({});

  const [compose, setCompose] = useState({
    campaignName: '',
    subject: '',
    fromEmail: '',
    fromName: '',
    contentUrl: '',
    listKeys: [] as string[],
  });
  const [sending, setSending] = useState(false);
  const [subscribeEmail, setSubscribeEmail] = useState('');
  const [subscribeListKey, setSubscribeListKey] = useState('');

  const apiBase = `/api/zoho/campaigns?tenantId=${encodeURIComponent(currentTenant?.id || '')}`;

  const loadStatus = useCallback(async () => {
    const [statusRes, zohoRes] = await Promise.all([
      fetch(`${apiBase}&action=status`, { credentials: 'include' }).then((r) => r.json().catch(() => ({}))),
      fetch(`/api/auth/zoho/status?tenantId=${encodeURIComponent(currentTenant?.id || '')}`, { credentials: 'include' }).then((r) => r.json().catch(() => ({}))),
    ]);
    setCampaignsReady(statusRes?.campaignsReady === true);
    setBaseConnected(zohoRes?.baseConnected === true || zohoRes?.isConnected === true);
    if (statusRes?.reconnect || statusRes?.code === 'ZOHO_RECONNECT') {
      setCampaignsReady(false);
    }
  }, [apiBase, currentTenant?.id]);

  const loadCampaigns = useCallback(async () => {
    const res = await fetch(`${apiBase}&action=campaigns&range=30`, { credentials: 'include' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to load campaigns');
    const rows: ZohoCampaignSummary[] = data.campaigns || [];
    setCampaigns(rows);

    const sent = rows.filter((c) => c.status?.toLowerCase() === 'sent').slice(0, 8);
    const reportEntries: Record<string, { openRate?: number; clickRate?: number; sentCount?: number }> = {};
    await Promise.all(
      sent.map(async (c) => {
        if (!c.campaignKey) return;
        try {
          const r = await fetch(`${apiBase}&action=report&campaignKey=${encodeURIComponent(c.campaignKey)}`, {
            credentials: 'include',
          });
          const d = await r.json().catch(() => ({}));
          if (d.report) reportEntries[c.campaignKey] = d.report;
        } catch { /* non-fatal */ }
      })
    );
    setReports(reportEntries);
  }, [apiBase]);

  const loadLists = useCallback(async () => {
    const res = await fetch(`${apiBase}&action=lists&range=50`, { credentials: 'include' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to load mailing lists');
    setLists(data.lists || []);
  }, [apiBase]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      await loadStatus();
      await Promise.all([loadCampaigns(), loadLists()]);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to refresh');
    } finally {
      setLoading(false);
    }
  }, [loadStatus, loadCampaigns, loadLists]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const connectZoho = () => {
    router.push('/api/auth/zoho/connect?region=EU');
  };

  const handleCreateAndSend = async () => {
    if (!compose.campaignName.trim() || !compose.subject.trim() || !compose.fromEmail.trim() || !compose.contentUrl.trim()) {
      toast.error('Fill in campaign name, subject, sender email, and content URL');
      return;
    }
    if (!compose.listKeys.length) {
      toast.error('Select at least one mailing list');
      return;
    }

    setSending(true);
    const toastId = toast.loading('Creating campaign…');
    try {
      const createRes = await fetch('/api/zoho/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          tenantId: currentTenant?.id,
          ...compose,
        }),
      });
      const createData = await createRes.json().catch(() => ({}));
      if (!createRes.ok) throw new Error(createData.error || 'Create failed');

      toast.loading('Sending campaign…', { id: toastId });
      const sendRes = await fetch('/api/zoho/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send', tenantId: currentTenant?.id, campaignKey: createData.campaignKey }),
      });
      const sendData = await sendRes.json().catch(() => ({}));
      if (!sendRes.ok) throw new Error(sendData.error || 'Send failed');

      toast.success('Campaign is sending', { id: toastId });
      setCompose({ campaignName: '', subject: '', fromEmail: '', fromName: '', contentUrl: '', listKeys: [] });
      setTab('campaigns');
      await refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Campaign failed', { id: toastId });
    } finally {
      setSending(false);
    }
  };

  const handleSubscribe = async () => {
    if (!subscribeListKey || !subscribeEmail.trim()) {
      toast.error('Select a list and enter an email');
      return;
    }
    try {
      const res = await fetch('/api/zoho/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'subscribe',
          tenantId: currentTenant?.id,
          listKey: subscribeListKey,
          email: subscribeEmail.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || data.message || 'Subscribe failed');
      toast.success(data.message || 'Contact added to list');
      setSubscribeEmail('');
      await loadLists();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Subscribe failed');
    }
  };

  const toggleList = (listKey: string) => {
    setCompose((prev) => ({
      ...prev,
      listKeys: prev.listKeys.includes(listKey)
        ? prev.listKeys.filter((k) => k !== listKey)
        : [...prev.listKeys, listKey],
    }));
  };

  if (!baseConnected) {
    return (
      <ModulePageLayout>
        <div className="max-w-2xl mx-auto rounded-3xl border border-white/5 bg-slate-900/70 p-6 md:p-8 overflow-hidden relative">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(45,212,191,0.18),transparent_42%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.14),transparent_36%)] pointer-events-none" />
          <div className="relative grid gap-6 md:grid-cols-[1.15fr_0.85fr] items-center">
            <div className="space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
                <Megaphone className="w-7 h-7 text-teal-400" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-white">Connect Zoho to run campaigns</h2>
                <p className="text-sm text-slate-400 mt-2 max-w-lg">
                  Campaigns run natively through your Zoho account so lists, sends, opens, and clicks stay in sync.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: 'Live sync', icon: Sparkles },
                  { label: 'Open rates', icon: TrendingUp },
                  { label: 'List segmentation', icon: Users },
                ].map((chip) => {
                  const ChipIcon = chip.icon;
                  return (
                    <span key={chip.label} className="inline-flex items-center gap-1.5 rounded-full border border-white/5 bg-slate-950/60 px-3 py-1 text-[11px] font-bold text-slate-300">
                      <ChipIcon className="w-3.5 h-3.5 text-teal-400" />
                      {chip.label}
                    </span>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={connectZoho}
                className="inline-flex items-center gap-2 rounded-xl bg-teal-500 hover:bg-teal-400 px-5 py-2.5 text-sm font-black text-slate-950 shadow-lg shadow-teal-500/20"
              >
                Connect Zoho
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="rounded-2xl border border-white/5 bg-slate-950/60 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-[0.28em] text-slate-500">Campaign flow</span>
                <span className="text-[11px] font-bold text-teal-400">Ready in 2 steps</span>
              </div>
              <div className="space-y-3">
                {[
                  { title: 'Zoho connected', text: 'Authorize your workspace', active: true },
                  { title: 'Lists synced', text: 'Import segments and audiences', active: false },
                  { title: 'Send campaign', text: 'Track opens and clicks', active: false },
                ].map((step, index) => (
                  <div key={step.title} className="flex items-start gap-3">
                    <div className={`mt-0.5 w-7 h-7 rounded-full border flex items-center justify-center text-[11px] font-black ${
                      step.active
                        ? 'bg-teal-500/15 border-teal-500/30 text-teal-300'
                        : 'bg-slate-800 border-white/5 text-slate-500'
                    }`}>
                      {index + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-white">{step.title}</p>
                      <p className="text-xs text-slate-500">{step.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </ModulePageLayout>
    );
  }

  if (!campaignsReady && !loading) {
    return (
      <ModulePageLayout>
        <div className="max-w-lg mx-auto rounded-2xl border border-amber-500/20 bg-amber-500/5 p-8 text-center">
          <AlertCircle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-white mb-2">Campaigns access needed</h2>
          <p className="text-sm text-slate-400 mb-5">
            Your Zoho connection is missing Campaigns permissions. Reconnect to grant list and campaign access.
          </p>
          <button type="button" onClick={connectZoho} className="inline-flex items-center gap-2 rounded-xl bg-teal-500 px-4 py-2 text-sm font-black text-slate-950">
            Reconnect Zoho
            <ExternalLink className="w-4 h-4" />
          </button>
        </div>
      </ModulePageLayout>
    );
  }

  return (
    <ModulePageLayout
      header={
        <div className="flex items-center justify-between gap-3 mb-2">
          <div>
            <p className="text-xs text-slate-500 uppercase font-bold tracking-widest">Marketing</p>
            <p className="text-sm text-slate-400">Native Zoho Campaigns — lists, sends, analytics</p>
          </div>
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      }
    >
      <div className="mb-4 rounded-xl border border-purple-500/15 bg-purple-500/5 px-4 py-3 text-xs text-slate-400">
        <strong className="text-purple-300">Campaigns are native to Zoho.</strong> Bulk sends always go through Zoho Campaigns.
        For invoices, replies, and one-to-one email, choose your delivery provider in{' '}
        <a href="/dashboard/business/settings" className="text-teal-400 font-semibold hover:underline">Settings → Email Delivery Provider</a>.
      </div>

      <div className="flex gap-2 mb-6 border-b border-white/5 pb-2">
        {([
          { id: 'campaigns' as Tab, label: 'Campaigns', icon: Megaphone },
          { id: 'lists' as Tab, label: 'Mailing Lists', icon: Users },
          { id: 'compose' as Tab, label: 'New Campaign', icon: Plus },
        ]).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wide ${
              tab === id ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin text-teal-400 mr-2" />
          Loading from Zoho…
        </div>
      ) : tab === 'campaigns' ? (
        <div className="space-y-3">
          {campaigns.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-12">No campaigns yet. Create one in the New Campaign tab.</p>
          ) : (
            campaigns.map((c) => {
              const report = c.campaignKey ? reports[c.campaignKey] : undefined;
              return (
                <div key={c.campaignKey || c.name} className="rounded-xl border border-white/5 bg-slate-900/50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-white truncate">{c.name || 'Untitled'}</p>
                    <p className="text-xs text-slate-500 capitalize">{c.status || 'unknown'} · {c.createdAt || '—'}</p>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    {report && (
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-slate-400"><BarChart3 className="w-3 h-3 inline mr-1" />{report.openRate ?? 0}% opens</span>
                        <span className="text-slate-400">{report.clickRate ?? 0}% clicks</span>
                        {report.sentCount != null && <span className="text-slate-500">{report.sentCount} sent</span>}
                      </div>
                    )}
                    {c.previewUrl && (
                      <a href={c.previewUrl.startsWith('http') ? c.previewUrl : `https://${c.previewUrl}`} target="_blank" rel="noreferrer" className="text-teal-400 hover:text-teal-300">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : tab === 'lists' ? (
        <div className="space-y-4">
          <div className="grid gap-3">
            {lists.map((list) => (
              <div key={list.listKey} className="rounded-xl border border-white/5 bg-slate-900/50 p-4 flex justify-between items-center gap-3">
                <div>
                  <p className="font-semibold text-white">{list.name}</p>
                  <p className="text-xs text-slate-500">{list.contactCount} subscribers · {list.unsubscribeCount} unsubscribed</p>
                </div>
                <span className="text-[10px] uppercase font-bold text-slate-500">{list.owner}</span>
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-white/5 bg-slate-950/50 p-4 space-y-3">
            <p className="text-xs font-bold uppercase text-slate-500">Add CRM contact to list</p>
            <select
              value={subscribeListKey}
              onChange={(e) => setSubscribeListKey(e.target.value)}
              className="w-full h-10 bg-slate-900 border border-white/5 rounded-xl px-3 text-xs text-white"
            >
              <option value="">Select mailing list</option>
              {lists.map((l) => (
                <option key={l.listKey} value={l.listKey}>{l.name}</option>
              ))}
            </select>
            <input
              type="email"
              value={subscribeEmail}
              onChange={(e) => setSubscribeEmail(e.target.value)}
              placeholder="contact@example.com"
              className="w-full h-10 bg-slate-900 border border-white/5 rounded-xl px-3 text-xs text-white"
            />
            <button type="button" onClick={handleSubscribe} className="rounded-xl bg-teal-600 px-4 py-2 text-xs font-bold text-white">
              Add to list
            </button>
          </div>
        </div>
      ) : (
        <div className="max-w-2xl space-y-4">
          <input
            value={compose.campaignName}
            onChange={(e) => setCompose({ ...compose, campaignName: e.target.value })}
            placeholder="Campaign name"
            className="w-full h-11 bg-slate-900 border border-white/5 rounded-xl px-4 text-sm text-white"
          />
          <input
            value={compose.subject}
            onChange={(e) => setCompose({ ...compose, subject: e.target.value })}
            placeholder="Email subject"
            className="w-full h-11 bg-slate-900 border border-white/5 rounded-xl px-4 text-sm text-white"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              value={compose.fromEmail}
              onChange={(e) => setCompose({ ...compose, fromEmail: e.target.value })}
              placeholder="From email"
              className="h-11 bg-slate-900 border border-white/5 rounded-xl px-4 text-sm text-white"
            />
            <input
              value={compose.fromName}
              onChange={(e) => setCompose({ ...compose, fromName: e.target.value })}
              placeholder="From name (optional)"
              className="h-11 bg-slate-900 border border-white/5 rounded-xl px-4 text-sm text-white"
            />
          </div>
          <input
            value={compose.contentUrl}
            onChange={(e) => setCompose({ ...compose, contentUrl: e.target.value })}
            placeholder="Public HTML content URL (hosted newsletter HTML)"
            className="w-full h-11 bg-slate-900 border border-white/5 rounded-xl px-4 text-sm text-white"
          />
          <div>
            <p className="text-xs font-bold uppercase text-slate-500 mb-2">Mailing lists</p>
            <div className="flex flex-wrap gap-2">
              {lists.map((l) => (
                <button
                  key={l.listKey}
                  type="button"
                  onClick={() => toggleList(l.listKey)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                    compose.listKeys.includes(l.listKey)
                      ? 'bg-teal-600/20 border-teal-500/40 text-teal-300'
                      : 'border-white/10 text-slate-400 hover:text-white'
                  }`}
                >
                  {l.name} ({l.contactCount})
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={handleCreateAndSend}
            disabled={sending}
            className="inline-flex items-center gap-2 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-50 px-5 py-2.5 text-sm font-bold text-white"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Create &amp; Send
          </button>
          <p className="text-[10px] text-slate-500 flex items-start gap-1.5">
            <Mail className="w-3 h-3 mt-0.5 shrink-0" />
            Campaigns are created and delivered through Zoho Campaigns. Provide a publicly accessible HTML URL for your newsletter body.
          </p>
        </div>
      )}
    </ModulePageLayout>
  );
}
