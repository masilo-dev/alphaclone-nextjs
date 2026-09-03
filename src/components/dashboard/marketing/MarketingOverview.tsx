'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Mail,
  Send,
  PenSquare,
  AlertTriangle,
  Activity,
  Loader2,
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { ModuleOverviewChrome } from '@/components/ui/os/ModuleOverviewChrome';
import ActiveCampaignCard, { type ActiveCampaignData } from './ActiveCampaignCard';
import AIOutreachModal from '../business/AIOutreachModal';
import toast from 'react-hot-toast';

type OverviewData = {
  today: {
    emailsSent: number;
    outreachSent: number;
    socialPosts: number;
    replies: number;
    meetingsBooked: number;
  };
  activeWork: ActiveCampaignData[];
  socialScheduled: number;
  needsAttention: Array<{
    id: string;
    type: string;
    title: string;
    detail: string;
    affected?: number;
    href?: string;
    action?: string;
  }>;
  recentResults: {
    replies: number;
    meetings: number;
    qualifiedLeads: number;
    customers: number;
  };
  delivery: {
    mode: string;
    resolvedProvider: string;
    resolvedLabel: string;
    providers: Array<{
      id: string;
      label: string;
      connected: boolean;
      role: string;
      health: string;
    }>;
  };
  recentOutreach: Array<{
    id: string;
    company: string;
    recipient: string;
    status: string;
    lastAction: string;
    nextStep: string;
    error?: string;
  }>;
  activity: Array<{
    id: string;
    time: string;
    label: string;
    source?: string;
    detail?: string;
  }>;
  globalPauseAvailable: boolean;
};

function KpiCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="ac-workspace-panel p-3 text-center">
      <p className="text-[10px] uppercase tracking-wide text-[var(--ws-text-secondary)] font-semibold">{label}</p>
      <p className="text-xl font-bold text-[var(--ws-text-primary)] mt-1">{value}</p>
    </div>
  );
}

