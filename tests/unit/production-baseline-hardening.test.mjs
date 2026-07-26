import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('canonical tenant membership queries do not probe optional status column', () => {
  const source = fs.readFileSync('src/lib/tenant/platformTenant.ts', 'utf8');
  assert.doesNotMatch(source, /\.from\('tenant_users'\)[\s\S]{0,120}\.select\('[^']*status/);
});

test('MCP approval does not generate schema-error probes for tenant_users.status', () => {
  const source = fs.readFileSync('src/app/api/mcp/oauth/approve/route.ts', 'utf8');
  assert.doesNotMatch(source, /\.from\('tenant_users'\)[\s\S]{0,120}\.select\('[^']*status/);
});

test('server-only PII and quarantine tables are closed by reversible migration', () => {
  const up = fs.readFileSync('supabase/migrations/20260727160000_close_public_compliance_and_quarantine_tables.sql', 'utf8');
  const down = fs.readFileSync('supabase/rollbacks/20260727160000_close_public_compliance_and_quarantine_tables.down.sql', 'utf8');
  for (const table of ['data_requests', 'tenant_isolation_quarantine']) {
    assert.match(up, new RegExp(`ALTER TABLE IF EXISTS public\\.${table} ENABLE ROW LEVEL SECURITY`));
    assert.match(up, new RegExp(`REVOKE ALL ON TABLE public\\.${table} FROM anon, authenticated`));
    assert.match(down, new RegExp(`GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public\\.${table} TO authenticated`));
  }
});

test('production audit command is read-only by default', () => {
  const source = fs.readFileSync('scripts/audit-production-readiness.mjs', 'utf8');
  assert.doesNotMatch(source, /db['", ]+push|apply_migration|db reset|--include-seed/);
  assert.match(source, /mutationPerformed: false/);
});

test('public views flagged by Supabase use caller RLS', () => {
  const sql = fs.readFileSync('supabase/migrations/20260727161000_security_invoker_public_views.sql', 'utf8');
  for (const view of [
    'user_tenant_roles',
    'facebook_integrations_safe',
    'linkedin_integrations_safe',
    'unified_tickets',
  ]) {
    assert.match(sql, new RegExp(`['"]${view}['"]`));
  }
  assert.match(sql, /security_invoker = true/);
});

test('security-definer hardening preserves signatures and fixes search path', () => {
  const sql = fs.readFileSync('supabase/migrations/20260727162000_harden_security_definer_search_paths.sql', 'utf8');
  assert.match(sql, /p\.prosecdef/);
  assert.match(sql, /p\.oid::regprocedure/);
  assert.match(sql, /search_path TO public, extensions, pg_temp/);
  assert.doesNotMatch(sql, /DROP FUNCTION|CREATE OR REPLACE FUNCTION/i);
});

test('Auth confirmation verifies token hash server-side with recovery routing', () => {
  const source = fs.readFileSync('src/app/auth/confirm/route.ts', 'utf8');
  assert.match(source, /verifyOtp\(\{ token_hash: tokenHash, type: rawType \}\)/);
  assert.match(source, /rawType === 'recovery'/);
  assert.match(source, /auth\/reset-password/);
  assert.doesNotMatch(source, /console\.(?:log|error).*token/i);
});
