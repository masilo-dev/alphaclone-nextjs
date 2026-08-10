import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(
  new URL('../../src/lib/mcp/tools/bonnie-approvals.ts', import.meta.url),
  'utf8'
);

test('list_pending_approvals uses the real autonomous_runner_approvals columns', () => {
  assert.doesNotMatch(source, /\.select\([^)]*action_type/);
  assert.match(source, /\.select\('id, action_key, risk_level, status, reason, payload, created_at, workflow_id'\)/);
  assert.match(source, /row\.action_key/);
});

test('approval MCP tools cover queued action approval and rejection', async () => {
  const { initializeRegistry, hasTool } =
    await import('../../src/lib/mcp/tool-registry.ts');

  initializeRegistry();
  assert.equal(hasTool('list_pending_approvals'), true);
  assert.equal(hasTool('approve_pending_action'), true);
  assert.equal(hasTool('reject_pending_action'), true);
});
