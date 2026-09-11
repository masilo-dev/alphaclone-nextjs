import fs from 'node:fs';
import path from 'node:path';
import {
  authScopeFor,
  classifyReadWrite,
  classifyRisk,
  ensureAuditDir,
  hasIdempotency,
  inferIntegrationDependency,
  loadMcpCatalogs,
  normalizeModule,
} from './mcp-audit-common';
import { buildToolCapabilityMeta } from '../src/lib/mcp/capabilityFilter';
import { CHATGPT_CONNECTOR_TOOL_NAMES } from '../src/lib/mcp/toolAnnotations';
import { getUnifiedMcpTools, invalidateUnifiedMcpToolCache } from '../src/lib/mcp/listAllTools';

type InventoryRow = {
  tool: string;
  module: string;
  action_type: string;
  read_or_write: 'read' | 'write';
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  required_permissions: string[];
  quota_category: string | null;
  chatgpt_exposed: boolean;
  internally_callable: boolean;
  schema_valid: boolean;
  integration_dependency: string | null;
  implementation_status: 'executable' | 'catalog_only';
  status: 'ok' | 'catalog_only' | 'integration_blocked' | 'permission_gated';
};

function schemaValid(schema: unknown): boolean {
  if (!schema || typeof schema !== 'object') return false;
  const record = schema as Record<string, unknown>;
  return record.type === 'object' && typeof record.properties === 'object';
}

function quotaCategory(toolName: string): string | null {
  const name = toolName.toLowerCase();
  if (/email|mail|outreach|reply/.test(name)) return 'email_actions';
  if (/social|publish|post/.test(name)) return 'social_actions';
  if (/bulk|campaign/.test(name)) return 'bulk_outreach';
  if (/invoice|payment|quote/.test(name)) return 'finance_actions';
  return null;
}

