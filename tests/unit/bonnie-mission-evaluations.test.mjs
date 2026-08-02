import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateMissionExecution } from '../../src/lib/bonnie/bonnieMissionEvaluator.ts';
import { selectAgentsForGoal } from '../../src/lib/bonnie/os/supervisor.ts';

const missions = [
  ['Qualify these leads and update the CRM', ['sales', 'crm', 'research']],
  ['Chase overdue invoices and send reminders', ['finance', 'accounting']],
  ['Publish an image post for this campaign', ['marketing', 'social']],
  ['Open this document and summarize its records', ['document', 'knowledge']],
  ['Resolve this customer support ticket', ['support', 'customer_success']],
  ['Find the operations bottleneck and assign follow-up tasks', ['coo', 'workflow']],
];

test('realistic missions route to a relevant specialist', () => {
  for (const [mission, expected] of missions) {
    const selected = selectAgentsForGoal(mission, { maxAgents: 4 }).map((agent) => agent.id);
    assert.ok(expected.some((id) => selected.includes(id)), `${mission}: routed to ${selected.join(', ')}`);
  }
});

test('write success claims fail without tool evidence', () => {
  const result = evaluateMissionExecution({
    instruction: 'Publish the campaign post',
    response: 'Done — it was successfully published.',
    toolResults: [],
  });
  assert.equal(result.passed, false);
});

test('write success claims pass with successful tool evidence', () => {
  const result = evaluateMissionExecution({
    instruction: 'Publish the campaign post',
    response: 'The post was published.',
    toolResults: [{ tool: 'create_social_post_with_media', success: true, summary: 'Live URL verified' }],
  });
  assert.equal(result.passed, true);
  assert.equal(result.verifiedToolCount, 1);
});

test('approval queues do not count as executed writes', () => {
  const result = evaluateMissionExecution({
    instruction: 'Send the invoice reminder',
    response: 'Successfully sent.',
    toolResults: [{
      tool: 'send_invoice_reminder',
      success: true,
      summary: 'Awaiting approval',
      approvalRequired: true,
    }],
  });
  assert.equal(result.passed, false);
});
