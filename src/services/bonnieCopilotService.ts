/**
 * Client wrapper for Bonnie tool execution via /api/bonnie/tool (ToolPolicyGate enforced).
 */

export type BonnieCopilotResult = {
  success: boolean;
  text?: string;
  summary?: string;
  approvalRequired?: boolean;
  approvalId?: string;
  error?: string;
};

function parseApprovalId(details?: string): string | undefined {
  if (!details) return undefined;
  const match = details.match(/Approval ID:\s*([a-f0-9-]+)/i);
  return match?.[1];
}

export async function executeBonnieCopilotTool(params: {
  tenantId: string;
  tool: string;
  args?: Record<string, unknown>;
  policySource?: 'bonnie' | 'mcp' | 'playbook';
}): Promise<BonnieCopilotResult> {
  const res = await fetch('/api/bonnie/tool', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(params),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { success: false, error: data.error || 'Tool request failed' };
  }

  const result = data.result || {};
  const approvalRequired = String(result.summary || '').includes('Approval required');
  return {
    success: Boolean(result.success),
    text: result.details || result.summary,
    summary: result.summary,
    approvalRequired,
    approvalId: parseApprovalId(result.details),
    error: result.success ? undefined : result.summary,
  };
}

export async function draftTicketReply(params: {
  tenantId: string;
  title: string;
  description: string;
  priority: string;
  conversationSnippet: string;
}): Promise<BonnieCopilotResult> {
  const prompt = `Draft a professional, empathetic response to this support ticket.

TICKET TITLE: ${params.title}
DESCRIPTION: ${params.description}
PRIORITY: ${params.priority}
RECENT CONVERSATION:
${params.conversationSnippet || 'No messages yet.'}`;

  return executeBonnieCopilotTool({
    tenantId: params.tenantId,
    tool: 'draft_reply',
    args: { prompt },
  });
}

export async function summarizeTicket(params: {
  tenantId: string;
  title: string;
  description: string;
  conversationSnippet: string;
}): Promise<BonnieCopilotResult> {
  const prompt = `Summarize this support ticket in 3 bullet points for the assigned agent.

TICKET TITLE: ${params.title}
DESCRIPTION: ${params.description}
CONVERSATION:
${params.conversationSnippet || 'No messages yet.'}`;

  return executeBonnieCopilotTool({
    tenantId: params.tenantId,
    tool: 'summarize_ticket',
    args: { prompt },
  });
}

export async function generateOutreachDraft(params: {
  tenantId: string;
  prompt: string;
}): Promise<BonnieCopilotResult> {
  return executeBonnieCopilotTool({
    tenantId: params.tenantId,
    tool: 'generate_outreach_draft',
    args: { prompt: params.prompt },
  });
}

export async function runModuleIntelligenceAction(params: {
  tenantId: string;
  moduleKey: string;
  actionText: string;
}): Promise<BonnieCopilotResult> {
  const toolMap: Record<string, string> = {
    customerSuccess: 'solo_owner_operator_brief',
    aiProposals: 'recommend_next_steps',
    invoicingRevenue: 'accounting_snapshot',
    marketing: 'campaign_diagnose',
    default: 'summarize_workspace',
  };
  const tool = toolMap[params.moduleKey] || toolMap.default;
  return executeBonnieCopilotTool({
    tenantId: params.tenantId,
    tool,
    args: { module: params.moduleKey, action_hint: params.actionText },
  });
}
