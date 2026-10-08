import test from 'node:test';
import assert from 'node:assert/strict';

import { okResult, errorResult } from '../../src/lib/mcp/connector/response.ts';
import { resolveMcpToolName } from '../../src/lib/mcp/canonicalToolRegistry.ts';

test('canonicalToolRegistry resolves check_execution_status to get_execution_status', () => {
  assert.equal(resolveMcpToolName('check_execution_status'), 'get_execution_status');
  assert.equal(resolveMcpToolName('execution_status'), 'get_execution_status');
});

test('okResult includes full structured ActionReceipt with canonical fields', () => {
  const result = okResult('send_email', { messageId: 'msg-1' }, {
    receipt: {
      action_id: 'act-123',
      execution_id: 'act-123',
      correlation_id: 'corr-456',
      status: 'succeeded',
      operation: 'send_email',
      resource_id: 'msg-1',
      provider: 'zoho',
      provider_reference: 'zoho-999',
      started_at: '2026-10-08T10:00:00.000Z',
      completed_at: '2026-10-08T10:00:02.000Z',
      verified_at: '2026-10-08T10:00:02.000Z',
      verification_status: 'verified',
    },
  });

  assert.equal(result.ok, true);
  assert.ok(result.receipt);
  assert.equal(result.receipt.action_id, 'act-123');
  assert.equal(result.receipt.execution_id, 'act-123');
  assert.equal(result.receipt.correlation_id, 'corr-456');
  assert.equal(result.receipt.status, 'succeeded');
  assert.equal(result.receipt.operation, 'send_email');
  assert.equal(result.receipt.resource_id, 'msg-1');
  assert.equal(result.receipt.provider, 'zoho');
  assert.equal(result.receipt.provider_reference, 'zoho-999');
  assert.equal(result.receipt.verification_status, 'verified');
});

test('errorResult preserves structured ActionReceipt for pending or timeout states', () => {
  const result = errorResult(
    'send_email',
    'PENDING_VERIFICATION',
    'Provider accepted; delivery confirmation is pending.',
    null,
    {
      retryable: false,
      receipt: {
        action_id: 'act-timeout-1',
        execution_id: 'act-timeout-1',
        correlation_id: 'act-timeout-1',
        status: 'pending_verification',
        operation: 'send_email',
        provider: 'zoho',
        verification_status: 'pending',
      },
    }
  );

  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'PENDING_VERIFICATION');
  assert.ok(result.receipt);
  assert.equal(result.receipt.status, 'pending_verification');
  assert.equal(result.receipt.verification_status, 'pending');
  assert.equal(result.receipt.action_id, 'act-timeout-1');
});
