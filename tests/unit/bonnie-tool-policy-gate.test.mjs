import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { classifyToolRisk, evaluateToolPolicy } from '../../src/lib/ai/ToolPolicyGate.ts';

test('Bonnie social publishing stays behind the policy and approval path', () => {
  const source = fs.readFileSync(new URL('../../src/lib/ai/ToolPolicyGate.ts', import.meta.url), 'utf8');
  assert.equal(classifyToolRisk('publish_social_post'), 'send');
  assert.doesNotMatch(source, /source === 'mcp' \|\| source === 'bonnie'/);
  assert.match(source, /requiresApproval/);
});

test('Bonnie invoice chasing is classified as financial', () => {
  assert.equal(classifyToolRisk('nexus_invoice_chasing'), 'financial');
});

test('Bonnie outreach is classified as a send action', () => {
  assert.equal(classifyToolRisk('send_batch_outreach'), 'send');
});

test('MCP source still auto-allows publish tools', async () => {
  const decision = await evaluateToolPolicy({
    tenantId: 'tenant-test',
    userId: 'user-test',
    toolName: 'publish_facebook_reel',
    source: 'mcp',
  });
  assert.equal(decision.outcome, 'allow');
  assert.equal(decision.riskClass, 'send');
});

test('publish_ prefix classifies as send', () => {
  assert.equal(classifyToolRisk('publish_now'), 'send');
});
