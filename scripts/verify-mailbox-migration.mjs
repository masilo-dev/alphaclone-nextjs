// Run with PGLITE_MODULE_PATH pointing to an installed @electric-sql/pglite module.
// This uses PostgreSQL locally; it is not evidence of production mailbox access.
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const { PGlite } = await import(
  process.env.PGLITE_MODULE_PATH || '@electric-sql/pglite'
);
const db = new PGlite();
await db.exec(`
 CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
 CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
 CREATE TABLE tenants(id uuid PRIMARY KEY);
 CREATE TABLE integrations(id uuid PRIMARY KEY);
 CREATE TABLE email_sender_addresses(id uuid PRIMARY KEY);
 CREATE TABLE tenant_members(user_id uuid,tenant_id uuid);
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT NULL::uuid$$;
`);
// Use the existing canonical production table definitions, not a replacement schema.
const foundation = await readFile(
  new URL(
    '../supabase/migrations/20260726230000_unified_email_foundation.sql',
    import.meta.url,
  ),
  'utf8',
);
const end = foundation.indexOf(
  'CREATE TABLE IF NOT EXISTS public.email_outbound_jobs',
);
await db.exec(
  foundation.slice(
    foundation.indexOf(
      'CREATE TABLE IF NOT EXISTS public.email_provider_accounts',
    ),
    end,
  ),
);
const migration = await readFile(
  new URL(
    '../supabase/migrations/20261008090000_mcp_mailbox_sync.sql',
    import.meta.url,
  ),
  'utf8',
);
await db.exec(migration);
await db.exec(migration); // Repeat deployment must be harmless.
const threadingMigration = await readFile(
  new URL(
    '../supabase/migrations/20261008090001_mcp_mailbox_thread_identity.sql',
    import.meta.url,
  ),
  'utf8',
);
await db.exec(threadingMigration);
await db.exec(threadingMigration);
const tenant = '00000000-0000-4000-8000-000000000001',
  account = '00000000-0000-4000-8000-000000000002',
  other = '00000000-0000-4000-8000-000000000003';
await db.query('INSERT INTO tenants(id) VALUES($1),($2)', [tenant, other]);
await db.query(
  "INSERT INTO email_provider_accounts(id,tenant_id,provider,account_type) VALUES($1,$2,'zoho','user')",
  [account, tenant],
);
const message = {
  id: 'native-1',
  thread_id: 'thread-1',
  subject: 'Test',
  date: '2026-10-08T05:00:00Z',
  direction: 'inbound',
  is_read: false,
  folder_id: 'folder-1',
  folder_name: 'inbox',
  from: 'sender@example.com',
  to: ['owner@example.com'],
  cc: [],
  body_text: 'Exact body',
  body_html: '<p>Exact body</p>',
  attachments: [],
  headers: { 'message-id': '<1@example.com>' },
};
const ingest = async (t, m) =>
  (
    await db.query('SELECT ingest_mailbox_message($1,$2,$3::jsonb) AS id', [
      t,
      account,
      JSON.stringify(m),
    ])
  ).rows[0].id;
const first = await ingest(tenant, message);
assert.equal(await ingest(tenant, message), first);
assert.equal(
  (await db.query('SELECT count(*)::integer AS n FROM email_messages')).rows[0]
    .n,
  1,
);
assert.equal(
  (
    await db.query(
      'SELECT count(*)::integer AS n FROM email_message_recipients',
    )
  ).rows[0].n,
  1,
);
await ingest(tenant, {
  ...message,
  id: 'reply-1',
  direction: 'outbound',
  folder_name: 'sent',
  is_read: true,
  date: '2026-10-08T05:01:00Z',
});
assert.equal(
  (
    await db.query(
      'SELECT count(DISTINCT thread_id)::integer AS n FROM email_messages',
    )
  ).rows[0].n,
  1,
);
// Provider-native reply readback must retain the original conversation root.
await ingest(tenant, {
  ...message,
  id: 'reply-1',
  thread_id: 'native-1',
  direction: 'outbound',
  folder_name: 'sent',
  date: '2026-10-08T05:01:00Z',
});
assert.equal(
  (
    await db.query(
      "SELECT provider_thread_id FROM email_messages WHERE provider_message_id='reply-1'",
    )
  ).rows[0].provider_thread_id,
  'thread-1',
);
await assert.rejects(
  () => ingest(other, message),
  /EMAIL_ACCOUNT_TENANT_MISMATCH/,
);
const rows = (
  await db.query(
    'SELECT provider_message_id,mailbox_sort_at FROM email_messages ORDER BY mailbox_sort_at',
  )
).rows;
assert.equal(rows[0].provider_message_id, 'native-1');
assert.equal(rows[1].provider_message_id, 'reply-1');
assert.equal(
  (
    await db.query(
      "SELECT has_function_privilege('authenticated','ingest_mailbox_message(uuid,uuid,jsonb)','EXECUTE') AS allowed",
    )
  ).rows[0].allowed,
  false,
);
console.log(
  'PostgreSQL migration checks passed: repeatability, message/recipient deduplication, thread identity, ordering, tenant isolation and restricted RPC access.',
);
await db.close();
