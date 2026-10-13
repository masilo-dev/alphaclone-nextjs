import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getTaskGuide } from '../../src/lib/ui/taskGuides.ts';
import { parseWorkflowConfig, workflowConfigError } from '../../src/lib/ui/workflowConfig.ts';
test('specific user tasks receive the relevant guide through route aliases', () => {
  assert.equal(getTaskGuide('/dashboard/contacts').title, 'Manage customers and sales');
  assert.equal(getTaskGuide('/dashboard/leads/campaigns').title, 'Find and save leads');
  assert.equal(getTaskGuide('/dashboard/business/contracts/manage').title, 'Prepare a contract');
  assert.equal(getTaskGuide('/dashboard/business/campaigns').title, 'Create a campaign');
  assert.equal(getTaskGuide('/dashboard/outreach').title, 'Prepare outreach');
  assert.equal(getTaskGuide('/unknown'), null);
});
test('workflow settings preserve event placeholders and numeric values', () => {
  assert.deepEqual(parseWorkflowConfig('{"title":"Follow up {{contact_name}}","due_hours":2}'), {title:'Follow up {{contact_name}}',due_hours:2});
});
test('partial editing and non-object workflow settings prevent submission', () => {
  for (const text of ['{"message":', 'null', '[]', '42', '"hello"']) {
    assert.ok(workflowConfigError(text));
    assert.throws(() => parseWorkflowConfig(text));
  }
  assert.equal(workflowConfigError('{"message":"hello"}'), null);
});
