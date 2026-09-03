'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, Send, ArrowRight, RefreshCw } from 'lucide-react';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { ModuleOverviewChrome } from '@/components/ui/os/ModuleOverviewChrome';
import { OutreachLifecyclePanel } from '../outreach/OutreachLifecyclePanel';
import AIOutreachModal from '../business/AIOutreachModal';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

type OutreachRow = {
  id: string;
  company: string;
  recipient: string;
  status: string;
  lastAction: string;
  nextStep: string;
  error?: string;
};

type OverviewSlice = {
  today: {
    outreachSent: number;
    replies: number;
    meetingsBooked: number;
  };
  recentOutreach: OutreachRow[];
};

const PIPELINE_STAGES = [
  { id: 'lead', label: 'Lead' },
  { id: 'contacted', label: 'Contacted' },
  { id: 'replied', label: 'Replied' },
  { id: 'qualified', label: 'Qualified' },
  { id: 'meeting', label: 'Meeting' },
  { id: 'customer', label: 'Customer' },
];

function statusTone(status: string): string {
  const s = status.toLowerCase();
  if (s === 'replied') return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
  if (s === 'failed') return 'text-red-400 bg-red-500/10 border-red-500/30';
  if (s === 'sent' || s === 'delivered') return 'text-sky-400 bg-sky-500/10 border-sky-500/30';
  return 'text-slate-400 bg-slate-500/10 border-slate-500/30';
}

export default function MarketingOutreachPage() {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<OverviewSlice | null>(null);
  const [loading, setLoading] = useState(true);
  const [outreachOpen, setOutreachOpen] = useState(false);

  const load = useCallback(async () => {
    if (!currentTenant?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/marketing/overview?tenantId=${currentTenant.id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load');
      setData({ today: json.today, recentOutreach: json.recentOutreach || [] });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load outreach');
    } finally {
      setLoading(false);
    }
  }, [currentTenant?.id]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <ModuleOverviewChrome moduleId="marketing" activeHref="/dashboard/marketing/outreach">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold text-[var(--ws-text-primary)]">Outreach</h1>
            <p className="text-[13px] text-[var(--ws-text-secondary)] mt-0.5">
              Track who you contacted, who replied, and what needs follow-up.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setOutreachOpen(true)}
              className="ac-workspace-action-btn ac-workspace-action-btn--primary inline-flex items-center gap-1.5"
            >
              <Send className="w-4 h-4" />
              Send outreach
            </button>
            <Link href="/dashboard/outreach/inbox" className="ac-workspace-action-btn inline-flex items-center gap-1.5">
              Reach inbox
            </Link>
          </div>
        </div>

        {loading && !data ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
          </div>
        ) : (
          <>
            {/* Pipeline */}
            <section>
              <h2 className="text-[11px] font-bold uppercase tracking-widest text-[var(--ws-text-secondary)] mb-3">Pipeline</h2>
              <div className="ac-workspace-panel p-4 flex flex-wrap items-center gap-1">
                {PIPELINE_STAGES.map((stage, i) => (
                  <React.Fragment key={stage.id}>
                    <span className="text-[11px] font-medium text-[var(--ws-text-secondary)] px-2 py-1 rounded bg-slate-800/50">
                      {stage.label}
                    </span>
                    {i < PIPELINE_STAGES.length - 1 ? (
                      <ArrowRight className="w-3 h-3 text-slate-600 shrink-0" />
                    ) : null}
                  </React.Fragment>
                ))}
              </div>
              <p className="text-[11px] text-[var(--ws-text-secondary)] mt-2">
                Marketing actions move CRM records through these stages.{' '}
                <Link href="/dashboard/crm" className="text-teal-400 hover:text-teal-300">
                  View CRM →
                </Link>
              </p>
            </section>

            {/* Today KPIs */}
            <section>
              <h2 className="text-[11px] font-bold uppercase tracking-widest text-[var(--ws-text-secondary)] mb-3">Today</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { label: 'Sent', value: data?.today.outreachSent ?? 0 },
                  { label: 'Replies', value: data?.today.replies ?? 0 },
                  { label: 'Failed', value: data?.recentOutreach.filter((r) => r.status === 'failed').length ?? 0 },
                  { label: 'Meetings', value: data?.today.meetingsBooked ?? 0 },
                ].map((kpi) => (
                  <div key={kpi.label} className="ac-workspace-panel p-3 text-center">
                    <p className="text-[10px] uppercase tracking-wide text-[var(--ws-text-secondary)]">{kpi.label}</p>
                    <p className="text-xl font-bold text-[var(--ws-text-primary)] mt-1">{kpi.value}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Recent outreach table */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[11px] font-bold uppercase tracking-widest text-[var(--ws-text-secondary)]">Recent outreach</h2>
                <button type="button" onClick={load} className="text-[11px] text-slate-500 hover:text-slate-300 inline-flex items-center gap-1">
                  <RefreshCw className="w-3 h-3" />
                  Refresh
                </button>
              </div>
              {!(data?.recentOutreach.length) ? (
                <div className="ac-workspace-panel p-8 text-center">
                  <p className="text-[13px] text-[var(--ws-text-secondary)]">No outreach history yet.</p>
                  <button
                    type="button"
                    onClick={() => setOutreachOpen(true)}
                    className="inline-block mt-3 text-[12px] text-teal-400 hover:text-teal-300"
                  >
                    Send your first outreach
                  </button>
                </div>
              ) : (
                <div className="ac-workspace-panel overflow-hidden">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="border-b border-white/5 text-[var(--ws-text-secondary)]">
                        <th className="text-left px-4 py-2.5 font-semibold uppercase tracking-wide text-[10px]">Company</th>
                        <th className="text-left px-4 py-2.5 font-semibold uppercase tracking-wide text-[10px]">Recipient</th>
                        <th className="text-left px-4 py-2.5 font-semibold uppercase tracking-wide text-[10px]">Status</th>
                        <th className="text-left px-4 py-2.5 font-semibold uppercase tracking-wide text-[10px]">Last action</th>
                        <th className="text-left px-4 py-2.5 font-semibold uppercase tracking-wide text-[10px]">Next step</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recentOutreach.map((row) => (
                        <tr key={row.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                          <td className="px-4 py-3 text-[var(--ws-text-primary)] font-medium">{row.company}</td>
                          <td className="px-4 py-3 text-[var(--ws-text-secondary)]">{row.recipient || '—'}</td>
                          <td className="px-4 py-3">
                            <span className={cn('inline-flex px-2 py-0.5 rounded text-[10px] font-semibold uppercase border capitalize', statusTone(row.status))}>
                              {row.status}
                            </span>
                            {row.error ? (
                              <p className="text-[10px] text-red-400/80 mt-0.5 truncate max-w-[160px]" title={row.error}>
                                {row.error}
                              </p>
                            ) : null}
                          </td>
                          <td className="px-4 py-3 text-[var(--ws-text-secondary)]">{row.lastAction}</td>
                          <td className="px-4 py-3">
                            {row.status === 'failed' ? (
                              <button
                                type="button"
                                onClick={() => router.push('/dashboard/marketing/outreach')}
                                className="text-[10px] font-semibold uppercase text-amber-400 hover:text-amber-300"
                              >
                                Retry
                              </button>
                            ) : row.status === 'replied' ? (
                              <Link href="/dashboard/outreach/inbox" className="text-[10px] font-semibold uppercase text-teal-400 hover:text-teal-300">
                                Review reply
                              </Link>
                            ) : (
                              <span className="text-[11px] text-[var(--ws-text-secondary)]">{row.nextStep}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <OutreachLifecyclePanel />
          </>
        )}
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
