import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { normalizeToolName } from '@/lib/mcp/mcpToolTelemetry';

type SessionRow = {
  tool_name: string | null;
  success: boolean | null;
  tool_success?: boolean | null;
  duration_ms: number | null;
  tool_latency_ms?: number | null;
};

function isToolExecutionRow(row: SessionRow): boolean {
  return Boolean(row.tool_name && String(row.tool_name).trim());
}

function rowSucceeded(row: SessionRow): boolean {
  return row.success === true || row.tool_success === true;
}

function rowDurationMs(row: SessionRow): number {
  return row.duration_ms ?? row.tool_latency_ms ?? 0;
}

export async function buildApiHealthReport(tenantId: string, hours = 24) {
  const supabase = createSupabaseAdminClient();
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  const { data: sessions, error } = await supabase
    .from('mcp_sessions')
    .select('tool_name, success, tool_success, duration_ms, tool_latency_ms')
    .eq('tenant_id', tenantId)
    .gte('created_at', since);

  if (error) throw new Error(`Failed to fetch health data: ${error.message}`);

  const allRows = (sessions || []) as SessionRow[];
  const toolRows = allRows.filter(isToolExecutionRow);
  const connectionSessions = allRows.length - toolRows.length;

  const total = toolRows.length;
  const successes = toolRows.filter(rowSucceeded).length;
  const avgDuration =
    total > 0 ? Math.round(toolRows.reduce((sum, row) => sum + rowDurationMs(row), 0) / total) : 0;

  const toolStats: Record<string, { calls: number; success: number; failures: number }> = {};
  for (const row of toolRows) {
    const tool = normalizeToolName(row.tool_name);
    if (!toolStats[tool]) toolStats[tool] = { calls: 0, success: 0, failures: 0 };
    toolStats[tool].calls++;
    if (rowSucceeded(row)) toolStats[tool].success++;
    else toolStats[tool].failures++;
  }

  return {
    period_hours: hours,
    total_calls: total,
    successes,
    failures: total - successes,
    success_rate_percent: total > 0 ? Math.round((successes / total) * 100) : 100,
    avg_duration_ms: avgDuration,
    tool_breakdown: toolStats,
    excluded_connection_sessions: connectionSessions,
    note:
      connectionSessions > 0
        ? `${connectionSessions} MCP connection session(s) excluded from tool metrics (no tool_name).`
        : undefined,
  };
}
