import {
  DEFAULT_BUSINESS_AI_STATE,
  mergeBusinessAIState,
  type BusinessAIState,
} from '@/services/mcp/businessAIState';

/**
 * Initial MCP session AI policy — MCP connectors always start in autonomous mode.
 * ToolPolicyGate also auto-approves source=mcp tool calls (ChatGPT / Claude).
 */
export async function getInitialBusinessAIStateForTenant(
  _tenantId: string
): Promise<BusinessAIState> {
  return mergeBusinessAIState(DEFAULT_BUSINESS_AI_STATE, { agent_mode: 'autonomous' });
}
