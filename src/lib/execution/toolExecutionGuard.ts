import {
  evaluateToolPolicy,
  type PolicyDecision,
  type PolicySource,
} from '@/lib/ai/ToolPolicyGate';
import { structuredErrorToMcpContent } from '@/lib/mcp/formatMcpError';
import type { MCPToolExecutionResult } from '@/types/mcp';

import { capabilityRequiresIdempotencyKey } from '@/lib/execution/domainCapabilityGuard';

const WRITE_TOOL_PATTERN =
  /^(create|update|delete|send|publish|upload|queue|approve|reject|schedule|run|convert|assign|complete|cancel|void|promote)_/;

export type ToolExecutionGuardOptions = {
  executionSource: PolicySource;
  skipPolicyEvaluation?: boolean;
};

export type ToolExecutionGuardResult =
  | { allowed: true; policy: PolicyDecision | null }
  | { allowed: false; mcpResult: MCPToolExecutionResult; policy: PolicyDecision | null };

export async function guardToolExecution(params: {
  tenantId: string;
  userId: string;
  toolName: string;
  args: Record<string, unknown>;
  options: ToolExecutionGuardOptions;
}): Promise<ToolExecutionGuardResult> {
  const { tenantId, userId, toolName, args, options } = params;
  let policy: PolicyDecision | null = null;

  if (!options.skipPolicyEvaluation) {
    policy = await evaluateToolPolicy({
      tenantId,
      userId,
      toolName,
      source: options.executionSource,
      args,
    });

    if (policy.outcome === 'deny') {
      return {
        allowed: false,
        policy,
        mcpResult: structuredErrorToMcpContent({
          ok: false,
          tool: toolName,
          data: null,
          receipt: null,
          error: {
            code: 'POLICY_BLOCKED',
            message: policy.reason,
            retryable: false,
            details: { risk_class: policy.riskClass, source: options.executionSource },
          },
          meta: { policy_attributes: policy.policyAttributes },
        }),
      };
    }

    if (policy.outcome === 'queue_approval') {
      return {
        allowed: false,
        policy,
        mcpResult: {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  ok: false,
                  tool: toolName,
                  queued_for_approval: true,
                  approval_id: policy.approvalId,
                  risk_class: policy.riskClass,
                  message: policy.reason,
                  execution_truth: {
                    status: 'QUEUED',
                    verification_state: 'QUEUED',
                    approval_state: 'queued',
                    may_claim_completed: false,
                    user_message: policy.reason,
                  },
                },
                null,
                2
              ),
            },
          ],
        },
      };
    }
  }

  if (capabilityRequiresIdempotencyKey(toolName)) {
    const key = typeof args.idempotency_key === 'string' ? args.idempotency_key.trim() : '';
    if (!key) {
      return {
        allowed: false,
        policy,
        mcpResult: structuredErrorToMcpContent({
          ok: false,
          tool: toolName,
          data: null,
          receipt: null,
          error: {
            code: 'IDEMPOTENCY_REQUIRED',
            message:
              'idempotency_key is required for this external write. Reuse the same key when retrying after timeouts.',
            retryable: false,
          },
          meta: {},
        }),
      };
    }
  }

  return { allowed: true, policy };
}

export function isWriteToolName(toolName: string): boolean {
  return WRITE_TOOL_PATTERN.test(toolName.toLowerCase());
}
