import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import {
  DEFAULT_BUSINESS_AI_STATE,
  mergeBusinessAIState,
  type BusinessAIState,
} from '@/services/mcp/businessAIState';
import { isConnectorAutopilotEnabled } from '@/lib/ai/resolveEffectiveAgentMode';

/**
 * Initial MCP session AI policy — respects tenant Sovereign Autopilot settings
 * so Claude/ChatGPT connectors are not stuck in act_with_approval by default.
 */
export async function getInitialBusinessAIStateForTenant(
  tenantId: string
): Promise<BusinessAIState> {
  const admin = createSupabaseAdminClient();
  const { data: rules } = await admin
    .from('autonomous_runner_rules')
    .select('auto_send_enabled, high_risk_approval_required')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (isConnectorAutopilotEnabled(rules)) {
    return mergeBusinessAIState(DEFAULT_BUSINESS_AI_STATE, { agent_mode: 'autonomous' });
  }
  return DEFAULT_BUSINESS_AI_STATE;
}
