import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveProjectNextActions } from '../../src/lib/projects/projectIntelligence.ts';

test('blocked work outranks approvals, payments and overdue work', () => {
  const actions = deriveProjectNextActions({
    blockedTasks: [{ id: 'task-blocked', title: 'Development' }],
    missingApprovals: [{ id: 'approval-1', title: 'Design approval' }],
    unpaidInvoices: [{ id: 'invoice-1', invoice_number: 'INV-1', due_date: '2999-01-01' }],
    overdueTasks: [{ id: 'task-late', title: 'QA' }],
    overdueMilestones: [],
  });

  assert.equal(actions[0].type, 'blocked_task');
  assert.equal(actions[0].priority, 'critical');
});

test('overdue unpaid invoice is critical', () => {
  const actions = deriveProjectNextActions({
    blockedTasks: [],
    missingApprovals: [],
    unpaidInvoices: [{ id: 'invoice-1', invoice_number: 'INV-1', due_date: '2000-01-01' }],
    overdueTasks: [],
    overdueMilestones: [],
  });

  assert.equal(actions[0].type, 'unpaid_invoice');
  assert.equal(actions[0].priority, 'critical');
});

test('approval requirement becomes a high priority next action', () => {
  const actions = deriveProjectNextActions({
    blockedTasks: [],
    missingApprovals: [{ id: 'approval-1', title: 'Client design approval' }],
    unpaidInvoices: [],
    overdueTasks: [],
    overdueMilestones: [],
  });

  assert.equal(actions[0].type, 'missing_approval');
  assert.equal(actions[0].priority, 'high');
});

test('healthy project gets continue-work fallback', () => {
  const actions = deriveProjectNextActions({
    blockedTasks: [],
    missingApprovals: [],
    unpaidInvoices: [],
    overdueTasks: [],
    overdueMilestones: [],
  });

  assert.deepEqual(actions, [
    { type: 'continue_work', priority: 'low', label: 'Continue planned project work.' },
  ]);
});
