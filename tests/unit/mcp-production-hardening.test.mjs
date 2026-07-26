import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { negotiateClientCapabilities } from '../../src/lib/mcp/clientCapabilities.ts';
import { coreTools, searchToolCatalog } from '../../src/lib/mcp/progressiveDiscovery.ts';

test('capability negotiation is conservative for generic clients', () => {
  const caps = negotiateClientCapabilities({ protocolVersion: '2025-11-25', clientName: 'unknown' });
  assert.equal(caps.supportsTools, true);
  assert.equal(caps.supportsFileUpload, false);
  assert.equal(caps.maxToolCount, 32);
});

test('advertised MCP capabilities override conservative presentation defaults', () => {
  const caps = negotiateClientCapabilities({
    protocolVersion: '2025-11-25',
    clientName: 'Claude Code',
    advertised: { resources: true, prompts: true, tasks: true },
  });
  assert.equal(caps.supportsResources, true);
  assert.equal(caps.supportsTasks, true);
});

test('progressive discovery caps core and searches modules', () => {
  const tools = Array.from({ length: 100 }, (_, i) => ({
    name: i < 40 ? `task_${i}` : `invoice_${i}`,
    description: `tool ${i}`,
    inputSchema: { type: 'object' },
  }));
  tools[0].name = 'list_tasks';
  tools[1].name = 'create_task';
  assert.ok(coreTools(tools).length <= 32);
  assert.equal(searchToolCatalog(tools, { module: 'finance', limit: 10 }).length, 10);
});

test('migration preserves legacy tokens and removes unsafe uniqueness', () => {
  const sql = fs.readFileSync('supabase/migrations/20260727150000_mcp_oauth_grants_multiclient_hardening.sql', 'utf8');
  assert.match(sql, /Preserve every legacy connection/);
  assert.match(sql, /DROP INDEX IF EXISTS public\.mcp_oauth_tokens_active_user_client_uidx/);
  assert.doesNotMatch(sql, /CREATE UNIQUE INDEX[\\s\\S]{0,120}\\(user_id,\\s*client_id\\)/i);
  assert.match(sql, /UNIQUE INDEX IF NOT EXISTS mcp_oauth_tokens_active_family_uidx/);
});
