import type { UnifiedMcpTool } from '@/lib/mcp/listAllTools';
import { inferToolAnnotations } from '@/lib/mcp/toolAnnotations';
import { moduleForTool } from '@/lib/mcp/progressiveDiscovery';
import {
  integrationAvailable,
  integrationDependencyForTool,
  type TenantIntegrationSnapshot,
} from '@/services/integrationStatusService';
import type { ConnectorPermission } from '@/lib/mcp/connector/types';

export type CapabilityTier =
  | 'read'
  | 'draft'
  | 'reversible_write'
  | 'external_write'
  | 'high_risk';

export type ToolCapabilityMeta = {
  module: string;
  read_or_write: 'read' | 'write';
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  capability_tier: CapabilityTier;
  agent_policy: string;
  permission: string;
  integration_dependency: string | null;
  integration_available: boolean;
  integration_block_reason: string | null;
  executable: boolean;
  requires_confirmation: boolean;
  requires_target: boolean;
  requires_receipt: boolean;
  supports_dry_run: boolean;
};

const WRITE_PATTERN =
  /^(create|update|delete|send|publish|upload|queue|approve|reject|schedule|run|stop|restart|mark|convert|assign|complete|launch|pause|resume|cancel|void|pay)/;

const PERMISSION_BY_MODULE: Record<string, ConnectorPermission> = {
  crm: 'crm:write',
  leads: 'crm:write',
  contacts: 'crm:write',
  companies: 'crm:write',
  email: 'email:send',
  social: 'social:publish',
  documents: 'documents:write',
  calendar: 'calendar:write',
  finance: 'accounting:write',
  workflows: 'bonnie:execute',
  admin: 'platform:admin',
};

function classifyCapabilityTier(
  toolName: string,
  readOrWrite: 'read' | 'write',
  risk: ToolCapabilityMeta['risk_level']
): CapabilityTier {
  if (readOrWrite === 'read') return 'read';
  if (risk === 'critical') return 'high_risk';
  if (/^(delete|remove|destroy|purge)_/.test(toolName)) return 'high_risk';
  if (/(send|publish|post_to|queue_email)/.test(toolName)) return 'external_write';
  if (/^(create|update|schedule)_/.test(toolName) && risk !== 'high') return 'draft';
  if (/^(update|assign|mark|convert)_/.test(toolName)) return 'reversible_write';
  return readOrWrite === 'write' ? 'reversible_write' : 'read';
}

function agentPolicyForTier(tier: CapabilityTier): string {
  switch (tier) {
    case 'read':
      return 'Execute freely — no side effects.';
    case 'draft':
      return 'Execute with logging — creates non-final records.';
    case 'reversible_write':
      return 'Execute when intent is clear; prefer confirmation for bulk changes.';
    case 'external_write':
      return 'Require exact target + idempotency_key; verify receipt after success.';
    case 'high_risk':
      return 'Requires explicit human approval before execution.';
    default: {
      const _exhaustive: never = tier;
      return String(_exhaustive);
    }
  }
}

function classifyRisk(toolName: string): ToolCapabilityMeta['risk_level'] {
  const annotations = inferToolAnnotations(toolName);
  if (annotations.destructiveHint || /^(delete|remove|destroy|purge|restart|stop)_/.test(toolName)) {
    return 'critical';
  }
  if (/(bulk|campaign|send|publish|invoice|payment|run_workflow)/.test(toolName)) {
    return 'high';
  }
  if (!annotations.readOnlyHint || annotations.openWorldHint) return 'medium';
  return 'low';
}

function permissionForTool(toolName: string): string {
  const module = moduleForTool(toolName);
  if (!WRITE_PATTERN.test(toolName) && /^(get|list|search|fetch|inspect|read|status|health)/.test(toolName)) {
    if (module === 'email') return 'email:read';
    if (module === 'social') return 'social:read';
    if (module === 'documents') return 'documents:read';
    if (module === 'calendar') return 'calendar:read';
    if (module === 'finance') return 'accounting:read';
    if (/crm|lead|contact|compan/.test(module)) return 'crm:read';
    return 'platform:read';
  }
  return PERMISSION_BY_MODULE[module] || 'platform:read';
}

export function buildToolCapabilityMeta(
  tool: UnifiedMcpTool,
  options?: {
    integrationSnapshot?: TenantIntegrationSnapshot | null;
    executable?: boolean;
  }
): ToolCapabilityMeta {
  const annotations = inferToolAnnotations(tool.name);
  const readOrWrite =
    annotations.readOnlyHint && !annotations.openWorldHint ? 'read' : 'write';
  const integrationDependency = integrationDependencyForTool(tool.name);
  const integrationCheck = options?.integrationSnapshot
    ? integrationAvailable(options.integrationSnapshot, integrationDependency)
    : { available: true, reason: null };
  const risk = classifyRisk(tool.name);
  const capabilityTier = classifyCapabilityTier(tool.name, readOrWrite, risk);

  return {
    module: moduleForTool(tool.name),
    read_or_write: readOrWrite,
    risk_level: risk,
    capability_tier: capabilityTier,
    agent_policy: agentPolicyForTier(capabilityTier),
    permission: permissionForTool(tool.name),
    integration_dependency: integrationDependency,
    integration_available: integrationCheck.available,
    integration_block_reason: integrationCheck.reason,
    executable: options?.executable ?? true,
    requires_confirmation: capabilityTier === 'high_risk' || risk === 'critical',
    requires_target: capabilityTier === 'external_write',
    requires_receipt: capabilityTier === 'external_write',
    supports_dry_run:
      tool.name === 'preflight_social_publish' ||
      tool.name === 'check_mcp_execution_readiness' ||
      /dry_run|preflight/.test(tool.name),
  };
}

/** Enrich discovery tools with capability metadata — never hide tools from catalog. */
export function enrichToolsWithCapabilityMeta(
  tools: UnifiedMcpTool[],
  options?: {
    integrationSnapshot?: TenantIntegrationSnapshot | null;
    executableNames?: Set<string>;
  }
): UnifiedMcpTool[] {
  return tools.map((tool) => {
    const capability = buildToolCapabilityMeta(tool, {
      integrationSnapshot: options?.integrationSnapshot,
      executable: options?.executableNames ? options.executableNames.has(tool.name) : true,
    });
    return {
      ...tool,
      _meta: {
        ...(tool._meta || {}),
        'alphaclone/capability': capability,
      },
    };
  });
}
