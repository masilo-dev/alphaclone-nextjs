import test from 'node:test';
import assert from 'node:assert/strict';

const { shouldUseMcpDirectExecution } = await import('../../src/lib/mcp/mcpDirectExecution.ts');

test('send_email defaults to direct execution for ChatGPT MCP', () => {
  assert.equal(shouldUseMcpDirectExecution('send_email'), true);
});

test('send_email uses durable only when MCP_SEND_EMAIL_DURABLE=true', () => {
  const prev = process.env.MCP_SEND_EMAIL_DURABLE;
  process.env.MCP_SEND_EMAIL_DURABLE = 'true';
  assert.equal(shouldUseMcpDirectExecution('send_email'), false);
  process.env.MCP_SEND_EMAIL_DURABLE = prev;
});

test('social publish defaults to direct execution', () => {
  assert.equal(shouldUseMcpDirectExecution('publish_social_post'), true);
});

test('bulk and campaign email tools default to direct execution', () => {
  for (const tool of [
    'send_bulk_email',
    'send_bulk_email_campaign',
    'create_bulk_email_campaign',
    'queue_email_campaign_send',
  ]) {
    assert.equal(shouldUseMcpDirectExecution(tool), true, `${tool} should default to direct`);
  }
});

test('bulk email uses durable only when MCP_BULK_EMAIL_DURABLE=true', () => {
  const prev = process.env.MCP_BULK_EMAIL_DURABLE;
  process.env.MCP_BULK_EMAIL_DURABLE = 'true';
  assert.equal(shouldUseMcpDirectExecution('send_bulk_email'), false);
  assert.equal(shouldUseMcpDirectExecution('queue_email_campaign_send'), false);
  process.env.MCP_BULK_EMAIL_DURABLE = prev;
});

test('batch outreach defaults to direct execution', () => {
  assert.equal(shouldUseMcpDirectExecution('send_batch_outreach'), true);
});

test('batch outreach uses durable only when MCP_BULK_OUTREACH_DURABLE=true', () => {
  const prev = process.env.MCP_BULK_OUTREACH_DURABLE;
  process.env.MCP_BULK_OUTREACH_DURABLE = 'true';
  assert.equal(shouldUseMcpDirectExecution('send_batch_outreach'), false);
  process.env.MCP_BULK_OUTREACH_DURABLE = prev;
});
