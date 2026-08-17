import { initializeRegistry, listTools } from '@/lib/mcp/tool-registry';
import { getUnifiedMcpTools } from '@/lib/mcp/listAllTools';
import { MCP_TOOLS } from '@/services/mcp/toolManifest';
import { SUPPLEMENTAL_MCP_TOOLS } from '@/lib/mcp/supplementalToolDefinitions';
import { DISCOVERY_CONTROL_TOOLS } from '@/lib/mcp/progressiveDiscovery';
import fs from 'fs';

async function runAudit() {
  console.log('=== STARTING ALPHACLONE MCP AUDIT ===\n');

  // Initialize tool registry
  initializeRegistry();

  // 1. Registry tools
  const registryTools = listTools(false);
  console.log(`Registry tools count: ${registryTools.length}`);

  // 2. Manifest tools
  console.log(`Manifest tools count: ${MCP_TOOLS.length}`);

  // 3. Supplemental tools
  console.log(`Supplemental tools count: ${SUPPLEMENTAL_MCP_TOOLS.length}`);

  // 4. Discovery Control tools
  console.log(`Discovery Control tools count: ${DISCOVERY_CONTROL_TOOLS.length}`);

  // 5. Unified MCP Tools (Full Catalog)
  const fullCatalog = await getUnifiedMcpTools({ sanitizeForClient: false, catalogMode: 'full' });
  console.log(`Full catalog unified tools count: ${fullCatalog.length}`);

  // 6. Unified MCP Tools (Sanitized for client / discovery response)
  const sanitizedFullCatalog = await getUnifiedMcpTools({ sanitizeForClient: true, catalogMode: 'full' });
  console.log(`Sanitized full catalog tools count: ${sanitizedFullCatalog.length}`);

  // 7. Progressive Catalog
  const progressiveCatalog = await getUnifiedMcpTools({ sanitizeForClient: true, catalogMode: 'progressive' });
  console.log(`Progressive catalog tools count: ${progressiveCatalog.length}`);

  // 8. Analyze Schema Payload Sizes
  const fullJsonStr = JSON.stringify(sanitizedFullCatalog);
  console.log(`\nFull Sanitized Tools Payload Size: ${(fullJsonStr.length / 1024).toFixed(2)} KB (${fullJsonStr.length} characters)`);

  const rawFullJsonStr = JSON.stringify(fullCatalog);
  console.log(`Full Raw Tools Payload Size: ${(rawFullJsonStr.length / 1024).toFixed(2)} KB (${rawFullJsonStr.length} characters)`);

  let maxDescLen = 0;
  let maxDescTool = '';
  let maxSchemaLen = 0;
  let maxSchemaTool = '';
  let totalDescChars = 0;
  let totalSchemaChars = 0;

  for (const t of sanitizedFullCatalog) {
    const descLen = (t.description || '').length;
    totalDescChars += descLen;
    if (descLen > maxDescLen) {
      maxDescLen = descLen;
      maxDescTool = t.name;
    }

    const schemaStr = JSON.stringify(t.inputSchema || t.jsonSchema || {});
    const schemaLen = schemaStr.length;
    totalSchemaChars += schemaLen;
    if (schemaLen > maxSchemaLen) {
      maxSchemaLen = schemaLen;
      maxSchemaTool = t.name;
    }
  }

  console.log(`\nAverage Tool Description Length: ${Math.round(totalDescChars / sanitizedFullCatalog.length)} chars`);
  console.log(`Largest Description: ${maxDescTool} (${maxDescLen} chars)`);
  console.log(`Average Tool Schema Length: ${Math.round(totalSchemaChars / sanitizedFullCatalog.length)} chars`);
  console.log(`Largest Schema: ${maxSchemaTool} (${maxSchemaLen} chars)`);

  // Check Collisions / Duplicates across sources
  console.log('\n--- COLLISION AUDIT ---');
  const allSourceNames: { name: string; source: string }[] = [];
  registryTools.forEach(t => allSourceNames.push({ name: t.name, source: 'registry' }));
  MCP_TOOLS.forEach(t => allSourceNames.push({ name: t.name, source: 'manifest' }));
  SUPPLEMENTAL_MCP_TOOLS.forEach(t => allSourceNames.push({ name: t.name, source: 'supplemental' }));
  DISCOVERY_CONTROL_TOOLS.forEach(t => allSourceNames.push({ name: t.name, source: 'discovery_control' }));

  const nameCounts = new Map<string, string[]>();
  for (const item of allSourceNames) {
    const existing = nameCounts.get(item.name) || [];
    existing.push(item.source);
    nameCounts.set(item.name, existing);
  }

  let duplicateCount = 0;
  const duplicatesList: { name: string; sources: string[] }[] = [];
  for (const [name, sources] of nameCounts.entries()) {
    if (sources.length > 1) {
      duplicateCount++;
      duplicatesList.push({ name, sources });
    }
  }
  console.log(`Total Unique Tool Names across sources: ${nameCounts.size}`);
  console.log(`Total Tools with Duplicated Sources: ${duplicateCount}`);

  // Save audit data to JSON for detailed report generation
  const reportData = {
    registryToolsCount: registryTools.length,
    manifestToolsCount: MCP_TOOLS.length,
    supplementalToolsCount: SUPPLEMENTAL_MCP_TOOLS.length,
    discoveryControlCount: DISCOVERY_CONTROL_TOOLS.length,
    fullCatalogCount: fullCatalog.length,
    progressiveCatalogCount: progressiveCatalog.length,
    payloadSizeBytes: fullJsonStr.length,
    totalDescChars,
    totalSchemaChars,
    maxDescTool: { name: maxDescTool, length: maxDescLen },
    maxSchemaTool: { name: maxSchemaTool, length: maxSchemaLen },
    duplicatesCount: duplicateCount,
    duplicatesList,
    fullToolNames: fullCatalog.map(t => t.name),
  };

  fs.writeFileSync('./mcp_audit_raw_summary.json', JSON.stringify(reportData, null, 2));
  console.log('\nSaved mcp_audit_raw_summary.json');
}

runAudit().catch(console.error);
