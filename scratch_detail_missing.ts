import { initializeRegistry, listTools } from './src/lib/mcp/tool-registry';
import { MCP_TOOLS } from './src/services/mcp/toolManifest';
import { SUPPLEMENTAL_MCP_TOOLS } from './src/lib/mcp/supplementalToolDefinitions';
import * as fs from 'fs';

async function detailMissing() {
  initializeRegistry();
  const registeredNames = new Set(listTools(false).map(t => t.name));
  
  const mcpServerCode = fs.readFileSync('./src/services/mcp/MCPServer.ts', 'utf-8');
  const caseMatches = Array.from(mcpServerCode.matchAll(/case\s+['"]([^'"]+)['"]\s*:/g)).map(m => m[1]);
  const mcpServerCases = new Set(caseMatches);

  const manifestMissing = MCP_TOOLS.filter(m => !registeredNames.has(m.name));
  const suppMissing = SUPPLEMENTAL_MCP_TOOLS.filter(s => !registeredNames.has(s.name));

  console.log(`Manifest tools missing from registry: ${manifestMissing.length}`);
  const inSwitch = manifestMissing.filter(m => mcpServerCases.has(m.name));
  const notInSwitch = manifestMissing.filter(m => !mcpServerCases.has(m.name));

  console.log(`- Of these, handled in MCPServer switch: ${inSwitch.length}`);
  console.log(`- Of these, NOT in MCPServer switch (unhandled): ${notInSwitch.length}`);

  console.log(`\nSupplemental tools missing from registry: ${suppMissing.length}`);
  const suppInSwitch = suppMissing.filter(s => mcpServerCases.has(s.name));
  const suppNotInSwitch = suppMissing.filter(s => !mcpServerCases.has(s.name));
  console.log(`- Of these, handled in MCPServer switch: ${suppInSwitch.length}`);
  console.log(`- Of these, NOT in MCPServer switch (unhandled): ${suppNotInSwitch.length}`);

  console.log("\n=== MANIFEST TOOLS NOT IN REGISTRY BUT IN MCPSERVER SWITCH ===");
  console.log(inSwitch.map(i => i.name));

  console.log("\n=== MANIFEST & SUPPLEMENTAL TOOLS NOT IN REGISTRY AND NOT IN MCPSERVER SWITCH ===");
  console.log([...notInSwitch, ...suppNotInSwitch].map(n => n.name));
}

detailMissing().catch(console.error);
