import { initializeRegistry, listTools, hasTool } from './src/lib/mcp/tool-registry';
import { getUnifiedMcpTools } from './src/lib/mcp/listAllTools';
import { MCP_TOOLS } from './src/services/mcp/toolManifest';
import { SUPPLEMENTAL_MCP_TOOLS } from './src/lib/mcp/supplementalToolDefinitions';
import { DISCOVERY_CONTROL_TOOLS } from './src/lib/mcp/progressiveDiscovery';
import * as fs from 'fs';

async function analyzeAllTools() {
  initializeRegistry();
  const registeredMap = new Map(listTools(false).map(t => [t.name, t]));
  const fullTools = await getUnifiedMcpTools({ catalogMode: 'full', sanitizeForClient: false });

  // Read MCPServer.ts content to see which case statements exist in the legacy switch
  const mcpServerCode = fs.readFileSync('./src/services/mcp/MCPServer.ts', 'utf-8');
  
  // Extract all `case 'tool_name':` from MCPServer.ts
  const caseMatches = Array.from(mcpServerCode.matchAll(/case\s+['"]([^'"]+)['"]\s*:/g)).map(m => m[1]);
  const mcpServerCases = new Set(caseMatches);

  // Check special cases in api/mcp/route.ts
  const routeCode = fs.readFileSync('./src/app/api/mcp/route.ts', 'utf-8');
  const routeCases = new Set(Array.from(routeCode.matchAll(/toolName\s*===\s*['"]([^'"]+)['"]/g)).map(m => m[1]));

  console.log(`Found ${fullTools.length} total tools in full catalog.`);
  console.log(`Found ${registeredMap.size} tools in tool-registry.`);
  console.log(`Found ${mcpServerCases.size} case handlers in MCPServer.ts switch.`);
  console.log(`Found ${routeCases.size} tool handlers in api/mcp/route.ts.`);

  const statusList: Array<{
    name: string;
    description: string;
    inRegistry: boolean;
    inMCPServerCase: boolean;
    inRouteCase: boolean;
    executable: boolean;
    schemaValid: boolean;
    issues: string[];
  }> = [];

  let executableCount = 0;
  let brokenCount = 0;

  for (const tool of fullTools) {
    const name = tool.name;
    const inRegistry = registeredMap.has(name);
    const inMCPServerCase = mcpServerCases.has(name);
    const inRouteCase = routeCases.has(name);
    const issues: string[] = [];

    // Is inputSchema valid?
    let schemaValid = true;
    if (!tool.inputSchema || typeof tool.inputSchema !== 'object') {
      schemaValid = false;
      issues.push('Invalid inputSchema');
    }

    const executable = inRegistry || inMCPServerCase || inRouteCase;
    if (executable) {
      executableCount++;
    } else {
      brokenCount++;
      issues.push('NO HANDLER REGISTERED OR IN SWITCH - DISCOVERABLE BUT UNEXECUTABLE');
    }

    statusList.push({
      name,
      description: tool.description || '',
      inRegistry,
      inMCPServerCase,
      inRouteCase,
      executable,
      schemaValid,
      issues,
    });
  }

  console.log(`\n================ SUMMARY ================`);
  console.log(`TOTAL_CANONICAL_TOOLS: ${fullTools.length}`);
  console.log(`TOTAL_EXECUTABLE: ${executableCount}`);
  console.log(`TOTAL_BROKEN_UNEXECUTABLE: ${brokenCount}`);

  const unexecutable = statusList.filter(s => !s.executable);
  console.log(`\nUnexecutable tools (${unexecutable.length}):`);
  console.log(unexecutable.map(u => u.name));
}

analyzeAllTools().catch(console.error);
