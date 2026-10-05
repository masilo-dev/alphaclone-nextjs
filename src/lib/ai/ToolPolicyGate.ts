import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { mcpStore } from '@/services/mcp/mcpStore';
import type { BusinessAIAgentMode } from '@/services/mcp/businessAIState';
import { resolveEffectiveAgentMode } from '@/lib/ai/resolveEffectiveAgentMode';
import { evaluateBusinessAIState } from '@/services/mcp/businessAIState';
import {
  classifyMcpToolTier,
  mcpToolRequiresApproval,
  type McpToolTier,
} from '@/lib/mcp/toolRiskTiers';

/**
 * ToolPolicyGate — EU AI Act Art. 14 human oversight + ISO 42001 A.4.
 *
 * High-risk tools (send / bulk / financial) queue for approval unless the
 * workspace is in autonomous mode (and readiness allows it). ChatGPT / Claude
 * MCP connectors auto-execute authenticated tool calls — the connector user
 * already issued the command. In-app Bonnie still goes through this gate so
 * send / bulk / financial actions can be approved in the Approval Center.
 */

export type ToolRiskClass = 'read' | 'draft' | 'send' | 'bulk' | 'financial';
export type PolicySource = 'bonnie' | 'mcp' | 'playbook' | 'cron' | 'ui';
export type PolicyOutcome = 'allow' | 'queue_approval' | 'deny';

export type PolicySourceAttribute =
  | 'mcp_connector_auto_allow'
  | 'tenant_autonomy'
  | 'default_allow'
  | 'approval_required'
  | 'mode_blocked';

export type PolicyDecision = {
  outcome: PolicyOutcome;
  riskClass: ToolRiskClass;
  reason: string;
  approvalId?: string;
  isDuplicate?: boolean;
  /** Explicit source policy — never silent bypass. */
  sourcePolicy?: PolicySourceAttribute;
  approvalState?: 'none' | 'required' | 'queued' | 'mcp_auto_allowed' | 'approved';
  policyAttributes?: Record<string, unknown>;
};

const SEND_TOOLS = new Set([
  'send_email',
  'send_invoice',
  'send_transactional_email',
  'send_batch_outreach',
  'send_whatsapp_message',
  'queue_email_campaign_send',
  'send_campaign',
  'nexus_invoice_chasing',
  'nexus_sales_campaign',
  'create_linkedin_post',
  'create_social_post',
  'create_social_post_with_media',
  'create_post_with_ai_image',
  'create_post',
  'publish_social_post',
  'publish_post',
  'publish_now',
  'schedule_social_post',
  'publish_facebook_reel',
  'publish_facebook_multi_photo',
  'reply_to_email',
  'microsoft_send_email',
]);

const META_ORCHESTRATION_TOOLS = new Set([
  'run_chief_of_staff_routine',
  'orchestrate_task',
  'run_autonomous_scan',
  'run_playbook',
  'trigger_bonnie_dream',
  'list_pending_approvals',
  'approve_pending_action',
  'reject_pending_action',
]);

const FINANCIAL_TOOLS = new Set([
  'send_invoice',
  'create_invoice',
  'update_invoice',
  'delete_invoice',
  'record_payment',
  'reconcile_payment',
  'nexus_invoice_chasing',
  'issue_refund',
  'refund_payment',
  'create_payout',
  'initiate_payout',
  'initiate_payment',
  'transfer_funds',
]);

/** Record-keeping in CRM/ledger — not the same risk as moving money externally. */
export const FINANCIAL_RECORD_KEEPING_TOOLS = new Set([
  'create_invoice',
  'update_invoice',
  'delete_invoice',
  'create_quote',
  'update_quote',
]);

/** Capabilities that can move, refund, or transfer real funds — never MCP auto-allow. */
export const FINANCIAL_MONEY_MOVEMENT_TOOLS = new Set([
  'record_payment',
  'reconcile_payment',
  'issue_refund',
  'refund_payment',
  'create_payout',
  'initiate_payout',
  'initiate_payment',
  'transfer_funds',
  'nexus_payroll_sync',
]);

export function isFinancialMoneyMovementTool(toolName: string): boolean {
  return FINANCIAL_MONEY_MOVEMENT_TOOLS.has(toolName.toLowerCase());
}

export function isFinancialRecordKeepingTool(toolName: string): boolean {
  return FINANCIAL_RECORD_KEEPING_TOOLS.has(toolName.toLowerCase());
}

