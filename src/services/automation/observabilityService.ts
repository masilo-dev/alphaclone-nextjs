import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export async function getAutomationHealth(tenantId: string) {
  const supabase = createSupabaseAdminClient();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('automation_runs')
    .select('status, started_at, finished_at')
    .eq('tenant_id', tenantId)
    .gte('started_at', since);
  if (error) return { success: false, error: error.message };
  const rows = data || [];
  const statusCounts: Record<string, number> = {};
  rows.forEach((row: Record<string, unknown>) => {
    const status = String(row.status || 'unknown');
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  });
  return { success: true, window_hours: 24, total_runs: rows.length, status_counts: statusCounts };
}

export async function getAutomationFailureReport(tenantId: string, limit = 50) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('automation_run_steps')
    .select('run_id, step_id, action, status, error_message, started_at, finished_at')
    .eq('tenant_id', tenantId)
    .eq('status', 'failed')
    .order('started_at', { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 200));
  if (error) return { success: false, error: error.message };
  return { success: true, failures: data || [] };
}

export async function getAutomationThroughputReport(tenantId: string, hours = 24) {
  const supabase = createSupabaseAdminClient();
  const safeHours = Math.min(Math.max(hours, 1), 720);
  const since = new Date(Date.now() - safeHours * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('automation_runs')
    .select('id, status, started_at, finished_at')
    .eq('tenant_id', tenantId)
    .gte('started_at', since);
  if (error) return { success: false, error: error.message };
  const runs = data || [];
  const completed = runs.filter((r: Record<string, unknown>) => String(r.status) === 'completed');
  return {
    success: true,
    window_hours: safeHours,
    total_runs: runs.length,
    completed_runs: completed.length,
    runs_per_hour: Number((runs.length / safeHours).toFixed(2)),
  };
}

export async function reconcileOutreachVsLogs(tenantId: string, limit = 100) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('lead_outreach_log')
    .select('id, tracking_id, status, provider, sent_at, updated_at')
    .eq('tenant_id', tenantId)
    .order('updated_at', { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 500));
  if (error) return { success: false, error: error.message };
  const rows = data || [];
  const staleQueued = rows.filter((r: Record<string, unknown>) => String(r.status || '') === 'queued');
  const failed = rows.filter((r: Record<string, unknown>) => String(r.status || '') === 'failed');
  return {
    success: true,
    scanned: rows.length,
    stale_queued_count: staleQueued.length,
    failed_count: failed.length,
    samples: {
      stale_queued: staleQueued.slice(0, 10),
      failed: failed.slice(0, 10),
    },
  };
}

