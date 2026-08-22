'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, ChevronDown, ChevronRight, RefreshCw, Search, ShieldCheck, User, Building2, HelpCircle, Terminal } from 'lucide-react';
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

const STATUS_BADGES: Record<string, { bg: string; text: string; label: string }> = {
  success: { bg: 'bg-emerald-500/10 border-emerald-500/30', text: 'text-emerald-400', label: 'Success' },
  completed: { bg: 'bg-emerald-500/10 border-emerald-500/30', text: 'text-emerald-400', label: 'Completed' },
  failed: { bg: 'bg-rose-500/10 border-rose-500/30', text: 'text-rose-400', label: 'Failed' },
  blocked: { bg: 'bg-amber-500/10 border-amber-500/30', text: 'text-amber-400', label: 'Blocked' },
  at_risk: { bg: 'bg-orange-500/10 border-orange-500/30', text: 'text-orange-400', label: 'At Risk' },
  waiting: { bg: 'bg-sky-500/10 border-sky-500/30', text: 'text-sky-400', label: 'Waiting' },
};

function titleize(value?: string | null) {
  return String(value || 'system').replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function AuditTrailPage() {
  const { currentTenant } = useTenant();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [viewMode, setViewMode] = useState<'business' | 'technical'>('business');
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

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
        .limit(250),
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
      const emailRows = ((emailResult.data || []) as any[]).map((row) => ({
        id: `email-${row.id}`,
        action: row.status === 'sent' ? 'Sales email sent' : 'Email publication failed',
        resource_type: 'email',
        resource_id: row.id,
        user_email: null,
        severity: row.status === 'sent' ? 'low' : 'high',
        created_at: row.created_at,
        metadata: {
          event: row.status === 'sent' ? 'Sales email sent' : 'Email delivery failed',
          actor: row.user_id || 'System',
          client: row.to_email || 'Client',
          result: row.status === 'sent' ? `Email sent to ${row.to_email}` : `Failed: ${row.error || 'Provider error'}`,
          status: row.status === 'sent' ? 'success' : 'failed',
          next_action: row.status === 'sent' ? 'Await client reply' : 'Review sender integration settings',
          owner: row.user_id || 'Sales Owner',
          is_business_activity: true,
          technical_details: {
            provider: row.provider || 'unknown',
            recipient: row.to_email,
            template: row.template_name,
            error: row.error,
          },
        },
      } satisfies AuditRow));

      setRows([...(auditResult.data || []) as AuditRow[], ...emailRows]
        .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
        .slice(0, 250));
    }
    setLoading(false);
  }, [currentTenant?.id]);

  useEffect(() => {
    void loadAuditLogs();
  }, [loadAuditLogs]);

  const toggleExpand = (id: string) => {
    setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (!normalizedQuery) return true;
      const meta = row.metadata as Record<string, any> | null;
      const haystack = [
        row.action,
        row.entity_type,
        row.resource_type,
        row.user_email,
        meta?.event,
        meta?.actor,
        meta?.client,
        meta?.result,
        meta?.next_action,
        meta?.owner,
      ].join(' ').toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [query, rows]);

  if (loading) {
    return <div className="p-4"><TableSkeleton rows={8} columns={5} /></div>;
  }

  return (
    <section className="ac-workspace-panel overflow-hidden">
      {/* Header with Mode Toggle */}
      <div className="flex flex-col gap-4 border-b border-[var(--ws-border)] p-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-teal-400" aria-hidden="true" />
            <h2 className="text-lg font-semibold text-white">
              {viewMode === 'business' ? 'Business Activity Log' : 'Technical System Log'}
            </h2>
          </div>
          <p className="mt-1 text-sm text-[var(--ws-text-muted)]">
            {viewMode === 'business'
              ? 'Human-readable operational history: WHO DID WHAT → FOR WHOM → WHY → WHAT RESULTED → WHAT NEEDS TO HAPPEN NEXT.'
              : 'Low-level engineering audit log displaying raw API calls, HTTP status codes, and tool identifiers.'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Mode Switcher */}
          <div className="inline-flex rounded-lg border border-[var(--ws-border)] bg-[var(--ws-surface-secondary)] p-1">
            <button
              onClick={() => setViewMode('business')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                viewMode === 'business'
                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <User className="h-3.5 w-3.5" />
              Business Log
            </button>
            <button
              onClick={() => setViewMode('technical')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                viewMode === 'technical'
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Terminal className="h-3.5 w-3.5" />
              Technical Log
            </button>
          </div>

          <button
            type="button"
            onClick={() => void loadAuditLogs()}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[var(--ws-border)] px-3 text-sm font-medium text-slate-300 transition-colors hover:bg-[var(--ws-hover)]"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Refresh
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col gap-3 border-b border-[var(--ws-border)] bg-[var(--ws-surface-secondary)] p-4 sm:flex-row">
        <label className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <span className="sr-only">Search audit trail</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search business events, clients, actors, or actions..."
            className="h-10 w-full rounded-lg border border-[var(--ws-border)] bg-[var(--ws-surface-primary)] py-2 pl-9 pr-3 text-sm text-white outline-none transition-colors placeholder:text-slate-500 focus:border-teal-500"
          />
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
            title={rows.length ? 'No matching audit events found' : 'No activity recorded yet'}
            description="Operations and business events will appear here in human-readable language."
            icon={Activity}
          />
        </div>
      ) : viewMode === 'business' ? (
        /* ── BUSINESS ACTIVITY LOG VIEW ── */
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-[var(--ws-surface-secondary)] text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">When</th>
                <th scope="col" className="px-4 py-3 font-semibold">Business Event</th>
                <th scope="col" className="px-4 py-3 font-semibold">Actor</th>
                <th scope="col" className="px-4 py-3 font-semibold">Client / Record</th>
                <th scope="col" className="px-4 py-3 font-semibold">Result</th>
                <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                <th scope="col" className="px-4 py-3 font-semibold">Next Action</th>
                <th scope="col" className="px-4 py-3 font-semibold">Owner</th>
                <th scope="col" className="px-4 py-3 font-semibold">Tech Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--ws-border)]">
              {filteredRows.map((row) => {
                const meta = (row.metadata || {}) as Record<string, any>;
                const eventName = meta.event || titleize(row.action);
                const actorName = meta.actor || row.user_email || 'System';
                const clientName = meta.client || meta.company || titleize(row.entity_type || row.resource_type);
                const resultText = meta.result || meta.description || 'Action performed';
                const statusCode = String(meta.status || (row.severity === 'high' ? 'failed' : 'success')).toLowerCase();
                const badge = STATUS_BADGES[statusCode] || STATUS_BADGES.success;
                const nextActionText = meta.next_action || 'None required';
                const ownerName = meta.owner || actorName;
                const hasTechDetails = Boolean(meta.technical_details || row.resource_id || row.entity_id);
                const isExpanded = Boolean(expandedRows[row.id]);

                return (
                  <React.Fragment key={row.id}>
                    <tr className="align-top transition-colors hover:bg-[var(--ws-hover)]">
                      <td className="whitespace-nowrap px-4 py-4 text-xs text-slate-400">
                        {new Date(row.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-4 font-semibold text-white">
                        {eventName}
                        {meta.business_context && (
                          <div className="mt-0.5 font-normal text-xs text-slate-400 max-w-xs">
                            {meta.business_context}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4 text-slate-300 font-medium">{actorName}</td>
                      <td className="px-4 py-4 text-slate-300">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5 text-teal-400 shrink-0" />
                          <span>{clientName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-slate-300 max-w-xs">{resultText}</td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${badge.bg} ${badge.text}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-xs font-medium text-teal-300 max-w-xs">
                        {nextActionText}
                      </td>
                      <td className="px-4 py-4 text-slate-300 text-xs">{ownerName}</td>
                      <td className="px-4 py-4">
                        {hasTechDetails ? (
                          <button
                            onClick={() => toggleExpand(row.id)}
                            className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-teal-300 transition-colors"
                          >
                            {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                            <span>View details</span>
                          </button>
                        ) : (
                          <span className="text-xs text-slate-600">—</span>
                        )}
                      </td>
                    </tr>

                    {/* Technical details expandable drawer */}
                    {isExpanded && (
                      <tr className="bg-slate-950/80">
                        <td colSpan={9} className="px-6 py-4 border-t border-b border-slate-800">
                          <div className="font-mono text-xs space-y-2 text-slate-300">
                            <div className="flex items-center gap-2 text-purple-400 font-semibold mb-2">
                              <Terminal className="h-4 w-4" />
                              Technical Execution Context
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 bg-slate-900/90 p-3 rounded-lg border border-slate-800">
                              <div><span className="text-slate-500">Record ID:</span> {row.entity_id || row.resource_id || 'N/A'}</div>
                              <div><span className="text-slate-500">Entity Type:</span> {row.entity_type || row.resource_type || 'N/A'}</div>
                              <div><span className="text-slate-500">Severity:</span> {row.severity || 'low'}</div>
                              {meta.technical_details &&
                                Object.entries(meta.technical_details).map(([k, v]) => (
                                  <div key={k} className="truncate">
                                    <span className="text-slate-500">{k}:</span> {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                                  </div>
                                ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* ── TECHNICAL SYSTEM LOG VIEW ── */
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm font-mono">
            <thead className="bg-[var(--ws-surface-secondary)] text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th scope="col" className="px-5 py-3 font-semibold">Timestamp</th>
                <th scope="col" className="px-5 py-3 font-semibold">Action / Event</th>
                <th scope="col" className="px-5 py-3 font-semibold">Resource</th>
                <th scope="col" className="px-5 py-3 font-semibold">User</th>
                <th scope="col" className="px-5 py-3 font-semibold">Severity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--ws-border)]">
              {filteredRows.map((row) => (
                <tr key={row.id} className="align-top hover:bg-[var(--ws-hover)] text-xs">
                  <td className="whitespace-nowrap px-5 py-3 text-slate-400">{row.created_at}</td>
                  <td className="px-5 py-3 text-purple-300 font-semibold">{row.action}</td>
                  <td className="px-5 py-3 text-slate-300">{row.entity_type || row.resource_type}:{row.entity_id || row.resource_id || 'null'}</td>
                  <td className="px-5 py-3 text-slate-400">{row.user_email || 'system'}</td>
                  <td className="px-5 py-3 text-slate-300">{row.severity || 'low'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="border-t border-[var(--ws-border)] px-5 py-3 text-xs text-[var(--ws-text-muted)] flex justify-between items-center">
        <span>Showing {filteredRows.length} of {rows.length} loaded audit items.</span>
        <span>Mode: <strong>{viewMode === 'business' ? 'Business Activity Log' : 'Technical System Log'}</strong></span>
      </div>
    </section>
  );
}