const DRAFT_TOOLS = new Set([
  'generate_contract_draft',
  'draft_email',
  'draft_reply',
  'create_draft',
  'create_email_draft',
  'generate_outreach_draft',
]);

export function classifyToolRisk(toolName: string): ToolRiskClass {
  const name = toolName.toLowerCase();
  if (META_ORCHESTRATION_TOOLS.has(name)) return 'read';

  // Money-movement / financial tools keep financial class even when also EXTERNAL_WRITE.
  if (isFinancialMoneyMovementTool(name) || FINANCIAL_TOOLS.has(name)) return 'financial';

  // Canonical MCP tiers map into policy risk classes (MCP-SURFACE / MCP-IDEM).
  const tier: McpToolTier = classifyMcpToolTier(name);
  if (tier === 'HIGH_RISK_EXTERNAL_WRITE') {
    if (name.startsWith('bulk_') || name.includes('_bulk') || name.includes('outreach')) return 'bulk';
    return 'bulk';
  }
  if (tier === 'EXTERNAL_WRITE') return 'send';

  if (name.startsWith('bulk_') || name.includes('_bulk') || name === 'bulk_update') return 'bulk';
  if (SEND_TOOLS.has(name)) return 'send';
  if (name.startsWith('publish_') || name.startsWith('send_')) return 'send';
  if (DRAFT_TOOLS.has(name) || name.includes('draft')) return 'draft';
  if (
    name.startsWith('get_') ||
    name.startsWith('list_') ||
    name.startsWith('search_') ||
    name.startsWith('fetch_') ||
    name.startsWith('find_')
  ) {
    return 'read';
  }
  if (tier === 'INTERNAL_WRITE') return 'draft';
  if (name.startsWith('create_') || name.startsWith('update_') || name.startsWith('delete_')) {
    return 'draft';
  }
  return 'read';
}

function modeBlocksExecution(mode: BusinessAIAgentMode, riskClass: ToolRiskClass): boolean {
  if (riskClass === 'read' || riskClass === 'draft') return false;
  if (mode === 'observe') return true;
  return false;
}

function requiresApproval(
  mode: BusinessAIAgentMode,
  riskClass: ToolRiskClass,
  highRiskRequired: boolean
): boolean {
  if (riskClass === 'read') return false;
  if (riskClass === 'draft') return mode === 'observe';
  if (mode === 'autonomous' && !highRiskRequired) return false;
  if (
    mode === 'autonomous' &&
    highRiskRequired &&
    (riskClass === 'send' || riskClass === 'bulk' || riskClass === 'financial')
  ) {
    return true;
  }
  return (
    mode === 'draft' ||
    mode === 'act_with_approval' ||
    riskClass === 'send' ||
    riskClass === 'bulk' ||
    riskClass === 'financial'
  );
}

