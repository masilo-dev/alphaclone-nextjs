import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

test('launch funnel exposes one core activation path and aliases first contact to first client', async () => {
  const store = new Map();
  const previousCustomEvent = globalThis.CustomEvent;
  globalThis.localStorage = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  };
  globalThis.window = {
    localStorage: globalThis.localStorage,
    dispatchEvent: () => true,
  };
  globalThis.CustomEvent = class CustomEvent {
    constructor(type, init) {
      this.type = type;
      this.detail = init?.detail;
    }
  };

  const { CORE_ACTIVATION_STEPS, launchFunnelService } = await import('../../src/services/launchFunnelService.ts');

  assert.deepEqual(CORE_ACTIVATION_STEPS, [
    'first_client_added',
    'first_invoice_started',
    'first_revenue_action_sent',
  ]);

  await launchFunnelService.completeStep('first_contact_captured');
  const steps = launchFunnelService.getCompletedSteps();
  assert.equal(steps.first_contact_captured, true);
  assert.equal(steps.first_client_added, true);

  delete globalThis.localStorage;
  delete globalThis.window;
  if (previousCustomEvent === undefined) delete globalThis.CustomEvent;
  else globalThis.CustomEvent = previousCustomEvent;
});

test('first-value helper classifies empty workspace stats and exports only core starter modules', async () => {
  const {
    FIRST_VALUE_MODULES,
    hasCompletedCoreActivationSteps,
    isFirstValueRoute,
    isNewWorkspaceStats,
    isWorkspaceActivatedStats,
  } = await import('../../src/lib/activation/firstValue.ts');

  assert.equal(isNewWorkspaceStats({
    totalLeads: 0,
    clientCount: 0,
    activeProjects: 0,
    totalTasks: 0,
    unreadMessages: 0,
    activeCampaigns: 0,
    totalRevenue: 0,
  }), true);
  assert.equal(isNewWorkspaceStats({ clientCount: 1 }), false);
  assert.equal(isWorkspaceActivatedStats({ clientCount: 1, totalRevenue: 0 }), false);
  assert.equal(isWorkspaceActivatedStats({ clientCount: 1, pendingAmount: 250 }), true);
  assert.equal(hasCompletedCoreActivationSteps({
    first_client_added: true,
    first_invoice_started: true,
    first_revenue_action_sent: false,
  }), false);
  assert.equal(hasCompletedCoreActivationSteps({
    first_client_added: true,
    first_invoice_started: true,
    first_revenue_action_sent: true,
  }), true);
  assert.deepEqual(
    FIRST_VALUE_MODULES.map((module) => module.id),
    ['crm', 'invoicing', 'pipeline', 'tasks']
  );
  assert.equal(isFirstValueRoute('/dashboard/crm/workspace?quickAdd=true'), true);
  assert.equal(isFirstValueRoute('/dashboard/business/billing/manage?create=true'), true);
  assert.equal(isFirstValueRoute('/dashboard/business/social-command'), false);
  assert.equal(isFirstValueRoute('/dashboard/executive'), false);
  assert.equal(isFirstValueRoute('/dashboard/accounting'), false);
});

test('new user setup focuses on client, money action, and follow-up', () => {
  const source = read('src/components/dashboard/business/NewUserSetupPanel.tsx');

  assert.match(source, /Add your first client/);
  assert.match(source, /Create the first money action/);
  assert.match(source, /Send a follow-up/);
  assert.match(source, /\/dashboard\/comms/);
  assert.doesNotMatch(source, /Connect email or LinkedIn/);
});

test('welcome modal and launch checklist use the same first-value promise', () => {
  const welcome = read('src/components/dashboard/business/BusinessWelcomeModal.tsx');
  const checklist = read('src/components/dashboard/business/LaunchActivationChecklist.tsx');

  for (const source of [welcome, checklist]) {
    assert.match(source, /first|First|follow-up|follow up|money action|Money action/);
    assert.match(source, /\/dashboard\/comms/);
    assert.doesNotMatch(source, /Schedule first post/);
    assert.doesNotMatch(source, /Connect one channel/);
  }

  assert.match(checklist, /first_client_added/);
  assert.match(checklist, /first_invoice_started/);
  assert.match(checklist, /first_revenue_action_sent/);
  assert.match(checklist, /\.eq\('tenant_id', tenantId\)/);
  assert.match(checklist, /contains\('metadata', \{ step: 'first_revenue_action_sent' \}\)/);
});

test('empty tenant workspaces receive simplified activation navigation', () => {
  const dashboard = read('src/components/dashboard/business/BusinessDashboard.tsx');
  const home = read('src/components/dashboard/OperatingSystemHome.tsx');
  const constants = read('src/constants.ts');

  assert.match(dashboard, /isWorkspaceActivatedStats/);
  assert.match(dashboard, /hasCompletedCoreActivationSteps/);
  assert.match(dashboard, /isFirstValueRoute/);
  assert.match(dashboard, /Finish first business value/);
  assert.match(dashboard, /shouldShowActivationGate/);
  assert.match(dashboard, /activationVersion/);
  assert.match(dashboard, /TENANT_ADMIN_ACTIVATION_NAV_ITEMS/);
  assert.match(home, /FIRST_VALUE_MODULES/);
  assert.match(home, /Start with one customer record, one money action, and one follow-up/);
  assert.match(constants, /TENANT_ADMIN_ACTIVATION_NAV_ITEMS/);
  assert.match(constants, /Customers/);
  assert.match(constants, /Money/);
  assert.match(constants, /Communication/);
  assert.doesNotMatch(
    constants.slice(constants.indexOf('TENANT_ADMIN_ACTIVATION_NAV_ITEMS')),
    /Social command|Executive view|Accounting|Bonnie AI|Lead Finder/
  );
});
