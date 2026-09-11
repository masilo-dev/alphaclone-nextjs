/**
 * Users were signed out after 10 idle minutes, and scrolling inside the
 * dashboard's fixed-height shell did not count as activity because `scroll`
 * does not bubble to `document`.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(path.resolve(here, rel), 'utf8');

const { resolveIdleTimeoutMs, SESSION_ACTIVITY_EVENTS } = await import('../../src/components/SessionTimeoutWarning.tsx');

describe('session idle timeout', () => {
  it('defaults to 30 minutes and honours NEXT_PUBLIC_SESSION_IDLE_TIMEOUT_MINUTES', () => {
    assert.equal(resolveIdleTimeoutMs(undefined), 30 * 60 * 1000);
    assert.equal(resolveIdleTimeoutMs('45'), 45 * 60 * 1000);
    assert.equal(resolveIdleTimeoutMs('10'), 10 * 60 * 1000);
  });

  it('refuses values that would fire before the 2-minute warning can show', () => {
    assert.equal(resolveIdleTimeoutMs('1'), 30 * 60 * 1000);
    assert.equal(resolveIdleTimeoutMs('abc'), 30 * 60 * 1000);
    assert.equal(resolveIdleTimeoutMs(''), 30 * 60 * 1000);
  });

  it('treats nested scrolling and trackpad wheel as activity', () => {
    assert.ok(SESSION_ACTIVITY_EVENTS.includes('scroll'));
    assert.ok(SESSION_ACTIVITY_EVENTS.includes('wheel'));
    const source = read('../../src/components/SessionTimeoutWarning.tsx');
    assert.match(source, /capture: true/, 'scroll must be observed in the capture phase');
    assert.match(source, /removeEventListener\(event, handleActivity, listenerOptions\)/, 'capture listeners must be removed with the same options');
  });
});
