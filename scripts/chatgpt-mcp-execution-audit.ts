import fs from 'node:fs';
import path from 'node:path';
import * as dotenv from 'dotenv';
import {
  classifyReadWrite,
  classifyRisk,
  ensureAuditDir,
  loadMcpCatalogs,
  normalizeModule,
  requiresApproval,
  ROUTE_EXECUTED_TOOL_NAMES,
} from './mcp-audit-common';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

type AuditStatus =
  | 'passed'
  | 'blocked_missing_config'
  | 'requires_approval'
  | 'not_executable'
  | 'skipped_destructive'
  | 'skipped_write'
  | 'failed';

type AuditRow = {
  module: string;
  tool_name: string;
  discoverable_after_load: boolean;
  executable_registered: boolean;
  executable_via: string | null;
  read_write: 'read' | 'write';
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  status: AuditStatus;
  detail: string;
};

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

async function callHttpTool(baseUrl: string, token: string, toolName: string, args: Record<string, unknown>) {
  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/mcp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'User-Agent': 'ChatGPT MCP execution audit',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: `${Date.now()}-${toolName}`,
      method: 'tools/call',
      params: { name: toolName, arguments: args },
    }),
  });
  const payload = await res.json().catch(() => ({}));
  return { ok: res.ok && !payload?.error, status: res.status, payload };
}

function defaultSafeArgs(toolName: string): Record<string, unknown> {
  if (toolName === 'search_tools') return { query: 'status', limit: 5 };
  if (toolName === 'load_module_tools') return { module: 'crm' };
  if (toolName === 'list_tools' || toolName === 'list_modules' || toolName === 'list_capabilities') return {};
  if (toolName === 'search') return { query: 'test', limit: 1 };
  if (toolName === 'fetch') return { id: 'mcp://audit/nonexistent' };
  return { limit: 1 };
}

async function main() {
  const executeReadTools = hasFlag('--execute-read-tools');
  const executeWriteTools = hasFlag('--execute-write-tools');
  const useHttp = hasFlag('--http');
  const baseUrl = process.env.MCP_BASE_URL || 'https://alphaclonesystems.com';
  const token = process.env.MCP_TOKEN || process.env.MCP_API_KEY || '';

  if (useHttp && !token) {
    throw new Error('MCP_TOKEN or MCP_API_KEY is required for --http mode');
  }

  const catalogs = await loadMcpCatalogs();
  const modules = Object.keys(catalogs.moduleKeywords).sort();
  const rows: AuditRow[] = [];
  const progressivelyVisibleNames = new Set<string>();

  for (const moduleName of modules) {
    const { getUnifiedMcpTools, invalidateUnifiedMcpToolCache } = await import('../src/lib/mcp/listAllTools');
    invalidateUnifiedMcpToolCache();
    const visible = await getUnifiedMcpTools({
      sanitizeForClient: false,
      forceRefresh: true,
      catalogMode: 'progressive',
      loadedModules: [moduleName],
    });
    const visibleNames = new Set(visible.map((tool) => tool.name));

    for (const tool of visible) {
      progressivelyVisibleNames.add(tool.name);
      const annotations = catalogs.inferToolAnnotations(tool.name);
      const readWrite = classifyReadWrite(tool.name, annotations);
      const risk = classifyRisk(tool.name, annotations);
      const executableRegistered = catalogs.executableNames.has(tool.name);
      const executableVia = catalogs.registryNames.has(tool.name)
        ? 'tool-registry'
        : ROUTE_EXECUTED_TOOL_NAMES.has(tool.name)
          ? 'mcp-route'
          : null;
      const row: AuditRow = {
        module: normalizeModule(tool.name, catalogs.moduleForTool(tool.name)),
        tool_name: tool.name,
        discoverable_after_load: visibleNames.has(tool.name),
        executable_registered: executableRegistered,
        executable_via: executableVia,
        read_write: readWrite,
        risk_level: risk,
        status: 'passed',
        detail: 'Discoverable after module load and executable by MCP route/registry.',
      };

      if (!executableRegistered) {
        row.status = 'not_executable';
        row.detail = 'Tool appears in progressive tools/list but is not backed by route or registry execution.';
      } else if (risk === 'critical' && !executeWriteTools) {
        row.status = 'skipped_destructive';
        row.detail = 'Destructive/critical tool was not executed. Pass --execute-write-tools in a staging workspace to test.';
      } else if (readWrite === 'write' && !executeWriteTools) {
        row.status = requiresApproval(tool.name, risk) ? 'requires_approval' : 'skipped_write';
        row.detail = 'Write tool was not executed by default. Pass --execute-write-tools only in a staging workspace.';
      } else if (readWrite === 'read' && !executeReadTools) {
        row.detail = 'Dry-run passed. Pass --execute-read-tools --http to invoke read tools against a credentialed endpoint.';
      } else if (useHttp) {
        const result = await callHttpTool(baseUrl, token, tool.name, defaultSafeArgs(tool.name));
        row.status = result.ok ? 'passed' : 'failed';
        row.detail = result.ok
          ? 'HTTP tools/call succeeded.'
          : `HTTP tools/call failed (${result.status}): ${JSON.stringify(result.payload).slice(0, 500)}`;
      } else {
        row.detail = 'Local dry-run passed. HTTP execution not requested.';
      }

      rows.push(row);
    }
  }

  for (const tool of catalogs.registryTools) {
    if (progressivelyVisibleNames.has(tool.name)) continue;
    const annotations = catalogs.inferToolAnnotations(tool.name);
    const readWrite = classifyReadWrite(tool.name, annotations);
    const risk = classifyRisk(tool.name, annotations);
    rows.push({
      module: normalizeModule(tool.name, catalogs.moduleForTool(tool.name)),
      tool_name: tool.name,
      discoverable_after_load: false,
      executable_registered: true,
      executable_via: 'tool-registry',
      read_write: readWrite,
      risk_level: risk,
      status: 'failed',
      detail:
        'Executable registry tool is not discoverable through any current progressive module load. Add module keywords/mapping or intentionally classify it as internal-only.',
    });
  }

  const uniqueRows = Array.from(new Map(rows.map((row) => [row.tool_name, row])).values()).sort((a, b) =>
    a.module.localeCompare(b.module) || a.tool_name.localeCompare(b.tool_name)
  );
  const totals = uniqueRows.reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = (acc[row.status] || 0) + 1;
    return acc;
  }, {});

  const report = {
    generated_at: new Date().toISOString(),
    mode: {
      transport: useHttp ? 'http' : 'local-dry-run',
      execute_read_tools: executeReadTools,
      execute_write_tools: executeWriteTools,
      base_url: useHttp ? baseUrl : null,
    },
    policy:
      'Default mode proves ChatGPT progressive discover/load/executable exposure without side effects. Live invocation requires --http and explicit execution flags.',
    totals: {
      tools_audited: uniqueRows.length,
      registry_tools: catalogs.registryNames.size,
      progressively_visible_tools: progressivelyVisibleNames.size,
      ...totals,
    },
    failures: uniqueRows.filter((row) => row.status === 'failed' || row.status === 'not_executable'),
    tools: uniqueRows,
  };

  const outDir = ensureAuditDir();
  const outPath = path.join(outDir, 'chatgpt-mcp-execution-audit.json');
  fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ outPath, totals: report.totals, failures: report.failures.slice(0, 20) }, null, 2));

  if (report.failures.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
