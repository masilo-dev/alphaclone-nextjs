'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { RefreshCw, ShieldCheck } from 'lucide-react';
import { userService } from '@/services/userService';
import { PlatformKpiGrid, MetricDateRangeSelector } from '@/components/dashboard/metrics';
import { platformKpiFromNumbers } from '@/lib/metrics/metricPresentation';
import { useMetricDateRange } from '@/hooks/useMetricDateRange';

export const SuperAdminDashboardTab: React.FC = () => {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { preset, setPeriod, comparisonLabel } = useMetricDateRange('last_30_days');

  const fetchMetrics = async () => {
    setLoading(true);
    const { metrics: data } = await userService.getAdminDashboardStats();
    if (data) setMetrics(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  const users = metrics?.users || {};
  const workspaces = metrics?.workspaces || {};
  const platform = metrics?.platform || {};
  const warnings: string[] = platform.systemWarnings || [];
  const recentLogs: any[] = metrics?.security?.recentAuditLogs || [];

  const adminKpis = useMemo(
    () => [
      platformKpiFromNumbers({
        metricId: 'admin.total_users',
        label: 'Total users',
        current: users.total ?? null,
        previous: users.totalPrev ?? undefined,
        referencePeriod: comparisonLabel,
        formattedValue: users.total != null ? String(users.total) : undefined,
        state: loading ? 'loading' : users.total == null ? 'empty' : 'ready',
      }),
      platformKpiFromNumbers({
        metricId: 'admin.active_users',
        label: 'Active users',
        current: users.active ?? null,
        formattedValue: users.active != null ? String(users.active) : undefined,
        referencePeriod: `${users.suspended ?? 0} suspended`,
        state: loading ? 'loading' : users.active == null ? 'empty' : 'ready',
      }),
      platformKpiFromNumbers({
        label: 'New signups today',
        current: users.newToday ?? null,
        referencePeriod: `+${users.newThisWeek ?? 0} this week`,
        state: loading ? 'loading' : users.newToday == null ? 'empty' : 'ready',
      }),
      platformKpiFromNumbers({
        label: 'Workspaces',
        current: workspaces.total ?? null,
        referencePeriod: `+${workspaces.newThisWeek ?? 0} this week`,
        state: loading ? 'loading' : workspaces.total == null ? 'empty' : 'ready',
      }),
      platformKpiFromNumbers({
        label: 'Pending password resets',
        current: users.pendingPasswordReset ?? null,
        isBetterHigher: false,
        referencePeriod: comparisonLabel,
        state: loading ? 'loading' : users.pendingPasswordReset == null ? 'empty' : 'ready',
      }),
      platformKpiFromNumbers({
        metricId: 'admin.failed_jobs',
        label: 'Failed jobs',
        current: platform.failedJobs ?? null,
        isBetterHigher: false,
        referencePeriod: comparisonLabel,
        state: loading ? 'loading' : platform.failedJobs == null ? 'empty' : 'ready',
      }),
    ],
    [loading, users, workspaces, platform.failedJobs, comparisonLabel],
  );

  return (
    <div className="space-y-6 animate-fade-in ac-enterprise-module">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-[var(--brand-green-500,#22c55e)]" />
            Super Admin Control Center
          </h2>
          <p className="text-[var(--ws-text-secondary)] text-sm">Platform-wide health and executive overview</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <MetricDateRangeSelector value={preset} onChange={setPeriod} compact className="mb-0" />
          <button
            onClick={fetchMetrics}
            className="flex items-center gap-2 px-3 py-1.5 bg-[var(--ws-surface-secondary)] hover:bg-[var(--ws-hover)] text-[var(--ws-text-secondary)] rounded-lg text-xs font-semibold border border-[var(--ws-border)] transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>
      </div>

      <PlatformKpiGrid items={adminKpis} loading={loading} skeletonCount={6} />

      {warnings.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 space-y-2">
          <p className="text-sm font-semibold text-amber-200">System warnings</p>
          <ul className="space-y-1">
            {warnings.map((w, i) => (
              <li key={i} className="text-sm text-amber-100/90">
                {w}
              </li>
            ))}
          </ul>
        </div>
      )}

      {recentLogs.length > 0 && (
        <div className="ac-workspace-panel p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ws-text-muted)] mb-3">
            Recent audit activity
          </p>
          <ul className="space-y-2">
            {recentLogs.slice(0, 8).map((log, i) => (
              <li key={log.id ?? i} className="text-sm text-[var(--ws-text-secondary)] border-b border-[var(--ws-border)] pb-2 last:border-0">
                {log.action || log.event_type || 'Audit event'}
                {log.created_at ? (
                  <span className="ml-2 text-[var(--ws-text-muted)] text-xs">{log.created_at}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default SuperAdminDashboardTab;
