import fs from 'node:fs';
import path from 'node:path';
import { initializeRegistry, listTools } from '../src/lib/mcp/tool-registry';
import { getUnifiedMcpTools, invalidateUnifiedMcpToolCache } from '../src/lib/mcp/listAllTools';
import { inferToolAnnotations } from '../src/lib/mcp/toolAnnotations';
import { moduleForTool } from '../src/lib/mcp/progressiveDiscovery';
import { MCP_TOOL_ALIASES } from '../src/lib/mcp/canonicalToolRegistry';

type ExposureRow = {
  tool_name: string;
  registered: boolean;
  chatgpt_exposed: boolean;
  claude_exposed: boolean;
  bonnie_exposed: boolean;
  cursor_exposed: boolean;
  read_or_write: 'read' | 'write';
  module: string;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  canonical_tool: boolean;
  alias_of: string | null;
  requires_approval: boolean;
  requires_external_provider: boolean;
  supports_idempotency: boolean;
  supports_verification: boolean;
};

const ALIASES: Record<string, string> = { ...MCP_TOOL_ALIASES, generate_ai_image: 'generate_image' };

function schemaText(schema: unknown): string {
  return JSON.stringify(schema || {}).toLowerCase();
}

function classifyRisk(name: string, annotations: ReturnType<typeof inferToolAnnotations>) {
  if (/^(delete|remove|destroy|purge|drop|revoke)_/.test(name)) return 'critical' as const;
  if (annotations.destructiveHint) return 'critical' as const;
  if (/(send|publish|approve|reject|mark_invoice_paid|payment|invoice|restart|run_workflow|resume_workflow|orchestrate)/.test(name)) {
    return 'high' as const;
  }
  if (!annotations.readOnlyHint) return 'medium' as const;
  return 'low' as const;
}

async function main() {
  initializeRegistry();
  invalidateUnifiedMcpToolCache();

  const registered = listTools(false);
  const exposed = await getUnifiedMcpTools({
    sanitizeForClient: false,
    forceRefresh: true,
  });
  const full = await getUnifiedMcpTools({
    sanitizeForClient: false,
    forceRefresh: true,
    catalogMode: 'full',
  });

  const exposedNames = new Set(exposed.map((tool) => tool.name));
  const registeredNames = new Set(registered.map((tool) => tool.name));

  const rows: ExposureRow[] = full.map((tool) => {
    const name = tool.name;
    const annotations = inferToolAnnotations(name);
    const text = `${name} ${tool.description || ''} ${schemaText(tool.inputSchema)}`;
    const readOrWrite = annotations.readOnlyHint ? 'read' : 'write';
    const module = moduleForTool(name);
    const aliasOf = ALIASES[name] || null;
    const requiresExternalProvider = /(email|gmail|outlook|whatsapp|social|facebook|linkedin|instagram|publish|send|stripe|payment|x_|twitter|google|microsoft)/.test(text);

    return {
      tool_name: name,
      registered: registeredNames.has(name),
      chatgpt_exposed: exposedNames.has(name),
      claude_exposed: exposedNames.has(name),
      bonnie_exposed: exposedNames.has(name),
      cursor_exposed: exposedNames.has(name),
      read_or_write: readOrWrite,
      module,
      risk_level: classifyRisk(name, annotations),
      canonical_tool: !aliasOf,
      alias_of: aliasOf,
      requires_approval: annotations.destructiveHint || /(approve|send|publish|payment|invoice|restart|delete|reject)/.test(name),
      requires_external_provider: requiresExternalProvider,
      supports_idempotency: text.includes('idempotency_key'),
      supports_verification: /^verify_/.test(name) || text.includes('verification'),
    };
  }).sort((a, b) => a.tool_name.localeCompare(b.tool_name));

  const totals = {
    total_registered: rows.filter((row) => row.registered).length,
    total_directly_exposed: rows.filter((row) => row.chatgpt_exposed).length,
    total_read_tools: rows.filter((row) => row.read_or_write === 'read').length,
    total_write_tools: rows.filter((row) => row.read_or_write === 'write').length,
    total_external_action_tools: rows.filter((row) => row.requires_external_provider).length,
    total_admin_tools: rows.filter((row) => row.module === 'admin' || /admin|audit|restart|system|health/.test(row.tool_name)).length,
    total_hidden_tools: rows.filter((row) => !row.chatgpt_exposed).length,
    total_canonical_tools: rows.filter((row) => row.canonical_tool).length,
    total_aliases: rows.filter((row) => !row.canonical_tool).length,
    total_tools_with_verification: rows.filter((row) => row.supports_verification).length,
    total_executable_but_unexposed_tools: rows.filter((row) => row.registered && !row.chatgpt_exposed).length,
  };

  const report = {
    generated_at: new Date().toISOString(),
    exposure_model: 'compatibility-full by default; stable-core and domain-pack discovery available without removing executable aliases',
    totals,
    tools: rows,
  };

  const outDir = path.join(process.cwd(), 'artifacts', 'audit');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'mcp-exposure-report.json');
  fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ outPath, totals }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
