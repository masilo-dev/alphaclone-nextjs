import test from 'node:test';
import assert from 'node:assert/strict';

const { normalizeAgentRunExecutionMode } = await import(
  '../../src/lib/bonnie/runtime/goalRunService.ts'
);

test('normalizeAgentRunExecutionMode maps autonomous to fully_autonomous', () => {
  assert.equal(normalizeAgentRunExecutionMode('autonomous'), 'fully_autonomous');
});

test('normalizeAgentRunExecutionMode preserves allowed values', () => {
  assert.equal(normalizeAgentRunExecutionMode('semi_autonomous'), 'semi_autonomous');
  assert.equal(normalizeAgentRunExecutionMode('approval_required'), 'approval_required');
});

test('normalizeAgentRunExecutionMode falls back safely', () => {
  assert.equal(normalizeAgentRunExecutionMode('bogus'), 'semi_autonomous');
});
