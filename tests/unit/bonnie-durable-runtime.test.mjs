import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');

test('durable runtime migration and services exist', () => {
  const required = [
    'supabase/migrations/20260724170000_bonnie_durable_runtime.sql',
    'src/lib/bonnie/runtime/taskStateMachine.ts',
    'src/lib/bonnie/runtime/outboxService.ts',
    'src/lib/bonnie/runtime/inboxService.ts',
    'src/lib/bonnie/runtime/leaseService.ts',
    'src/lib/bonnie/runtime/workerService.ts',
    'src/lib/bonnie/runtime/checkpointService.ts',
    'src/lib/bonnie/runtime/reconciliation/index.ts',
    'src/app/api/cron/bonnie-runtime-worker/route.ts',
    'src/app/api/cron/bonnie-runtime-outbox/route.ts',
    'src/app/api/cron/bonnie-runtime-reconcile/route.ts',
    'src/app/api/cron/bonnie-runtime-timers/route.ts',
    'src/app/api/bonnie/runtime/runs/route.ts',
    'src/components/dashboard/bonnie/runtime/BonnieRuntimePanel.tsx',
    'docs/BONNIE_DURABLE_EXECUTION.md',
  ];
  for (const rel of required) {
    assert.equal(fs.existsSync(path.join(root, rel)), true, rel);
  }
});

test('migration defines outbox inbox claim and graph transaction', () => {
  const sql = fs.readFileSync(
    path.join(root, 'supabase/migrations/20260724170000_bonnie_durable_runtime.sql'),
    'utf8',
  );
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.agent_runs/);
  assert.match(sql, /agent_event_outbox/);
  assert.match(sql, /agent_event_inbox/);
  assert.match(sql, /create_agent_graph_transaction/);
  assert.match(sql, /claim_agent_task/);
  assert.match(sql, /EXECUTION_UNCERTAIN/);
  assert.match(sql, /fencing_token/);
});

test('railway crons register durable workers', () => {
  const crons = JSON.parse(fs.readFileSync(path.join(root, 'railway.crons.json'), 'utf8'));
  const paths = crons.crons.map((c) => c.path);
  assert.ok(paths.includes('/api/cron/bonnie-runtime-worker'));
  assert.ok(paths.includes('/api/cron/bonnie-runtime-outbox'));
  assert.ok(paths.includes('/api/cron/bonnie-runtime-reconcile'));
  assert.ok(paths.includes('/api/cron/bonnie-runtime-timers'));
});

test('thin outbox payload shape is documented in outbox service', () => {
  const src = fs.readFileSync(path.join(root, 'src/lib/bonnie/runtime/outboxService.ts'), 'utf8');
  const types = fs.readFileSync(path.join(root, 'src/lib/bonnie/runtime/types.ts'), 'utf8');
  assert.match(types, /task_id/);
  assert.match(types, /run_id/);
  assert.match(types, /tenant_id/);
  assert.match(src, /task\.ready/);
  assert.match(src, /ThinQueuePayload/);
});

test('lease reclaim never blindly retries uncertain side effects', () => {
  const src = fs.readFileSync(path.join(root, 'src/lib/bonnie/runtime/leaseService.ts'), 'utf8');
  assert.match(src, /EXECUTION_UNCERTAIN/);
  assert.match(src, /lookupIdempotency/);
  assert.match(src, /safeToRequeue/);
});

test('bonnieAgent durable cutover is feature-flagged', () => {
  const src = fs.readFileSync(path.join(root, 'src/lib/bonnie/bonnieAgent.ts'), 'utf8');
  assert.match(src, /isDurableRuntimeEnabled/);
  assert.match(src, /createRunForObjective/);
});
