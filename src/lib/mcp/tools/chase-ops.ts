/**
 * Universal Chaser MCP surface — Phase 1 observe + inbox operations.
 */

import { z } from 'zod';
import { defineConnectorTool, tenantIdField } from '@/lib/mcp/connector';
import { okResult, throwConnectorError } from '@/lib/mcp/connector/response';
import {
  getChaseInstanceById,
  listChaseInstances,
  transitionChaseState,
  upsertChaseInstance,
} from '@/lib/chaser/chaseInstanceService';
import { buildChaseBrief, runChaseScanForTenant } from '@/lib/chaser/chaseDetector';
import { getChasePolicy, listChasePolicies } from '@/lib/chaser/policyRegistry';
import {
  loadTenantChasePolicyOverride,
  upsertTenantChasePolicy,
} from '@/lib/chaser/chaseTenantPolicyService';
import { getChaseHealthMetrics } from '@/lib/chaser/chaseMetricsService';
import { CHASE_POLICY_KEYS } from '@/lib/chaser/types';

const policyKeySchema = z.enum(CHASE_POLICY_KEYS);

defineConnectorTool({
  module: 'chase-ops',
  name: 'list_chase_items',
  description: 'List canonical chase instances for the tenant (Universal Chaser inbox).',
  permission: 'crm:read',
  rateLimitClass: 'read',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    policy_key: policyKeySchema.optional(),
    state: z.string().optional(),
    limit: z.number().int().min(1).max(200).optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      policy_key: { type: 'string' },
      state: { type: 'string' },
      limit: { type: 'integer' },
    },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const { data, error } = await listChaseInstances(args.tenant_id, {
      policyKey: args.policy_key,
      state: args.state as any,
      limit: args.limit,
    });
    if (error) throwConnectorError('list_chase_items', error);
    return okResult('list_chase_items', { items: data, count: data.length });
  },
});

defineConnectorTool({
  module: 'chase-ops',
  name: 'get_chase_item',
  description: 'Fetch one chase instance with policy snapshot and evidence.',
  permission: 'crm:read',
  rateLimitClass: 'read',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    chase_id: z.string().uuid(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      chase_id: { type: 'string', format: 'uuid' },
    },
    required: ['tenant_id', 'chase_id'],
  },
  handler: async (args) => {
    const { data, error } = await getChaseInstanceById(args.tenant_id, args.chase_id);
    if (error) throwConnectorError('get_chase_item', error);
    if (!data) throwConnectorError('get_chase_item', 'Chase item not found', 404);
    return okResult('get_chase_item', data);
  },
});

defineConnectorTool({
  module: 'chase-ops',
  name: 'start_chase',
  description: 'Create or refresh a canonical chase instance (observe-only unless tenant policy permits execution).',
  permission: 'crm:write',
  rateLimitClass: 'write',
  auditAction: 'start_chase',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    policy_key: policyKeySchema,
    entity_type: z.string(),
    entity_id: z.string().uuid(),
    reason_code: z.string().optional(),
    waiting_on: z.string().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      policy_key: { type: 'string' },
      entity_type: { type: 'string' },
      entity_id: { type: 'string', format: 'uuid' },
      reason_code: { type: 'string' },
      waiting_on: { type: 'string' },
    },
    required: ['tenant_id', 'policy_key', 'entity_type', 'entity_id'],
  },
  handler: async (args) => {
    const result = await upsertChaseInstance({
      tenantId: args.tenant_id,
      policyKey: args.policy_key,
      entityType: args.entity_type as any,
      entityId: args.entity_id,
      reasonCode: args.reason_code,
      waitingOn: args.waiting_on,
    });
    if (result.error) throwConnectorError('start_chase', result.error);
    return okResult('start_chase', { chase: result.data, created: result.created });
  },
});

defineConnectorTool({
  module: 'chase-ops',
  name: 'snooze_chase',
  description: 'Snooze a chase until a future time.',
  permission: 'crm:write',
  rateLimitClass: 'write',
  auditAction: 'snooze_chase',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    chase_id: z.string().uuid(),
    until: z.string(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      chase_id: { type: 'string', format: 'uuid' },
      until: { type: 'string', format: 'date-time' },
    },
    required: ['tenant_id', 'chase_id', 'until'],
  },
  handler: async (args) => {
    const result = await transitionChaseState(args.tenant_id, args.chase_id, {
      state: 'SNOOZED',
      snoozedUntil: args.until,
      evidence: { snoozed_until: args.until },
    });
    if (!result.ok) throwConnectorError('snooze_chase', result.error || 'Snooze failed');
    return okResult('snooze_chase', { chase_id: args.chase_id, snoozed_until: args.until });
  },
});

defineConnectorTool({
  module: 'chase-ops',
  name: 'stop_chase',
  description: 'Stop chasing with a verified terminal outcome.',
  permission: 'crm:write',
  rateLimitClass: 'write',
  auditAction: 'stop_chase',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    chase_id: z.string().uuid(),
    terminal_outcome: z.string(),
    reason: z.string().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      chase_id: { type: 'string', format: 'uuid' },
      terminal_outcome: { type: 'string' },
      reason: { type: 'string' },
    },
    required: ['tenant_id', 'chase_id', 'terminal_outcome'],
  },
  handler: async (args) => {
    const result = await transitionChaseState(args.tenant_id, args.chase_id, {
      state: 'CANCELLED',
      terminalOutcome: args.terminal_outcome,
      evidence: { stop_reason: args.reason || null, stopped_at: new Date().toISOString() },
    });
    if (!result.ok) throwConnectorError('stop_chase', result.error || 'Stop failed');
    return okResult('stop_chase', {
      chase_id: args.chase_id,
      terminal_outcome: args.terminal_outcome,
    });
  },
});

