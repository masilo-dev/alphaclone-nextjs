'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Clock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { ModulePageLayout } from '@/components/ui/ModulePageLayout';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  MobileDataCard,
  ResponsiveTableDesktop,
  ResponsiveTableMobile,
} from '@/components/ui/ResponsiveTable';
import { useTenant } from '@/contexts/TenantContext';
import { supabase } from '@/lib/supabase';
import { formatDistanceToNow } from 'date-fns';

type QueueRow = {
  id: string;
  kind: string;
  status: string;
  detail: string;
  created_at: string;
};

export default function JobsQueueTab() {
  const { currentTenant } = useTenant();
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!currentTenant?.id) return;
    setLoading(true);
    const tenantId = currentTenant.id;

    const [eventsRes, runsRes, scraperRes] = await Promise.all([
      supabase
        .from('business_automation_events')
        .select('id, event_type, processed, created_at, payload')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(30),
      supabase
        .from('automation_runs')
        .select('id, status, last_error, created_at, playbook_id')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(30),
      supabase
        .from('lead_search_jobs')
        .select('id, status, created_at, error_message')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(20)
        .then((r: { data: unknown[] | null; error: unknown }) => r)
        .catch(() => ({ data: [], error: null })),
    ]);

    const merged: QueueRow[] = [
      ...(eventsRes.data || []).map((e: { id: string; event_type: string; processed: boolean; created_at: string }) => ({
        id: e.id,
        kind: 'automation_event',
        status: e.processed ? 'completed' : 'pending',
        detail: e.event_type,
        created_at: e.created_at,
      })),
      ...(runsRes.data || []).map((r: { id: string; status: string; last_error: string | null; created_at: string; playbook_id: string | null }) => ({
        id: r.id,
        kind: 'workflow_run',
        status: r.status || 'unknown',
        detail: r.last_error || r.playbook_id || 'workflow',
        created_at: r.created_at,
      })),
      ...((scraperRes as { data: { id: string; status: string; created_at: string; error_message: string | null }[] | null }).data || []).map((j) => ({
        id: j.id,
        kind: 'scraper_job',
        status: j.status || 'unknown',
        detail: j.error_message || 'Lead search',
        created_at: j.created_at,
      })),
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    setRows(merged.slice(0, 50));
    setLoading(false);
  }, [currentTenant?.id]);

  useEffect(() => { void load(); }, [load]);

  const statusIcon = (status: string) => {
    if (status === 'completed' || status === 'success' || status === 'delivered') {
      return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
    }
    if (status === 'failed' || status === 'error') {
      return <AlertCircle className="w-4 h-4 text-red-400" />;
    }
    return <Clock className="w-4 h-4 text-amber-400" />;
  };

  return (
    <ModulePageLayout
      header={
        <div className="px-1 pb-2 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-white">Jobs & Queue</h1>
            <p className="text-sm text-slate-400">Automation events, workflows, and scraper jobs</p>
          </div>
          <button type="button" onClick={() => void load()} className="p-2 rounded-lg border border-[var(--ws-border)] text-slate-400 hover:text-white">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      }
    >
      <div className="ac-scroll-full pb-24">
        {loading ? (
          <p className="p-6 text-sm text-slate-500">Loading queue…</p>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Clock}
            title="Queue is empty"
            description="No background jobs in the last 30 runs."
          />
        ) : (
          <>
            <ResponsiveTableMobile>
              {rows.map((row) => (
                <MobileDataCard key={`${row.kind}-${row.id}`} className="ac-workspace-panel">
                  <div className="flex items-start gap-3">
                    {statusIcon(row.status)}
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-white truncate">{row.detail}</p>
                      <p className="text-[11px] text-[var(--ws-text-tertiary)] mt-0.5">
                        {row.kind.replace('_', ' ')} · {row.status}
                      </p>
                      <p className="text-[11px] text-[var(--ws-text-tertiary)]">
                        {formatDistanceToNow(new Date(row.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                </MobileDataCard>
              ))}
            </ResponsiveTableMobile>
            <ResponsiveTableDesktop className="ac-workspace-panel overflow-hidden">
              <table className="w-full min-w-[640px] text-sm ac-data-table">
                <thead>
                  <tr>
                    <th className="w-10" />
                    <th>Detail</th>
                    <th>Kind</th>
                    <th>Status</th>
                    <th>When</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={`${row.kind}-${row.id}`}>
                      <td>{statusIcon(row.status)}</td>
                      <td className="font-medium text-white max-w-[280px] truncate">{row.detail}</td>
                      <td className="text-[var(--ws-text-secondary)] capitalize">{row.kind.replace('_', ' ')}</td>
                      <td className="text-[var(--ws-text-secondary)] capitalize">{row.status}</td>
                      <td className="text-[var(--ws-text-tertiary)] text-xs whitespace-nowrap">
                        {formatDistanceToNow(new Date(row.created_at), { addSuffix: true })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ResponsiveTableDesktop>
          </>
        )}
      </div>
    </ModulePageLayout>
  );
}
