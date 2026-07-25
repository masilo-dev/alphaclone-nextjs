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

// ── define_outcome ────────────────────────────────────────────────────────────
registerTool('bonnie-outcomes', {
  name: 'define_outcome',
  description:
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
        items: {
          type: 'object',
          properties: {
            metric: { type: 'string' },
            target: { type: ['string', 'number'] },
            actual: { type: ['string', 'number'] },
            met: { type: 'boolean' },
          },
        },
      },
      status: {
        type: 'string',
        description: 'success | partial | failure (aliases like done/failed accepted)',
      },
      notes: { type: 'string', description: 'Optional plain-language notes' },
    },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const normalized = normalizeDefineOutcomeArgs(
      args && typeof args === 'object' ? (args as Record<string, unknown>) : {}
    );
    const tenantId = normalized.tenant_id;
    if (!tenantId) {
      throw new Error('Workspace ID is required to record results.');
    }

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
    };
  },
});
