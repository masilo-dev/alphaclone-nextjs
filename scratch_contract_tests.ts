/**
 * Automated MCP Contract Test Suite
 * 
 * Verifies that:
 * 1. All 499+ canonical tools are registered.
 * 2. All registered tools have valid inputSchema objects.
 * 3. Zero tools are discoverable-but-unexecutable.
 * 4. search_tools / load_module_tools are available as core discovery tools.
 * 5. Progressive catalog returns a bounded core (≤50).
 * 6. Full catalog returns all 499+ tools.
 */

import { initializeRegistry, listTools } from './src/lib/mcp/tool-registry';
import { getUnifiedMcpTools } from './src/lib/mcp/listAllTools';
import { MCP_TOOLS } from './src/services/mcp/toolManifest';
import { SUPPLEMENTAL_MCP_TOOLS } from './src/lib/mcp/supplementalToolDefinitions';
import * as fs from 'fs';

type TestResult = { name: string; passed: boolean; detail?: string };

function assert(name: string, condition: boolean, detail?: string): TestResult {
  return { name, passed: condition, detail: condition ? '✓' : `✗ ${detail || 'FAILED'}` };
}

async function runContractTests() {
  initializeRegistry();

  const registeredTools = listTools(false);
  const registeredNames = new Set(registeredTools.map(t => t.name));
  
  const fullCatalog = await getUnifiedMcpTools({ catalogMode: 'full', sanitizeForClient: false });
  const progressiveCatalog = await getUnifiedMcpTools({ catalogMode: 'progressive', sanitizeForClient: false });

  const mcpServerCode = fs.readFileSync('./src/services/mcp/MCPServer.ts', 'utf-8');
  const caseMatches = Array.from(mcpServerCode.matchAll(/case\s+['"]([^'"]+)['"]\s*:/g)).map(m => m[1]);
  const mcpServerCases = new Set(caseMatches);

  const routeCode = fs.readFileSync('./src/app/api/mcp/route.ts', 'utf-8');
  const routeCases = new Set(Array.from(routeCode.matchAll(/toolName\s*===\s*['"]([^'"]+)['"]/g)).map(m => m[1]));

  const tests: TestResult[] = [];

  // ── T1: Registry size ─────────────────────────────────────────────────────
  tests.push(assert(
    'T1: Registry has ≥ 499 tools',
    registeredTools.length >= 499,
    `Only ${registeredTools.length} tools registered`
  ));

  // ── T2: Full catalog completeness ─────────────────────────────────────────
  tests.push(assert(
    'T2: Full catalog ≥ 499 tools',
    fullCatalog.length >= 499,
    `Full catalog has ${fullCatalog.length}`
  ));

  // ── T3: Zero unexecutable tools ───────────────────────────────────────────
  const unexecutable = fullCatalog.filter(t =>
    !registeredNames.has(t.name) && !mcpServerCases.has(t.name) && !routeCases.has(t.name)
  );
  tests.push(assert(
    'T3: Zero unexecutable tools in full catalog',
    unexecutable.length === 0,
    `${unexecutable.length} unexecutable: ${unexecutable.slice(0, 5).map(t => t.name).join(', ')}`
  ));

  // ── T4: All manifest tools in registry ───────────────────────────────────
  const missingManifest = MCP_TOOLS.filter(t => !registeredNames.has(t.name));
  tests.push(assert(
    'T4: All manifest tools in registry',
    missingManifest.length === 0,
    `${missingManifest.length} manifest tools missing from registry`
  ));

  // ── T5: All supplemental tools in registry ───────────────────────────────
  const missingSupp = SUPPLEMENTAL_MCP_TOOLS.filter(t => !registeredNames.has(t.name));
  tests.push(assert(
    'T5: All supplemental tools in registry',
    missingSupp.length === 0,
    `${missingSupp.length} supplemental tools missing from registry`
  ));

  // ── T6: Progressive catalog bounded (≤50 core) ───────────────────────────
  tests.push(assert(
    'T6: Progressive catalog is bounded (≤ 50)',
    progressiveCatalog.length <= 50,
    `Progressive catalog too large: ${progressiveCatalog.length}`
  ));

  // ── T7: Discovery tools always in progressive catalog ─────────────────────
  const discoveryTools = ['search_tools', 'load_module_tools', 'list_modules', 'list_capabilities', 'load_skill'];
  for (const name of discoveryTools) {
    tests.push(assert(
      `T7: '${name}' in progressive catalog`,
      progressiveCatalog.some(t => t.name === name),
      `'${name}' missing from progressive catalog`
    ));
  }

  // ── T8: Schema validity check ─────────────────────────────────────────────
  const invalidSchema = registeredTools.filter(t => !t.inputSchema || typeof t.inputSchema !== 'object');
  tests.push(assert(
    'T8: All registered tools have valid inputSchema',
    invalidSchema.length === 0,
    `${invalidSchema.length} tools with invalid schema: ${invalidSchema.slice(0, 3).map(t => t.name).join(', ')}`
  ));

  // ── T9: No duplicate tool names ───────────────────────────────────────────
  const fullNames = fullCatalog.map(t => t.name);
  const uniqueNames = new Set(fullNames);
  tests.push(assert(
    'T9: No duplicate tool names in full catalog',
    fullNames.length === uniqueNames.size,
    `${fullNames.length - uniqueNames.size} duplicates found`
  ));

  // ── T10: Progressive + modules = expected coverage ────────────────────────
  const withEmail = await getUnifiedMcpTools({ catalogMode: 'progressive', loadedModules: ['email', 'finance', 'crm'] });
  tests.push(assert(
    'T10: Progressive with email+finance+crm modules > 50 tools',
    withEmail.length > 50,
    `Only ${withEmail.length} tools with 3 modules loaded`
  ));

  // ── T11: send_email has registered handler ────────────────────────────────
  tests.push(assert(
    'T11: send_email has registered handler',
    registeredNames.has('send_email'),
    'send_email not in registry'
  ));

  // ── T12: dispatch_tool / execute_action exist ─────────────────────────────
  tests.push(assert('T12: dispatch_tool registered', registeredNames.has('dispatch_tool'), 'dispatch_tool not in registry'));
  tests.push(assert('T13: execute_action registered', registeredNames.has('execute_action'), 'execute_action not in registry'));

  // ── Print results ─────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════');
  console.log('  AlphaClone MCP Contract Test Suite');
  console.log('══════════════════════════════════════════════\n');

  let passed = 0;
  let failed = 0;

  for (const result of tests) {
    const icon = result.passed ? '✅' : '❌';
    console.log(`${icon} ${result.name}`);
    if (!result.passed && result.detail) {
      console.log(`     ${result.detail}`);
    }
    if (result.passed) passed++; else failed++;
  }

  console.log('\n══════════════════════════════════════════════');
  console.log(`TOTAL: ${tests.length} tests — PASSED: ${passed} — FAILED: ${failed}`);
  console.log('══════════════════════════════════════════════\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runContractTests().catch(err => {
  console.error('Contract test runner error:', err);
  process.exit(1);
});
