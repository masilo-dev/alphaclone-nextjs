export type ToolLifecycle = 'stable' | 'legacy_alias' | 'experimental';

export type ToolGovernance = {
  canonicalName: string;
  lifecycle: ToolLifecycle;
  module: string;
  deprecated: boolean;
  replacement: string | null;
};

/**
 * Compatibility aliases remain executable, but discovery marks their canonical
 * replacement. Removing an entry requires a separately announced migration.
 */
export const MCP_TOOL_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  compare_versions: 'compare_document_versions',
  create_post: 'publish_social_post',
  create_linkedin_post: 'publish_social_post',
  email_send: 'send_email',
  execute_action: 'dispatch_tool',
  get_clients: 'get_contacts',
  get_post_analytics: 'get_social_post_insights',
  get_post_status: 'verify_social_post_published',
  gmail_send: 'send_email',
  list_leads: 'get_leads',
  post_to_facebook: 'publish_social_post',
  post_to_linkedin: 'publish_social_post',
  post_to_social: 'publish_social_post',
  publish_now: 'publish_social_post',
  publish_post: 'publish_social_post',
  retrieve_document: 'get_document',
  run_playbook: 'run_workflow',
  schedule_post: 'schedule_social_post',
  schedule_social: 'schedule_social_post',
  send_mail: 'send_email',
  social_post: 'publish_social_post',
  write_email: 'send_email',
});

const EXPERIMENTAL_PREFIXES = ['nexus_', 'dream_', 'autonomous_'];

/** Resolve compatibility aliases before registry lookup (case-insensitive). */
export function resolveMcpToolName(toolName: string | null | undefined): string {
  const trimmed = String(toolName || '').trim();
  if (!trimmed) return '_unknown_tool';
  const lower = trimmed.toLowerCase();
  for (const [alias, canonical] of Object.entries(MCP_TOOL_ALIASES)) {
    if (alias.toLowerCase() === lower) return canonical;
  }
  return trimmed;
}

export function getToolGovernance(name: string, module = 'workspace'): ToolGovernance {
  const replacement = MCP_TOOL_ALIASES[name] || null;
  const experimental = EXPERIMENTAL_PREFIXES.some((prefix) => name.startsWith(prefix));
  return {
    canonicalName: replacement || name,
    lifecycle: replacement ? 'legacy_alias' : experimental ? 'experimental' : 'stable',
    module,
    deprecated: Boolean(replacement),
    replacement,
  };
}

export function withGovernanceDescription(name: string, description: string): string {
  const governance = getToolGovernance(name);
  if (!governance.deprecated) return description;
  return `[Deprecated compatibility alias; use ${governance.replacement}.] ${description}`;
}
