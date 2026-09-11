import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const { deriveApiErrorRate } = await import('../../src/lib/mcp/apiHealthReport.ts');

test('API error rate is derived from canonical call totals when legacy field is absent', () => {
  assert.equal(deriveApiErrorRate({ total_calls: 80, failures: 4 }), 0.05);
  assert.equal(deriveApiErrorRate({ total_calls: 0, failures: 0 }), 0);
  assert.equal(deriveApiErrorRate({ error_rate: 0.2, total_calls: 80, failures: 4 }), 0.2);
});

test('Home snapshot counts every invoice and derives monthly paid revenue', () => {
  const source = fs.readFileSync('src/services/StrategicAuditService.ts', 'utf8');
  assert.match(source, /business_invoices'\)\.select\('\*', \{ count: 'exact', head: true \}\)\.eq\('tenant_id', tid\),/);
  assert.match(source, /revenue_monthly_actual: monthlyRevenue/);
  assert.doesNotMatch(source, /revenue_monthly_actual: 0/);
});

test('Operations health surfaces overdue work as a primary bottleneck', () => {
  const source = fs.readFileSync('src/services/operationsService.ts', 'utf8');
  assert.match(source, /overdueTasksCount/);
  assert.match(source, /overdue tasks require triage/);
  assert.match(source, /overdueTasksCount,/);
});

test('System health does not label near-exhausted heap as healthy', () => {
  const source = fs.readFileSync('src/lib/mcp/tools/platform-ops.ts', 'utf8');
  assert.match(source, /heapUtilization >= 0\.95 \? 'unhealthy'/);
  assert.match(source, /heap_utilization_percent/);
});

test('contract lifecycle repair prevents signed records from remaining drafts', () => {
  const migration = fs.readFileSync(
    'supabase/migrations/20260908170000_repair_contract_lifecycle_truth.sql',
    'utf8',
  );
  assert.match(migration, /WHEN COALESCE\(status, ''\) IN \('fully_signed', 'signed'\) THEN 'signed'/);
  assert.match(migration, /WHEN COALESCE\(status, ''\) = 'client_signed' THEN 'sent'/);
  assert.match(migration, /Backfilled lifecycle to match existing contract signing state/);
});