defineConnectorTool({
  module: 'chase-ops',
  name: 'run_chase_scan',
  description: 'Phase 1 observe-only detector — creates canonical chase records without sending messages.',
  permission: 'crm:write',
  rateLimitClass: 'write',
  auditAction: 'run_chase_scan',
  inputSchema: z.object({
    tenant_id: tenantIdField,
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
    },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const scan = await runChaseScanForTenant(args.tenant_id);
    return okResult('run_chase_scan', scan);
  },
});

defineConnectorTool({
  module: 'chase-ops',
  name: 'get_chase_brief',
  description: 'Consolidated owner brief grouped by client/project — what is stuck and why.',
  permission: 'crm:read',
  rateLimitClass: 'read',
  inputSchema: z.object({
    tenant_id: tenantIdField,
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
    },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const brief = await buildChaseBrief(args.tenant_id);
    return okResult('get_chase_brief', brief);
  },
});

defineConnectorTool({
  module: 'chase-ops',
  name: 'get_chase_health',
  description: 'Operational metrics for Universal Chaser — active, resolved, failures, due now.',
  permission: 'crm:read',
  rateLimitClass: 'read',
  inputSchema: z.object({
    tenant_id: tenantIdField,
  }),
  jsonSchema: {
    type: 'object',
    properties: { tenant_id: { type: 'string', format: 'uuid' } },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const metrics = await getChaseHealthMetrics(args.tenant_id);
    return okResult('get_chase_health', metrics);
  },
});

defineConnectorTool({
  module: 'chase-ops',
  name: 'update_chase_policy',
  description: 'Read or update tenant chase policy (persists to agent_chasing_policies).',
  permission: 'automation:write',
  rateLimitClass: 'write',
  auditAction: 'update_chase_policy',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    policy_key: policyKeySchema,
    requires_approval: z.boolean().optional(),
    max_attempts: z.number().int().min(1).max(50).optional(),
    follow_up_interval_hours: z.array(z.number().int().positive()).optional(),
    active: z.boolean().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      policy_key: { type: 'string' },
      requires_approval: { type: 'boolean' },
      max_attempts: { type: 'integer' },
      active: { type: 'boolean' },
    },
    required: ['tenant_id', 'policy_key'],
  },
  handler: async (args) => {
    const hasWrite =
      args.requires_approval !== undefined ||
      args.max_attempts !== undefined ||
      args.active !== undefined ||
      args.follow_up_interval_hours !== undefined;

    if (hasWrite) {
      const result = await upsertTenantChasePolicy({
        tenantId: args.tenant_id,
        policyKey: args.policy_key,
        requiresApproval: args.requires_approval,
        maxAttempts: args.max_attempts,
        followUpIntervalHours: args.follow_up_interval_hours,
        active: args.active,
      });
      if (!result.ok) throwConnectorError('update_chase_policy', result.error || 'Update failed');
    }

    const override = await loadTenantChasePolicyOverride(args.tenant_id, args.policy_key);
    const defaults = getChasePolicy(args.policy_key);
    return okResult('update_chase_policy', {
      policy: defaults,
      tenant_override: override,
      all_policies: listChasePolicies().map((p) => p.key),
    });
  },
});

defineConnectorTool({
  module: 'chase-ops',
  name: 'approve_chase_action',
  description: 'Placeholder for Phase 3 approval-gated external actions.',
  permission: 'crm:write',
  rateLimitClass: 'write',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    chase_id: z.string().uuid(),
    approval_id: z.string().uuid().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      chase_id: { type: 'string', format: 'uuid' },
      approval_id: { type: 'string', format: 'uuid' },
    },
    required: ['tenant_id', 'chase_id'],
  },
  handler: async (args, ctx) => {
    const { approveAndExecuteChase } = await import('@/lib/chaser/chaseExecutorService');
    const result = await approveAndExecuteChase(args.tenant_id, args.chase_id, ctx.userId);
    if (!result.ok) throwConnectorError('approve_chase_action', result.error || 'Approval failed');
    return okResult('approve_chase_action', {
      chase_id: args.chase_id,
      outcome: result.outcome,
    });
  },
});

defineConnectorTool({
  module: 'chase-ops',
  name: 'reassign_chase',
  description: 'Reassign chase ownership to another user.',
  permission: 'crm:write',
  rateLimitClass: 'write',
  auditAction: 'reassign_chase',
  inputSchema: z.object({
    tenant_id: tenantIdField,
    chase_id: z.string().uuid(),
    assignee_user_id: z.string().uuid(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      chase_id: { type: 'string', format: 'uuid' },
      assignee_user_id: { type: 'string', format: 'uuid' },
    },
    required: ['tenant_id', 'chase_id', 'assignee_user_id'],
  },
  handler: async (args) => {
    const { createSupabaseAdminClient } = await import('@/lib/supabase-admin');
    const admin = createSupabaseAdminClient();
    const { error } = await admin
      .from('chase_instances')
      .update({
        assignee_user_id: args.assignee_user_id,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', args.tenant_id)
      .eq('id', args.chase_id);
    if (error) throwConnectorError('reassign_chase', error.message);
    return okResult('reassign_chase', {
      chase_id: args.chase_id,
      assignee_user_id: args.assignee_user_id,
    });
  },
});
