import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { mcpStore } from '@/services/mcp/mcpStore';
import type { BusinessAIAgentMode } from '@/services/mcp/businessAIState';
import { resolveEffectiveAgentMode } from '@/lib/ai/resolveEffectiveAgentMode';

export type ToolRiskClass = 'read' | 'draft' | 'send' | 'bulk' | 'financial';
export type PolicySource = 'bonnie' | 'mcp' | 'playbook';
export type PolicyOutcome = 'allow' | 'queue_approval' | 'deny';

export type PolicyDecision = {
  outcome: PolicyOutcome;
  riskClass: ToolRiskClass;
  reason: string;
  approvalId?: string;
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

function modeBlocksExecution(mode: BusinessAIAgentMode, riskClass: ToolRiskClass): boolean {
  if (riskClass === 'read' || riskClass === 'draft') return false;
  if (mode === 'observe') return true;
  // draft mode queues high-risk actions instead of hard-blocking (power-agent UX)
  return false;
}

function requiresApproval(mode: BusinessAIAgentMode, riskClass: ToolRiskClass, highRiskRequired: boolean): boolean {
  if (riskClass === 'read') return false;
  if (riskClass === 'draft') return mode === 'observe';
  if (mode === 'autonomous' && !highRiskRequired) return false;
  if (mode === 'autonomous' && highRiskRequired && (riskClass === 'send' || riskClass === 'bulk' || riskClass === 'financial')) {
    return true;
  }
  return mode === 'draft' || mode === 'act_with_approval' || riskClass === 'send' || riskClass === 'bulk' || riskClass === 'financial';
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

  const [{ data: rulesRow }, aiState] = await Promise.all([
    admin.from('autonomous_runner_rules').select('high_risk_approval_required, auto_send_enabled').eq('tenant_id', tenantId).maybeSingle(),
    mcpStore.getBusinessAIState(tenantId, userId),
  ]);

  const highRiskRequired = rulesRow?.high_risk_approval_required !== false;
  const agentMode = resolveEffectiveAgentMode(aiState.agent_mode, rulesRow);

  if (modeBlocksExecution(agentMode, riskClass)) {
    return {
      outcome: 'deny',
      riskClass,
      reason: `Agent mode "${agentMode}" blocks ${riskClass} actions for tool "${toolName}".`,
    };
  }

  const needsApproval = requiresApproval(agentMode, riskClass, highRiskRequired);

  if (!needsApproval) {
    return { outcome: 'allow', riskClass, reason: 'Policy allows execution.' };
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
      reason: `${source.toUpperCase()} requested "${toolName}" (${riskClass}) — approval required by policy.`,
      payload: {
        source,
        tool_name: toolName,
        args,
        user_id: userId,
        risk_class: riskClass,
        agent_mode: agentMode,
        instruction: instruction || undefined,
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
    reason: `Action queued for approval (ID: ${approval?.id}).`,
    approvalId: approval?.id,
  };
}
