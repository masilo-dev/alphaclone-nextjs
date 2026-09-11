import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyEventPriority,
  isMutatingMcpTool,
  shouldSendImmediateEmail,
} from '../../src/lib/notifications/eventCatalog.ts';

test('event catalog classifies security and failures as urgent', () => {
  assert.equal(classifyEventPriority('security.login'), 'P0');
  assert.equal(classifyEventPriority('campaign.failed', 'failed'), 'P1');
  assert.equal(classifyEventPriority('lead.replied'), 'P1');
  assert.equal(classifyEventPriority('mcp.action_completed'), 'P3');
});

test('event catalog detects mutating MCP tools', () => {
  assert.equal(isMutatingMcpTool('create_lead'), true);
  assert.equal(isMutatingMcpTool('publish_social_post'), true);
  assert.equal(isMutatingMcpTool('list_leads'), false);
  assert.equal(isMutatingMcpTool('get_system_health'), false);
});

test('immediate email only for P0/P1 or explicit patterns', () => {
  assert.equal(shouldSendImmediateEmail('invoice.overdue', 'P1'), true);
  assert.equal(shouldSendImmediateEmail('lead.created', 'P2'), false);
});
