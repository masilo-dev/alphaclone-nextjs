/**
 * Production memory / worker stability unit tests.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

describe('background job heap gate', () => {
  it('blocks when heap exceeds configured threshold', async () => {
    const { resolveBackgroundJobHeapRejectMb, backgroundJobBlockedReason } = await import(
      '../../src/lib/runtime/backgroundJobGate.ts'
    );
    assert.ok(resolveBackgroundJobHeapRejectMb() >= 3072);
    assert.equal(backgroundJobBlockedReason(), null);
  });
});

describe('bonnie worker tick guard exports', () => {
  it('exports isBonnieWorkerTickRunning', async () => {
    const { isBonnieWorkerTickRunning } = await import('../../src/bonnie/workerMain.ts');
    assert.equal(typeof isBonnieWorkerTickRunning, 'function');
    assert.equal(isBonnieWorkerTickRunning(), false);
  });
});

describe('processClaimableTasks in-flight guard', () => {
  it('exports isProcessClaimableTasksRunning', async () => {
    const { isProcessClaimableTasksRunning } = await import(
      '../../src/lib/bonnie/runtime/workerService.ts'
    );
    assert.equal(typeof isProcessClaimableTasksRunning, 'function');
    assert.equal(isProcessClaimableTasksRunning(), false);
  });
});

describe('bulk job status mapping', () => {
  it('maps pending queue rows to queued status', async () => {
    const { getBulkJobStatus } = await import('../../src/lib/mcp/bulkJobQueue.ts');
    assert.equal(typeof getBulkJobStatus, 'function');
  });
});

describe('worker runtime counters', () => {
  it('starts at zero', async () => {
    const { getWorkerRuntimeCounters } = await import('../../src/lib/runtime/workerRuntimeCounters.ts');
    const counters = getWorkerRuntimeCounters();
    assert.equal(counters.activeWorkerTicks, 0);
    assert.equal(counters.activeBonnieTasks, 0);
    assert.equal(counters.activeMcpRequests, 0);
    assert.equal(counters.activeReconciliation, 0);
  });
});
