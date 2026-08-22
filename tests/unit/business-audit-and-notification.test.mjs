import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  translateMcpToolToBusinessEvent,
  translateAiActivityToBusinessEvent,
  translateFailureToBusinessEvent,
} from '../../src/lib/audit/businessAuditEngine.ts';
import { formatDailyOperationsDigestHtml } from '../../src/lib/email/dailyBusinessDigestEngine.ts';

test('Business Audit Engine — MCP tool execution translator', () => {
  const result = translateMcpToolToBusinessEvent(
    'create_project',
    { name: 'Acme Enterprise Redesign', client_name: 'Acme Corp' },
    { id: 'proj-123' },
    true
  );

  assert.equal(result.event, 'Project created');
  assert.match(result.businessContext, /Acme Enterprise Redesign/);
  assert.match(result.result, /Acme Corp/);
  assert.match(result.nextAction, /Collect client assets/);
});

test('Business Audit Engine — AI activity translator', () => {
  const result = translateAiActivityToBusinessEvent(
    'Bonnie AI',
    'Follow up with lead',
    'Beta Systems',
    'Schedule demo call due to high intent score'
  );

  assert.equal(result.event, 'Bonnie AI recommended action');
  assert.match(result.result, /Schedule demo call/);
  assert.equal(result.nextAction, 'Awaiting team owner approval or confirmation.');
});

test('Business Audit Engine — Failure event translator', () => {
  const result = translateFailureToBusinessEvent(
    'Social Publishing',
    'publish post to LinkedIn',
    'OAuth token expired',
    'Reconnect LinkedIn account in Settings'
  );

  assert.equal(result.event, 'Social Publishing action failed');
  assert.equal(result.nextAction, 'Reconnect LinkedIn account in Settings');
});

test('Daily Operations Summary — HTML format builder', () => {
  const mockSummary = {
    tenantId: 'tenant-001',
    tenantName: 'Acme Agency',
    today: {
      newLeads: 5,
      qualifiedLeads: 3,
      newClients: 1,
      proposalsSent: 2,
      proposalsAccepted: 1,
      meetingsCompleted: 4,
      projectsCreated: 1,
      tasksCompleted: 8,
      paymentsReceivedAmount: 15000,
    },
    needsAttention: {
      unansweredEmails: 2,
      overdueInvoices: 1,
      projectsAtRisk: 1,
      failedActionsCount: 0,
      details: ['1 overdue invoice requires payment follow-up', '1 project marked at risk'],
    },
    waitingOn: ['Pending signature: Enterprise Master Services Agreement'],
    tomorrow: ['Meeting: Project kickoff with Acme CEO'],
  };

  const html = formatDailyOperationsDigestHtml(mockSummary);

  assert.match(html, /AlphaClone Daily Operations/);
  assert.match(html, /Acme Agency/);
  assert.match(html, /5.*new leads/);
  assert.match(html, /\$15,000.*payment received/);
  assert.match(html, /Needs Attention/);
  assert.match(html, /1 overdue invoice requires payment follow-up/);
  assert.match(html, /Pending signature: Enterprise Master Services Agreement/);
});
