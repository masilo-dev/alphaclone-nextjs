import { z } from 'zod';
import { registerTool } from '../tool-registry';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { normalizeDefineOutcomeArgs } from '@/lib/bonnie/outcomeArgs';

const defineOutcomeSchema = z.preprocess(
  (raw) => {
    if (!raw || typeof raw !== 'object') return raw;
    return normalizeDefineOutcomeArgs(raw as Record<string, unknown>);
  },
  z.object({
    tenant_id: z.string().uuid(),
    session_id: z.string().optional(),
    criteria: z
      .array(
        z.object({
          metric: z.string(),
          target: z.union([z.string(), z.number()]),
          actual: z.union([z.string(), z.number()]).optional(),
          met: z.boolean(),
        })
      )
      .min(1),
    status: z.enum(['success', 'partial', 'failure']),
    notes: z.string().optional(),
  })
);

// ── define_outcome ────────────────────────────────────────────────────────────
registerTool('bonnie-outcomes', {
  name: 'define_outcome',
  description:
    'Defines and records the success/failure outcome of a Bonnie agent session. Pass status as success|partial|failure and criteria as an array of {metric,target,met}. Loose aliases (completed/failed) and string criteria are accepted.',
  // Preprocess wrapper is ZodEffects; runtime .parse works. Cast for registry typing.
  inputSchema: defineOutcomeSchema as unknown as z.ZodObject<any>,
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', description: 'Tenant UUID' },
      session_id: { type: 'string', description: 'Optional: MCP session ID this outcome is linked to' },
      criteria: {
        type: 'array',
        description: 'List of evaluation criteria objects {metric,target,met}',
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
      status: {
        type: 'string',
        enum: ['success', 'partial', 'failure'],
        description: 'Overall outcome status (aliases like completed/failed accepted)',
      },
      notes: { type: 'string', description: 'Optional notes about the outcome' },
    },
    required: ['tenant_id', 'criteria', 'status'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const criteria = args.criteria as Array<{ met: boolean }>;
    const status = args.status as 'success' | 'partial' | 'failure';
    const notes = args.notes as string | undefined;

    const metCount = criteria.filter((c) => c.met).length;
    const score = Math.round((metCount / criteria.length) * 100);

    const { error } = await supabase.from('mcp_sessions').insert({
      tenant_id: args.tenant_id,
      tool_name: 'define_outcome',
      success: status === 'success',
      duration_ms: 0,
      tool_success: status === 'success',
      tool_latency_ms: 0,
      expires_at: new Date(Date.now() + 60000).toISOString(),
      error_message: status === 'failure' ? `Outcome: ${status}. Notes: ${notes || 'none'}` : null,
    });

    if (error) throw new Error(`Failed to record outcome: ${error.message}`);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          outcome: {
            status,
            score_percent: score,
            criteria_met: metCount,
            criteria_total: criteria.length,
            notes,
          },
        }, null, 2),
      }],
    };
  },
});
