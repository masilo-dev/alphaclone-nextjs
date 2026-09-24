import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';

// Mock localStorage and sessionStorage for Node.js environment
const createStorage = () => {
  let store = {};
  return {
    getItem: (key) => store[key] ?? null,
    setItem: (key, val) => { store[key] = String(val); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; },
  };
};

globalThis.localStorage = createStorage();
globalThis.sessionStorage = createStorage();
globalThis.window = {
  dispatchEvent: () => true,
  localStorage: globalThis.localStorage,
  sessionStorage: globalThis.sessionStorage,
};

const {
  WALKTHROUGH_VERSION,
  getWalkthroughRecord,
  setWalkthroughState,
  canAutoStartWalkthrough,
  markAutoStartEvaluated,
} = await import('../../src/lib/onboarding/walkthroughService.ts');

describe('Walkthrough Service State Machine', () => {
  const testUser = 'user-test-uuid-42';

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('defaults to not_started with the current version', () => {
    const record = getWalkthroughRecord(testUser);
    assert.equal(record.state, 'not_started');
    assert.equal(record.version, WALKTHROUGH_VERSION);
  });

  it('allows setting state to in_progress with stepIndex', () => {
    const updated = setWalkthroughState(testUser, 'in_progress', 3);
    assert.equal(updated.state, 'in_progress');
    assert.equal(updated.stepIndex, 3);

    const reloaded = getWalkthroughRecord(testUser);
    assert.equal(reloaded.state, 'in_progress');
    assert.equal(reloaded.stepIndex, 3);
  });

  it('marks completed and writes legacy keys for compatibility', () => {
    setWalkthroughState(testUser, 'completed');
    const record = getWalkthroughRecord(testUser);
    assert.equal(record.state, 'completed');
    assert.ok(record.completedAt);
    assert.equal(localStorage.getItem(`business_tour_completed_${testUser}`), '1');
    assert.equal(localStorage.getItem(`tour_completed_${testUser}`), '1');
  });

  it('marks dismissed and writes legacy dismissed key', () => {
    setWalkthroughState(testUser, 'dismissed');
    const record = getWalkthroughRecord(testUser);
    assert.equal(record.state, 'dismissed');
    assert.ok(record.dismissedAt);
    assert.equal(localStorage.getItem(`tour_dismissed_${testUser}`), '1');
  });

  it('recognizes legacy completed keys for returning users', () => {
    localStorage.setItem(`business_tour_completed_${testUser}`, '1');
    const record = getWalkthroughRecord(testUser);
    assert.equal(record.state, 'completed');
  });

  it('recognizes legacy dismissed keys for returning users', () => {
    localStorage.setItem(`tour_dismissed_${testUser}`, '1');
    const record = getWalkthroughRecord(testUser);
    assert.equal(record.state, 'dismissed');
  });

  it('canAutoStartWalkthrough returns true ONLY for brand new eligible users', () => {
    // New user, not established workspace -> eligible
    assert.equal(canAutoStartWalkthrough(testUser, false), true);

    // Established workspace -> NOT eligible
    assert.equal(canAutoStartWalkthrough(testUser, true), false);

    // After session evaluation -> NOT eligible
    markAutoStartEvaluated(testUser);
    assert.equal(canAutoStartWalkthrough(testUser, false), false);
  });

  it('canAutoStartWalkthrough returns false if already completed or dismissed', () => {
    setWalkthroughState(testUser, 'completed');
    assert.equal(canAutoStartWalkthrough(testUser, false), false);

    setWalkthroughState(testUser, 'dismissed');
    assert.equal(canAutoStartWalkthrough(testUser, false), false);
  });
});
