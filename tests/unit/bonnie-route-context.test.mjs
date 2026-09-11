import test from 'node:test';
import assert from 'node:assert/strict';

const {
  resolveBonnieContextsFromPath,
  modeRequiresConfirmation,
} = await import('../../src/lib/dashboard/bonnieRouteContext.ts');

test('infers CRM context from path', () => {
  const contexts = resolveBonnieContextsFromPath('/dashboard/crm/workspace');
  assert.equal(contexts[0]?.label, 'CRM');
  assert.equal(contexts[0]?.type, 'CRM');
});

test('infers invoicing context from billing path', () => {
  const contexts = resolveBonnieContextsFromPath('/dashboard/business/billing/manage');
  assert.equal(contexts[0]?.label, 'Invoicing');
});

test('confirmation required for send/delete/automate intents', () => {
  assert.equal(modeRequiresConfirmation('ask', 'send this email to the client'), true);
  assert.equal(modeRequiresConfirmation('automate', 'create a workflow'), true);
  assert.equal(modeRequiresConfirmation('ask', 'what is my pipeline health?'), false);
});
