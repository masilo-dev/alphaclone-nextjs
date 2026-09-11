import fs from 'node:fs';
import path from 'node:path';
import {
  authScopeFor,
  classifyReadWrite,
  classifyRisk,
  ensureAuditDir,
  hasIdempotency,
  hasReceiptSignal,
  inferIntegrationDependency,
  loadMcpCatalogs,
  normalizeModule,
  requiresApproval,
  ROUTE_EXECUTED_TOOL_NAMES,
} from './mcp-audit-common';

async function main() {
  const catalogs = await loadMcpCatalogs();
  const duplicateNames = catalogs.fullTools
    .map((tool) => tool.name)
    .filter((name, index, all) => all.indexOf(name) !== index);

  const tools = catalogs.fullTools
    .map((tool) => {
      const annotations = catalogs.inferToolAnnotations(tool.name);
      const inferredModule = normalizeModule(tool.name, catalogs.moduleForTool(tool.name));
      const readWrite = classifyReadWrite(tool.name, annotations);
      const risk = classifyRisk(tool.name, annotations);
      const executable =
        catalogs.registryNames.has(tool.name) || ROUTE_EXECUTED_TOOL_NAMES.has(tool.name);
      const integrationDependency = inferIntegrationDependency(tool.name, tool.inputSchema);

      return {
        canonical_tool_name: tool.name,
        module: inferredModule,
        description: tool.description || '',
        input_schema: tool.inputSchema || { type: 'object', properties: {} },
        output_schema: {
          type: 'object',
          description:
            readWrite === 'write'
              ? 'MCP content envelope containing structured JSON with ok/error and action receipt when the action mutates state.'
              : 'MCP content envelope containing structured JSON data or read-only result.',
        },
        read_write_classification: readWrite,
        risk_level: risk,
        approval_requirement: requiresApproval(tool.name, risk),
        auth_scope: authScopeFor(tool.name),
        tenant_scope: 'session_tenant_required',
        feature_flag_dependency: null,
        integration_dependency: integrationDependency,
        executable_status: executable ? 'executable' : 'catalog_only_not_executable',
        executable_via: catalogs.registryNames.has(tool.name)
          ? 'tool-registry'
          : ROUTE_EXECUTED_TOOL_NAMES.has(tool.name)
            ? 'mcp-route'
            : null,
        supports_idempotency: hasIdempotency(tool.inputSchema),
        supports_action_receipt: hasReceiptSignal(tool.name, tool.inputSchema),
        annotations,
      };
    })
    .sort((a, b) => a.module.localeCompare(b.module) || a.canonical_tool_name.localeCompare(b.canonical_tool_name));

  const byModule = tools.reduce<Record<string, typeof tools>>((acc, tool) => {
    (acc[tool.module] ||= []).push(tool);
    return acc;
  }, {});

  const report = {
    generated_at: new Date().toISOString(),
    source_of_truth: 'runtime MCP registry + unified tools/list full catalog',
    policy:
      'Existing clients retain the full executable catalog for compatibility. Stable-core and domain-pack discovery are available as the migration target; catalog-only entries are audit visibility only.',
    totals: {
      full_catalog_tools: tools.length,
      registry_executable_tools: catalogs.registryNames.size,
      progressive_route_tools: ROUTE_EXECUTED_TOOL_NAMES.size,
      catalog_only_tools: tools.filter((tool) => tool.executable_status !== 'executable').length,
      write_tools: tools.filter((tool) => tool.read_write_classification === 'write').length,
      write_tools_with_idempotency: tools.filter((tool) => tool.read_write_classification === 'write' && tool.supports_idempotency).length,
      write_tools_with_receipt_signal: tools.filter((tool) => tool.read_write_classification === 'write' && tool.supports_action_receipt).length,
      duplicate_names: Array.from(new Set(duplicateNames)).sort(),
    },
    modules: Object.fromEntries(
      Object.entries(byModule).map(([module, moduleTools]) => [
        module,
        {
          total: moduleTools.length,
          executable: moduleTools.filter((tool) => tool.executable_status === 'executable').length,
          write: moduleTools.filter((tool) => tool.read_write_classification === 'write').length,
          tools: moduleTools,
        },
      ]),
    ),
    tools,
  };

  const outDir = ensureAuditDir();
  const jsonPath = path.join(outDir, 'mcp-canonical-tool-inventory.json');
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ outPath: jsonPath, totals: report.totals }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
