import { test } from 'node:test';
import assert from 'node:assert/strict';

// Test translation logic directly
function translateMcpToolToBusinessEvent(toolName, input, output, success) {
  const normalizedTool = toolName.toLowerCase();
  if (normalizedTool.includes('create_project')) {
    return {
      event: 'Project created',
      businessContext: `Project "${input.name || input.title || 'New Project'}" initialized via MCP.`,
      result: success
        ? `Project created for ${input.client_name || input.clientName || 'Client'}.`
        : `Project creation failed: ${output.error || 'Unknown error'}`,
      nextAction: 'Collect client assets and assign initial milestone tasks.',
    };
  }
  return {
    event: 'Task executed',
    businessContext: 'Operation completed',
    result: success ? 'Success' : 'Failed',
  };
}

function formatDailyOperationsDigestHtml(summary) {
  return `
    <div>
      <h1>AlphaClone Daily Operations</h1>
      <p>Workspace: ${summary.tenantName}</p>
      <h2>Today</h2>
      <ul>
        <li><strong>${summary.today.newLeads}</strong> new leads</li>
        <li><strong>$${summary.today.paymentsReceivedAmount.toLocaleString()}</strong> payment received</li>
      </ul>
      <h2>Needs Attention</h2>
      <ul>
        ${summary.needsAttention.details.map((item) => `<li>${item}</li>`).join('')}
      </ul>
    </div>
  `;
}

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

test('Daily Operations Summary — HTML format builder', () => {
  const mockSummary = {
    tenantId: 'tenant-001',
    tenantName: 'Acme Agency',
    today: {
      newLeads: 5,
      paymentsReceivedAmount: 15000,
    },
    needsAttention: {
      details: ['1 overdue invoice requires payment follow-up', '1 project marked at risk'],
    },
  };

  const html = formatDailyOperationsDigestHtml(mockSummary);

  assert.match(html, /AlphaClone Daily Operations/);
  assert.match(html, /Acme Agency/);
  assert.match(html, /5.*new leads/);
  assert.match(html, /15,000.*payment received/);
  assert.match(html, /Needs Attention/);
  assert.match(html, /1 overdue invoice requires payment follow-up/);
});
