import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

createRequire(import.meta.url)('./stub-server-only.cjs');

export type ToolRisk = 'low' | 'medium' | 'high' | 'critical';
export type ToolReadWrite = 'read' | 'write';

export const ROUTE_EXECUTED_TOOL_NAMES = new Set([
  'search',
  'fetch',
  'list_tools',
  'list_modules',
  'list_capabilities',
  'search_tools',
  'load_module_tools',
]);

export const MODULE_ORDER = [
  'crm',
  'leads',
  'contacts',
  'companies',
  'social',
  'media',
  'email',
  'documents',
  'calendar',
  'appointments',
  'tasks',
  'projects',
  'invoices',
  'payments',
  'revenue',
  'reporting',
  'workflows',
  'bonnie',
  'approvals',
  'search',
  'integrations',
  'workspace',
  'health',
  'admin',
] as const;

export function ensureAuditDir(): string {
  const outDir = path.join(process.cwd(), 'artifacts', 'audit');
  fs.mkdirSync(outDir, { recursive: true });
  return outDir;
}

export function schemaText(schema: unknown): string {
  return JSON.stringify(schema || {}).toLowerCase();
}

export function normalizeModule(toolName: string, inferred: string): string {
  const name = toolName.toLowerCase();
  if (/lead/.test(name)) return 'leads';
  if (/contact/.test(name)) return 'contacts';
  if (/compan/.test(name)) return 'companies';
  if (/invoice/.test(name)) return 'invoices';
  if (/payment|paid|receipt/.test(name)) return 'payments';
  if (/revenue|subscription|quote|deal/.test(name)) return 'revenue';
  if (/report|analytics|metric|dashboard/.test(name)) return 'reporting';
  if (/approval|approve|reject/.test(name)) return 'approvals';
  if (/workflow|playbook|orchestrat|automation/.test(name)) return 'workflows';
  if (/media|image|video|asset/.test(name)) return 'media';
  if (/document|contract|file/.test(name)) return 'documents';
  if (/calendar|appointment|event|reminder/.test(name)) return 'calendar';
  if (/task/.test(name)) return 'tasks';
  if (/project/.test(name)) return 'projects';
  if (/health|status|environment|version|error/.test(name)) return 'health';
  if (/admin|audit|restart|platform|system/.test(name)) return 'admin';
  if (/integration|connected|provider|account/.test(name)) return 'integrations';
  if (/search|fetch|find|inspect|list_tools|load_module_tools|capabilities/.test(name)) return 'search';
  if (/bonnie|memory|agent|prompt|planner|executor|scheduler/.test(name)) return 'bonnie';
  if (/facebook|linkedin|instagram|social|post|campaign|engagement|x_/.test(name)) return 'social';
  return inferred || 'workspace';
}

export function inferIntegrationDependency(toolName: string, schema: unknown): string | null {
  const text = `${toolName} ${schemaText(schema)}`;
  if (/linkedin/i.test(text)) return 'linkedin';
  if (/facebook/i.test(text)) return 'facebook';
  if (/instagram/i.test(text)) return 'instagram';
  if (/\bx_|twitter/i.test(text)) return 'x';
  if (/gmail|google_calendar|google/i.test(text)) return 'google';
  if (/microsoft|outlook|office/i.test(text)) return 'microsoft';
  if (/stripe|payment/i.test(text)) return 'stripe';
  if (/zoho/i.test(text)) return 'zoho';
  if (/calendly/i.test(text)) return 'calendly';
  if (/openai|image generation|ai image/i.test(text)) return 'openai';
  if (/email|smtp|sendgrid|resend/i.test(text)) return 'email_provider';
  return null;
}

export function classifyReadWrite(toolName: string, annotations: { readOnlyHint: boolean }): ToolReadWrite {
  if (annotations.readOnlyHint) return 'read';
  if (/^(get|list|search|fetch|inspect|audit|analyze|validate|verify|status|health|report|dashboard|connected|scheduled|drafts|campaigns|events|tasks|appointments|invoices|quotes|payments|subscriptions)_/.test(toolName)) {
    return 'read';
  }
  return 'write';
}

export function classifyRisk(
  toolName: string,
  annotations: { readOnlyHint: boolean; openWorldHint: boolean; destructiveHint: boolean },
): ToolRisk {
  if (annotations.destructiveHint || /^(delete|remove|destroy|purge|drop|revoke|restart|stop|cancel)_/.test(toolName)) {
    return 'critical';
  }
  if (/(send|publish|approve|reject|payment|paid|invoice|restart|run_workflow|resume_workflow|orchestrate|bulk|campaign)/.test(toolName)) {
    return 'high';
  }
  if (!annotations.readOnlyHint || annotations.openWorldHint) return 'medium';
  return 'low';
}

export function requiresApproval(toolName: string, risk: ToolRisk): boolean {
  return risk === 'critical' || /(approve|reject|send|publish|payment|paid|invoice|restart|delete|remove|revoke|bulk|campaign)/.test(toolName);
}

export function authScopeFor(toolName: string): string[] {
  if (/^(get|list|search|fetch|inspect|audit|analyze|validate|verify|status|health|report|dashboard|connected|scheduled|drafts|campaigns|events|tasks|appointments|invoices|quotes|payments|subscriptions)_/.test(toolName)) {
    return ['read', 'mcp:tools'];
  }
  return ['write', 'mcp:tools'];
}

export function hasIdempotency(schema: unknown): boolean {
  return schemaText(schema).includes('idempotency_key');
}

export function hasReceiptSignal(toolName: string, schema: unknown): boolean {
  return /receipt|status|verify|get_action_status/.test(`${toolName} ${schemaText(schema)}`);
}

export async function loadMcpCatalogs() {
  const { initializeRegistry, listTools } = await import('../src/lib/mcp/tool-registry');
  const { getUnifiedMcpTools, invalidateUnifiedMcpToolCache } = await import('../src/lib/mcp/listAllTools');
  const { inferToolAnnotations } = await import('../src/lib/mcp/toolAnnotations');
  const { moduleForTool, MODULE_KEYWORDS } = await import('../src/lib/mcp/progressiveDiscovery');

  initializeRegistry();
  invalidateUnifiedMcpToolCache();

  const registryTools = listTools(false);
  const registryNames = new Set(registryTools.map((tool) => tool.name));
  const executableNames = new Set([...registryNames, ...ROUTE_EXECUTED_TOOL_NAMES]);
  const fullTools = await getUnifiedMcpTools({
    sanitizeForClient: false,
    forceRefresh: true,
    catalogMode: 'full',
  });

  return {
    registryTools,
    registryNames,
    executableNames,
    fullTools,
    inferToolAnnotations,
    moduleForTool,
    moduleKeywords: MODULE_KEYWORDS as Record<string, string[]>,
  };
}
