'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Clock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { ModulePageLayout } from '@/components/ui/ModulePageLayout';
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
      ...(eventsRes.data || []).map((e: any) => ({
        id: e.id,
        kind: 'automation_event',
        status: e.processed ? 'completed' : 'pending',
        detail: e.event_type,
        created_at: e.created_at,
      })),
      ...(runsRes.data || []).map((r: any) => ({
        id: r.id,
        kind: 'workflow_run',
        status: r.status || 'unknown',
        detail: r.last_error || r.playbook_id || 'workflow',
        created_at: r.created_at,
      })),
      ...((scraperRes as any).data || []).map((j: any) => ({
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
          <button onClick={() => void load()} className="p-2 rounded-lg border border-white/10 text-slate-400 hover:text-white">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      }
    >
      <div className="bg-slate-900 border border-white/5 rounded-2xl divide-y divide-white/5 ac-scroll-full">
        {loading ? (
          <p className="p-6 text-sm text-slate-500">Loading queue…</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No background jobs in the last 30 runs.</p>
        ) : (
          rows.map((row) => (
            <div key={`${row.kind}-${row.id}`} className="p-4 flex items-start gap-3">
              {statusIcon(row.status)}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{row.detail}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {row.kind.replace('_', ' ')} · {row.status} · {formatDistanceToNow(new Date(row.created_at), { addSuffix: true })}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </ModulePageLayout>
  );
}
