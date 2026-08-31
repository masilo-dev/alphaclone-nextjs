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
  'load_module_tools', 'load_skill', 'execute_internal_tool',
  'dispatch_tool', 'execute_action',
  // Essential CRM & Lead mutations
  'list_leads', 'get_leads', 'create_lead', 'create_leads', 'update_lead', 'delete_lead',
  'add_note', 'create_deal', 'score_deal', 'change_pipeline_stage', 'create_follow_up',
  'create_company', 'create_contact', 'update_contact', 'update_company',
  'qualify_crm_leads', 'find_and_qualify_leads', 'parse_lead_criteria', 'get_scraper_leads',
  'search_facebook_leads',
  // Social Media publishing & media ingestion
  'upload_social_media', 'create_social_post_with_media', 'publish_social_post',
  'publish_post', 'get_social_identities', 'get_facebook_identities',
  'get_linkedin_identities', 'check_mcp_execution_readiness', 'verify_social_post',
  // Invoicing & Financial Lifecycle
  'create_invoice', 'start_invoice_lifecycle', 'send_invoice_reminder',
  'pay_invoice', 'get_invoices', 'nexus_invoice_chasing',
  // Contracts & Documents
  'create_contract', 'sign_contract', 'send_contract_for_signature',
  'update_contract_status', 'get_contracts',
  // Email & Outreach
  'send_email', 'send_outreach_email', 'reply_to_email', 'generate_outreach_draft',
  'read_emails', 'search_emails', 'create_email_draft', 'list_email_accounts',
  'send_transactional_email',
  // Social scheduling, media library & LinkedIn/Instagram publish
  'schedule_social_post', 'create_social_post', 'get_social_posts', 'get_social_post',
  'upload_media_asset', 'get_media', 'get_media_asset', 'list_media_assets', 'delete_media',
  'create_social_post_with_ai_image', 'publish_now', 'create_post', 'schedule_post',
  'publish_linkedin_image', 'publish_linkedin_document', 'publish_facebook_photo',
  'publish_instagram_photo', 'publish_instagram_reel', 'upload_document',
  'analytics', 'engagement_report', 'get_post_status',
  // Projects & Tasks
  'create_project', 'update_project_stage',
]);

export const MODULE_KEYWORDS: Record<string, string[]> = {
  crm: ['lead', 'contact', 'company', 'deal', 'pipeline', 'crm'],
  leads: ['lead'],
  contacts: ['contact', 'client', 'note', 'follow_up'],
  companies: ['company', 'companies'],
  projects: ['project'],
  tasks: ['task', 'reminder'],
  documents: ['document', 'contract', 'file', 'signature', 'legal_hold', 'knowledge'],
  finance: ['invoice', 'account', 'payment', 'revenue', 'subscription', 'quote', 'opportunity', 'inventory', 'stock', 'finance'],
  email: ['email', 'message', 'outreach', 'reply'],
  calendar: ['calendar', 'appointment', 'event', 'meeting', 'schedule'],
  appointments: ['appointment', 'meeting'],
  social: ['social', 'post', 'facebook', 'linkedin', 'instagram', 'draft', 'engagement'],
  marketing: ['campaign', 'funnel', 'landing', 'engagement', 'conversion', 'sequence'],
  media: ['media', 'image', 'video', 'upload'],
  support: ['ticket', 'support'],
  automation: ['workflow', 'approval', 'job', 'orchestration'],
  workflows: ['workflow', 'orchestration', 'playbook'],
  approvals: ['approval', 'approve', 'reject', 'review', 'request_changes'],
  analytics: ['analytics', 'report', 'status', 'health', 'audit', 'dashboard', 'metric'],
  reporting: ['analytics', 'report', 'dashboard', 'metric'],
  bonnie: ['bonnie', 'skill', 'outcome', 'dream', 'nexus', 'memory', 'agent', 'business_ai', 'digital_twin', 'cognitive', 'autopilot', 'solo_owner', 'trust_ledger'],
  integrations: ['integration', 'connected_account', 'provider', 'microsoft', 'google', 'zoho', 'stripe', 'calendly', 'gmail'],
  workspace: ['workspace', 'conversation', 'widget', 'notification', 'user', 'points'],
  health: ['health', 'status', 'version', 'environment', 'feature_flag', 'readiness'],
  admin: ['admin', 'system', 'platform', 'restart', 'audit'],
  search: ['search', 'fetch', 'find', 'inspect', 'vector', 'embedding', 'rag', 'planner', 'executor', 'scheduler', 'capabilities'],
};

