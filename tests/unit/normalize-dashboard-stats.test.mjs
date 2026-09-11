import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDashboardStats } from '../../src/lib/analytics/normalizeDashboardStats.ts';

test('normalizeDashboardStats maps RPC fields to home KPI fields', () => {
  const normalized = normalizeDashboardStats({
    totalRevenue: 1200,
    pendingRevenue: 2920,
    totalLeads: 665,
    clientCount: 12,
    completedTasks: 8,
    totalTasks: 15,
    staleLeads: 479,
    pipeline: {
      discovered: 644,
      qualified: 21,
      proposal: 3,
    },
  });

  assert.equal(normalized.revenue, 1200);
  assert.equal(normalized.newLeads, 665);
  assert.equal(normalized.outstanding, 2920);
  assert.equal(normalized.qualifiedLeads, 24);
  assert.equal(normalized.staleLeads, 479);
  assert.equal(normalized.openTasks, 7);
});

test('normalizeDashboardStats preserves explicit qualifiedLeads when present', () => {
  const normalized = normalizeDashboardStats({
    totalLeads: 10,
    qualifiedLeads: 4,
    pipeline: { qualified: 99 },
  });

  assert.equal(normalized.qualifiedLeads, 4);
});
