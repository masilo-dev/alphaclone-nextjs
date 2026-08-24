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
    const { buildApiHealthReport } = await import('@/lib/mcp/apiHealthReport');
    const report = await buildApiHealthReport(args.tenant_id, args.hours);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          ...report,
          unified_tool_catalog_count: await getUnifiedMcpToolCount(),
        }, null, 2),
      }],
    };
  },
});
