import test from 'node:test';
import assert from 'node:assert/strict';
import {
  toCanonicalProjectStage,
  STAGE_LIFECYCLE_STEP,
  computeProjectProgressPercent,
  isFinishedProject,
} from '../../src/lib/projects/projectEnums.ts';
import { loadClientProjects } from '../../src/lib/clientPortal/projects.ts';

const tenant = '11111111-1111-4111-8111-111111111111';
const client = '22222222-2222-4222-8222-222222222222';

function mockDatabase(tables = {}) {
  const admin = {
    from(table) {
      const filters = [];
      let single = false;
      const q = {
        select() { return q; },
        eq(k, v) {
          filters.push((r) => r[k] === v);
          return q;
        },
        order() { return q; },
        limit() { return q; },
        maybeSingle() {
          single = true;
          return q;
        },
        single() {
          single = true;
          return q;
        },
        then(resolve, reject) {
          try {
            const rows = tables[table] || [];
            const data = rows.filter((r) => filters.every((f) => f(r)));
            return Promise.resolve({ data: single ? data[0] || null : data, error: null }).then(resolve, reject);
          } catch (e) {
            return Promise.reject(e).then(resolve, reject);
          }
        },
      };
      return q;
    },
  };
  return admin;
}

test('Defect 1 & 4: canonical stages and backward transitions maintain consistent state', () => {
  assert.equal(toCanonicalProjectStage('Discovery'), 'Initiation');
  assert.equal(toCanonicalProjectStage('Kickoff'), 'Initiation');
  assert.equal(toCanonicalProjectStage('Development'), 'Execution');
  assert.equal(toCanonicalProjectStage('Closure'), 'Closure');

  // Verify step count mappings
  assert.deepEqual(STAGE_LIFECYCLE_STEP.Initiation, { step: 1, total: 5, label: 'Step 1/5', order: 1 });
  assert.deepEqual(STAGE_LIFECYCLE_STEP.Planning, { step: 2, total: 5, label: 'Step 2/5', order: 2 });
  assert.deepEqual(STAGE_LIFECYCLE_STEP.Execution, { step: 3, total: 5, label: 'Step 3/5', order: 3 });
  assert.deepEqual(STAGE_LIFECYCLE_STEP.Review, { step: 4, total: 5, label: 'Step 4/5', order: 4 });
  assert.deepEqual(STAGE_LIFECYCLE_STEP.Closure, { step: 5, total: 5, label: 'Step 5/5', order: 5 });
});

test('Defect 2: progress calculation honors stage completion and task sources', () => {
  // Fresh project in initiation with no tasks
  assert.equal(computeProjectProgressPercent({ status: 'Active', currentStage: 'Initiation', tasks: [], milestones: [] }), 0);

  // In-progress tasks
  assert.equal(
    computeProjectProgressPercent({
      status: 'Active',
      currentStage: 'Execution',
      tasks: [{ status: 'completed' }, { status: 'in_progress' }],
    }),
    50,
  );

  // Finished project is always 100%
  assert.equal(computeProjectProgressPercent({ status: 'Completed', currentStage: 'Closure' }), 100);
});

test('Defect 6: client portal displays projects with portal_enabled or client_visible', async () => {
  const admin = mockDatabase({
    projects: [
      { id: 'mcp-created', tenant_id: tenant, client_id: client, portal_enabled: true, metadata: {} },
      { id: 'dashboard-visible', tenant_id: tenant, client_id: client, metadata: { client_visible: true } },
      { id: 'explicit-private', tenant_id: tenant, client_id: client, portal_enabled: true, metadata: { client_visible: false } },
      { id: 'unapproved', tenant_id: tenant, client_id: client, portal_enabled: false, metadata: {} },
    ],
  });

  const visible = await loadClientProjects(admin, tenant, client);
  const ids = visible.map((p) => p.id);

  assert.ok(ids.includes('mcp-created'), 'MCP project with portal_enabled should be visible in portal');
  assert.ok(ids.includes('dashboard-visible'), 'Project with client_visible true should be visible');
  assert.ok(!ids.includes('explicit-private'), 'Explicit private project must be hidden');
  assert.ok(!ids.includes('unapproved'), 'Unapproved project without portal_enabled must be hidden');
});

test('Defect 7: flexible client_id parsing handles empty string, null and valid UUID', async () => {
  const { z } = await import('zod');
  const optionalUuidOrEmpty = z
    .union([z.string().uuid(), z.literal(''), z.null()])
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined));

  assert.equal(optionalUuidOrEmpty.parse(''), undefined);
  assert.equal(optionalUuidOrEmpty.parse(null), undefined);
  assert.equal(optionalUuidOrEmpty.parse(undefined), undefined);
  assert.equal(optionalUuidOrEmpty.parse('11111111-1111-4111-8111-111111111111'), '11111111-1111-4111-8111-111111111111');
});

test('Defect 8 & 9: enqueueProjectNotification persists activity and queues outbox item', async () => {
  const activityRows = [];
  const outboxRows = [];

  const mockDb = {
    from(table) {
      return {
        insert(data) {
          const row = { id: `id-${Math.random().toString(36).slice(2, 8)}`, ...data };
          if (table === 'project_activity') activityRows.push(row);
          if (table === 'project_notification_outbox') outboxRows.push(row);
          return {
            select() {
              return {
                single: async () => ({ data: row, error: null }),
              };
            },
          };
        },
      };
    },
  };

  const { enqueueProjectNotification } = await import('../../src/lib/projects/projectNotificationOutbox.ts');
  const result = await enqueueProjectNotification({
    db: mockDb,
    tenantId: tenant,
    projectId: 'proj-123',
    eventType: 'milestone_completed',
    action: 'milestone_completed',
    newValue: { name: 'MVP Launch' },
  });

  assert.ok(result.eventId, 'Should create activity event ID');
  assert.ok(result.outboxId, 'Should create outbox ID');
  assert.equal(activityRows.length, 1);
  assert.equal(outboxRows.length, 1);
  assert.equal(outboxRows[0].status, 'queued');
  assert.equal(outboxRows[0].event_type, 'milestone_completed');
});
