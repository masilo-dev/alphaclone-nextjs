import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isEnterpriseFullBleedTab } from '../../src/components/ui/EnterpriseTabWrapper.tsx';

/**
 * Regression: /dashboard/comms was edge-to-edge in BusinessDashboard but not in
 * EnterpriseTabWrapper, so the inbox wrapper grew to the email's full height
 * inside an overflow-hidden main and long messages could not be scrolled.
 */
test('every edge-to-edge business route is also full-bleed in the enterprise wrapper', () => {
  const source = readFileSync(new URL('../../src/components/dashboard/business/BusinessDashboard.tsx', import.meta.url), 'utf8');
  const block = source.match(/const DASHBOARD_EDGE_TO_EDGE_TABS: string\[\] = \[([\s\S]*?)\];/);
  assert.ok(block, 'DASHBOARD_EDGE_TO_EDGE_TABS must exist');
  const routes = [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  assert.ok(routes.includes('/dashboard/comms'));
  for (const route of routes) {
    assert.equal(isEnterpriseFullBleedTab(route), true, `${route} must be full-bleed so its own panes can scroll`);
  }
});

test('the unified inbox routes own their scroll', () => {
  assert.equal(isEnterpriseFullBleedTab('/dashboard/comms'), true);
  assert.equal(isEnterpriseFullBleedTab('/dashboard/mail'), true);
  assert.equal(isEnterpriseFullBleedTab('/dashboard/business/contracts/manage'), false);
});

test('reading a message shows a dedicated scroll pane and keeps reply collapsed', () => {
  const source = readFileSync(
    new URL('../../src/components/dashboard/business/UnifiedInboxView.tsx', import.meta.url),
    'utf8',
  );
  assert.match(source, /data-testid="email-reading-pane"/);
  assert.match(source, /ac-email-reader-scroll/);
  assert.match(source, /overflow-y-scroll/);
  assert.match(source, /Write a reply…/);
  assert.match(source, /replyComposerOpen/);
  assert.equal(source.includes('AI Quick Reply Suggestions'), false);
});
