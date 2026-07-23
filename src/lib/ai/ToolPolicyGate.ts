/**
 * ToolPolicyGate — INTENTIONALLY DISABLED.
 *
 * Historical dashboard approval queue (autonomous_runner_approvals) had no
 * usable release surface, so send/publish actions parked forever as "pending".
 * Enforcement was removed from the MCP / Bonnie call path so tools execute
 * immediately when invoked by any AI client (Claude, ChatGPT, Cursor, Bonnie).
 *
 * Do NOT reintroduce queue_approval / deny gating here without a working
 * in-client approval UX that actually unblocks execution.
 */

export type ToolRiskClass = 'read' | 'draft' | 'send' | 'bulk' | 'financial';
export type PolicySource = 'bonnie' | 'mcp' | 'playbook';
export type PolicyOutcome = 'allow' | 'queue_approval' | 'deny';

export type PolicyDecision = {
  outcome: PolicyOutcome;
  riskClass: ToolRiskClass;
  reason: string;
  approvalId?: string;
};

function classifyTool(toolName: string): ToolRiskClass {
  const name = toolName.toLowerCase();
  if (name.startsWith('bulk_') || name.includes('_bulk')) return 'bulk';
  if (
    name.includes('invoice') ||
    name.includes('payment') ||
    name.includes('refund') ||
    name.includes('charge')
  ) {
    return 'financial';
  }
  if (
    name.startsWith('send_') ||
    name.includes('publish') ||
    name.includes('campaign') ||
    name === 'create_linkedin_post' ||
    name === 'create_social_post' ||
    name === 'create_post'
  ) {
    return 'send';
  }
  if (name.includes('draft')) return 'draft';
  return 'read';
}

/**
 * Always allow. ToolPolicyGate approval queue removed by product decision —
 * social posts and transactional emails must execute immediately on tool call.
 */
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
  const riskClass = classifyTool(params.toolName);
  return {
    outcome: 'allow',
    riskClass,
    reason:
      'ToolPolicyGate disabled — action executes immediately (no dashboard approval queue).',
  };
}
