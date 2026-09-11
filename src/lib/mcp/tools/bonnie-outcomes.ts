// @ts-nocheck
import { z } from 'zod';
import { registerTool } from '../tool-registry';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

// ── define_outcome ────────────────────────────────────────────────────────────
registerTool('bonnie-outcomes', {
  name: 'define_outcome',
  description:
    'Defines and records the success/failure outcome of a Bonnie agent session, including evaluation criteria and performance scores.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    session_id: z.string().optional(),
    criteria: z.array(
      z.object({
        metric: z.string(),
        target: z.union([z.string(), z.number()]),
        actual: z.union([z.string(), z.number()]).optional(),
        met: z.boolean(),
      })
    ).min(1),
    status: z.enum(['success', 'partial', 'failure']),
    notes: z.string().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', description: 'Tenant UUID' },
      session_id: { type: 'string', description: 'Optional: MCP session ID this outcome is linked to' },
      criteria: {
        type: 'array',
        description: 'List of evaluation criteria',
        items: {
          type: 'object',
          properties: {
            metric: { type: 'string' },
            target: { type: ['string', 'number'] },
            actual: { type: ['string', 'number'] },
            met: { type: 'boolean' },
          },
          required: ['metric', 'target', 'met'],
        },
      },
      status: { type: 'string', enum: ['success', 'partial', 'failure'], description: 'Overall outcome status' },
      notes: { type: 'string', description: 'Optional notes about the outcome' },
    },
    required: ['tenant_id', 'criteria', 'status'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();

    const metCount = args.criteria.filter(c => c.met).length;
    const score = Math.round((metCount / args.criteria.length) * 100);

    // Log outcome to mcp_sessions as a special entry
    const { error } = await supabase.from('mcp_sessions').insert({
      tenant_id: args.tenant_id,
      tool_name: 'define_outcome',
      success: args.status === 'success',
      duration_ms: 0,
      tool_success: args.status === 'success',
      tool_latency_ms: 0,
      expires_at: new Date(Date.now() + 60000).toISOString(),
      error_message: args.status === 'failure' ? `Outcome: ${args.status}. Notes: ${args.notes || 'none'}` : null,
    });

    if (error) throw new Error(`Failed to record outcome: ${error.message}`);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          outcome: {
            status: args.status,
            score_percent: score,
            criteria_met: metCount,
            criteria_total: args.criteria.length,
            notes: args.notes,
          },
        }, null, 2),
      }],
    };
  },
});