export default function MarketingOverview() {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [outreachOpen, setOutreachOpen] = useState(false);

  const load = useCallback(async () => {
    if (!currentTenant?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/marketing/overview?tenantId=${currentTenant.id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load');
      setData(json);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load marketing overview');
    } finally {
      setLoading(false);
    }
  }, [currentTenant?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const handlePauseCampaign = async (campaignId: string) => {
    if (!currentTenant?.id) return;
    try {
      const res = await fetch('/api/email/campaigns', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: currentTenant.id, campaignId, status: 'paused' }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Pause failed');
      toast.success('Campaign paused');
      load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Pause failed');
    }
  };

  const handleStopCampaign = async (campaignId: string) => {
    if (!currentTenant?.id) return;
    try {
      const res = await fetch('/api/email/campaigns', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: currentTenant.id, campaignId, status: 'cancelled' }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Stop failed');
      toast.success('Campaign stopped');
      load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Stop failed');
    }
  };

  if (loading && !data) {
    return (
      <ModuleOverviewChrome moduleId="marketing" activeHref="/dashboard/marketing">
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
        </div>
      </ModuleOverviewChrome>
    );
  }

  const d = data!;

  return (
    <ModuleOverviewChrome moduleId="marketing" activeHref="/dashboard/marketing">
      <div className="space-y-6">
        {/* Header + quick actions */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold text-[var(--ws-text-primary)]">Marketing</h1>
            <p className="text-[13px] text-[var(--ws-text-secondary)] mt-0.5">
              Run outreach, campaigns and social from one place.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/business/campaigns?new=1"
              className="ac-workspace-action-btn ac-workspace-action-btn--primary inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              New Campaign
            </Link>
            <button
              type="button"
              onClick={() => setOutreachOpen(true)}
              className="ac-workspace-action-btn inline-flex items-center gap-1.5"
            >
              <Send className="w-4 h-4" />
              Send Outreach
            </button>
            <Link
              href="/dashboard/business/social/compose"
              className="ac-workspace-action-btn inline-flex items-center gap-1.5"
            >
              <PenSquare className="w-4 h-4" />
              Create Post
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">
          {/* Main column */}
          <div className="space-y-6">
            {/* Today */}
            <section>
              <h2 className="text-[11px] font-bold uppercase tracking-widest text-[var(--ws-text-secondary)] mb-3">Today</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                <KpiCell label="Emails sent" value={d.today.emailsSent} />
                <KpiCell label="Outreach sent" value={d.today.outreachSent} />
                <KpiCell label="Social posts" value={d.today.socialPosts} />
                <KpiCell label="Replies" value={d.today.replies} />
                <KpiCell label="Meetings booked" value={d.today.meetingsBooked} />
              </div>
            </section>

            {/* Active work */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[11px] font-bold uppercase tracking-widest text-[var(--ws-text-secondary)]">Active work</h2>
                <Link href="/dashboard/business/campaigns" className="text-[11px] text-teal-400 hover:text-teal-300">
                  All campaigns →
                </Link>
              </div>
              {d.activeWork.length === 0 && d.socialScheduled === 0 ? (
                <div className="ac-workspace-panel p-6 text-center">
                  <p className="text-[13px] text-[var(--ws-text-secondary)]">Nothing running right now.</p>
                  <Link
                    href="/dashboard/business/campaigns?new=1"
                    className="inline-block mt-3 text-[12px] text-teal-400 hover:text-teal-300"
                  >
                    Start a campaign
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {d.activeWork.map((c) => (
                    <ActiveCampaignCard
                      key={c.id}
                      campaign={c}
                      onPause={handlePauseCampaign}
                      onStop={handleStopCampaign}
                    />
                  ))}
                  {d.socialScheduled > 0 ? (
                    <div className="ac-workspace-panel p-4">
                      <h3 className="text-[13px] font-semibold text-[var(--ws-text-primary)]">Social campaign</h3>
                      <p className="text-[12px] text-[var(--ws-text-secondary)] mt-1">
                        {d.socialScheduled} post{d.socialScheduled === 1 ? '' : 's'} scheduled
                      </p>
                      <Link
                        href="/dashboard/business/social-command"
                        className="inline-block mt-3 text-[11px] text-teal-400 hover:text-teal-300 uppercase font-semibold"
                      >
                        View schedule →
                      </Link>
                    </div>
                  ) : null}
                </div>
              )}
            </section>

            {/* Recent results */}
            <section>
              <h2 className="text-[11px] font-bold uppercase tracking-widest text-[var(--ws-text-secondary)] mb-3">Recent results</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <KpiCell label="Replies" value={d.recentResults.replies} />
                <KpiCell label="Booked meetings" value={d.recentResults.meetings} />
                <KpiCell label="Qualified leads" value={d.recentResults.qualifiedLeads} />
                <KpiCell label="Customers" value={d.recentResults.customers} />
              </div>
            </section>

            {/* Activity feed */}
            {d.activity.length > 0 ? (
              <section>
                <h2 className="text-[11px] font-bold uppercase tracking-widest text-[var(--ws-text-secondary)] mb-3">Marketing activity</h2>
                <div className="ac-workspace-panel divide-y divide-white/5">
                  {d.activity.slice(0, 8).map((item) => (
                    <div key={item.id} className="flex items-start gap-3 px-4 py-3">
                      <Activity className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] text-[var(--ws-text-primary)] capitalize">{item.label}</p>
                        {item.detail ? (
                          <p className="text-[11px] text-[var(--ws-text-secondary)] truncate">{item.detail}</p>
                        ) : null}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[10px] text-slate-500">{item.time}</p>
                        {item.source ? (
                          <p className="text-[10px] text-teal-500/80">{item.source}</p>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </div>

          {/* Right sidebar */}
          <div className="space-y-6">
            {/* Needs attention */}
            <section>
              <h2 className="text-[11px] font-bold uppercase tracking-widest text-[var(--ws-text-secondary)] mb-3 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                Needs attention
              </h2>
              {d.needsAttention.length === 0 ? (
                <div className="ac-workspace-panel p-4 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <p className="text-[12px] text-[var(--ws-text-secondary)]">All clear — no issues detected.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {d.needsAttention.map((item) => (
                    <div key={item.id} className="ac-workspace-panel p-3">
                      <p className="text-[12px] font-medium text-[var(--ws-text-primary)]">{item.title}</p>
                      <p className="text-[11px] text-[var(--ws-text-secondary)] mt-0.5">{item.detail}</p>
                      {item.href && item.action ? (
                        <button
                          type="button"
                          onClick={() => router.push(item.href!)}
                          className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-amber-400 hover:text-amber-300"
                        >
                          {item.action} →
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Connected delivery */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[11px] font-bold uppercase tracking-widest text-[var(--ws-text-secondary)]">Connected delivery</h2>
                <Link href="/dashboard/marketing/delivery" className="text-[11px] text-teal-400 hover:text-teal-300">
                  Manage →
                </Link>
              </div>
              <div className="ac-workspace-panel p-4 space-y-2">
                <p className="text-[12px] text-[var(--ws-text-secondary)]">
                  Automatic · <span className="text-teal-400">{d.delivery.resolvedLabel}</span>
                </p>
                {d.delivery.providers
                  .filter((p) => p.connected)
                  .slice(0, 5)
                  .map((p) => (
                    <div key={p.id} className="flex items-center justify-between text-[11px]">
                      <span className="text-[var(--ws-text-primary)]">{p.label}</span>
                      <span className="flex items-center gap-1 text-emerald-400">
                        <CheckCircle2 className="w-3 h-3" />
                        {p.role === 'primary' ? 'Primary' : p.role === 'mailbox' ? 'Mailbox' : 'Backup'}
                      </span>
                    </div>
                  ))}
              </div>
            </section>

            {/* Global pause note */}
            {!d.globalPauseAvailable ? (
              <div className="ac-workspace-panel p-3 border border-amber-500/20 bg-amber-500/5">
                <div className="flex items-start gap-2">
                  <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[11px] font-semibold text-amber-300">Emergency pause</p>
                    <p className="text-[10px] text-[var(--ws-text-secondary)] mt-0.5 leading-relaxed">
                      Global outbound pause is not yet available. Pause individual campaigns from Active work above.
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {user?.id ? (
        <AIOutreachModal
          isOpen={outreachOpen}
          onClose={() => {
            setOutreachOpen(false);
            load();
          }}
          userId={user.id}
        />
      ) : null}
    </ModuleOverviewChrome>
  );
}
