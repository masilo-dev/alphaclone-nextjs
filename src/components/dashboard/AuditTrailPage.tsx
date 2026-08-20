'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import { useTenant } from '@/contexts/TenantContext';
import { supabase } from '@/lib/supabase';
import { EmptyState } from '@/components/ui/EmptyState';
import { TableSkeleton } from '@/components/ui/Skeleton';

type AuditRow = {
  id: string;
  action?: string | null;
  entity_type?: string | null;
  resource_type?: string | null;
  entity_id?: string | null;
  resource_id?: string | null;
  user_email?: string | null;
  severity?: string | null;
  created_at: string;
  metadata?: Record<string, unknown> | null;
};

type EmailLogRow = {
  id: string;
  user_id?: string | null;
  provider?: string | null;
  to_email?: string | null;
  template_name?: string | null;
  status?: string | null;
  error?: string | null;
  created_at: string;
  metadata?: Record<string, unknown> | null;
};

const SEVERITY_CLASS: Record<string, string> = {
  critical: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
  high: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  medium: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
  low: 'border-slate-500/30 bg-slate-500/10 text-slate-300',
};

function titleize(value?: string | null) {
  return String(value || 'system').replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function metadataSummary(metadata?: Record<string, unknown> | null) {
  if (!metadata || typeof metadata !== 'object') return 'No additional details';
  const safeKeys = ['apiEndpoint', 'mcpTool', 'source', 'event_type', 'reason', 'provider', 'recipient', 'template'] as const;
  const details = safeKeys
    .map((key) => {
      const value = metadata[key];
      return value ? `${titleize(key)}: ${String(value)}` : null;
    })
    .filter(Boolean);
  return details.length ? details.join(' · ') : 'Recorded activity';
}

export default function AuditTrailPage() {
  const { currentTenant } = useTenant();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [severity, setSeverity] = useState('all');

  const loadAuditLogs = useCallback(async () => {
    if (!currentTenant?.id) return;
    setLoading(true);
    setError(null);
    const [auditResult, emailResult] = await Promise.all([
      supabase
        .from('audit_logs')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false })
        .limit(200),
      supabase
        .from('email_logs')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false })
        .limit(200),
    ]);

    if (auditResult.error) {
      setError(auditResult.error.message);
      setRows([]);
    } else {
      const emailRows = ((emailResult.data || []) as EmailLogRow[]).map((row) => ({
        id: `email-${row.id}`,
        action: row.status === 'sent' ? 'EMAIL_SENT' : 'EMAIL_FAILED',
        resource_type: 'email',
        resource_id: row.id,
        user_email: null,
        severity: row.status === 'sent' ? 'low' : 'high',
        created_at: row.created_at,
        metadata: {
          ...(row.metadata && typeof row.metadata === 'object' ? row.metadata : {}),
          provider: row.provider || 'unknown',
          recipient: row.to_email || 'unknown',
          template: row.template_name || undefined,
          reason: row.error || undefined,
        },
      } satisfies AuditRow));
      setRows([...(auditResult.data || []) as AuditRow[], ...emailRows]
        .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
        .slice(0, 200));
    }
    setLoading(false);
  }, [currentTenant?.id]);

  useEffect(() => {
    void loadAuditLogs();
  }, [loadAuditLogs]);

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return rows.filter((row) => {
      const rowSeverity = String(row.severity || 'low').toLowerCase();
      if (severity !== 'all' && rowSeverity !== severity) return false;
      if (!normalizedQuery) return true;
      const haystack = [
        row.action,
        row.entity_type,
        row.resource_type,
        row.user_email,
        row.entity_id,
        row.resource_id,
        metadataSummary(row.metadata),
      ].join(' ').toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [query, rows, severity]);

  if (loading) {
    return <div className="p-4"><TableSkeleton rows={8} columns={5} /></div>;
  }

  return (
    <section className="ac-workspace-panel overflow-hidden">
      <div className="flex flex-col gap-4 border-b border-[var(--ws-border)] p-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-[var(--brand-blue-500)]" aria-hidden="true" />
            <h2 className="text-lg font-semibold text-[var(--ws-text-primary)]">Audit trail</h2>
          </div>
          <p className="mt-1 text-sm text-[var(--ws-text-muted)]">Latest 200 recorded workspace and email-delivery events. Audit details are scoped to the active organization.</p>
        </div>
        <button
          type="button"
          onClick={() => void loadAuditLogs()}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[var(--ws-border)] px-3 text-sm font-medium text-[var(--ws-text-secondary)] transition-colors hover:bg-[var(--ws-hover)]"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Refresh
        </button>
      </div>

      <div className="flex flex-col gap-3 border-b border-[var(--ws-border)] bg-[var(--ws-surface-secondary)] p-4 sm:flex-row">
        <label className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ws-text-muted)]" aria-hidden="true" />
          <span className="sr-only">Search audit trail</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search actions, records, users, or sources"
            className="h-10 w-full rounded-lg border border-[var(--ws-border)] bg-[var(--ws-surface-primary)] py-2 pl-9 pr-3 text-sm text-[var(--ws-text-primary)] outline-none transition-colors placeholder:text-[var(--ws-text-muted)] focus:border-[var(--brand-blue-500)]"
          />
        </label>
        <label>
          <span className="sr-only">Filter by severity</span>
          <select
            value={severity}
            onChange={(event) => setSeverity(event.target.value)}
            className="h-10 min-w-40 rounded-lg border border-[var(--ws-border)] bg-[var(--ws-surface-primary)] px-3 text-sm text-[var(--ws-text-primary)] outline-none focus:border-[var(--brand-blue-500)]"
          >
            <option value="all">All severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </label>
      </div>

      {error ? (
        <div className="m-4 flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold">Audit trail unavailable</p>
            <p className="mt-1 text-rose-200/80">{error}</p>
          </div>
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="p-4">
          <EmptyState
            title={rows.length ? 'No audit events match the current filters' : 'No audit events recorded yet'}
            description={rows.length ? 'Adjust the search or severity filter to see more activity.' : 'New workspace activity will appear here when it is recorded.'}
            icon={Activity}
          />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-[var(--ws-surface-secondary)] text-xs uppercase tracking-wide text-[var(--ws-text-muted)]">
              <tr>
                <th scope="col" className="px-5 py-3 font-semibold">When</th>
                <th scope="col" className="px-5 py-3 font-semibold">Action</th>
                <th scope="col" className="px-5 py-3 font-semibold">Record</th>
                <th scope="col" className="px-5 py-3 font-semibold">Actor</th>
                <th scope="col" className="px-5 py-3 font-semibold">Details</th>
                <th scope="col" className="px-5 py-3 font-semibold">Severity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--ws-border)]">
              {filteredRows.map((row) => {
                const resource = row.resource_type || row.entity_type || 'system';
                const recordId = row.resource_id || row.entity_id;
                const normalizedSeverity = String(row.severity || 'low').toLowerCase();
                return (
                  <tr key={row.id} className="align-top transition-colors hover:bg-[var(--ws-hover)]">
                    <td className="whitespace-nowrap px-5 py-4 text-[var(--ws-text-secondary)]">
                      {new Date(row.created_at).toLocaleString()}
                    </td>
                    <td className="px-5 py-4 font-medium text-[var(--ws-text-primary)]">{titleize(row.action)}</td>
                    <td className="px-5 py-4 text-[var(--ws-text-secondary)]">
                      <div>{titleize(resource)}</div>
                      {recordId ? <div className="mt-0.5 font-mono text-xs text-[var(--ws-text-muted)]">{String(recordId).slice(0, 16)}</div> : null}
                    </td>
                    <td className="px-5 py-4 text-[var(--ws-text-secondary)]">{row.user_email || 'System'}</td>
                    <td className="max-w-sm px-5 py-4 text-[var(--ws-text-muted)]">{metadataSummary(row.metadata)}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium ${SEVERITY_CLASS[normalizedSeverity] || SEVERITY_CLASS.low}`}>
                        {titleize(normalizedSeverity)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="border-t border-[var(--ws-border)] px-5 py-3 text-xs text-[var(--ws-text-muted)]">
        Showing {filteredRows.length} of {rows.length} loaded events.
      </div>
    </section>
  );
}
