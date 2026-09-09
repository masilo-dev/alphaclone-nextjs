import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import { aggregateDigestEvents } from '../../src/lib/email/notificationDigestAggregation.ts';

test('canonical digest schema has recipient-local idempotency and pending-event indexes', async () => {
  const sql = await fs.readFile('supabase/migrations/20260909120000_notification_digest_engine.sql', 'utf8');
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.notification_digest_events/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.notification_digests/);
  assert.match(sql, /idempotency_key TEXT NOT NULL UNIQUE/);
  assert.match(sql, /check_internal_notification_budget/);
  assert.match(sql, /WHERE included_in_digest_id IS NULL/);
});

test('all unclassified internal sends are stopped at the canonical gateway', async () => {
  const source = await fs.readFile('src/lib/email/sendEmailServer.ts', 'utf8');
  assert.match(source, /internalNotificationKind\?: 'digest' \| 'immediate_exception'/);
  assert.match(source, /code: 'DIGEST_REQUIRED'/);
});

test('digest worker claims the unique key before provider delivery and aggregates events', async () => {
  const source = await fs.readFile('src/lib/email/notificationDigestEngine.ts', 'utf8');
  const claim = source.indexOf("from('notification_digests').insert");
  const send = source.indexOf('sendEmailServer({');
  assert.ok(claim > 0 && send > claim);
  assert.match(source, /aggregateDigestEvents\(events\)/);
  assert.match(source, /Math\.max\(0, events\.length - 1\)/);
  assert.match(source, /internalNotificationKind: 'digest'/);
});

test('250 identical MCP success events collapse into one concise summary group', () => {
  const events = Array.from({ length: 250 }, (_, index) => ({
    id: String(index), event_type: 'mcp.action_completed', event_category: 'mcp',
    entity_type: 'lead', entity_id: String(index), source_action: 'create_lead',
    severity: 'info', title: 'Lead added', summary: `Lead ${index} added`,
  }));
  const aggregated = aggregateDigestEvents(events);
  assert.equal(aggregated.length, 1);
  assert.equal(aggregated[0].count, 250);
});
