/**
 * Bonnie reported "0 open tasks" while the dashboard showed 272.
 *
 * `tasks.status` and legacy `projects.status` are Postgres enums. Filtering an
 * enum column against a label it does not have ("done", "archived", "planning")
 * makes Postgres reject the whole query; the counters swallowed that error and
 * returned 0, so every Bonnie tool built on the canonical counts was wrong.
 *
 * These tests pin the DB-side filters to labels that exist in the enums and
 * verify a failing count is surfaced (warned) rather than silently zeroed.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

const {
  TASK_STATUS_ENUM_CLOSED,
  LEGACY_PROJECT_STATUS_ENUM_ACTIVE,
  CLOSED_TASK_STATUSES,
  closedTaskFilter,
  countOpenTasks,
  countActiveProjects,
  isOpenTaskStatus,
} = await import('../../src/lib/crm/canonicalWorkspaceStats.ts');

// Mirrors the production enums (information_schema on 2026-09-06).
const TASK_STATUS_LABELS = ['todo', 'in_progress', 'completed', 'cancelled', 'ideas', 'review', 'blocked'];
const PROJECT_STATUS_LABELS = [
  'Active', 'Pending', 'Completed', 'Declined', 'backlog', 'todo', 'in_progress', 'review', 'done', 'cancelled',
];

/** Minimal PostgREST-like stub that fails like Postgres does on unknown enum labels. */
function fakeAdmin({ tasksOpen = 272, legacyActive = 2, bizActive = 4 } = {}) {
  const calls = [];
  const builder = (table) => {
    const state = { table, filters: [] };
    const api = {
      select() { return api; },
      eq(col, val) { state.filters.push(['eq', col, val]); return api; },
      in(col, vals) { state.filters.push(['in', col, vals]); return api; },
      not(col, op, val) { state.filters.push(['not', col, op, val]); return api; },
      then(resolve) {
        calls.push(state);
        const labels = table === 'tasks' ? TASK_STATUS_LABELS : table === 'projects' ? PROJECT_STATUS_LABELS : null;
        for (const f of state.filters) {
          if (!labels || f[1] !== 'status') continue;
          const used = f[0] === 'in' ? f[2] : f[0] === 'not' ? String(f[3]).replace(/[()"]/g, '').split(',') : [f[2]];
          const bad = used.find((v) => !labels.includes(v));
          if (bad) {
            return resolve({ count: null, error: { message: `invalid input value for enum: "${bad}"` } });
          }
        }
        const count = table === 'tasks' ? tasksOpen : table === 'projects' ? legacyActive : bizActive;
        return resolve({ count, error: null });
      },
    };
    return api;
  };
  return { from: builder, calls };
}

describe('canonical workspace counts are enum-safe', () => {
  it('only filters tasks.status with real task_status labels', () => {
    for (const label of TASK_STATUS_ENUM_CLOSED) {
      assert.ok(TASK_STATUS_LABELS.includes(label), `${label} is not a task_status enum label`);
    }
    const inList = closedTaskFilter().replace(/[()"]/g, '').split(',');
    assert.deepEqual(inList, [...TASK_STATUS_ENUM_CLOSED]);
    assert.ok(!inList.includes('done') && !inList.includes('archived'), 'legacy text spellings must not reach the enum filter');
  });

  it('only filters legacy projects.status with real project_status labels', () => {
    for (const label of LEGACY_PROJECT_STATUS_ENUM_ACTIVE) {
      assert.ok(PROJECT_STATUS_LABELS.includes(label), `${label} is not a project_status enum label`);
    }
  });

  it('counts the 272 open tasks the dashboard shows (instead of 0)', async () => {
    const admin = fakeAdmin();
    assert.equal(await countOpenTasks(admin, 'tenant-1'), 272);
  });

  it('counts active legacy projects instead of erroring to 0', async () => {
    const admin = fakeAdmin();
    assert.equal(await countActiveProjects(admin, 'tenant-1'), 4); // max(biz 4, legacy 2)
    const legacyCall = admin.calls.find((c) => c.table === 'projects');
    assert.ok(legacyCall, 'legacy projects table is queried');
  });

  it('warns (does not silently zero) when a count query fails', async () => {
    const warnings = [];
    const original = console.warn;
    console.warn = (msg) => warnings.push(String(msg));
    try {
      const admin = {
        from: () => ({
          select() { return this; }, eq() { return this; }, not() { return this; },
          then(resolve) { resolve({ count: null, error: { message: 'boom' } }); },
        }),
      };
      assert.equal(await countOpenTasks(admin, 'tenant-1'), 0);
    } finally {
      console.warn = original;
    }
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /open tasks count failed.*boom/);
  });

  it('keeps the tolerant text-side check for legacy spellings', () => {
    assert.deepEqual([...CLOSED_TASK_STATUSES], ['completed', 'cancelled', 'done', 'archived']);
    assert.equal(isOpenTaskStatus('todo'), true);
    assert.equal(isOpenTaskStatus('Done'), false);
    assert.equal(isOpenTaskStatus('archived'), false);
  });
});
