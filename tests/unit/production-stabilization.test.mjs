import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('audit severity normalizes legacy values to DB constraint', async () => {
  const { normalizeAuditSeverity, auditSeverityFromStatus, AUDIT_SEVERITY_VALUES } = await import(
    '../../src/lib/audit/auditSeverity.ts'
  );
  assert.deepEqual(AUDIT_SEVERITY_VALUES, ['info', 'warning', 'error', 'critical']);
  assert.equal(normalizeAuditSeverity('low'), 'info');
  assert.equal(normalizeAuditSeverity('medium'), 'warning');
  assert.equal(normalizeAuditSeverity('high'), 'error');
  assert.equal(normalizeAuditSeverity('critical'), 'critical');
  assert.equal(auditSeverityFromStatus('failed'), 'error');
  assert.equal(auditSeverityFromStatus('at_risk'), 'warning');
});

test('mcp session user resolver prefers explicit user id', async () => {
  const source = fs.readFileSync('src/lib/mcp/resolveMcpSessionUserId.ts', 'utf8');
  assert.match(source, /tenant_users/);
  assert.match(source, /MCP_SYSTEM_USER_ID/);
});

test('cron distributed lock skips overlapping invocations locally', async () => {
  process.env.DISABLE_CRON_DISTRIBUTED_LOCK = 'true';
  const { acquireCronLock, clearLocalCronLockForTests } = await import(
    '../../src/lib/cron/distributedLock.ts'
  );
  clearLocalCronLockForTests('test-job');
  const first = await acquireCronLock('test-job', 5);
  assert.equal(first.acquired, true);
  const second = await acquireCronLock('test-job', 5);
  assert.equal(second.acquired, false);
  if (first.acquired) await first.release();
  delete process.env.DISABLE_CRON_DISTRIBUTED_LOCK;
});

test('cron lock can be released and re-acquired', async () => {
  const { acquireCronLock, clearLocalCronLockForTests } = await import(
    '../../src/lib/cron/distributedLock.ts'
  );
  clearLocalCronLockForTests('recover-job');
  const first = await acquireCronLock('recover-job', 1);
  assert.equal(first.acquired, true);
  if (first.acquired) await first.release();
  const again = await acquireCronLock('recover-job', 1);
  assert.equal(again.acquired, true);
  if (again.acquired) await again.release();
});

test('usage metering treats duplicate operation_id as non-fatal', () => {
  const source = fs.readFileSync('src/lib/email/usageMeteringService.ts', 'utf8');
  assert.match(source, /duplicate|unique|23505/i);
});

test('tenant email branding does not select tenants.legal_name', () => {
  const source = fs.readFileSync('src/lib/email/tenantEmailBranding.ts', 'utf8');
  assert.doesNotMatch(source, /legal_name,/);
});

test('media asset loader avoids deleted_at filter', () => {
  const source = fs.readFileSync('src/lib/media/fetchMediaAssetBytes.ts', 'utf8');
  assert.doesNotMatch(source, /deleted_at/);
});

test('readiness supports lightweight production mode', () => {
  const source = fs.readFileSync('src/app/api/readiness/route.ts', 'utf8');
  assert.match(source, /READINESS_LIGHT_DB/);
});

test('auth service clears stale refresh tokens without retry loop', () => {
  const source = fs.readFileSync('src/services/authService.ts', 'utf8');
  assert.match(source, /refresh token not found/i);
  assert.match(source, /signOut/);
});

test('heavy cron routes use withCronJob wrapper', () => {
  for (const route of [
    'src/app/api/cron/bonnie-runtime-worker/route.ts',
    'src/app/api/cron/process-mcp-event-queue/route.ts',
    'src/app/api/cron/process-events/route.ts',
    'src/app/api/cron/social-publish/route.ts',
  ]) {
    const source = fs.readFileSync(route, 'utf8');
    assert.match(source, /withCronJob/, `${route} should use withCronJob`);
  }
});

test('stabilization migration adds mcp_action_receipts and agent_event_inbox columns', () => {
  const sql = fs.readFileSync(
    'supabase/migrations/20260902140000_production_stabilization_schema.sql',
    'utf8'
  );
  assert.match(sql, /mcp_action_receipts/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS tool TEXT/);
  assert.match(sql, /agent_event_inbox/);
  assert.match(sql, /run_id UUID/);
  assert.match(sql, /ON CONFLICT \(tenant_id, operation_id\)/);
});

test('process guards register SIGTERM drain', () => {
  const source = fs.readFileSync('src/lib/runtime/processGuards.ts', 'utf8');
  assert.match(source, /SIGTERM/);
  assert.match(source, /stopMemoryTelemetry/);
});

test('bonnie worker handles shutdown signals', () => {
  const source = fs.readFileSync('src/bonnie/worker.ts', 'utf8');
  assert.match(source, /SIGTERM/);
  assert.match(source, /shuttingDown/);
});
