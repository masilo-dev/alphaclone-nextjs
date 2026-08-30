import type { BonnieModuleId } from '@/lib/bonnie/bonnieToolCatalog';
import { BONNIE_CUSTOM_TOOLS, BONNIE_MODULE_HINTS } from '@/lib/bonnie/bonnieToolCatalog';
import { suggestToolsForQuestion } from '@/lib/bonnie/bonnieTenantDataRules';
import type { UnifiedMcpTool } from '@/lib/mcp/listAllTools';

const DISCOVERY_TOOL_NAMES = new Set([
  'search_tools',
  'list_tools',
  'list_modules',
  'load_module_tools',
  'list_capabilities',
  'dispatch_tool',
  'search',
  'fetch',
]);

export function bonnieMaxAgentTools(): number {
  return Math.min(
    80,
    Math.max(24, Number(process.env.BONNIE_MAX_AGENT_TOOLS || 80)),
  );
}

function selectedToolNames(
  instruction: string,
  moduleId: BonnieModuleId,
  specialistTools: string[] = [],
): Set<string> {
  const moduleTools = BONNIE_MODULE_HINTS[moduleId]?.tools || BONNIE_MODULE_HINTS.general.tools;
  return new Set([
    ...moduleTools,
    ...suggestToolsForQuestion(instruction, moduleId),
    ...specialistTools,
    ...DISCOVERY_TOOL_NAMES,
    'get_business_snapshot',
    'get_account_overview',
    'summarize_workspace',
    'list_pending_approvals',
    'orchestrate_task',
  ]);
}

/** Build the MCP tool set Bonnie's agent can call for this turn (dynamic, capped). */
export function buildBonnieAgentToolDefinitions(
  instruction: string,
  moduleId: BonnieModuleId,
  catalog: UnifiedMcpTool[],
  specialistToolNames: string[] = [],
): UnifiedMcpTool[] {
  const selected = selectedToolNames(instruction, moduleId, specialistToolNames);
  const customSet = new Set<string>(BONNIE_CUSTOM_TOOLS);
  const maxTools = bonnieMaxAgentTools();

  const ranked: UnifiedMcpTool[] = [];
  const seen = new Set<string>();

  const push = (tool: UnifiedMcpTool | undefined) => {
    if (!tool?.name || seen.has(tool.name)) return;
    seen.add(tool.name);
    ranked.push(tool);
  };

  // Discovery + orchestration first
  for (const name of DISCOVERY_TOOL_NAMES) {
    push(catalog.find((t) => t.name === name));
  }
  push(catalog.find((t) => t.name === 'orchestrate_task'));

  // Module + specialist + suggested tools
  for (const tool of catalog) {
    if (selected.has(tool.name)) push(tool);
  }

  // Custom tools not in catalog
  for (const name of selected) {
    if (customSet.has(name) && !seen.has(name)) {
      push({
        name,
        description: `Run the AlphaClone Bonnie capability ${name}.`,
        inputSchema: { type: 'object', properties: {}, additionalProperties: true },
      });
    }
  }

  return ranked.slice(0, maxTools);
}
