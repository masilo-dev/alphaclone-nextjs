import type { BusinessAIAgentMode } from '@/services/mcp/businessAIState';

type RunnerRulesRow = {
  auto_send_enabled?: boolean | null;
  high_risk_approval_required?: boolean | null;
} | null;

/**
 * Tenant runner rules override session defaults so Claude/ChatGPT/Manus MCP
 * connectors can execute sends without dashboard approval when autopilot is on.
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

export function isConnectorAutopilotEnabled(rules: RunnerRulesRow): boolean {
  return rules?.auto_send_enabled === true && rules?.high_risk_approval_required === false;
}
