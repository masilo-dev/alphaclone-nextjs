import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CANONICAL_EXECUTION_STATES,
  normalizeCanonicalExecutionState,
  isValidExecutionTransition,
  isTerminalExecutionState,
  isAmbiguousTransportError,
} from '../../src/lib/execution/executionStates.ts';

test('CANONICAL_EXECUTION_STATES has the exact 6 required states', () => {
  assert.deepEqual([...CANONICAL_EXECUTION_STATES], [
    'queued',
    'executing',
    'pending_verification',
    'succeeded',
    'failed',
    'cancelled',
  ]);
});

test('normalizeCanonicalExecutionState correctly maps legacy and external statuses', () => {
  // Succeeded
  assert.equal(normalizeCanonicalExecutionState('completed'), 'succeeded');
  assert.equal(normalizeCanonicalExecutionState('published'), 'succeeded');
  assert.equal(normalizeCanonicalExecutionState('sent'), 'succeeded');
  assert.equal(normalizeCanonicalExecutionState('delivered'), 'succeeded');
  assert.equal(normalizeCanonicalExecutionState('verified'), 'succeeded');
  assert.equal(normalizeCanonicalExecutionState('succeeded'), 'succeeded');

  // Executing
  assert.equal(normalizeCanonicalExecutionState('running'), 'executing');
  assert.equal(normalizeCanonicalExecutionState('processing'), 'executing');
  assert.equal(normalizeCanonicalExecutionState('executing'), 'executing');

  // Pending verification
  assert.equal(normalizeCanonicalExecutionState('outcome_unknown'), 'pending_verification');
  assert.equal(normalizeCanonicalExecutionState('unknown_execution_state'), 'pending_verification');
  assert.equal(normalizeCanonicalExecutionState('provider_accepted'), 'pending_verification');
  assert.equal(normalizeCanonicalExecutionState('verification_pending'), 'pending_verification');
  assert.equal(normalizeCanonicalExecutionState('pending_verification'), 'pending_verification');

  // Failed
  assert.equal(normalizeCanonicalExecutionState('failed'), 'failed');
  assert.equal(normalizeCanonicalExecutionState('failure'), 'failed');

  // Queued
  assert.equal(normalizeCanonicalExecutionState('queued'), 'queued');
  assert.equal(normalizeCanonicalExecutionState('scheduled'), 'queued');
  assert.equal(normalizeCanonicalExecutionState('awaiting_approval'), 'queued');

  // Cancelled
  assert.equal(normalizeCanonicalExecutionState('cancelled'), 'cancelled');
  assert.equal(normalizeCanonicalExecutionState('canceled'), 'cancelled');

  // Ambiguous or unrecognized string NEVER defaults to failed
  assert.equal(normalizeCanonicalExecutionState('random_provider_status'), 'pending_verification');
  assert.notEqual(normalizeCanonicalExecutionState('random_provider_status'), 'failed');
});

test('isValidExecutionTransition permits legal state machine transitions', () => {
  // queued -> executing
  assert.equal(isValidExecutionTransition('queued', 'executing'), true);
  assert.equal(isValidExecutionTransition('queued', 'cancelled'), true);
  assert.equal(isValidExecutionTransition('queued', 'failed'), true);

  // executing -> pending_verification, succeeded, failed, cancelled
  assert.equal(isValidExecutionTransition('executing', 'pending_verification'), true);
  assert.equal(isValidExecutionTransition('executing', 'succeeded'), true);
  assert.equal(isValidExecutionTransition('executing', 'failed'), true);
  assert.equal(isValidExecutionTransition('executing', 'cancelled'), true);

  // pending_verification -> succeeded, failed, cancelled
  assert.equal(isValidExecutionTransition('pending_verification', 'succeeded'), true);
  assert.equal(isValidExecutionTransition('pending_verification', 'failed'), true);
  assert.equal(isValidExecutionTransition('pending_verification', 'cancelled'), true);

  // Idempotent re-affirmation of current state
  assert.equal(isValidExecutionTransition('succeeded', 'succeeded'), true);
  assert.equal(isValidExecutionTransition('executing', 'executing'), true);
  assert.equal(isValidExecutionTransition('pending_verification', 'pending_verification'), true);
});

test('isValidExecutionTransition BLOCKS illegal transitions out of terminal succeeded state', () => {
  // NEVER overwrite a verified success with a delayed failure!
  assert.equal(isValidExecutionTransition('succeeded', 'failed'), false);
  assert.equal(isValidExecutionTransition('succeeded', 'pending_verification'), false);
  assert.equal(isValidExecutionTransition('succeeded', 'executing'), false);
  assert.equal(isValidExecutionTransition('succeeded', 'cancelled'), false);

  // Cancelled is terminal
  assert.equal(isValidExecutionTransition('cancelled', 'succeeded'), false);
  assert.equal(isValidExecutionTransition('cancelled', 'executing'), false);
});

test('isTerminalExecutionState identifies terminal states', () => {
  assert.equal(isTerminalExecutionState('succeeded'), true);
  assert.equal(isTerminalExecutionState('verified'), true);
  assert.equal(isTerminalExecutionState('cancelled'), true);

  assert.equal(isTerminalExecutionState('executing'), false);
  assert.equal(isTerminalExecutionState('queued'), false);
  assert.equal(isTerminalExecutionState('pending_verification'), false);
});

test('isAmbiguousTransportError accurately identifies timeouts and transport drops', () => {
  assert.equal(isAmbiguousTransportError(new Error('Gateway timeout')), true);
  assert.equal(isAmbiguousTransportError(new Error('Connection reset by peer (ECONNRESET)')), true);
  assert.equal(isAmbiguousTransportError(new Error('socket hang up')), true);
  assert.equal(isAmbiguousTransportError({ code: 'PROVIDER_TIMEOUT', message: 'Provider timed out' }), true);
  assert.equal(isAmbiguousTransportError({ code: 'OUTCOME_UNKNOWN', message: 'Unknown' }), true);

  // Definitive client/validation errors are NOT ambiguous transport errors
  assert.equal(isAmbiguousTransportError(new Error('Invalid email address format')), false);
  assert.equal(isAmbiguousTransportError({ code: 'AUTH_EXPIRED', message: 'OAuth token expired' }), false);
  assert.equal(isAmbiguousTransportError({ code: 'VALIDATION_FAILED', message: 'Missing recipient' }), false);
});
