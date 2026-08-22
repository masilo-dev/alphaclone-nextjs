import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { mcpStore } from '@/services/mcp/mcpStore';
import type { ToolRiskClass } from '@/lib/ai/ToolPolicyGate';

export type DecisionOutcome =
  | 'allowed'
  | 'denied'
  | 'queued_approval'
  | 'executed'
  | 'failed';

export type AlamosMetadata = {
  objective?: string;
  baseline?: string;
  probability?: number;
  cost?: number;
  risk?: string;
  bottleneck?: string;
  classification?: 'BUILD' | 'FIX' | 'SCALE' | 'KEEP' | 'SIMPLIFY' | 'TEST' | 'DEFER' | 'AUTOMATE' | 'REMOVE' | 'KILL';
};

export type RecordDecisionParams = {
  tenantId: string;
  userId?: string | null;
  sessionId?: string | null;
  instruction?: string;
  reasoning?: string;
  toolName: string;
  toolArgs?: Record<string, unknown>;
  outcome: DecisionOutcome;
  riskClass?: ToolRiskClass | string;
  approvalId?: string | null;
  proposedState?: Record<string, unknown> | null;
  counteredState?: Record<string, unknown> | null;
  acceptedState?: Record<string, unknown> | null;
  alamosMetadata?: AlamosMetadata | null;
};

export type NexusDecisionRow = {
  id: string;
  tenant_id: string;
  user_id: string | null;
  session_id: string | null;
  instruction: string | null;
  reasoning: string | null;
  tool_name: string;
  tool_args: Record<string, unknown>;
  outcome: DecisionOutcome;
  risk_class: string | null;
  approval_id: string | null;
  created_at: string;
};

export async function recordDecision(params: RecordDecisionParams): Promise<void> {
  try {
    const state = await mcpStore.getBusinessAIState(params.tenantId, params.userId);
    if (!state.audit?.record_decisions) return;

    const mergedToolArgs = {
      ...(params.toolArgs || {}),
      ...(params.proposedState || params.counteredState || params.acceptedState
        ? {
            negotiation_history: {
              proposed: params.proposedState || null,
              countered: params.counteredState || null,
              accepted: params.acceptedState || null,
            },
          }
        : {}),
      ...(params.alamosMetadata ? { alamos_metadata: params.alamosMetadata } : {}),
    };

    const admin = createSupabaseAdminClient();
    const { error } = await admin.from('nexus_decision_log').insert({
      tenant_id: params.tenantId,
      user_id: params.userId || null,
      session_id: params.sessionId || null,
      instruction: params.instruction?.slice(0, 2000) || null,
      reasoning: params.reasoning?.slice(0, 2000) || null,
      tool_name: params.toolName,
      tool_args: mergedToolArgs,
      outcome: params.outcome,
      risk_class: params.riskClass || null,
      approval_id: params.approvalId || null,
    });

    if (error) {
      console.warn('[nexusDecisionLog] insert failed:', error.message);
    }
  } catch (err) {
    console.warn('[nexusDecisionLog] recordDecision error:', err);
  }
}

export async function recordNegotiationDecision(params: {
  tenantId: string;
  userId?: string | null;
  dealId?: string;
  proposalId?: string;
  instruction: string;
  reasoning: string;
  proposedState: Record<string, unknown>;
  counteredState?: Record<string, unknown>;
  acceptedState?: Record<string, unknown>;
  alamosMetadata?: AlamosMetadata;
}): Promise<void> {
  await recordDecision({
    tenantId: params.tenantId,
    userId: params.userId,
    instruction: params.instruction,
    reasoning: params.reasoning,
    toolName: 'record_business_negotiation_decision',
    toolArgs: {
      deal_id: params.dealId || null,
      proposal_id: params.proposalId || null,
    },
    outcome: params.acceptedState ? 'executed' : params.counteredState ? 'queued_approval' : 'allowed',
    proposedState: params.proposedState,
    counteredState: params.counteredState || null,
    acceptedState: params.acceptedState || null,
    alamosMetadata: params.alamosMetadata || null,
  });
}

export async function getRecentDecisions(
  tenantId: string,
  hours = 72,
  limit = 100
): Promise<NexusDecisionRow[]> {
  const admin = createSupabaseAdminClient();
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  const { data, error } = await admin
    .from('nexus_decision_log')
    .select('*')
    .eq('tenant_id', tenantId)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.warn('[nexusDecisionLog] getRecentDecisions failed:', error.message);
    return [];
  }

  return (data || []) as NexusDecisionRow[];
}
