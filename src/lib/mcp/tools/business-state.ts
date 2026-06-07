import { z } from 'zod';
import { registerTool } from '../tool-registry';
import { mcpStore } from '@/services/mcp/mcpStore';
import {
  evaluateBusinessAIState,
  summarizeBusinessAIState,
  type BusinessAIState,
} from '@/services/mcp/businessAIState';

const evaluationContextSchema = z.object({
  task: z.string().optional(),
  task_category: z.string().optional(),
  touches_sensitive_data: z.boolean().optional(),
  requires_external_action: z.boolean().optional(),
  requires_financial_action: z.boolean().optional(),
  requires_legal_action: z.boolean().optional(),
  requires_customer_facing_action: z.boolean().optional(),
});

const businessStatePatchSchema = z.object({
  primary_domain: z.enum(['crm', 'finance', 'contracts', 'marketing', 'support', 'operations', 'strategy']).optional(),
  secondary_domains: z.array(z.enum(['crm', 'finance', 'contracts', 'marketing', 'support', 'operations', 'strategy'])).optional(),
  agent_mode: z.enum(['observe', 'draft', 'act_with_approval', 'autonomous']).optional(),
  preferred_model: z.enum(['claude', 'openai', 'hybrid', 'auto']).optional(),
  preferred_model_by_task: z.record(z.string(), z.enum(['claude', 'openai', 'hybrid', 'auto'])).optional(),
  audit: z.object({
    evidence_required: z.boolean().optional(),
    record_decisions: z.boolean().optional(),
    human_review_actions: z.array(z.string()).optional(),
  }).optional(),
  compliance: z.object({
    dpa_ok: z.boolean().optional(),
    retention_ok: z.boolean().optional(),
    sso_ok: z.boolean().optional(),
    pii_rules_ok: z.boolean().optional(),
  }).optional(),
  scores: z.object({
    auditability: z.number().min(0).max(100).optional(),
    workflow_fit: z.number().min(0).max(100).optional(),
    data_quality: z.number().min(0).max(100).optional(),
    human_review_coverage: z.number().min(0).max(100).optional(),
    integration_depth: z.number().min(0).max(100).optional(),
    model_confidence: z.number().min(0).max(100).optional(),
    compliance: z.number().min(0).max(100).optional(),
  }).optional(),
  thresholds: z.object({
    draft_max: z.number().min(0).max(100).optional(),
    act_with_approval_min: z.number().min(0).max(100).optional(),
    autonomous_min: z.number().min(0).max(100).optional(),
  }).optional(),
  owner_profile: z.object({
    owner_type: z.enum(['solo', 'small_team', 'scaling_team']).optional(),
    weekly_capacity_hours: z.number().min(1).max(168).optional(),
    admin_load: z.enum(['low', 'medium', 'high']).optional(),
    primary_constraint: z.enum(['time', 'cash_flow', 'leads', 'delivery', 'focus']).optional(),
    value_add_focus: z.array(z.string()).optional(),
  }).optional(),
  memory_summary: z.string().optional(),
  kpi_targets: z.array(z.string()).optional(),
  last_policy_review_at: z.string().optional().nullable(),
});

registerTool('business-state', {
  name: 'get_business_ai_state',
  description:
    'Read the current business AI connection state, including model preference, audit posture, risk flags, and the recommended mode for this workspace.',
  inputSchema: z.object({
    task: z.string().optional(),
    task_category: z.string().optional(),
    touches_sensitive_data: z.boolean().optional(),
    requires_external_action: z.boolean().optional(),
    requires_financial_action: z.boolean().optional(),
    requires_legal_action: z.boolean().optional(),
    requires_customer_facing_action: z.boolean().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      task: { type: 'string', description: 'Optional business task to evaluate' },
      task_category: { type: 'string', description: 'Optional category such as research, audit, drafting, execution' },
      touches_sensitive_data: { type: 'boolean', description: 'Whether the task uses sensitive data' },
      requires_external_action: { type: 'boolean', description: 'Whether the task needs an external system action' },
      requires_financial_action: { type: 'boolean', description: 'Whether the task affects money or accounting' },
      requires_legal_action: { type: 'boolean', description: 'Whether the task affects legal/contracts' },
      requires_customer_facing_action: { type: 'boolean', description: 'Whether the task directly affects customers' },
    },
    required: [],
  },
  handler: async (args, context) => {
    const state = await mcpStore.getBusinessAIState(context.tenantId, context.userId);
    const evaluation = evaluateBusinessAIState(state, {
      task: args.task,
      task_category: args.task_category,
      touches_sensitive_data: args.touches_sensitive_data,
      requires_external_action: args.requires_external_action,
      requires_financial_action: args.requires_financial_action,
      requires_legal_action: args.requires_legal_action,
      requires_customer_facing_action: args.requires_customer_facing_action,
    });

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          state: summarizeBusinessAIState(state),
          evaluation,
        }, null, 2),
      }],
    };
  },
});

registerTool('business-state', {
  name: 'update_business_ai_state',
  description:
    'Update the current business AI connection state so the MCP session remembers model preferences, audit settings, and review thresholds.',
  inputSchema: z.object({
    patch: businessStatePatchSchema,
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      patch: {
        type: 'object',
        description: 'Partial business AI state update',
      },
    },
    required: ['patch'],
  },
  handler: async (args, context) => {
    const result = await mcpStore.updateBusinessAIState(context.tenantId, context.userId, args.patch as Partial<BusinessAIState>);
    if (!result.success || !result.state) {
      throw new Error(result.error || 'Failed to update business AI state');
    }

    const evaluation = evaluateBusinessAIState(result.state);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          state: summarizeBusinessAIState(result.state),
          evaluation,
        }, null, 2),
      }],
    };
  },
});

registerTool('business-state', {
  name: 'evaluate_business_ai_readiness',
  description:
    'Score whether this workspace should observe, draft, act with approval, or operate autonomously for the requested business task.',
  inputSchema: z.object({
    task: z.string().min(1),
    task_category: z.string().optional(),
    touches_sensitive_data: z.boolean().optional(),
    requires_external_action: z.boolean().optional(),
    requires_financial_action: z.boolean().optional(),
    requires_legal_action: z.boolean().optional(),
    requires_customer_facing_action: z.boolean().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      task: { type: 'string', description: 'Describe the business task to evaluate' },
      task_category: { type: 'string', description: 'Optional category such as research, audit, drafting, execution' },
      touches_sensitive_data: { type: 'boolean', description: 'Whether the task uses sensitive data' },
      requires_external_action: { type: 'boolean', description: 'Whether the task needs an external system action' },
      requires_financial_action: { type: 'boolean', description: 'Whether the task affects money or accounting' },
      requires_legal_action: { type: 'boolean', description: 'Whether the task affects legal/contracts' },
      requires_customer_facing_action: { type: 'boolean', description: 'Whether the task directly affects customers' },
    },
    required: ['task'],
  },
  handler: async (args, context) => {
    const state = await mcpStore.getBusinessAIState(context.tenantId, context.userId);
    const evaluation = evaluateBusinessAIState(state, {
      task: args.task,
      task_category: args.task_category,
      touches_sensitive_data: args.touches_sensitive_data,
      requires_external_action: args.requires_external_action,
      requires_financial_action: args.requires_financial_action,
      requires_legal_action: args.requires_legal_action,
      requires_customer_facing_action: args.requires_customer_facing_action,
    });

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          task: args.task,
          state: summarizeBusinessAIState(state),
          evaluation,
        }, null, 2),
      }],
    };
  },
});
