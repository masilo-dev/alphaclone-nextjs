import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('canonical outbound persistence preserves provider acceptance evidence', async () => {
  const source = await read('src/lib/email/persistCanonicalEmail.ts');
  assert.match(source, /application_status:\s*'provider_accepted'/);
  assert.match(source, /delivery_status:\s*'accepted'/);
  assert.match(source, /provider_accepted_at/);
  assert.match(source, /provider_message_id/);
  assert.match(source, /email_delivery_events/);
  assert.match(source, /provider_send_response/);
});

test('canonical outbound persistence resolves CRM recipient and logs activity', async () => {
  const source = await read('src/lib/email/persistCanonicalEmail.ts');
  assert.match(source, /resolveCrmRecipient/);
  assert.match(source, /\.from\('contacts'\)/);
  assert.match(source, /\.eq\('tenant_id', tenantId\)/);
  assert.match(source, /logCrmActivityAdmin/);
  assert.match(source, /direction:\s*'outbound'/);
  assert.match(source, /status:\s*'provider_accepted'/);
});

test('legacy MCP read models receive canonical provider evidence', async () => {
  const migration = await read('supabase/migrations/20260912180500_email_legacy_read_model_bridge.sql');
  assert.match(migration, /bridge_canonical_outbound_email_recipient/);
  assert.match(migration, /lead_outreach_log/);
  assert.match(migration, /project_email_dispatches/);
  assert.match(migration, /provider_message_id/);
  assert.match(migration, /provider_accepted/);
  assert.match(migration, /NEW\.tenant_id/);
});

test('delivery lookup remains tenant scoped', async () => {
  const source = await read('src/lib/mcp/tools/autonomous-ops.ts');
  const start = source.indexOf("name: 'get_delivery_status'");
  assert.notEqual(start, -1);
  const section = source.slice(start, start + 2200);
  assert.match(section, /\.eq\('tenant_id', args\.tenant_id\)/);
  assert.match(section, /\.eq\('tracking_id', args\.message_id\)/);
});

test('search email lookup remains tenant scoped', async () => {
  const source = await read('src/lib/mcp/tools/email-ops.ts');
  const start = source.indexOf("name: 'search_emails'");
  assert.notEqual(start, -1);
  const section = source.slice(start, start + 2500);
  assert.match(section, /project_email_dispatches/);
  assert.match(section, /\.eq\('tenant_id', tenantId\)/);
});
