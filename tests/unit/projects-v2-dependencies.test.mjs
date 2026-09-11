import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hasTaskDependencyCycle,
  validateTaskDependency,
} from '../../src/lib/projects/taskDependencyGraph.ts';

test('accepts an acyclic dependency', () => {
  const result = validateTaskDependency(
    [
      { taskId: 'b', dependsOnTaskId: 'c' },
      { taskId: 'c', dependsOnTaskId: 'd' },
    ],
    { taskId: 'a', dependsOnTaskId: 'b' },
  );
  assert.deepEqual(result, { valid: true });
});

test('rejects self dependency', () => {
  const result = validateTaskDependency([], { taskId: 'a', dependsOnTaskId: 'a' });
  assert.equal(result.valid, false);
  assert.equal(result.reason, 'SELF_DEPENDENCY');
});

test('rejects a dependency that closes a cycle', () => {
  const result = validateTaskDependency(
    [
      { taskId: 'b', dependsOnTaskId: 'c' },
      { taskId: 'c', dependsOnTaskId: 'a' },
    ],
    { taskId: 'a', dependsOnTaskId: 'b' },
  );
  assert.equal(result.valid, false);
  assert.equal(result.reason, 'CYCLE');
  assert.deepEqual(result.path, ['a', 'b', 'c', 'a']);
});

test('detects cycles in an existing graph', () => {
  assert.equal(
    hasTaskDependencyCycle([
      { taskId: 'a', dependsOnTaskId: 'b' },
      { taskId: 'b', dependsOnTaskId: 'c' },
      { taskId: 'c', dependsOnTaskId: 'a' },
    ]),
    true,
  );
});

test('reports acyclic existing graph', () => {
  assert.equal(
    hasTaskDependencyCycle([
      { taskId: 'a', dependsOnTaskId: 'b' },
      { taskId: 'b', dependsOnTaskId: 'c' },
    ]),
    false,
  );
});
