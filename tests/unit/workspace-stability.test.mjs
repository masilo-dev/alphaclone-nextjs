import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const root = new URL('../..', import.meta.url);

function read(path) {
  return readFileSync(new URL(path, root), 'utf8');
}

test('workspace health endpoint checks core modules and integration config', () => {
  const src = read('src/app/api/health/workspace/route.ts');
  for (const table of ['leads', 'business_invoices', 'business_receipts', 'campaign_recipients', 'tasks', 'social_posts', 'linkedin_integrations', 'unified_messages', 'email_provider_accounts', 'doc_os_documents']) {
    assert.match(src, new RegExp(`'${table}'`));
  }
  assert.match(src, /LINKEDIN_CLIENT_SECRET/);
  assert.match(src, /CRON_SECRET/);
  assert.match(src, /listBuckets/);
});

test('workspace realtime readiness migration covers inbox, email, CRM, finance, docs, tasks, and social tables', () => {
  const src = read('supabase/migrations/20260808195057_workspace_realtime_readiness.sql');
  for (const table of ['unified_messages', 'email_provider_accounts', 'leads', 'business_invoices', 'tasks', 'doc_os_documents', 'social_posts', 'webhook_events']) {
    assert.match(src, new RegExp(`'${table}'`));
  }
  assert.match(src, /to_regclass/);
  assert.match(src, /ALTER PUBLICATION supabase_realtime ADD TABLE/);
});

test('database workspace audit reports missing tables, RLS, realtime, and key data warnings', () => {
  const src = read('scripts/database/workspace_readiness_audit.sql');
  for (const check of ['table_missing', 'rls_disabled', 'realtime_missing', 'email_accounts_active', 'invoices_missing_client_email']) {
    assert.match(src, new RegExp(check));
  }
});

test('LinkedIn developer app webhook performs HMAC challenge and signature verification', () => {
  const src = read('src/app/api/linkedin/webhook/route.ts');
  assert.match(src, /challengeCode/);
  assert.match(src, /challengeResponse/);
  assert.match(src, /createHmac\('sha256'/);
  assert.match(src, /hmacsha256=\$\{rawBody\}/);
  assert.match(src, /x-li-signature/i);
  assert.match(src, /externalEventId/);
  assert.match(src, /leadGenFormResponse.*occurredAt/s);
  assert.match(src, /syncLinkedInLeadToCrm/);
});

test('legacy LinkedIn lead webhook delegates to the signed canonical handler', () => {
  const src = read('src/app/api/webhooks/linkedin/leads/route.ts');
  assert.match(src, /export \{ GET, POST \} from '\.\.\/\.\.\/\.\.\/linkedin\/webhook\/route'/);
  assert.doesNotMatch(src, /hub\.challenge|req\.json\(\)/);
});

test('cron invoice reminder writes remain tenant scoped', () => {
  const src = read('src/app/api/cron/process-invoice-overdue-reminders/route.ts');
  assert.match(src, /\.eq\('id', invoice\.id\)[\s\S]{0,80}\.eq\('tenant_id', invoice\.tenant_id\)/);
});

test('social cron status writes use id and tenant predicates', () => {
  const src = read('src/lib/social/cronPublish.ts');
  assert.match(src, /updateSocialPostStatusWithFallback\(\s*postId,\s*post\.tenant_id/);
  assert.match(src, /\.eq\('tenant_id', post\.tenant_id\)/);
});
