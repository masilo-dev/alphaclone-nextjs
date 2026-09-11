import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { mcpStore } from '@/services/mcp/mcpStore';
import type { BusinessAIAgentMode } from '@/services/mcp/businessAIState';
import { resolveEffectiveAgentMode } from '@/lib/ai/resolveEffectiveAgentMode';
import { evaluateBusinessAIState } from '@/services/mcp/businessAIState';
import { notificationService } from '@/services/notificationService';
import crypto from 'crypto';

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
export type PolicySource = 'bonnie' | 'mcp' | 'playbook';
export type PolicyOutcome = 'allow' | 'queue_approval' | 'deny';

export type PolicyDecision = {
  outcome: PolicyOutcome;
  riskClass: ToolRiskClass;
  reason: string;
  approvalId?: string;
  isDuplicate?: boolean;
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
  'nexus_invoice_chasing',
]);

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
  if (name.startsWith('bulk_') || name.includes('_bulk') || name === 'bulk_update') return 'bulk';
  if (FINANCIAL_TOOLS.has(name)) return 'financial';
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

  // ChatGPT / Claude MCP connectors: authenticated connector user already issued
  // the command. Auto-execute — do not block on DPA or approval queues.
  // In-app Bonnie continues through the policy path below (reads/drafts still
  // execute immediately; send / bulk / financial follow workspace mode).
  if (source === 'mcp') {
    return {
      outcome: 'allow',
      riskClass,
      reason: 'MCP connector auto-approves tool execution.',
    };
  }

  const admin = createSupabaseAdminClient();

  // 1. Hourly Idempotency Check
  const payloadString = JSON.stringify(args || {});
  const hourBucket = new Date().toISOString().substring(0, 13); // "YYYY-MM-DDTHH"
  const idempotencyString = `${toolName}:${tenantId}:${payloadString}:${hourBucket}`;
  const idempotencyHash = crypto.createHash('sha256').update(idempotencyString).digest('hex');

  const { data: existingApp } = await admin
    .from('autonomous_runner_approvals')
    .select('id, status')
    .eq('tenant_id', tenantId)
    .eq('action_key', `${source}:${toolName}`)
    .eq('payload->>idempotency_hash', idempotencyHash)
    .limit(1);

  if (existingApp && existingApp.length > 0 && ['executed', 'approved'].includes(existingApp[0].status)) {
    return {
      outcome: 'allow',
      riskClass,
      reason: `Policy bypassed: Action already executed within the current hourly bucket (idempotent check). Hash: ${idempotencyHash}`,
      isDuplicate: true,
    };
  }

  const [{ data: rulesRow }, aiState] = await Promise.all([
    admin
      .from('autonomous_runner_rules')
      .select('high_risk_approval_required, auto_send_enabled')
      .eq('tenant_id', tenantId)
      .maybeSingle(),
    mcpStore.getBusinessAIState(tenantId, userId),
  ]);

  const highRiskRequired = rulesRow?.high_risk_approval_required !== false;
  // Default workspace mode to autonomous if rules enable it, else resolve
  const agentMode = resolveEffectiveAgentMode(aiState.agent_mode || 'autonomous', rulesRow);

  // 2. Classify into Tiers 1-4
  let tier: 1 | 2 | 3 | 4 = 1;

  if (HIGH_RISK_CONFIRM_TOOLS.has(toolName.toLowerCase())) {
    tier = 4; // Hard confirm
  } else if (riskClass === 'bulk' || riskClass === 'financial') {
    tier = 3; // Auto + reversible delay
  } else if (riskClass === 'send') {
    tier = 2; // Auto + notify
  } else {
    tier = 1; // Auto (read/draft)
  }

  // Tier 1: Executes immediately, logged only
  if (tier === 1) {
    // Log as executed in the approvals table for idempotency tracking
    await admin
      .from('autonomous_runner_approvals')
      .insert({
        tenant_id: tenantId,
        action_key: `${source}:${toolName}`,
        risk_level: 'low',
        confidence_score: 100,
        status: 'executed',
        reason: `Tier 1 Auto-executed: ${toolName}.`,
        payload: {
          source,
          tool_name: toolName,
          args,
          user_id: userId,
          idempotency_hash: idempotencyHash,
          tier,
        },
      })
      .catch(() => {});

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
      if (process.env.MCP_AUTO_EXECUTE !== 'true') {
        needsApproval = true;
        readinessReason = `Readiness gate: workspace recommends "${evaluation.recommended_mode}" (score ${evaluation.readiness_score}). ${evaluation.reasons[0] || 'Improve reliability before autonomous execution.'}`;
      }
    }
    return { outcome: 'allow', riskClass, reason: 'Tier 2 Policy allows execution with active notification.' };
  }

  // Tier 3 or 4: Must queue approval with specific risk levels and custom statuses
  const isTier4 = tier === 4;
  const riskLevel = isTier4 ? 'high' : 'medium';

  const { data: approval, error } = await admin
    .from('autonomous_runner_approvals')
    .insert({
      tenant_id: tenantId,
      run_id: null,
      action_key: `${source}:${toolName}`,
      risk_level: riskLevel,
      confidence_score: isTier4 ? 50 : 85, // Tier 4 always starts with lower auto-approve confidence so it requires hard confirm
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
  };
}
