import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateToolPolicy } from '../../src/lib/ai/ToolPolicyGate.ts';

test('Bonnie source auto-allows social publish without DPA or approval queue', async () => {
  const decision = await evaluateToolPolicy({
    tenantId: 'tenant-test',
    userId: 'user-test',
    toolName: 'publish_social_post',
    source: 'bonnie',
    args: { caption: 'Hello from Bonnie', platforms: ['facebook'] },
  });
  assert.equal(decision.outcome, 'allow');
  assert.equal(decision.riskClass, 'send');
  assert.match(decision.reason, /Bonnie auto-executes/i);
});

test('Bonnie source auto-allows invoice chasing', async () => {
  const decision = await evaluateToolPolicy({
    tenantId: 'tenant-test',
    userId: 'user-test',
    toolName: 'nexus_invoice_chasing',
    source: 'bonnie',
  });
  assert.equal(decision.outcome, 'allow');
  assert.equal(decision.riskClass, 'financial');
});

test('Bonnie source auto-allows outreach send', async () => {
  const decision = await evaluateToolPolicy({
    tenantId: 'tenant-test',
    userId: 'user-test',
    toolName: 'send_batch_outreach',
    source: 'bonnie',
  });
  assert.equal(decision.outcome, 'allow');
  assert.equal(decision.riskClass, 'send');
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

test('publish_ prefix classifies as send for Bonnie allow path', async () => {
  const decision = await evaluateToolPolicy({
    tenantId: 'tenant-test',
    userId: 'user-test',
    toolName: 'publish_now',
    source: 'bonnie',
  });
  assert.equal(decision.outcome, 'allow');
  assert.equal(decision.riskClass, 'send');
});
