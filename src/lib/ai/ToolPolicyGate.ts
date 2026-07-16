import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { mcpStore } from '@/services/mcp/mcpStore';
import type { BusinessAIAgentMode } from '@/services/mcp/businessAIState';
import { resolveEffectiveAgentMode } from '@/lib/ai/resolveEffectiveAgentMode';
import { evaluateBusinessAIState } from '@/services/mcp/businessAIState';
import { notificationService } from '@/services/notificationService';
import crypto from 'crypto';

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
  'create_linkedin_post',
  'create_social_post',
  'create_post_with_ai_image',
]);

const META_ORCHESTRATION_TOOLS = new Set([
  'run_chief_of_staff_routine',
  'orchestrate_task',
  'run_autonomous_scan',
  'run_playbook',
  'trigger_bonnie_dream',
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
]);

const TENANT_INTERNAL_TOOLS = new Set([
  'draft_reply',
  'summarize_ticket',
  'generate_outreach_draft',
  'summarize_workspace',
  'get_account_overview',
  'find_and_qualify_leads',
  'parse_lead_criteria',
  'qualify_crm_leads',
  'get_scraper_leads',
  'get_customer_360',
  'get_integration_health',
  'get_proactive_brief',
  'list_scraper_campaigns',
  'run_scraper_campaign',
  'create_scraper_campaign',
  'search_email_lead_context',
  'ingest_content_to_lead',
  'get_autonomous_rules',
  'search_facebook_leads',
  'run_autonomous_scan',
  'list_skills',
  'load_skill',
  'activate_skill_for_session',
  ...META_ORCHESTRATION_TOOLS,
]);

// Tier 4 High-Risk Tools requiring strict manual confirmation
const HIGH_RISK_CONFIRM_TOOLS = new Set([
  'record_payment',
  'delete_invoice',
  'delete_client',
  'delete_lead',
  'delete_task',
  'account_deletion',
  'send_contract_to_client',
]);

function classifyTool(toolName: string): ToolRiskClass {
  const name = toolName.toLowerCase();
  if (TENANT_INTERNAL_TOOLS.has(name)) return 'read';
  if (name.startsWith('bulk_') || name.includes('_bulk') || name === 'bulk_update') return 'bulk';
  if (FINANCIAL_TOOLS.has(name)) return 'financial';
  if (SEND_TOOLS.has(name)) return 'send';
  if (DRAFT_TOOLS.has(name) || name.includes('draft')) return 'draft';
  if (name.startsWith('get_') || name.startsWith('list_') || name.startsWith('search_') || name.startsWith('fetch_')) {
    return 'read';
  }
  if (name.startsWith('create_') || name.startsWith('update_') || name.startsWith('delete_')) return 'draft';
  return 'read';
}

export async function evaluateToolPolicy(params: {
  tenantId: string;
  userId: string;
  toolName: string;
  source: PolicySource;
  args?: Record<string, unknown>;
  instruction?: string;
}): Promise<PolicyDecision> {
  const { tenantId, userId, toolName, source, args = {}, instruction } = params;
  const riskClass = classifyTool(toolName);
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
    admin.from('autonomous_runner_rules').select('high_risk_approval_required, auto_send_enabled').eq('tenant_id', tenantId).maybeSingle(),
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

    return { outcome: 'allow', riskClass, reason: 'Tier 1 Policy allows immediate execution.' };
  }

  // Tier 2: Executes immediately, pushes dashboard notification
  if (tier === 2) {
    // Log as executed in the approvals table for idempotency tracking
    await admin
      .from('autonomous_runner_approvals')
      .insert({
        tenant_id: tenantId,
        action_key: `${source}:${toolName}`,
        risk_level: 'low',
        confidence_score: 100,
        status: 'executed',
        reason: `Tier 2 Auto-executed: ${toolName}.`,
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

    try {
      if (userId) {
        await notificationService.sendNotification({
          userId,
          type: 'system',
          title: `Autonomous Action: ${toolName}`,
          message: `Executed autonomously under Tier 2. Action: ${toolName}. Purpose: ${instruction || 'routine operational task'}.`,
          priority: 'low',
          metadata: { toolName, args },
        });
      }
    } catch (err) {
      console.warn('[ToolPolicyGate] Notification delivery skipped:', err);
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
      reason: `${source.toUpperCase()} requested "${toolName}" (${riskClass}) — Tier ${tier} approval gate triggered.`,
      payload: {
        source,
        tool_name: toolName,
        args,
        user_id: userId,
        risk_class: riskClass,
        agent_mode: agentMode,
        instruction: instruction || undefined,
        idempotency_hash: idempotencyHash,
        tier,
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
    reason: `Tier ${tier} action queued for approval (ID: ${approval?.id}).`,
    approvalId: approval?.id,
  };
}
