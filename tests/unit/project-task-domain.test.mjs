import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateProjectHealth,
  calculateWeightedProgress,
  canTransitionTask,
  normalizeTaskStatus,
  wouldCreateDependencyCycle,
} from '../../src/lib/projects/projectTaskDomain.ts';

test('legacy task states map into the unified lifecycle', () => {
  assert.equal(normalizeTaskStatus('todo'), 'to_do');
  assert.equal(normalizeTaskStatus('completed'), 'done');
  assert.equal(canTransitionTask('todo', 'in_progress'), true);
  assert.equal(canTransitionTask('completed', 'todo'), false);
});

test('weighted progress ignores trashed work', () => {
  assert.equal(calculateWeightedProgress([
    { status: 'done', weight: 3 },
    { status: 'todo', weight: 1 },
    { status: 'done', weight: 10, deletedAt: '2026-01-01' },
  ]), 75);
});

test('project health is deterministic and explainable', () => {
  assert.deepEqual(calculateProjectHealth({
    status: 'in_progress',
    overdueTaskCount: 4,
    budgetVariancePercent: 20,
  }), {
    status: 'at_risk',
    reasons: ['4 overdue task(s)', 'Budget is 20% over plan'],
  });
});

test('dependency cycles are rejected', () => {
  assert.equal(wouldCreateDependencyCycle('a', 'b', [
    { taskId: 'b', dependsOnTaskId: 'c' },
    { taskId: 'c', dependsOnTaskId: 'a' },
  ]), true);
  assert.equal(wouldCreateDependencyCycle('a', 'b', [
    { taskId: 'c', dependsOnTaskId: 'd' },
  ]), false);
});
