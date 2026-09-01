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
