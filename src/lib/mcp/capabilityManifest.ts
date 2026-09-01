/**
 * Capability negotiation for any MCP-compatible AI client.
 * Core business logic lives in services — not in model-specific adapters.
 */

import { MCP_PROTOCOL_VERSION, MCP_TOOL_CATALOG_VERSION } from './standardResponse';
import { isDurableRuntimeEnabled } from '@/lib/bonnie/runtime/types';

export type ApprovalType = 'none' | 'normal' | 'strong';

export type ConnectedIntegration = {
  provider: string;
  status: 'connected' | 'disconnected' | 'degraded' | 'unknown';
  capabilities?: string[];
};

export type CapabilityManifest = {
  protocol_version: string;
  tool_catalog_version: string;
  available_tools: string[];
  required_scopes: string[];
  supported_approval_types: ApprovalType[];
  connected_integrations: ConnectedIntegration[];
  enabled_tenant_features: string[];
  provider_availability: Record<string, 'available' | 'unavailable' | 'sandbox'>;
  mode: 'sandbox' | 'production' | 'dry_run';
  supported_clients: string[];
  workflow_states: string[];
  execution_tiers: Array<{
    tier: 'read' | 'draft' | 'reversible_write' | 'external_write' | 'high_risk';
    agent_policy: string;
  }>;
  durable_runtime_enabled: boolean;
};

export const WORKFLOW_STATES = [
  'queued',
  'running',
  'awaiting_approval',
  'partially_completed',
  'completed',
  'failed',
  'cancelled',
] as const;

export const SUPPORTED_AI_CLIENTS = [
  'chatgpt',
  'claude',
  'cursor',
  'gemini',
  'deepseek',
  'openai_api',
  'anthropic_api',
  'bonnie',
  'generic_mcp',
] as const;

export function buildCapabilityManifest(input: {
  availableTools: string[];
  connectedIntegrations?: ConnectedIntegration[];
  enabledFeatures?: string[];
  providerAvailability?: Record<string, 'available' | 'unavailable' | 'sandbox'>;
  testMode?: boolean;
}): CapabilityManifest {
  const mode = process.env.TEST_MODE === 'true' || input.testMode
    ? 'sandbox'
    : process.env.MCP_DRY_RUN === 'true'
      ? 'dry_run'
      : 'production';

  return {
    protocol_version: MCP_PROTOCOL_VERSION,
    tool_catalog_version: MCP_TOOL_CATALOG_VERSION,
    available_tools: input.availableTools,
    required_scopes: ['read', 'write', 'approvals'],
    supported_approval_types: ['none', 'normal', 'strong'],
    connected_integrations: input.connectedIntegrations || [],
    enabled_tenant_features: input.enabledFeatures || [],
    provider_availability: input.providerAvailability || {},
    mode,
    supported_clients: [...SUPPORTED_AI_CLIENTS],
    workflow_states: [...WORKFLOW_STATES],
    durable_runtime_enabled: isDurableRuntimeEnabled(),
    execution_tiers: [
      { tier: 'read', agent_policy: 'Execute freely — no side effects.' },
      { tier: 'draft', agent_policy: 'Execute with logging — creates non-final records.' },
      {
        tier: 'reversible_write',
        agent_policy: 'Execute when intent is clear; prefer confirmation for bulk changes.',
      },
      {
        tier: 'external_write',
        agent_policy: 'Require exact target + idempotency_key; verify receipt after success.',
      },
      { tier: 'high_risk', agent_policy: 'Requires explicit human approval before execution.' },
    ],
  };
}

/** Risk classes for portable approvals across all MCP clients. */
export function classifyActionRisk(toolOrAction: string): ApprovalType {
  const name = toolOrAction.toLowerCase();
  if (
    /^(refund|charge|delete_|accept_legal|change_permission|restart_)/.test(name) ||
    /(refund|delete_lead|delete_post|revoke|destroy)/.test(name)
  ) {
    return 'strong';
  }
  if (
    /(send_|publish_|schedule_post|send_invoice|send_campaign|send_for_signature|create_event|invite)/.test(
      name
    ) ||
    name === 'send_outreach' ||
    name === 'publish_now' ||
    name === 'send_transactional_email'
  ) {
    return 'normal';
  }
  return 'none';
}