export function moduleForTool(name: string): string {
  const lower = name.toLowerCase();
  if (/(social|facebook|linkedin|instagram|twitter|x_|post|draft|engagement)/.test(lower)) return 'social';
  if (/^(inspect_|search|fetch|find|negotiate_capabilities)/.test(lower)) return 'search';
  if (/(restart|admin|audit_platform|legal_hold)/.test(lower)) return 'admin';
  if (/(health|status|version|environment|feature_flag|readiness|compare_versions|recent_errors)/.test(lower)) return 'health';
  if (/(approve|reject|review|request_changes|pending_action)/.test(lower)) return 'approvals';
  if (/(workflow|orchestrat|playbook)/.test(lower)) return 'workflows';
  if (/(bonnie|dream|nexus|memory|agent|business_ai|digital_twin|cognitive|autopilot|solo_owner|trust_ledger|knowledge_graph|growth_lifecycle|recommend_next_steps)/.test(lower)) return 'bonnie';
  if (/(microsoft|google|zoho|stripe|calendly|gmail|integration|connected_account|provider)/.test(lower)) return 'integrations';
  if (/(meeting|calendar|appointment|event|reminder)/.test(lower)) return 'calendar';
  if (/(document|contract|file|signature|legal_hold)/.test(lower)) return 'documents';
  if (/(invoice|payment|revenue|subscription|quote|opportunit|inventory|stock|finance)/.test(lower)) return 'finance';
  if (/(dashboard|metric|report|analytics)/.test(lower)) return 'reporting';
  if (/(conversation|widget|notification|user|points|workspace)/.test(lower)) return 'workspace';
  if (/compan/.test(lower)) return 'companies';
  if (/contact|client|note|follow_up/.test(lower)) return 'contacts';
  if (/lead/.test(lower)) return 'leads';
  if (/task/.test(lower)) return 'tasks';
  if (/(email|message|outreach|reply)/.test(lower)) return 'email';
  if (/(campaign|funnel|landing|conversion|sequence)/.test(lower)) return 'marketing';
  for (const [module, words] of Object.entries(MODULE_KEYWORDS)) {
    if (words.some((word) => lower.includes(word))) return module;
  }
  return 'workspace';
}

export const ALL_MODULE_NAMES = Object.keys(MODULE_KEYWORDS);

export function coreTools(full: UnifiedMcpTool[], limit = 120): UnifiedMcpTool[] {
  return full.filter((tool) => CORE_TOOL_NAMES.has(tool.name)).slice(0, limit);
}

export function getModuleTools(full: UnifiedMcpTool[], moduleName: string): UnifiedMcpTool[] {
  const lower = moduleName.toLowerCase().trim();
  return full.filter((tool) => moduleForTool(tool.name) === lower);
}

export function findToolsByQuery(
  full: UnifiedMcpTool[],
  query: string,
  limit = 15
): UnifiedMcpTool[] {
  if (!query?.trim()) return full.slice(0, limit);
  const terms = query.toLowerCase().split(/[\s_-]+/).filter(Boolean);
  const scored = full.map((tool) => {
    const haystack = `${tool.name} ${tool.description || ''}`.toLowerCase();
    const hits = terms.filter((t) => haystack.includes(t)).length;
    return { tool, hits };
  });
  return scored
    .filter(({ hits }) => hits > 0)
    .sort((a, b) => b.hits - a.hits)
    .slice(0, limit)
    .map(({ tool }) => tool);
}

export function searchToolCatalog(
  full: UnifiedMcpTool[],
  input: { query?: string; module?: string; action?: string; limit?: number },
): UnifiedMcpTool[] {
  const query = `${input.query || ''} ${input.action || ''}`.trim().toLowerCase();
  const terms = query.split(/[\s_-]+/).map((term) => term.trim()).filter(Boolean);
  return full
    .filter((tool) => !input.module || moduleForTool(tool.name) === input.module)
    .filter((tool) => {
      if (!terms.length) return true;
      const haystack = `${tool.name} ${tool.description || ''}`.toLowerCase();
      return terms.every((term) => haystack.includes(term));
    })
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
