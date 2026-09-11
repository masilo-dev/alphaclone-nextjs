'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Send,
  PenSquare,
  AlertTriangle,
  Activity,
  Loader2,
  Plus,
  CheckCircle2,
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

const sectionLabel = 'mb-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--ws-text-tertiary)]';
const inlineAction = 'text-[11px] font-medium text-[var(--brand-teal)] transition-colors hover:text-[var(--interactive-secondary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] rounded-sm';

function KpiCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="ac-workspace-panel p-3 text-center">
      <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-[var(--ws-text-tertiary)]">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums text-[var(--ws-text-primary)]">{value}</p>
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
        <div className="flex items-center justify-center py-16" role="status" aria-label="Loading marketing overview">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--brand-teal)]" aria-hidden="true" />
        </div>
      </ModuleOverviewChrome>
    );
  }

  const d = data!;

  return (
    <ModuleOverviewChrome moduleId="marketing" activeHref="/dashboard/marketing">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-[18px] font-semibold leading-[26px] tracking-tight text-[var(--ws-text-primary)]">Marketing</h1>
            <p className="mt-0.5 text-[13px] text-[var(--ws-text-secondary)]">
              Run outreach, campaigns and social from one place.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard/business/campaigns?new=1" className="ac-workspace-action-btn ac-workspace-action-btn--primary inline-flex items-center gap-1.5">
              <Plus className="h-4 w-4" aria-hidden="true" />
              New Campaign
            </Link>
            <button type="button" onClick={() => setOutreachOpen(true)} className="ac-workspace-action-btn inline-flex items-center gap-1.5">
              <Send className="h-4 w-4" aria-hidden="true" />
              Send Outreach
            </button>
            <Link href="/dashboard/business/social/compose" className="ac-workspace-action-btn inline-flex items-center gap-1.5">
              <PenSquare className="h-4 w-4" aria-hidden="true" />
              Create Post
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_320px]">
          <div className="space-y-6">
            <section>
              <h2 className={sectionLabel}>Today</h2>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                <KpiCell label="Emails sent" value={d.today.emailsSent} />
                <KpiCell label="Outreach sent" value={d.today.outreachSent} />
                <KpiCell label="Social posts" value={d.today.socialPosts} />
                <KpiCell label="Replies" value={d.today.replies} />
                <KpiCell label="Meetings booked" value={d.today.meetingsBooked} />
              </div>
            </section>

            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className={sectionLabel.replace('mb-3 ', '')}>Active work</h2>
                <Link href="/dashboard/business/campaigns" className={inlineAction}>All campaigns →</Link>
              </div>
              {d.activeWork.length === 0 && d.socialScheduled === 0 ? (
                <div className="ac-workspace-panel p-6 text-center">
                  <p className="text-[13px] text-[var(--ws-text-secondary)]">Nothing running right now.</p>
                  <Link href="/dashboard/business/campaigns?new=1" className={`${inlineAction} mt-3 inline-block`}>Start a campaign</Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {d.activeWork.map((c) => (
                    <ActiveCampaignCard key={c.id} campaign={c} onPause={handlePauseCampaign} onStop={handleStopCampaign} />
                  ))}
                  {d.socialScheduled > 0 ? (
                    <div className="ac-workspace-panel p-4">
                      <h3 className="text-[13px] font-semibold text-[var(--ws-text-primary)]">Social campaign</h3>
                      <p className="mt-1 text-[12px] text-[var(--ws-text-secondary)]">{d.socialScheduled} post{d.socialScheduled === 1 ? '' : 's'} scheduled</p>
                      <Link href="/dashboard/business/social-command" className={`${inlineAction} mt-3 inline-block`}>View schedule →</Link>
                    </div>
                  ) : null}
                </div>
              )}
            </section>

            <section>
              <h2 className={sectionLabel}>Recent results</h2>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <KpiCell label="Replies" value={d.recentResults.replies} />
                <KpiCell label="Booked meetings" value={d.recentResults.meetings} />
                <KpiCell label="Qualified leads" value={d.recentResults.qualifiedLeads} />
                <KpiCell label="Customers" value={d.recentResults.customers} />
              </div>
            </section>

            {d.activity.length > 0 ? (
              <section>
                <h2 className={sectionLabel}>Marketing activity</h2>
                <div className="ac-workspace-panel divide-y divide-[var(--ws-border)] p-0">
                  {d.activity.slice(0, 8).map((item) => (
                    <div key={item.id} className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-[var(--ws-hover)]">
                      <Activity className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ws-text-tertiary)]" aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] capitalize text-[var(--ws-text-primary)]">{item.label}</p>
                        {item.detail ? <p className="truncate text-[11px] text-[var(--ws-text-secondary)]">{item.detail}</p> : null}
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-[10px] text-[var(--ws-text-tertiary)]">{item.time}</p>
                        {item.source ? <p className="text-[10px] text-[var(--brand-teal)]">{item.source}</p> : null}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </div>

          <div className="space-y-6">
            <section>
              <h2 className={`${sectionLabel} flex items-center gap-1.5`}>
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                Needs attention
              </h2>
              {d.needsAttention.length === 0 ? (
                <div className="ac-workspace-panel flex items-center gap-2 p-4">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--success)]" aria-hidden="true" />
                  <p className="text-[12px] text-[var(--ws-text-secondary)]">All clear — no issues detected.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {d.needsAttention.map((item) => (
                    <div key={item.id} className="ac-workspace-panel p-3">
                      <p className="text-[12px] font-medium text-[var(--ws-text-primary)]">{item.title}</p>
                      <p className="mt-0.5 text-[11px] text-[var(--ws-text-secondary)]">{item.detail}</p>
                      {item.href && item.action ? (
                        <button
                          type="button"
                          onClick={() => router.push(item.href!)}
                          className="mt-2 rounded-sm text-[10px] font-semibold text-[var(--warning)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                        >
                          {item.action} →
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className={sectionLabel.replace('mb-3 ', '')}>Connected delivery</h2>
                <Link href="/dashboard/marketing/delivery" className={inlineAction}>Manage →</Link>
              </div>
              <div className="ac-workspace-panel space-y-2 p-4">
                <p className="text-[12px] text-[var(--ws-text-secondary)]">
                  Automatic · <span className="text-[var(--brand-teal)]">{d.delivery.resolvedLabel}</span>
                </p>
                {d.delivery.providers.filter((p) => p.connected).slice(0, 5).map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-[11px]">
                    <span className="text-[var(--ws-text-primary)]">{p.label}</span>
                    <span className="flex items-center gap-1 text-[var(--success)]">
                      <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                      {p.role === 'primary' ? 'Primary' : p.role === 'mailbox' ? 'Mailbox' : 'Backup'}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            {!d.globalPauseAvailable ? (
              <div className="ac-workspace-panel border-[color-mix(in_srgb,var(--warning)_24%,var(--ws-border))] bg-[color-mix(in_srgb,var(--warning)_5%,var(--ws-panel))] p-3">
                <div className="flex items-start gap-2">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0 text-[var(--warning)]" aria-hidden="true" />
                  <div>
                    <p className="text-[11px] font-semibold text-[var(--warning)]">Emergency pause</p>
                    <p className="mt-0.5 text-[10px] leading-relaxed text-[var(--ws-text-secondary)]">Global outbound pause is not yet available. Pause individual campaigns from Active work above.</p>
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
