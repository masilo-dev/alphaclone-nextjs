import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { usePwaPreferences } from '../../src/hooks/usePwaPreferences.ts';
import { useMeetingSession } from '../../src/hooks/useMeetingSession.ts';

function Preferences() {
  const { prefs } = usePwaPreferences();
  const meeting = useMeetingSession('test-scope');
  return React.createElement('div', null, JSON.stringify({ prefs, active: meeting.activeMeetingCallId, minimized: meeting.isMeetingMinimized }));
}
test('stored browser preferences do not change the initial hydration tree', () => {
  const originalWindow = globalThis.window; const originalStorage = globalThis.localStorage;
  try {
    delete globalThis.window; delete globalThis.localStorage;
    const server = renderToString(React.createElement(Preferences));
    globalThis.window = { localStorage: { getItem: key => key.includes('call_id') ? 'saved-call' : '1' } };
    globalThis.localStorage = { getItem: () => JSON.stringify({ bottomNavModuleIds: ['custom'], pushEnabled: false }) };
    assert.equal(renderToString(React.createElement(Preferences)), server);
  } finally {
    if (originalWindow === undefined) delete globalThis.window; else globalThis.window = originalWindow;
    if (originalStorage === undefined) delete globalThis.localStorage; else globalThis.localStorage = originalStorage;
  }
});
