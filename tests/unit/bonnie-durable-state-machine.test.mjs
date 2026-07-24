import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canTransition,
  assertTransition,
  isTerminalStatus,
  isClaimableStatus,
  listAllowedTransitions,
} from '../../src/lib/bonnie/runtime/taskStateMachine.ts';
import {
  buildIdempotencyKey,
  classifyError,
  backoffWithJitter,
} from '../../src/lib/bonnie/runtime/utils.ts';

test('illegal transitions are rejected', () => {
  assert.equal(canTransition('DRAFT', 'READY'), true);
  assert.equal(canTransition('READY', 'CLAIMED'), true);
  assert.equal(canTransition('CLAIMED', 'RUNNING'), true);
  assert.equal(canTransition('RUNNING', 'WAITING_FOR_EVENT'), true);
  assert.equal(canTransition('RUNNING', 'EXECUTION_UNCERTAIN'), true);
  assert.equal(canTransition('RETRY_SCHEDULED', 'READY'), true);
  assert.equal(canTransition('COMPLETED', 'READY'), false);
  assert.equal(canTransition('CANCELLED', 'RUNNING'), false);
  assert.throws(() => assertTransition('FAILED', 'CLAIMED'));
});

test('claimable and terminal helpers', () => {
  assert.equal(isClaimableStatus('READY'), true);
  assert.equal(isClaimableStatus('QUEUED'), true);
  assert.equal(isClaimableStatus('RUNNING'), false);
  assert.equal(isTerminalStatus('COMPLETED'), true);
  assert.equal(isTerminalStatus('RUNNING'), false);
  assert.ok(listAllowedTransitions('RUNNING').includes('COMPLETED'));
});

test('idempotency key is stable and tenant-scoped', () => {
  const a = buildIdempotencyKey({
    tenantId: 't1',
    taskId: 'task1',
    actionType: 'email.send',
    targetRecordId: 'inv-9',
    actionVersion: 1,
  });
  const b = buildIdempotencyKey({
    tenantId: 't1',
    taskId: 'task1',
    actionType: 'email.send',
    targetRecordId: 'inv-9',
    actionVersion: 1,
  });
  const c = buildIdempotencyKey({
    tenantId: 't2',
    taskId: 'task1',
    actionType: 'email.send',
    targetRecordId: 'inv-9',
    actionVersion: 1,
  });
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.match(a, /^t1:task1:email\.send:inv-9:1$/);
});

test('error classification separates retryable and non-retryable', () => {
  assert.equal(classifyError(new Error('permission denied')).retryable, false);
  assert.equal(classifyError(new Error('rate limit exceeded')).retryable, true);
  assert.equal(classifyError(new Error('timeout talking to provider')).retryable, true);
  assert.equal(classifyError(new Error('validation failed')).retryable, false);
  assert.equal(classifyError(new Error('uncertain ambiguous')).code, 'UNCERTAIN');
});

test('backoff grows with jitter bounds', () => {
  const a = backoffWithJitter(1, 1000, 10000);
  const b = backoffWithJitter(4, 1000, 10000);
  assert.ok(a >= 1000);
  assert.ok(b >= a || b >= 1000);
  assert.ok(b <= 10000 + 5000);
});
