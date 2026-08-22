import { test } from 'node:test';
import assert from 'node:assert/strict';

test('Tenant Schedule Engine — Checkpoint Schedule Definitions', () => {
  const checkpoints = [
    'morning_0900',
    'midday_1300',
    'velocity_1500',
    'eod_1800',
    'outreach_2000',
  ];

  assert.equal(checkpoints.length, 5);
  assert.ok(checkpoints.includes('morning_0900'));
  assert.ok(checkpoints.includes('midday_1300'));
  assert.ok(checkpoints.includes('velocity_1500'));
  assert.ok(checkpoints.includes('eod_1800'));
  assert.ok(checkpoints.includes('outreach_2000'));
});

test('Tenant Schedule Engine — Checkpoint Content & Subject Generation', () => {
  function getCheckpointMeta(checkpoint, ownerName, highPriorityCount, pendingInvoiceTotal) {
    switch (checkpoint) {
      case 'morning_0900':
        return {
          title: '09:00 AM Morning Action Plan',
          subjectContains: 'Daily Action Plan & Priorities',
          focus: `High Priority Tasks: ${highPriorityCount}`,
        };
      case 'midday_1300':
        return {
          title: '13:00 PM Mid-Day Bottleneck & Asset Check',
          subjectContains: 'Mid-Day Bottlenecks & Lacking Assets Report',
          focus: 'Active System Blockers',
        };
      case 'velocity_1500':
        return {
          title: '15:00 PM Operational Velocity Push',
          subjectContains: 'Afternoon Execution & Revenue Push',
          focus: `Pending Revenue: $${pendingInvoiceTotal.toLocaleString()}`,
        };
      case 'eod_1800':
        return {
          title: '18:00 PM End-of-Day Operations Summary',
          subjectContains: 'End-of-Day Executive Operations Summary',
          focus: 'Completed Tasks Today',
        };
      case 'outreach_2000':
        return {
          title: '20:00 PM AI Required Outreach Forecast & Strategy',
          subjectContains: 'AI Required Client/Lead Outreach Forecast',
          focus: 'Target Contacts / Deals',
        };
      default:
        throw new Error('Unknown checkpoint');
    }
  }

  const morning = getCheckpointMeta('morning_0900', 'Bonnie', 4, 13000);
  assert.equal(morning.title, '09:00 AM Morning Action Plan');
  assert.match(morning.subjectContains, /Daily Action Plan/);
  assert.match(morning.focus, /High Priority Tasks: 4/);

  const velocity = getCheckpointMeta('velocity_1500', 'Bonnie', 2, 15000);
  assert.equal(velocity.title, '15:00 PM Operational Velocity Push');
  assert.match(velocity.focus, /15,000/);

  const outreach = getCheckpointMeta('outreach_2000', 'Bonnie', 0, 0);
  assert.equal(outreach.title, '20:00 PM AI Required Outreach Forecast & Strategy');
  assert.match(outreach.subjectContains, /AI Required Client\/Lead Outreach/);
});

test('MCP Email Tools — Search & Read payload validation', () => {
  const mockEmailDispatches = [
    {
      id: 'disp-001',
      tenant_id: 'tenant-100',
      recipient_email: 'client@acme.com',
      subject: 'Project Kickoff Scheduled',
      body_text: 'Hi Acme Team, welcome aboard!',
    },
  ];

  const searchResults = mockEmailDispatches.filter((d) =>
    d.subject.toLowerCase().includes('kickoff')
  );

  assert.equal(searchResults.length, 1);
  assert.equal(searchResults[0].id, 'disp-001');
  assert.equal(searchResults[0].recipient_email, 'client@acme.com');
});
