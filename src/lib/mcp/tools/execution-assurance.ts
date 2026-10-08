import { z } from 'zod';
import { registerTool } from '../tool-registry';
import {
  buildExecutionAssuranceReport,
  reconcileTenantExecutionReceipts,
} from '@/lib/mcp/executionAssurance';

const tenantField = z.string().uuid().optional();

registerTool('execution-assurance', {
  name: 'get_execution_assurance_report',
  description:
    'Tenant execution assurance dashboard: receipt completeness, ambiguous targets, stale external actions, and outcome run health.',
  inputSchema: z
    .object({
      tenant_id: tenantField,
      days: z.number().int().min(1).max(90).optional(),
    })
    .passthrough(),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      days: { type: 'number', description: 'Lookback window (default 30)' },
    },
    required: [],
  },
  handler: async (args, ctx) => {
    const days = Number((args as { days?: number }).days || 30);
    const report = await buildExecutionAssuranceReport({
      tenantId: ctx.tenantId,
      sinceDays: days,
    });
    return {
      content: [{ type: 'text', text: JSON.stringify({ ok: true, data: report }) }],
    };
  },
});

registerTool('execution-assurance', {
  name: 'reconcile_execution_receipts',
  description:
    'Repair incomplete MCP write receipts (e.g. backfill provider_reference from social_posts) and list remaining gaps.',
  inputSchema: z
    .object({
      tenant_id: tenantField,
      days: z.number().int().min(1).max(30).optional(),
      attempt_repair: z.boolean().optional(),
    })
    .passthrough(),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      days: { type: 'number' },
      attempt_repair: { type: 'boolean', default: true },
    },
    required: [],
  },
  handler: async (args, ctx) => {
    const raw = args as { days?: number; attempt_repair?: boolean };
    const result = await reconcileTenantExecutionReceipts({
      tenantId: ctx.tenantId,
      sinceDays: raw.days || 7,
      attemptRepair: raw.attempt_repair !== false,
    });
    return {
      content: [{ type: 'text', text: JSON.stringify({ ok: true, data: result }) }],
    };
  },
});

registerTool('execution-assurance', {
  name: 'get_execution_status',
  description:
    'Query authoritative execution status and receipt by execution_id, action_id, correlation_id, or idempotency_key.',
  inputSchema: z
    .object({
      tenant_id: tenantField,
      execution_id: z.string().optional(),
      action_id: z.string().optional(),
      correlation_id: z.string().optional(),
      idempotency_key: z.string().optional(),
    })
    .passthrough(),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      execution_id: { type: 'string', description: 'Execution ID or action UUID' },
      action_id: { type: 'string', description: 'Action ID' },
      correlation_id: { type: 'string', description: 'Correlation ID' },
      idempotency_key: { type: 'string', description: 'Idempotency key' },
    },
    required: [],
  },
  handler: async (args, ctx) => {
    const raw = args as {
      tenant_id?: string;
      execution_id?: string;
      action_id?: string;
      correlation_id?: string;
      idempotency_key?: string;
    };
    const targetId = raw.execution_id || raw.action_id || raw.correlation_id;
    const idempotencyKey = raw.idempotency_key;
    const tenantId = ctx.tenantId || raw.tenant_id;

    if (!targetId && !idempotencyKey) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              ok: false,
              error: {
                code: 'INVALID_ARGUMENT',
                message: 'Must provide execution_id, action_id, correlation_id, or idempotency_key',
              },
            }),
          },
        ],
      };
    }

    const { createSupabaseAdminClient } = await import('@/lib/supabase-admin');
    const { normalizeCanonicalExecutionState } = await import('@/lib/execution/executionStates');
    const admin = createSupabaseAdminClient();

    // 1. Check mcp_action_receipts
    let receiptQuery = admin
      .from('mcp_action_receipts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1);

    if (tenantId) receiptQuery = receiptQuery.eq('tenant_id', tenantId);
    if (targetId) {
      receiptQuery = receiptQuery.or(`action_id.eq.${targetId},correlation_id.eq.${targetId}`);
    } else if (idempotencyKey) {
      receiptQuery = receiptQuery.eq('idempotency_key', idempotencyKey);
    }

    const { data: receipts } = await receiptQuery;
    const receiptRow = receipts && receipts[0];

    // 2. Check external_actions
    let actionQuery = admin
      .from('external_actions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1);

    if (tenantId) actionQuery = actionQuery.eq('tenant_id', tenantId);
    if (targetId) {
      actionQuery = actionQuery.or(`action_id.eq.${targetId},id.eq.${targetId}`);
    } else if (idempotencyKey) {
      actionQuery = actionQuery.eq('idempotency_key', idempotencyKey);
    }

    const { data: actions } = await actionQuery;
    const actionRow = actions && actions[0];

    if (!receiptRow && !actionRow) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              ok: false,
              error: {
                code: 'EXECUTION_NOT_FOUND',
                message: 'No execution record found for the provided identifier',
              },
            }),
          },
        ],
      };
    }

    const rawStatus = receiptRow?.final_status || actionRow?.status || 'pending_verification';
    const canonicalStatus = normalizeCanonicalExecutionState(rawStatus);

    const receipt = {
      execution_id: receiptRow?.action_id || actionRow?.action_id || targetId,
      action_id: receiptRow?.action_id || actionRow?.action_id || targetId,
      correlation_id: receiptRow?.correlation_id || actionRow?.action_id || targetId,
      status: canonicalStatus,
      operation: receiptRow?.tool || actionRow?.tool_name || 'unknown',
      resource_id: receiptRow?.entity_id || actionRow?.provider_reference || null,
      provider: receiptRow?.provider || actionRow?.provider || null,
      provider_reference: receiptRow?.provider_reference || actionRow?.provider_reference || null,
      started_at: actionRow?.started_at || receiptRow?.created_at || actionRow?.created_at || null,
      completed_at: actionRow?.completed_at || (canonicalStatus === 'succeeded' ? receiptRow?.created_at : null),
      verified_at: canonicalStatus === 'succeeded' ? (actionRow?.completed_at || receiptRow?.created_at) : null,
      error_code: receiptRow?.error_code || (canonicalStatus === 'failed' ? 'EXECUTION_FAILED' : null),
      error_message: receiptRow?.error_message || actionRow?.failure_reason || null,
      verification_status:
        canonicalStatus === 'succeeded'
          ? 'verified'
          : canonicalStatus === 'failed'
          ? 'failed'
          : 'pending',
      live_url: receiptRow?.live_url || actionRow?.live_url || null,
      timestamp: receiptRow?.created_at || actionRow?.created_at || new Date().toISOString(),
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            ok: true,
            status: canonicalStatus,
            data: receipt,
            receipt,
          }),
        },
      ],
    };
  },
});

