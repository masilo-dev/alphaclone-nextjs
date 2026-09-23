'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Rocket, Target, Mail, MailCheck, BarChart3, Settings, Users, Inbox,
  AlertTriangle, CheckCircle2, TrendingUp, Zap, Calendar, RefreshCw,
  Shield, Globe, Send, Search, Filter, Plus, ChevronRight, Loader2,
  Activity, ArrowUpRight, MailWarning, PlayCircle, Archive,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

// ── Types ─────────────────────────────────────────────────

type Tab = 'overview' | 'leads' | 'campaigns' | 'mailboxes' | 'replies' | 'analytics' | 'settings';

interface OverviewData {
  active_campaigns: number;
  active_campaigns_detail: Array<{ id: string; name: string; status: string; sent: number; bounceRate: number }>;
  ready_leads: number;
  emails_sent_30d: number;
  emails_delivered_30d: number;
  positive_replies_7d: number;
  positive_replies_detail: Array<{ id: string; lead_id: string | null; contact_id: string | null; metadata: Record<string, unknown>; occurred_at: string }>;
  meetings_booked_30d: number;
  bounce_rate_30d: number;
  reply_rate_30d: number;
  mailbox_warnings: number;
  system_health: 'healthy' | 'warning';
  health_reasons: string[];
}

interface Lead {
  id: string;
  business_name?: string;
  contact_name?: string;
  email?: string;
  industry?: string;
  stage?: string;
  status?: string;
  source?: string;
  created_at?: string;
  updated_at?: string;
}

interface Mailbox {
  id: string;
  name: string;
  provider: string;
  email_address: string;
  connection_state: string;
  sending_enabled: boolean;
  daily_limit: number;
  messages_sent_today: number;
  is_primary_domain: boolean;
  spf_status: string;
  dkim_status: string;
  dmarc_status: string;
  mx_status: string;
  last_error?: string;
  health?: {
    can_send: boolean;
    remaining_today: number;
    warnings: string[];
    errors: string[];
    overall_status: string;
  };
}

interface Campaign {
  id: string;
  name: string;
  status: string;
  total_sent?: number;
  total_delivered?: number;
  total_bounced?: number;
  total_unsubscribed?: number;
  created_at?: string;
}

// ── Constants ─────────────────────────────────────────────

const TABS: Array<{ id: Tab; label: string; Icon: typeof Rocket }> = [
  { id: 'overview', label: 'Overview', Icon: Activity },
  { id: 'leads', label: 'Leads', Icon: Users },
  { id: 'campaigns', label: 'Campaigns', Icon: Mail },
  { id: 'mailboxes', label: 'Mailboxes', Icon: Shield },
  { id: 'replies', label: 'Replies', Icon: Inbox },
  { id: 'analytics', label: 'Analytics', Icon: BarChart3 },
  { id: 'settings', label: 'Settings', Icon: Settings },
];

const PROVIDER_COLORS: Record<string, string> = {
  microsoft: 'bg-blue-100 text-blue-700',
  zoho: 'bg-orange-100 text-orange-700',
  brevo: 'bg-emerald-100 text-emerald-700',
  resend: 'bg-violet-100 text-violet-700',
  sendgrid: 'bg-indigo-100 text-indigo-700',
  smtp: 'bg-slate-100 text-slate-700',
  other: 'bg-slate-100 text-slate-700',
};

const DNS_STATUS_BADGE: Record<string, string> = {
  healthy: 'bg-emerald-100 text-emerald-700',
  warning: 'bg-amber-100 text-amber-700',
  critical: 'bg-red-100 text-red-700',
  unknown: 'bg-slate-100 text-slate-500',
};

const FUNNEL_STAGES = [
  { key: 'discovered', label: 'Discovered', color: 'bg-slate-200' },
  { key: 'qualified', label: 'Qualified', color: 'bg-blue-200' },
  { key: 'verified', label: 'Verified', color: 'bg-blue-300' },
  { key: 'contacted', label: 'Contacted', color: 'bg-indigo-300' },
  { key: 'replied', label: 'Replied', color: 'bg-violet-300' },
  { key: 'interested', label: 'Interested', color: 'bg-emerald-300' },
  { key: 'meeting', label: 'Meeting', color: 'bg-emerald-400' },
  { key: 'customer', label: 'Customer', color: 'bg-emerald-500' },
];