export async function evaluateToolPolicy(params: {
  tenantId: string;
  userId: string;
  toolName: string;
  source: PolicySource;
  args?: Record<string, unknown>;
  instruction?: string;
  workflowId?: string;
  conversationId?: string;
}): Promise<PolicyDecision> {
  const {
    tenantId,
    userId,
    toolName,
    source,
    args = {},
    instruction,
    workflowId,
    conversationId,
  } = params;
  const riskClass = classifyToolRisk(toolName);
  const mcpTier = classifyMcpToolTier(toolName);
  const policyAttributes: Record<string, unknown> = {
    execution_source: source,
    risk_class: riskClass,
    mcp_tool_tier: mcpTier,
  };

  const admin = createSupabaseAdminClient();

  const [{ data: rulesRow }, aiState] = await Promise.all([
    admin
      .from('autonomous_runner_rules')
      .select('high_risk_approval_required, auto_send_enabled')
      .eq('tenant_id', tenantId)
      .maybeSingle(),
    mcpStore.getBusinessAIState(tenantId, userId),
  ]);

  const highRiskRequired = rulesRow?.high_risk_approval_required !== false;
  const agentMode = resolveEffectiveAgentMode(aiState.agent_mode, rulesRow);

  if (modeBlocksExecution(agentMode, riskClass)) {
    return {
      outcome: 'deny',
      riskClass,
      reason: `Agent mode "${agentMode}" blocks ${riskClass} actions for tool "${toolName}".`,
      sourcePolicy: 'mode_blocked',
      approvalState: 'required',
      policyAttributes,
    };
  }

  let needsApproval = requiresApproval(agentMode, riskClass, highRiskRequired);
  let readinessReason: string | undefined;

  // HIGH_RISK_EXTERNAL_WRITE always requires approval unless explicitly money-safe path handled below.
  if (mcpToolRequiresApproval(toolName)) {
    needsApproval = true;
  }

  if (agentMode === 'autonomous' && riskClass !== 'read') {
    const evaluation = evaluateBusinessAIState(aiState, {
      requires_external_action: riskClass === 'send' || riskClass === 'bulk',
      requires_financial_action: riskClass === 'financial',
      requires_customer_facing_action: riskClass === 'send',
      task_category: source,
    });
    if (
      evaluation.recommended_mode !== 'autonomous' &&
      (riskClass === 'send' || riskClass === 'bulk' || riskClass === 'financial')
    ) {
      needsApproval = true;
      readinessReason = `Readiness gate: workspace recommends "${evaluation.recommended_mode}" (score ${evaluation.readiness_score}). ${evaluation.reasons[0] || 'Improve reliability before autonomous execution.'}`;
    }
  }

  if (!needsApproval) {
    return {
      outcome: 'allow',
      riskClass,
      reason: 'Policy allows execution.',
      sourcePolicy: source === 'mcp' ? 'mcp_connector_auto_allow' : 'default_allow',
      approvalState: 'none',
      policyAttributes,
    };
  }

  // MCP connectors: evaluated above (mode, readiness, tenant rules). High-risk
  // financial/bulk/HIGH_RISK_EXTERNAL_WRITE actions still queue when required;
  // other MCP writes auto-allow with an explicit source attribute (not a silent bypass).
  const mcpHighRiskQueue =
    source === 'mcp' &&
    (isFinancialMoneyMovementTool(toolName) ||
      mcpToolRequiresApproval(toolName) ||
      (highRiskRequired && (riskClass === 'financial' || riskClass === 'bulk')));

  if (source === 'mcp' && !mcpHighRiskQueue) {
    return {
      outcome: 'allow',
      riskClass,
      reason:
        readinessReason ||
        'MCP connector policy: authenticated user command allowed after full policy evaluation.',
      sourcePolicy: 'mcp_connector_auto_allow',
      approvalState: 'mcp_auto_allowed',
      policyAttributes: {
        ...policyAttributes,
        mcp_connector_auto_allow: true,
        readiness_reason: readinessReason || null,
      },
    };
  }

  const { data: approval, error } = await admin
    .from('autonomous_runner_approvals')
    .insert({
      tenant_id: tenantId,
      run_id: null,
      action_key: `${source}:${toolName}`,
      risk_level: riskClass === 'bulk' || riskClass === 'financial' ? 'high' : 'medium',
      confidence_score: 70,
      status: 'pending',
      source: 'autonomous_runner',
      workflow_id: workflowId || null,
      conversation_id: conversationId || null,
      reason:
        readinessReason ||
        `${source.toUpperCase()} requested "${toolName}" (${riskClass}) — approval required by policy.`,
      payload: {
        source,
        tool_name: toolName,
        tool: toolName,
        args,
        user_id: userId,
        risk_class: riskClass,
        agent_mode: agentMode,
        instruction: instruction || undefined,
        workflow_id: workflowId || undefined,
        conversation_id: conversationId || undefined,
        preview: {
          target: String(
            args.to || args.recipient || args.email || args.phone || args.client_id || ''
          ).slice(0, 500) || undefined,
          draft: String(
            args.body || args.message || args.content || args.text || args.subject || args.html || ''
          ).slice(0, 2000) || undefined,
        },
      },
    })
    .select('id')
    .single();

  if (error) {
    console.error('[ToolPolicyGate] approval insert failed:', error.message);
    return {
      outcome: 'deny',
      riskClass,
      reason: `Approval queue unavailable: ${error.message}. Action blocked to avoid unsupervised execution.`,
    };
  }

  return {
    outcome: 'queue_approval',
    riskClass,
    reason: `Action queued for approval (ID: ${approval?.id}). Use list_pending_approvals / approve_pending_action or the Approval Center.`,
    approvalId: approval?.id,
    sourcePolicy: 'approval_required',
    approvalState: 'queued',
    policyAttributes: {
      ...policyAttributes,
      approval_id: approval?.id,
    },
  };
}
