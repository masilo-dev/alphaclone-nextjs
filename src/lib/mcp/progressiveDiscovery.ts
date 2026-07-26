import type { UnifiedMcpTool } from './listAllTools';

export const CORE_TOOL_NAMES = new Set([
  'search', 'fetch', 'get_current_user', 'summarize_workspace',
  'get_system_health', 'get_platform_status', 'search_leads',
  'search_documents', 'list_files', 'create_task', 'list_tasks',
  'run_workflow', 'get_workflow_status', 'list_pending_approvals',
  'approve_action', 'reject_action', 'upload_media', 'get_media',
  'get_action_status', 'get_recent_errors', 'connected_accounts',
  'pipeline_status', 'appointments', 'revenue_report',
  'search_tools', 'list_tools', 'list_modules', 'list_capabilities',
  'load_module_tools', 'load_skill',
]);

export const MODULE_KEYWORDS: Record<string, string[]> = {
  crm: ['lead', 'contact', 'company', 'deal', 'pipeline', 'crm'],
  projects: ['project'],
  tasks: ['task'],
  documents: ['document', 'contract', 'file'],
  finance: ['invoice', 'account', 'payment', 'revenue', 'subscription'],
  email: ['email', 'message', 'outreach'],
  calendar: ['calendar', 'appointment', 'event'],
  social: ['social', 'post', 'facebook', 'linkedin', 'instagram'],
  marketing: ['campaign', 'funnel', 'landing', 'engagement'],
  media: ['media', 'image', 'video', 'upload'],
  support: ['ticket', 'support'],
  automation: ['workflow', 'automation', 'approval', 'job'],
  analytics: ['analytics', 'report', 'status', 'health', 'audit'],
  bonnie: ['bonnie', 'skill', 'outcome'],
  integrations: ['integration', 'connected_account', 'provider'],
};

export function moduleForTool(name: string): string {
  const lower = name.toLowerCase();
  for (const [module, words] of Object.entries(MODULE_KEYWORDS)) {
    if (words.some((word) => lower.includes(word))) return module;
  }
  return 'workspace';
}

export function coreTools(full: UnifiedMcpTool[], limit = 32): UnifiedMcpTool[] {
  return full.filter((tool) => CORE_TOOL_NAMES.has(tool.name)).slice(0, limit);
}

export function searchToolCatalog(
  full: UnifiedMcpTool[],
  input: { query?: string; module?: string; action?: string; limit?: number },
): UnifiedMcpTool[] {
  const query = `${input.query || ''} ${input.action || ''}`.trim().toLowerCase();
  return full
    .filter((tool) => !input.module || moduleForTool(tool.name) === input.module)
    .filter((tool) => !query || `${tool.name} ${tool.description}`.toLowerCase().includes(query))
    .slice(0, Math.min(Math.max(input.limit || 20, 1), 50));
}

export const DISCOVERY_CONTROL_TOOLS: UnifiedMcpTool[] = [
  ['list_tools', 'List the small stable core MCP catalogue. Read-only; returns canonical names and modules.'],
  ['list_modules', 'List workspace modules available for progressive tool discovery. Read-only.'],
  ['list_capabilities', 'List negotiated client and server capabilities. Read-only.'],
  ['search_tools', 'Search canonical tools by query, module, or action before loading a module. Read-only.'],
  ['load_module_tools', 'Load the bounded canonical tool list for one workspace module. Read-only.'],
].map(([name, description]) => ({
  name,
  description,
  inputSchema: name === 'search_tools'
    ? { type: 'object', properties: { query: { type: 'string' }, module: { type: 'string' }, action: { type: 'string' }, risk_level: { type: 'string' }, limit: { type: 'number', maximum: 50 } } }
    : name === 'load_module_tools'
      ? { type: 'object', properties: { module: { type: 'string' } }, required: ['module'] }
      : { type: 'object', properties: {} },
}));
