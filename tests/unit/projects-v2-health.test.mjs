import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateProjectHealth } from '../../src/lib/projects/projectHealth.ts';

const now = new Date('2026-09-11T07:00:00.000Z');

test('completed project wins over other signals', () => {
  const result = evaluateProjectHealth({ projectStatus: 'completed', openBlockers: 2 }, now);
  assert.equal(result.status, 'COMPLETED');
});

test('blockers take precedence over overdue checkpoints', () => {
  const result = evaluateProjectHealth({ projectStatus: 'active', openBlockers: 1, overdueTasks: 3 }, now);
  assert.equal(result.status, 'BLOCKED');
  assert.match(result.reasons[0], /blocker/i);
});

test('project deadline and overdue task produce overdue state', () => {
  const result = evaluateProjectHealth({
    projectStatus: 'active',
    dueDate: '2026-09-10T10:00:00.000Z',
    overdueTasks: 1,
  }, now);
  assert.equal(result.status, 'OVERDUE');
  assert.equal(result.reasons.length, 2);
});

test('pending client approval creates waiting on client state', () => {
  const result = evaluateProjectHealth({ projectStatus: 'active', pendingClientApprovals: 2 }, now);
  assert.equal(result.status, 'WAITING_ON_CLIENT');
});

test('overdue outstanding payment creates waiting on payment state', () => {
  const result = evaluateProjectHealth({ projectStatus: 'active', paymentOverdue: true, outstandingAmount: 250 }, now);
  assert.equal(result.status, 'WAITING_ON_PAYMENT');
});

test('low task completion creates at risk state', () => {
  const result = evaluateProjectHealth({ projectStatus: 'active', totalTasks: 8, completedTasks: 1 }, now);
  assert.equal(result.status, 'AT_RISK');
});

test('healthy is the explainable fallback', () => {
  const result = evaluateProjectHealth({ projectStatus: 'active', totalTasks: 3, completedTasks: 1 }, now);
  assert.equal(result.status, 'HEALTHY');
  assert.match(result.reasons[0], /No active blocker/i);
});
