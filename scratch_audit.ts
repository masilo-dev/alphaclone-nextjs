import { initializeRegistry, listTools, hasTool } from './src/lib/mcp/tool-registry';
import { getUnifiedMcpTools } from './src/lib/mcp/listAllTools';
import { MCP_TOOLS } from './src/services/mcp/toolManifest';
import { SUPPLEMENTAL_MCP_TOOLS } from './src/lib/mcp/supplementalToolDefinitions';
import { DISCOVERY_CONTROL_TOOLS } from './src/lib/mcp/progressiveDiscovery';

async function audit() {
  initializeRegistry();
  const registered = listTools(false);
  const unifiedFull = await getUnifiedMcpTools({ catalogMode: 'full', sanitizeForClient: false });

  console.log("Registered tools count:", registered.length);
  console.log("MCP_TOOLS count in toolManifest:", MCP_TOOLS.length);
  console.log("SUPPLEMENTAL_MCP_TOOLS count:", SUPPLEMENTAL_MCP_TOOLS.length);
  console.log("DISCOVERY_CONTROL_TOOLS count:", DISCOVERY_CONTROL_TOOLS.length);
  console.log("Unified full catalog count:", unifiedFull.length);

  // Check duplicate names in unified full
  const names = new Map<string, number>();
  for (const t of unifiedFull) {
    names.set(t.name, (names.get(t.name) || 0) + 1);
  }
  const duplicates = Array.from(names.entries()).filter(([_, count]) => count > 1);
  console.log("Duplicates in unified:", duplicates);

  // Check tools in toolManifest NOT in tool-registry
  const regNames = new Set(registered.map(r => r.name));
  const manifestOnly = MCP_TOOLS.filter(m => !regNames.has(m.name));
  console.log("\n--- Tools in toolManifest but NOT in tool-registry (" + manifestOnly.length + ") ---");
  console.log(manifestOnly.map(m => m.name));

  // Check tools in supplemental NOT in tool-registry
  const suppOnly = SUPPLEMENTAL_MCP_TOOLS.filter(s => !regNames.has(s.name));
  console.log("\n--- Tools in supplemental but NOT in tool-registry (" + suppOnly.length + ") ---");
  console.log(suppOnly.map(s => s.name));
}

audit().catch(console.error);
