import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const hubRoutes = readFileSync(
  new URL('../../src/lib/dashboard/hubRoutes.tsx', import.meta.url),
  'utf8'
);
const inboxView = readFileSync(
  new URL('../../src/components/dashboard/business/UnifiedInboxView.tsx', import.meta.url),
  'utf8'
);
const emailWorkspace = readFileSync(
  new URL('../../src/components/dashboard/email/AlphaCloneEmailWorkspace.tsx', import.meta.url),
  'utf8'
);
const globals = readFileSync(
  new URL('../../src/app/globals.css', import.meta.url),
  'utf8'
);
const routeTransition = readFileSync(new URL('../../src/components/dashboard/DashboardRouteTransition.tsx', import.meta.url), 'utf8');
const uiPrimitives = readFileSync(new URL('../../src/components/ui/UIComponents.tsx', import.meta.url), 'utf8');

test('comms and mail routes are not wrapped in the Email & Outreach hub header', () => {
  const channelsRoutes = hubRoutes.match(/CHANNELS_HUB_ROUTES = new Set\(\[([\s\S]*?)\]\)/)?.[1] || '';
  assert.doesNotMatch(channelsRoutes, /\/dashboard\/comms/);
  assert.doesNotMatch(channelsRoutes, /\/dashboard\/mail/);
});

test('unified inbox keeps a three-pane mail layout', () => {
  assert.match(inboxView, /aria-label="Mail modules"/);
  assert.match(inboxView, /Message list/);
  assert.match(inboxView, /Read & reply/);
  assert.match(inboxView, /md:w-\[min\(340px,45%\)\] 2xl:w-\[380px\]/);
  assert.match(inboxView, /aria-label="Mail modules"[\s\S]*Mail folder/);
});

test('mail workspaces use bounded internal scrolling instead of page-level overflow', () => {
  assert.match(emailWorkspace, /h-\[calc\(100dvh-5\.5rem\)\]/);
  assert.match(emailWorkspace, /grid-cols-\[auto_minmax\(18rem,26rem\)_minmax\(0,1fr\)\]/);
  assert.match(globals, /\.no-scrollbar/);
});

test('dashboard overlays stay above chrome and scroll panes share one rule', () => {
  assert.match(globals, /\.ac-scroll-pane\s*\{[^}]*overflow-y: auto/);
  assert.doesNotMatch(routeTransition, /\b(?:scale|x|y):\s*[-\d.]+/);
  assert.match(uiPrimitives, /Math\.max\(Z_INDEX\.dropdown,[^\n]*hostLayer/);
  assert.match(uiPrimitives, /zIndex: menuLayer/);
  assert.match(uiPrimitives, /getComputedStyle\(dropdownRef\.current\)\.getPropertyValue\(token\)/);
});
