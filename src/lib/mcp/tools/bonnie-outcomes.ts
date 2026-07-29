<<<<<<< HEAD
import { z } from 'zod';
import { registerTool } from '../tool-registry';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { normalizeDefineOutcomeArgs } from '@/lib/bonnie/outcomeArgs';

/**
 * Loose schema — models often send wrong shapes. We normalize inside the handler
 * so operators never see Zod "invalid_type" dumps.
 */
const defineOutcomeSchema = z
  .object({
    tenant_id: z.string().min(1).optional(),
    tenantId: z.string().min(1).optional(),
    session_id: z.string().optional(),
    sessionId: z.string().optional(),
    criteria: z.any().optional(),
    status: z.any().optional(),
    notes: z.string().optional(),
  })
  .passthrough();
=======
// @ts-nocheck
import { z } from 'zod';
import { registerTool } from '../tool-registry';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
>>>>>>> origin/main

// ── define_outcome ────────────────────────────────────────────────────────────
registerTool('bonnie-outcomes', {
  name: 'define_outcome',
  description:
<<<<<<< HEAD
    'Records whether a Bonnie work session succeeded for the business. Accepts flexible status (done/failed/partial) and checklist items; they are normalized server-side.',
  inputSchema: defineOutcomeSchema as unknown as z.ZodObject<any>,
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', description: 'Workspace ID' },
      session_id: { type: 'string', description: 'Optional session link' },
      criteria: {
        type: 'array',
        description: 'Success checklist items (or a short sentence — both accepted)',
=======
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
>>>>>>> origin/main
        items: {
          type: 'object',
          properties: {
            metric: { type: 'string' },
            target: { type: ['string', 'number'] },
            actual: { type: ['string', 'number'] },
            met: { type: 'boolean' },
          },
<<<<<<< HEAD
        },
      },
      status: {
        type: 'string',
        description: 'success | partial | failure (aliases like done/failed accepted)',
      },
      notes: { type: 'string', description: 'Optional plain-language notes' },
    },
    required: [],
  },
  handler: async (args) => {
    const normalized = normalizeDefineOutcomeArgs(
      args && typeof args === 'object' ? (args as Record<string, unknown>) : {}
    );
    const tenantId =
      normalized.tenant_id ||
      process.env.DEFAULT_TENANT_ID ||
      '00000000-0000-0000-0000-000000000000';

    const supabase = createSupabaseAdminClient();
    const { criteria, status, notes } = normalized;

    const metCount = criteria.filter((c) => c.met).length;
    const score = Math.round((metCount / criteria.length) * 100);

    const businessNote =
      notes?.trim() ||
      (status === 'success'
        ? 'Work completed as planned'
        : status === 'partial'
          ? 'Work partly completed — follow-up may be needed'
          : 'Work did not finish as planned');

    const { error } = await supabase.from('mcp_sessions').insert({
      tenant_id: tenantId,
      tool_name: 'define_outcome',
      success: status === 'success',
      duration_ms: 0,
      tool_success: status === 'success',
      tool_latency_ms: 0,
      expires_at: new Date(Date.now() + 60000).toISOString(),
      // Never store Zod dumps — only plain business notes
      error_message:
        status === 'failure'
          ? businessNote
          : status === 'partial'
            ? businessNote
            : null,
    });

    if (error) throw new Error('Bonnie couldn’t save the result checklist. Please try again.');

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            outcome: {
              status,
              score_percent: score,
              criteria_met: metCount,
              criteria_total: criteria.length,
              notes: businessNote,
              summary:
                status === 'success'
                  ? 'Checked results — work succeeded.'
                  : status === 'partial'
                    ? 'Checked results — partly done; follow-up may be needed.'
                    : 'Checked results — needs another try.',
            },
          }),
        },
      ],
=======
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
>>>>>>> origin/main
    };
  },
});
