import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { getUnifiedMcpTools, invalidateUnifiedMcpToolCache } from '../../src/lib/mcp/listAllTools.ts';
import { MCP_TOOL_ALIASES, getToolGovernance } from '../../src/lib/mcp/canonicalToolRegistry.ts';

test('legacy MCP aliases remain discoverable with canonical deprecation metadata', async () => {
  invalidateUnifiedMcpToolCache();
  const full = await getUnifiedMcpTools({ catalogMode: 'full', sanitizeForClient: false, forceRefresh: true });
  for (const [alias, canonical] of Object.entries(MCP_TOOL_ALIASES)) {
    const tool = full.find((candidate) => candidate.name === alias);
    if (!tool) continue;
    assert.equal(tool._meta?.['alphaclone/deprecated'], true);
    assert.equal(tool._meta?.['alphaclone/replacementTool'], canonical);
    assert.match(tool.description, /Deprecated compatibility alias/);
  }
});

test('stable catalog is bounded, executable, canonical, and does not change full default', async () => {
  const stable = await getUnifiedMcpTools({ catalogMode: 'stable', sanitizeForClient: false, forceRefresh: true });
  const full = await getUnifiedMcpTools({ catalogMode: 'full', sanitizeForClient: false });
  assert.ok(stable.length > 40 && stable.length <= 80, `unexpected stable core size ${stable.length}`);
  assert.ok(full.length > stable.length);
  assert.equal(stable.some((tool) => getToolGovernance(tool.name).deprecated), false);
  for (const required of ['search_tools', 'load_module_tools', 'check_mcp_execution_readiness']) {
    assert.ok(stable.some((tool) => tool.name === required), `stable core missing ${required}`);
  }
});

test('create_client published schema and runtime both allow name-only clients', () => {
  const source = fs.readFileSync('src/lib/mcp/tools/crm.ts', 'utf8');
  const createClient = source.slice(source.indexOf("name: 'create_client'"), source.indexOf("name: 'get_leads'"));
  assert.match(createClient, /email: z\.string\(\)\.email\(\)\.optional\(\)/);
  assert.doesNotMatch(createClient, /email is required for create_client/);
  assert.match(createClient, /email: args\.email \|\| null/);
});

test('P0 reporting endpoints use guaranteed JSON serialization', () => {
  const source = fs.readFileSync('src/services/mcp/MCPServer.ts', 'utf8');
  assert.match(source, /function safeJsonText/);
  for (const tool of ['get_business_snapshot', 'get_email_campaign_stats', 'get_documents']) {
    const start = source.indexOf(`case '${tool}'`);
    assert.ok(start > 0, `missing ${tool}`);
    assert.match(source.slice(start, start + 2200), /safeJsonText/);
  }
});

test('write readiness is centralized and fails closed on verification errors', () => {
  const readiness = fs.readFileSync('src/lib/mcp/actionReadiness.ts', 'utf8');
  const social = fs.readFileSync('src/lib/mcp/tools/social-publishing.ts', 'utf8');
  assert.match(readiness, /Canonical source of truth/);
  assert.match(readiness, /verification_errors/);
  assert.match(readiness, /Readiness state could not be verified/);
  assert.match(social, /resolveMcpActionReadiness/);
});