// ── Loading skeleton ──────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded bg-slate-100', className)} />;
}

// ── Metric card ───────────────────────────────────────────

function MetricCard({
  label, value, sub, icon: Icon, tone = 'blue', warning = false,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: typeof Activity;
  tone?: 'blue' | 'green' | 'amber' | 'red' | 'violet' | 'slate';
  warning?: boolean;
}) {
  const tones: Record<string, string> = {
    blue: 'text-blue-600 bg-blue-50',
    green: 'text-emerald-600 bg-emerald-50',
    amber: 'text-amber-600 bg-amber-50',
    red: 'text-red-600 bg-red-50',
    violet: 'text-violet-600 bg-violet-50',
    slate: 'text-slate-600 bg-slate-50',
  };
  return (
    <div className={cn(
      'rounded-xl border bg-white shadow-sm p-5 flex flex-col gap-3',
      warning ? 'border-amber-200' : 'border-slate-200'
    )}>
      <div className="flex items-start justify-between">
        <span className="text-sm font-medium text-slate-500">{label}</span>
        <span className={cn('p-1.5 rounded-lg', tones[tone])}>
          <Icon size={15} />
        </span>
      </div>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-bold text-slate-900">{value}</span>
        {sub && <span className="text-xs text-slate-400 mb-0.5">{sub}</span>}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────

export default function OutboundEngine() {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('overview');

  // Overview
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);

  // Leads
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [leadsSearch, setLeadsSearch] = useState('');
  const [leadsPage, setLeadsPage] = useState(1);
  const [leadsTotal, setLeadsTotal] = useState(0);

  // Campaigns
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(false);

  // Mailboxes
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [mailboxesLoading, setMailboxesLoading] = useState(false);
  const [checkingDns, setCheckingDns] = useState<string | null>(null);
  const [showAddMailbox, setShowAddMailbox] = useState(false);

  const tenantId = currentTenant?.id;

  // ── Fetchers ──────────────────────────────────────────

  const loadOverview = useCallback(async () => {
    if (!tenantId) return;
    setOverviewLoading(true);
    try {
      const res = await fetch(`/api/outbound/overview?tenantId=${encodeURIComponent(tenantId)}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setOverview(data.overview);
      }
    } catch {
      // silent — overview is best-effort
    } finally {
      setOverviewLoading(false);
    }
  }, [tenantId]);

  const loadLeads = useCallback(async () => {
    if (!tenantId) return;
    setLeadsLoading(true);
    try {
      const params = new URLSearchParams({
        tenantId,
        page: String(leadsPage),
        limit: '20',
        ...(leadsSearch ? { q: leadsSearch } : {}),
      });
      const res = await fetch(`/api/leads?${params}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setLeads(data.leads || data.data || []);
        setLeadsTotal(data.total || data.count || 0);
      }
    } catch {
      // silent
    } finally {
      setLeadsLoading(false);
    }
  }, [tenantId, leadsPage, leadsSearch]);

  const loadCampaigns = useCallback(async () => {
    if (!tenantId) return;
    setCampaignsLoading(true);
    try {
      const res = await fetch(`/api/outreach/events?tenantId=${encodeURIComponent(tenantId)}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setCampaigns((data.campaigns || []).slice(0, 20));
      }
    } catch {
      // silent
    } finally {
      setCampaignsLoading(false);
    }
  }, [tenantId]);

  const loadMailboxes = useCallback(async () => {
    if (!tenantId) return;
    setMailboxesLoading(true);
    try {
      const res = await fetch(`/api/outbound/mailboxes?tenantId=${encodeURIComponent(tenantId)}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setMailboxes(data.mailboxes || []);
      }
    } catch {
      // silent
    } finally {
      setMailboxesLoading(false);
    }
  }, [tenantId]);

  const checkDns = async (mailboxId: string) => {
    if (!tenantId) return;
    setCheckingDns(mailboxId);
    try {
      const res = await fetch(
        `/api/outbound/mailboxes?tenantId=${encodeURIComponent(tenantId)}&action=dns&mailboxId=${encodeURIComponent(mailboxId)}`,
        { credentials: 'include' }
      );
      if (res.ok) {
        toast.success('DNS check complete');
        await loadMailboxes();
      } else {
        toast.error('DNS check failed');
      }
    } catch {
      toast.error('DNS check unavailable');
    } finally {
      setCheckingDns(null);
    }
  };

  // Load on tab switch
  useEffect(() => {
    if (tab === 'overview') loadOverview();
    if (tab === 'leads') loadLeads();
    if (tab === 'campaigns' || tab === 'analytics') loadCampaigns();
    if (tab === 'mailboxes') loadMailboxes();
    if (tab === 'overview' && !overview) loadMailboxes(); // need mailboxes for warnings
  }, [tab, tenantId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Render ────────────────────────────────────────────

  if (!tenantId) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <Loader2 className="animate-spin mr-2" size={18} /> Loading workspace…
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-0 h-full bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-50">
              <Rocket size={18} className="text-blue-600" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-slate-900">Outbound Engine</h1>
              <p className="text-xs text-slate-500">Discover → Qualify → Send → Reply → Book → Convert</p>
            </div>
          </div>
          <Button
            size="sm"
            className="bg-[#356AF4] hover:bg-[#2a57d4] text-white text-xs"
            onClick={() => router.push('/dashboard/leads/finder')}
          >
            <Plus size={13} className="mr-1" /> Add Leads
          </Button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="bg-white border-b border-slate-200 overflow-x-auto">
        <div className="flex min-w-max px-4">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                tab === id
                  ? 'border-[#356AF4] text-[#356AF4]'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              )}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab body */}
      <div className="flex-1 overflow-auto p-6">
        {tab === 'overview' && (
          <OverviewTab overview={overview} loading={overviewLoading} onRefresh={loadOverview} />
        )}
        {tab === 'leads' && (
          <LeadsTab
            leads={leads} loading={leadsLoading} total={leadsTotal}
            search={leadsSearch} onSearch={(v) => { setLeadsSearch(v); setLeadsPage(1); }}
            page={leadsPage} onPage={setLeadsPage}
            onRefresh={loadLeads}
          />
        )}
        {tab === 'campaigns' && (
          <CampaignsTab campaigns={campaigns} loading={campaignsLoading} onRefresh={loadCampaigns} />
        )}
        {tab === 'mailboxes' && (
          <MailboxesTab
            mailboxes={mailboxes} loading={mailboxesLoading}
            checkingDns={checkingDns} onCheckDns={checkDns}
            onRefresh={loadMailboxes} tenantId={tenantId}
            showAdd={showAddMailbox} onToggleAdd={() => setShowAddMailbox((v) => !v)}
          />
        )}
        {tab === 'replies' && <RepliesTab tenantId={tenantId} />}
        {tab === 'analytics' && (
          <AnalyticsTab campaigns={campaigns} loading={campaignsLoading} tenantId={tenantId} />
        )}
        {tab === 'settings' && <SettingsTab tenantId={tenantId} />}
      </div>
    </div>
  );
}