async function main() {
  const catalogs = await loadMcpCatalogs();
  invalidateUnifiedMcpToolCache();

  const chatgptFull = await getUnifiedMcpTools({
    clientId: 'chatgpt-connector',
    catalogMode: 'full',
    sanitizeForClient: false,
    forceRefresh: true,
  });
  const chatgptStable = await getUnifiedMcpTools({
    clientId: 'chatgpt-connector',
    catalogMode: 'stable',
    sanitizeForClient: false,
    forceRefresh: true,
  });
  const chatgptProgressive = await getUnifiedMcpTools({
    clientId: 'chatgpt-connector',
    catalogMode: 'progressive',
    sanitizeForClient: false,
    forceRefresh: true,
  });

  const legacyCurated = new Set(CHATGPT_CONNECTOR_TOOL_NAMES);
  const chatgptFullNames = new Set(chatgptFull.map((t) => t.name));

  const rows: InventoryRow[] = catalogs.fullTools.map((tool) => {
    const annotations = catalogs.inferToolAnnotations(tool.name);
    const module = normalizeModule(tool.name, catalogs.moduleForTool(tool.name));
    const readWrite = classifyReadWrite(tool.name, annotations);
    const risk = classifyRisk(tool.name, annotations);
    const executable =
      catalogs.registryNames.has(tool.name) ||
      ['search', 'fetch', 'list_tools', 'search_tools', 'load_module_tools'].includes(tool.name);
    const capability = buildToolCapabilityMeta(tool, { executable });
    const integrationDependency = inferIntegrationDependency(tool.name, tool.inputSchema);

    let status: InventoryRow['status'] = 'ok';
    if (!executable) status = 'catalog_only';
    else if (!capability.integration_available && capability.integration_dependency) {
      status = 'integration_blocked';
    }

    return {
      tool: tool.name,
      module,
      action_type: readWrite === 'read' ? 'read' : 'write',
      read_or_write: readWrite,
      risk_level: risk,
      required_permissions: [capability.permission, ...authScopeFor(tool.name)],
      quota_category: quotaCategory(tool.name),
      chatgpt_exposed: chatgptFullNames.has(tool.name),
      internally_callable: executable,
      schema_valid: schemaValid(tool.inputSchema),
      integration_dependency: integrationDependency,
      implementation_status: executable ? 'executable' : 'catalog_only',
      status,
    };
  }).sort((a, b) => a.tool.localeCompare(b.tool));

  const totals = {
    internal_registered_tools: catalogs.registryNames.size,
    mcp_discoverable_tools: catalogs.fullTools.length,
    chatgpt_exposed_full_catalog: chatgptFull.length,
    chatgpt_stable_core: chatgptStable.length,
    chatgpt_progressive_default: chatgptProgressive.length,
    legacy_curated_list: legacyCurated.size,
    read_tools: rows.filter((r) => r.read_or_write === 'read').length,
    write_tools: rows.filter((r) => r.read_or_write === 'write').length,
    admin_tools: rows.filter((r) => r.module === 'admin' || /admin|restart|audit/.test(r.tool)).length,
    intentionally_hidden: rows.filter((r) => !r.chatgpt_exposed).length,
    broken_tools: rows.filter((r) => !r.schema_valid).map((r) => r.tool),
    integration_blocked_tools: rows.filter((r) => r.status === 'integration_blocked').length,
    catalog_only_tools: rows.filter((r) => r.implementation_status === 'catalog_only').length,
  };

  const gapAnalysis = {
    why_counts_differ: [
      `Internal registry registers ${totals.internal_registered_tools} executable handlers.`,
      `Unified tools/list full catalog merges registry + manifest aliases → ${totals.mcp_discoverable_tools} discoverable tools.`,
      `ChatGPT connector (catalogMode=full) exposes ${totals.chatgpt_exposed_full_catalog} tools directly.`,
      `Stable core slice exposes ${totals.chatgpt_stable_core} tools (used by list_tools / bounded clients).`,
      `Progressive default slice exposes ${totals.chatgpt_progressive_default} tools until load_module_tools expands modules.`,
      `Legacy curated allowlist retained for annotations only: ${totals.legacy_curated_list} names.`,
      'Historical ~79 tool snapshots usually come from progressive/stable slices or paginated tools/list pages (default 75/page for non-full catalogs), not server-side hiding in full mode.',
    ],
    exposure_gap_full_vs_stable: totals.chatgpt_exposed_full_catalog - totals.chatgpt_stable_core,
    exposure_gap_full_vs_progressive: totals.chatgpt_exposed_full_catalog - totals.chatgpt_progressive_default,
  };

  const priorityTools = [
    'send_email',
    'reply_to_email',
    'read_emails',
    'create_email_draft',
    'publish_social_post',
    'create_task',
    'create_event',
    'create_invoice',
    'add_note',
    'run_workflow',
    'create_lead',
    'update_lead',
  ];

  const priorityStatus = Object.fromEntries(
    priorityTools.map((name) => {
      const row = rows.find((r) => r.tool === name);
      return [
        name,
        row
          ? {
              chatgpt_exposed: row.chatgpt_exposed,
              internally_callable: row.internally_callable,
              status: row.status,
            }
          : { chatgpt_exposed: false, internally_callable: false, status: 'missing' },
      ];
    })
  );

  const report = {
    generated_at: new Date().toISOString(),
    totals,
    gap_analysis: gapAnalysis,
    priority_tools: priorityStatus,
    inventory: rows,
    table: rows.map((row) => ({
      Tool: row.tool,
      Module: row.module,
      'Read/Write': row.read_or_write,
      'ChatGPT Exposed': row.chatgpt_exposed,
      'Internal Working': row.internally_callable,
      Integration: row.integration_dependency || '-',
      Permission: row.required_permissions.join(','),
      Status: row.status,
    })),
  };

  const outDir = ensureAuditDir();
  const jsonPath = path.join(outDir, 'mcp-chatgpt-full-inventory.json');
  const mdPath = path.join(outDir, 'mcp-chatgpt-audit-report.md');
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

  const md = `# AlphaClone MCP ChatGPT Audit Report

Generated: ${report.generated_at}

## Counts (dynamic)

| Metric | Count |
| --- | ---: |
| Internal registered tools | ${totals.internal_registered_tools} |
| MCP discoverable tools | ${totals.mcp_discoverable_tools} |
| ChatGPT exposed (full catalog) | ${totals.chatgpt_exposed_full_catalog} |
| Stable core slice | ${totals.chatgpt_stable_core} |
| Progressive default slice | ${totals.chatgpt_progressive_default} |
| Read tools | ${totals.read_tools} |
| Write tools | ${totals.write_tools} |
| Admin tools | ${totals.admin_tools} |
| Catalog-only (non-executable) | ${totals.catalog_only_tools} |

## Why counts differ

${gapAnalysis.why_counts_differ.map((line) => `- ${line}`).join('\n')}

## Priority business tools

| Tool | ChatGPT exposed | Internal working | Status |
| --- | --- | --- | --- |
${priorityTools
  .map((name) => {
    const p = priorityStatus[name] as { chatgpt_exposed: boolean; internally_callable: boolean; status: string };
    return `| ${name} | ${p.chatgpt_exposed} | ${p.internally_callable} | ${p.status} |`;
  })
  .join('\n')}
`;

  fs.writeFileSync(mdPath, md);
  console.log(JSON.stringify({ jsonPath, mdPath, totals, gapAnalysis }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
