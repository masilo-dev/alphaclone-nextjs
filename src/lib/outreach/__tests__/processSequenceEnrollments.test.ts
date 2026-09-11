import { describe, expect, it, vi } from 'vitest';
import { conditionMatches, quietHoursEnd } from '../processSequenceEnrollments';

describe('sequence execution policy', () => {
  it('supports positive and negative engagement conditions', () => {
    expect(conditionMatches({ event: 'opened' }, ['sent', 'opened'])).toBe(true);
    expect(conditionMatches({ event: 'not_opened' }, ['sent'])).toBe(true);
    expect(conditionMatches({ event: 'not_opened' }, ['opened'])).toBe(false);
    expect(conditionMatches({ event: 'no_reply' }, ['sent', 'opened'])).toBe(true);
    expect(conditionMatches({ event: 'no_reply' }, ['replied'])).toBe(false);
  });

  it('defers work until quiet hours end, including overnight windows', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-02T22:00:00.000Z'));
    expect(quietHoursEnd('UTC', { start: '20:00', end: '08:00' })).toBe('2026-08-03T08:00:00.000Z');
    expect(quietHoursEnd('UTC', { start: '09:00', end: '17:00' })).toBeNull();
    vi.useRealTimers();
  });
});