// ── Overview Tab ──────────────────────────────────────────

function OverviewTab({ overview, loading, onRefresh }: {
  overview: OverviewData | null;
  loading: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">What's happening</h2>
        <button onClick={onRefresh} className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1">
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <MetricCard
            label="Active campaigns" icon={Mail}
            value={overview?.active_campaigns ?? 0} tone="blue"
          />
          <MetricCard
            label="Ready leads" icon={Users}
            value={overview?.ready_leads ?? 0} sub="qualified" tone="green"
          />
          <MetricCard
            label="Emails sent" icon={Send}
            value={overview?.emails_sent_30d ?? 0} sub="30d" tone="slate"
          />
          <MetricCard
            label="Positive replies" icon={MailCheck}
            value={overview?.positive_replies_7d ?? 0} sub="7d" tone="violet"
          />
          <MetricCard
            label="Meetings booked" icon={Calendar}
            value={overview?.meetings_booked_30d ?? 0} sub="30d" tone="green"
          />
          <MetricCard
            label="Mailbox warnings" icon={AlertTriangle}
            value={overview?.mailbox_warnings ?? 0} tone="amber"
            warning={(overview?.mailbox_warnings ?? 0) > 0}
          />
        </div>
      )}

      {/* System health */}
      {overview && (
        <div className={cn(
          'rounded-xl border p-4 flex items-start gap-3',
          overview.system_health === 'healthy'
            ? 'border-emerald-200 bg-emerald-50'
            : 'border-amber-200 bg-amber-50'
        )}>
          {overview.system_health === 'healthy' ? (
            <CheckCircle2 size={16} className="text-emerald-600 mt-0.5 shrink-0" />
          ) : (
            <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0" />
          )}
          <div>
            <p className="text-sm font-medium text-slate-800">
              {overview.system_health === 'healthy' ? 'All systems operational' : 'Attention required'}
            </p>
            {overview.health_reasons.length > 0 && (
              <ul className="mt-1 space-y-0.5">
                {overview.health_reasons.map((r, i) => (
                  <li key={i} className="text-xs text-slate-600">{r}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Active campaigns detail */}
      {overview && overview.active_campaigns_detail.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Active Campaigns</h3>
          <div className="space-y-2">
            {overview.active_campaigns_detail.map((c) => (
              <div
                key={c.id}
                className="rounded-xl border border-slate-200 bg-white p-4 flex items-center justify-between shadow-sm"
              >
                <div>
                  <p className="text-sm font-medium text-slate-800">{c.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{c.sent.toLocaleString()} sent · {(c.bounceRate * 100).toFixed(1)}% bounce</p>
                </div>
                <Badge className={cn(
                  'text-xs',
                  c.status === 'sending' || c.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                  c.status === 'scheduled' ? 'bg-blue-100 text-blue-700' :
                  'bg-slate-100 text-slate-700'
                )}>
                  {c.status}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Speed-to-lead: positive replies */}
      {overview && overview.positive_replies_detail.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Positive replies — needs your attention
            </h3>
          </div>
          <div className="space-y-2">
            {overview.positive_replies_detail.slice(0, 5).map((r) => {
              const meta = r.metadata as Record<string, unknown>;
              const name = String(meta?.recipient_name || meta?.lead_name || meta?.contact_name || 'Unknown');
              const company = String(meta?.company || '');
              return (
                <div
                  key={r.id}
                  className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 flex items-center justify-between"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-900">{name}{company ? ` · ${company}` : ''}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {new Date(r.occurred_at).toLocaleDateString()} · Positive reply
                    </p>
                  </div>
                  <Badge className="bg-emerald-100 text-emerald-700 text-xs">Interested</Badge>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Leads Tab ─────────────────────────────────────────────

function LeadsTab({
  leads, loading, total, search, onSearch, page, onPage, onRefresh,
}: {
  leads: Lead[];
  loading: boolean;
  total: number;
  search: string;
  onSearch: (v: string) => void;
  page: number;
  onPage: (p: number) => void;
  onRefresh: () => void;
}) {
  const totalPages = Math.ceil(total / 20);

  return (
    <div className="space-y-4 max-w-6xl">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search leads…"
            className="pl-9 text-sm h-9 bg-white"
          />
        </div>
        <button onClick={onRefresh} className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1">
          <RefreshCw size={12} /> Refresh
        </button>
        <Button size="sm" className="bg-[#356AF4] hover:bg-[#2a57d4] text-white text-xs h-9">
          <Plus size={13} className="mr-1" /> Import CSV
        </Button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Company', 'Contact', 'Stage', 'Source', 'Last Activity'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 5 }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <Skeleton className="h-4 w-24" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : leads.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-slate-400 text-sm">
                    No leads found.{' '}
                    <button
                      className="text-[#356AF4] hover:underline"
                      onClick={() => window.location.href = '/dashboard/leads/finder'}
                    >
                      Discover leads
                    </button>
                  </td>
                </tr>
              ) : (
                leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-slate-50 transition-colors cursor-pointer">
                    <td className="px-4 py-3 font-medium text-slate-900">{lead.business_name || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{lead.contact_name || '—'}</td>
                    <td className="px-4 py-3">
                      <StageBadge stage={lead.stage || lead.status || 'new'} />
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{lead.source || '—'}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">
                      {lead.updated_at ? new Date(lead.updated_at).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden divide-y divide-slate-100">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="p-4 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            ))
          ) : leads.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">No leads found.</div>
          ) : (
            leads.map((lead) => (
              <div key={lead.id} className="p-4 flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-900">{lead.business_name || '—'}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{lead.contact_name || ''}</p>
                  <p className="text-xs text-slate-400 mt-1">{lead.source || ''}</p>
                </div>
                <StageBadge stage={lead.stage || lead.status || 'new'} />
              </div>
            ))
          )}
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>{total} total leads</span>
          <div className="flex items-center gap-2">
            <button
              disabled={page === 1}
              onClick={() => onPage(page - 1)}
              className="px-3 py-1.5 rounded border border-slate-200 bg-white disabled:opacity-40 hover:bg-slate-50"
            >
              Previous
            </button>
            <span>Page {page} of {totalPages}</span>
            <button
              disabled={page === totalPages}
              onClick={() => onPage(page + 1)}
              className="px-3 py-1.5 rounded border border-slate-200 bg-white disabled:opacity-40 hover:bg-slate-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StageBadge({ stage }: { stage: string }) {
  const s = stage.toLowerCase();
  const cls =
    s === 'qualified' || s === 'ready_for_outreach' ? 'bg-emerald-100 text-emerald-700' :
    s === 'contacted' || s === 'sent' ? 'bg-blue-100 text-blue-700' :
    s === 'replied' || s === 'interested' ? 'bg-violet-100 text-violet-700' :
    s === 'converted' || s === 'customer' ? 'bg-emerald-200 text-emerald-800' :
    s === 'bounced' || s === 'invalid' || s === 'disqualified' ? 'bg-red-100 text-red-700' :
    'bg-slate-100 text-slate-600';
  return <Badge className={cn('text-xs', cls)}>{stage}</Badge>;
}

// ── Campaigns Tab ─────────────────────────────────────────

function CampaignsTab({ campaigns, loading, onRefresh }: {
  campaigns: Campaign[];
  loading: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">Email campaigns</h2>
        <div className="flex gap-2">
          <button onClick={onRefresh} className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1">
            <RefreshCw size={12} /> Refresh
          </button>
          <Button
            size="sm"
            className="bg-[#356AF4] hover:bg-[#2a57d4] text-white text-xs"
            onClick={() => window.location.href = '/dashboard/business/campaigns'}
          >
            <ArrowUpRight size={13} className="mr-1" /> Manage
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : campaigns.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-slate-200 p-12 text-center">
          <Mail size={32} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 text-sm">No campaigns yet</p>
          <Button
            size="sm"
            className="mt-4 bg-[#356AF4] hover:bg-[#2a57d4] text-white text-xs"
            onClick={() => window.location.href = '/dashboard/business/campaigns'}
          >
            Create first campaign
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {campaigns.map((c) => {
            const sent = (c as { sent?: number }).sent ?? c.total_sent ?? 0;
            const delivered = (c as { delivered?: number }).delivered ?? c.total_delivered ?? 0;
            const replies = (c as { replies?: number }).replies ?? 0;
            return (
              <div
                key={c.id}
                className="rounded-xl border border-slate-200 bg-white shadow-sm p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <p className="text-sm font-medium text-slate-900">Campaign</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                    <span>{sent.toLocaleString()} sent</span>
                    {delivered > 0 && <span>{delivered.toLocaleString()} delivered</span>}
                    {replies > 0 && <span>{replies} replies</span>}
                  </div>
                </div>
                <Badge className={cn(
                  'text-xs self-start sm:self-center',
                  (c as { shouldPause?: boolean }).shouldPause ? 'bg-red-100 text-red-700' :
                  (c as { safe?: boolean }).safe !== false ? 'bg-emerald-100 text-emerald-700' :
                  'bg-slate-100 text-slate-600'
                )}>
                  {(c as { shouldPause?: boolean }).shouldPause ? 'At risk' : 'Healthy'}
                </Badge>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Mailboxes Tab ─────────────────────────────────────────

function MailboxesTab({
  mailboxes, loading, checkingDns, onCheckDns, onRefresh, tenantId, showAdd, onToggleAdd,
}: {
  mailboxes: Mailbox[];
  loading: boolean;
  checkingDns: string | null;
  onCheckDns: (id: string) => void;
  onRefresh: () => void;
  tenantId: string;
  showAdd: boolean;
  onToggleAdd: () => void;
}) {
  const [form, setForm] = useState({
    name: '', provider: 'brevo', email_address: '', from_name: '',
    daily_limit: 100, is_primary_domain: false,
  });
  const [saving, setSaving] = useState(false);

  const saveMailbox = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/outbound/mailboxes', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, tenantId }),
      });
      if (res.ok) {
        toast.success('Mailbox added');
        onToggleAdd();
        setForm({ name: '', provider: 'brevo', email_address: '', from_name: '', daily_limit: 100, is_primary_domain: false });
        onRefresh();
      } else {
        const d = await res.json().catch(() => ({}));
        toast.error(d.error || 'Failed to add mailbox');
      }
    } catch {
      toast.error('Failed to add mailbox');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">Sending mailboxes</h2>
        <div className="flex gap-2">
          <button onClick={onRefresh} className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1">
            <RefreshCw size={12} /> Refresh
          </button>
          <Button size="sm" className="bg-[#356AF4] hover:bg-[#2a57d4] text-white text-xs" onClick={onToggleAdd}>
            <Plus size={13} className="mr-1" /> Add Mailbox
          </Button>
        </div>
      </div>

      {/* Add mailbox form */}
      {showAdd && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 space-y-3">
          <h3 className="text-sm font-semibold text-slate-800">New mailbox</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input placeholder="Display name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="bg-white text-sm" />
            <select
              value={form.provider}
              onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value }))}
              className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800"
            >
              {['microsoft', 'zoho', 'brevo', 'resend', 'sendgrid', 'smtp', 'other'].map((p) => (
                <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
              ))}
            </select>
            <Input placeholder="from@yourdomain.com" value={form.email_address} onChange={(e) => setForm((f) => ({ ...f, email_address: e.target.value }))} className="bg-white text-sm" />
            <Input placeholder="From name (optional)" value={form.from_name} onChange={(e) => setForm((f) => ({ ...f, from_name: e.target.value }))} className="bg-white text-sm" />
            <div className="flex items-center gap-2">
              <Input
                type="number" min={1} max={10000}
                placeholder="Daily limit" value={form.daily_limit}
                onChange={(e) => setForm((f) => ({ ...f, daily_limit: Number(e.target.value) }))}
                className="bg-white text-sm"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox" checked={form.is_primary_domain}
                onChange={(e) => setForm((f) => ({ ...f, is_primary_domain: e.target.checked }))}
                className="rounded"
              />
              Primary business domain
            </label>
          </div>
          {form.is_primary_domain && (
            <div className="rounded-lg bg-amber-100 border border-amber-200 p-3 text-xs text-amber-800 flex items-start gap-2">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              Warning: Cold outreach from a primary domain can affect your email reputation. Consider using a separate sending domain.
            </div>
          )}
          <div className="flex gap-2">
            <Button size="sm" className="bg-[#356AF4] hover:bg-[#2a57d4] text-white text-xs" onClick={saveMailbox} disabled={saving || !form.email_address || !form.name}>
              {saving ? <Loader2 size={13} className="animate-spin mr-1" /> : null} Save mailbox
            </Button>
            <Button size="sm" variant="outline" className="text-xs" onClick={onToggleAdd}>Cancel</Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-40" />)}
        </div>
      ) : mailboxes.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-slate-200 p-12 text-center">
          <Shield size={32} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 text-sm">No mailboxes configured</p>
          <p className="text-slate-400 text-xs mt-1">Add a sending mailbox to enable outbound campaigns</p>
        </div>
      ) : (
        <div className="space-y-3">
          {mailboxes.map((m) => {
            const usagePercent = m.daily_limit > 0 ? Math.min(100, (m.messages_sent_today / m.daily_limit) * 100) : 0;
            const overallStatus = m.health?.overall_status ?? 'unknown';
            return (
              <div key={m.id} className="rounded-xl border border-slate-200 bg-white shadow-sm p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className={cn('mt-0.5 h-2.5 w-2.5 rounded-full shrink-0',
                      m.connection_state === 'connected' ? 'bg-emerald-500' :
                      m.connection_state === 'error' ? 'bg-red-500' : 'bg-slate-300'
                    )} />
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-slate-900">{m.name}</p>
                        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', PROVIDER_COLORS[m.provider] || PROVIDER_COLORS.other)}>
                          {m.provider}
                        </span>
                        {m.is_primary_domain && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">Primary domain</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{m.email_address}</p>
                    </div>
                  </div>
                  <Badge className={cn('text-xs shrink-0',
                    overallStatus === 'healthy' ? 'bg-emerald-100 text-emerald-700' :
                    overallStatus === 'degraded' ? 'bg-amber-100 text-amber-700' :
                    overallStatus === 'blocked' ? 'bg-red-100 text-red-700' :
                    'bg-slate-100 text-slate-600'
                  )}>
                    {overallStatus}
                  </Badge>
                </div>

                {/* Daily limit bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Daily limit</span>
                    <span>{m.messages_sent_today} / {m.daily_limit} sent</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all', usagePercent >= 90 ? 'bg-red-500' : usagePercent >= 70 ? 'bg-amber-500' : 'bg-emerald-500')}
                      style={{ width: `${usagePercent}%` }}
                    />
                  </div>
                </div>

                {/* DNS health */}
                <div className="flex items-center gap-2 flex-wrap">
                  {(['spf', 'dkim', 'dmarc', 'mx'] as const).map((check) => {
                    const status = m[`${check}_status` as keyof Mailbox] as string || 'unknown';
                    return (
                      <span key={check} className={cn('text-xs px-2 py-0.5 rounded-full font-medium uppercase', DNS_STATUS_BADGE[status] || DNS_STATUS_BADGE.unknown)}>
                        {check}: {status}
                      </span>
                    );
                  })}
                  <button
                    onClick={() => onCheckDns(m.id)}
                    disabled={checkingDns === m.id}
                    className="text-xs text-[#356AF4] hover:underline flex items-center gap-1 disabled:opacity-50"
                  >
                    {checkingDns === m.id ? <Loader2 size={11} className="animate-spin" /> : <Globe size={11} />}
                    Check DNS
                  </button>
                </div>

                {/* Warnings */}
                {(m.health?.warnings?.length ?? 0) > 0 && (
                  <div className="space-y-1">
                    {m.health!.warnings.map((w, i) => (
                      <p key={i} className="text-xs text-amber-700 flex items-center gap-1.5">
                        <AlertTriangle size={11} /> {w}
                      </p>
                    ))}
                  </div>
                )}

                {/* Errors */}
                {(m.health?.errors?.length ?? 0) > 0 && (
                  <div className="space-y-1">
                    {m.health!.errors.map((e, i) => (
                      <p key={i} className="text-xs text-red-700 flex items-center gap-1.5">
                        <AlertTriangle size={11} /> {e}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Replies Tab ───────────────────────────────────────────

function RepliesTab({ tenantId }: { tenantId: string }) {
  const [replies, setReplies] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/outreach/inbox?tenantId=${encodeURIComponent(tenantId)}`, {
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          setReplies(data.items || data.events || data.replies || []);
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [tenantId]);

  return (
    <div className="space-y-4 max-w-4xl">
      <h2 className="text-sm font-semibold text-slate-700">Replies inbox</h2>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : replies.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-slate-200 p-12 text-center">
          <Inbox size={32} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 text-sm">No replies yet</p>
          <p className="text-slate-400 text-xs mt-1">Replies from your campaigns will appear here</p>
        </div>
      ) : (
        <div className="space-y-2">
          {replies.map((r: Record<string, unknown>) => {
            const meta = (r.metadata || {}) as Record<string, unknown>;
            const name = String(meta.recipient_name || meta.lead_name || r.sender || 'Unknown');
            const classification = String(meta.reply_classification || r.event_type || 'replied');
            const replyText = String(meta.reply_text || '').slice(0, 120);
            return (
              <div
                key={r.id as string}
                className={cn(
                  'rounded-xl border bg-white shadow-sm p-4 space-y-2',
                  classification === 'positive' || classification === 'positive_reply'
                    ? 'border-emerald-200'
                    : classification === 'unsubscribe'
                    ? 'border-slate-200'
                    : 'border-slate-200'
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{name}</p>
                    {replyText && (
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">"{replyText}…"</p>
                    )}
                  </div>
                  <Badge className={cn('text-xs shrink-0',
                    classification === 'positive' || classification === 'positive_reply' ? 'bg-emerald-100 text-emerald-700' :
                    classification === 'unsubscribe' ? 'bg-slate-100 text-slate-600' :
                    classification === 'objection' ? 'bg-amber-100 text-amber-700' :
                    'bg-blue-100 text-blue-700'
                  )}>
                    {classification.replace('_', ' ')}
                  </Badge>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="text-xs h-7">Reply</Button>
                  <Button size="sm" variant="outline" className="text-xs h-7">Book meeting</Button>
                  <Button size="sm" variant="outline" className="text-xs h-7">Mark done</Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Analytics Tab ─────────────────────────────────────────

function AnalyticsTab({ campaigns, loading, tenantId }: {
  campaigns: Campaign[];
  loading: boolean;
  tenantId: string;
}) {
  // Derive funnel data from campaign events
  const funnelData = FUNNEL_STAGES.map((s) => ({
    ...s,
    count: s.key === 'contacted' ? campaigns.reduce((sum, c) => sum + ((c as { sent?: number }).sent ?? c.total_sent ?? 0), 0) :
           s.key === 'replied' ? campaigns.reduce((sum, c) => sum + ((c as { replies?: number }).replies ?? 0), 0) :
           0,
  }));

  const maxCount = Math.max(...funnelData.map((s) => s.count), 1);

  return (
    <div className="space-y-6 max-w-5xl">
      <h2 className="text-sm font-semibold text-slate-700">Acquisition funnel</h2>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-3">
          {FUNNEL_STAGES.map((stage, i) => {
            const current = funnelData[i];
            const prev = i > 0 ? funnelData[i - 1] : null;
            const conversion = prev && prev.count > 0 ? (current.count / prev.count * 100).toFixed(0) : null;
            const pct = maxCount > 0 ? (current.count / maxCount) * 100 : 0;

            return (
              <div key={stage.key} className="flex items-center gap-4">
                <div className="w-24 text-right text-xs text-slate-500 font-medium shrink-0">
                  {stage.label}
                </div>
                <div className="flex-1 flex items-center gap-3">
                  <div className="flex-1 bg-slate-100 rounded-full h-7 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full flex items-center justify-end pr-2 transition-all', stage.color)}
                      style={{ width: `${Math.max(pct, 2)}%` }}
                    >
                      {current.count > 0 && (
                        <span className="text-xs font-semibold text-slate-700">{current.count.toLocaleString()}</span>
                      )}
                    </div>
                  </div>
                  {conversion && (
                    <div className="text-xs text-slate-400 w-12 shrink-0">
                      {conversion}%
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total sent', value: campaigns.reduce((s, c) => s + ((c as { sent?: number }).sent ?? c.total_sent ?? 0), 0).toLocaleString() },
          { label: 'Total replies', value: campaigns.reduce((s, c) => s + ((c as { replies?: number }).replies ?? 0), 0).toLocaleString() },
          { label: 'Total meetings', value: campaigns.reduce((s, c) => s + ((c as { meetings?: number }).meetings ?? 0), 0).toLocaleString() },
          { label: 'Campaigns tracked', value: campaigns.length.toString() },
        ].map((m) => (
          <div key={m.label} className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
            <p className="text-xs text-slate-500">{m.label}</p>
            <p className="text-xl font-bold text-slate-900 mt-1">{m.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Settings Tab ──────────────────────────────────────────

function SettingsTab({ tenantId }: { tenantId: string }) {
  const router = useRouter();

  return (
    <div className="space-y-4 max-w-2xl">
      <h2 className="text-sm font-semibold text-slate-700">Outbound settings</h2>

      <div className="space-y-2">
        {[
          {
            icon: Target,
            title: 'ICP Configuration',
            desc: 'Define your ideal customer profile for AI-powered lead qualification',
            action: 'Configure ICP',
            href: '/dashboard/outbound/icp',
          },
          {
            icon: Archive,
            title: 'Suppression list',
            desc: 'View and manage suppressed emails (unsubscribes, bounces, manual blocks)',
            action: 'Manage suppressions',
            href: '/dashboard/business/campaigns',
          },
          {
            icon: Shield,
            title: 'Email verification',
            desc: 'Verify email addresses before sending to protect sender reputation',
            action: 'Verify emails',
            href: '/dashboard/leads',
          },
          {
            icon: Globe,
            title: 'Domain & mailbox health',
            desc: 'Check SPF, DKIM, DMARC and sending infrastructure',
            action: 'Check health',
            onClick: () => undefined,
          },
        ].map((item) => (
          <div
            key={item.title}
            className="rounded-xl border border-slate-200 bg-white shadow-sm p-4 flex items-center justify-between gap-4"
          >
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-slate-50">
                <item.icon size={15} className="text-slate-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900">{item.title}</p>
                <p className="text-xs text-slate-500 mt-0.5">{item.desc}</p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="text-xs shrink-0"
              onClick={item.href ? () => router.push(item.href!) : item.onClick}
            >
              {item.action} <ChevronRight size={12} className="ml-1" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
