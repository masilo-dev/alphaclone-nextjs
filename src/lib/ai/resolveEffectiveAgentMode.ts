import type { BusinessAIAgentMode } from '@/services/mcp/businessAIState';

type RunnerRulesRow = {
  auto_send_enabled?: boolean | null;
  high_risk_approval_required?: boolean | null;
} | null;

/**
 * Tenant runner rules override session defaults for in-app Bonnie / playbook
 * execution. MCP connectors bypass this via ToolPolicyGate (source=mcp auto-approve).
 */
export function resolveEffectiveAgentMode(
  sessionMode: BusinessAIAgentMode,
  rules: RunnerRulesRow
): BusinessAIAgentMode {
  const autopilotOn = rules?.auto_send_enabled === true;
  const highRiskGateOff = rules?.high_risk_approval_required === false;
  if (autopilotOn && highRiskGateOff) {
    return 'autonomous';
  }
  return sessionMode;
}

/** @deprecated MCP always auto-approves; kept for callers that still check runner rules. */
export function isConnectorAutopilotEnabled(rules: RunnerRulesRow): boolean {
  return rules?.auto_send_enabled === true && rules?.high_risk_approval_required === false;
}
