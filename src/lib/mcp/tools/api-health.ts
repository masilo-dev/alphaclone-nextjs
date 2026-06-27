// @ts-nocheck
import { z } from 'zod';
import { registerTool } from '../tool-registry';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { getUnifiedMcpToolCount } from '@/lib/mcp/listAllTools';

registerTool('api-health', {
  name: 'get_api_health',
  description: 'Returns API health metrics: success rates, error rates, avg latency, and rate-limit diagnostics for the tenant.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    hours: z.number().int().min(1).max(168).optional().default(24),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', description: 'Tenant UUID' },
      hours: { type: 'number', description: 'Lookback window in hours (default 24)', default: 24 },
    },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const since = new Date(Date.now() - args.hours * 60 * 60 * 1000).toISOString();

    const { data: sessions, error } = await supabase
      .from('mcp_sessions')
      .select('tool_name, success, duration_ms')
      .eq('tenant_id', args.tenant_id)
      .gte('created_at', since);

    if (error) throw new Error(`Failed to fetch health data: ${error.message}`);

    const total = (sessions || []).length;
    const successes = (sessions || []).filter(s => s.success).length;
    const avgDuration = total > 0
      ? Math.round((sessions || []).reduce((sum, s) => sum + (s.duration_ms || 0), 0) / total)
      : 0;

    const toolStats: Record<string, { calls: number; success: number }> = {};
    for (const s of sessions || []) {
      if (!toolStats[s.tool_name]) toolStats[s.tool_name] = { calls: 0, success: 0 };
      toolStats[s.tool_name].calls++;
      if (s.success) toolStats[s.tool_name].success++;
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          period_hours: args.hours,
          total_calls: total,
          successes,
          failures: total - successes,
          success_rate_percent: total > 0 ? Math.round((successes / total) * 100) : 100,
          avg_duration_ms: avgDuration,
          tool_breakdown: toolStats,
          unified_tool_catalog_count: await getUnifiedMcpToolCount(),
        }, null, 2),
      }],
    };
  },
});
