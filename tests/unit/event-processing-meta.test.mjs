/**
 * Poison-pill protection for business_automation_events: attempts are stamped
 * into the payload before any work happens, so an event that crashes the
 * process can only be retried MAX_EVENT_ATTEMPTS times.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

const {
  PROCESSING_META_KEY,
  MAX_EVENT_ATTEMPTS,
  readProcessingMeta,
  stripProcessingMeta,
  hasExhaustedAttempts,
  stampAttempt,
  stampFailure,
  stampAbandoned,
} = await import('../../src/lib/automation/eventProcessingMeta.ts');

describe('eventProcessingMeta', () => {
  it('reads zero attempts for payloads with no bookkeeping', () => {
    assert.deepEqual(readProcessingMeta({ ticket_id: 't1' }), { attempts: 0 });
    assert.deepEqual(readProcessingMeta(null), { attempts: 0 });
    assert.deepEqual(readProcessingMeta('garbage'), { attempts: 0 });
    assert.deepEqual(readProcessingMeta({ [PROCESSING_META_KEY]: { attempts: 'NaN' } }), { attempts: 0 });
  });

  it('stampAttempt increments attempts and preserves the business payload', () => {
    const now = new Date('2026-09-06T04:40:00Z');
    const first = stampAttempt({ ticket_id: 't1' }, now);
    assert.equal(first.ticket_id, 't1');
    assert.equal(readProcessingMeta(first).attempts, 1);
    assert.equal(readProcessingMeta(first).last_attempt_at, now.toISOString());

    const second = stampAttempt(first, now);
    const third = stampAttempt(second, now);
    assert.equal(readProcessingMeta(third).attempts, 3);
    assert.equal(third.ticket_id, 't1');
  });

  it('hasExhaustedAttempts flips exactly at MAX_EVENT_ATTEMPTS', () => {
    let payload = { ticket_id: 't1' };
    for (let i = 0; i < MAX_EVENT_ATTEMPTS; i++) {
      assert.equal(hasExhaustedAttempts(payload), false, `attempt ${i} should still be allowed`);
      payload = stampAttempt(payload);
    }
    assert.equal(hasExhaustedAttempts(payload), true);
  });

  it('stripProcessingMeta hides bookkeeping from workflows', () => {
    const stamped = stampFailure(stampAttempt({ ticket_id: 't1', priority: 'high' }), 'boom');
    assert.deepEqual(stripProcessingMeta(stamped), { ticket_id: 't1', priority: 'high' });
    assert.deepEqual(stripProcessingMeta(undefined), {});
    assert.deepEqual(stripProcessingMeta([1, 2]), {});
  });

  it('stampFailure truncates errors and keeps attempt count', () => {
    const stamped = stampFailure(stampAttempt({}), 'x'.repeat(2000));
    const meta = readProcessingMeta(stamped);
    assert.equal(meta.attempts, 1);
    assert.equal(meta.last_error.length, 500);
  });

  it('stampAbandoned records reason and timestamp', () => {
    const now = new Date('2026-09-06T05:00:00Z');
    const meta = readProcessingMeta(stampAbandoned(stampAttempt({}), 'exceeded attempts', now));
    assert.equal(meta.attempts, 1);
    assert.equal(meta.abandon_reason, 'exceeded attempts');
    assert.equal(meta.abandoned_at, now.toISOString());
  });
});
