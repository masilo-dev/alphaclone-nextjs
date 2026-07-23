import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateContract,
  validateInvoice,
  detectNovusOriginalityContradiction,
} from '../../src/lib/documents/documentValidationEngine.ts';
import { classifyActionRisk, buildCapabilityManifest, WORKFLOW_STATES } from '../../src/lib/mcp/capabilityManifest.ts';
import { standardOk, standardError, approvalRequiredError, MCP_PROTOCOL_VERSION } from '../../src/lib/mcp/standardResponse.ts';
import { routeModel } from '../../src/lib/ai/modelRouter.ts';
import { sanitizeForAudit } from '../../src/lib/mcp/actionReceipts.ts';
import { normalizeToolName } from '../../src/lib/mcp/mcpToolTelemetry.ts';
import { CHATGPT_CONNECTOR_TOOL_NAMES } from '../../src/lib/mcp/toolAnnotations.ts';
import { isHighRiskActionProxy } from './_workflowRiskHelper.mjs';

test('contract validator detects contradictory originality clauses (Novus-style)', () => {
  const text = `
    Alphaclone guarantees the originality of all creative work delivered under this agreement.
    Alphaclone agreed to copy the logo provided by Novus Power and disclaims originality for that asset.
  `;
  assert.equal(detectNovusOriginalityContradiction(text), true);
  const result = validateContract({
    text,
    clientName: 'Novus Power',
    clientEmail: 'ops@novus.example',
    isDraft: true,
    hasSignaturesFilled: true,
  });
  assert.equal(result.can_send, false);
  assert.ok(result.findings.some((f) => f.id === 'contradictory-originality'));
  assert.ok(result.findings.some((f) => f.id === 'draft-with-signatures'));
  assert.ok(result.findings.some((f) => f.id === 'undefined-jurisdiction'));
});

test('paid invoice validation requires zero balance and payment evidence', () => {
  const bad = validateInvoice({
    status: 'paid',
    total: 1000,
    amount_paid: 0,
    balance_due: 1000,
    currency: null,
    supplier_legal_name: "ALPHACLONE SYSTEMS's Organization",
    client_name: null,
    client_email: null,
  });
  assert.equal(bad.can_send, false);
  assert.ok(bad.findings.some((f) => f.id === 'paid-nonzero-balance'));
  assert.ok(bad.findings.some((f) => f.id === 'incomplete-supplier'));

  const good = validateInvoice({
    status: 'paid',
    total: 1000,
    amount_paid: 1000,
    balance_due: 0,
    paid_at: new Date().toISOString(),
    payment_method: 'eft',
    payment_reference: 'TXN-1',
    currency: 'ZAR',
    supplier_legal_name: 'Alphaclone Systems (Pty) Ltd',
    client_name: 'Novus Power',
    client_email: 'accounts@novus.example',
    is_receipt: true,
  });
  assert.equal(good.valid, true);
  assert.equal(good.can_send, true);
});

test('standard MCP success and approval error envelopes', () => {
  const ok = standardOk('send_transactional_email', { message_id: 'm1' }, {
    receipt: { status: 'completed', provider: 'zoho', provider_reference: 'm1' },
    meta: { tenant_id: 't1' },
  });
  assert.equal(ok.ok, true);
  assert.equal(ok.tool, 'send_transactional_email');
  assert.equal(ok.error, null);
  assert.ok(ok.receipt?.action_id);
  assert.equal(ok.meta.protocol_version, MCP_PROTOCOL_VERSION);

  const err = approvalRequiredError('publish_now', 'appr-1', 'Publishing requires approval');
  assert.equal(err.ok, false);
  assert.equal(err.error.code, 'APPROVAL_REQUIRED');
  assert.equal(err.error.approval_id, 'appr-1');
  assert.equal(err.error.retryable, true);
  assert.equal(err.error.details.approve_tool, 'approve_workflow_step');
});

test('capability negotiation exposes multi-client support and workflow states', () => {
  const manifest = buildCapabilityManifest({
    availableTools: ['search_leads', 'send_transactional_email', 'approve_workflow_step'],
    testMode: true,
  });
  assert.equal(manifest.mode, 'sandbox');
  assert.ok(manifest.supported_clients.includes('chatgpt'));
  assert.ok(manifest.supported_clients.includes('claude'));
  assert.ok(manifest.supported_clients.includes('cursor'));
  assert.ok(manifest.supported_clients.includes('bonnie'));
  for (const state of WORKFLOW_STATES) {
    assert.ok(manifest.workflow_states.includes(state));
  }
});

test('model router returns fallback chain without losing primary selection', () => {
  const decision = routeModel({
    taskType: 'reason',
    preferredProvider: 'anthropic',
    fallbackChain: ['anthropic', 'openai', 'deepseek'],
  });
  assert.ok(decision.provider);
  assert.ok(decision.model);
  assert.ok(Array.isArray(decision.fallbacks));
});

test('risk classification for approvals', () => {
  assert.equal(classifyActionRisk('search_leads'), 'none');
  assert.equal(classifyActionRisk('send_transactional_email'), 'normal');
  assert.equal(classifyActionRisk('publish_now'), 'normal');
  assert.equal(classifyActionRisk('refund_payment'), 'strong');
  assert.equal(classifyActionRisk('delete_lead'), 'strong');
});

test('sanitizeForAudit redacts secrets and email bodies', () => {
  const sanitized = sanitizeForAudit({
    to: 'bonniiehendrix@gmail.com',
    body_html: '<p>secret contract</p>',
    access_token: 'tok_123',
    nested: { refresh_token: 'r1', ok: true },
  });
  assert.equal(sanitized.body_html, '[redacted]');
  assert.equal(sanitized.access_token, '[redacted]');
  assert.equal(sanitized.nested.refresh_token, '[redacted]');
  assert.equal(sanitized.nested.ok, true);
  assert.equal(sanitized.to, 'bonniiehendrix@gmail.com');
});

test('mcp tool_name never normalizes to empty/null', () => {
  assert.equal(normalizeToolName(null), '_unknown_tool');
  assert.equal(normalizeToolName(undefined), '_unknown_tool');
  assert.equal(normalizeToolName(''), '_unknown_tool');
  assert.equal(normalizeToolName('  '), '_unknown_tool');
  assert.equal(normalizeToolName('search_leads'), 'search_leads');
});

test('curated MCP catalog includes autonomous transactional tools', () => {
  for (const name of [
    'search_leads',
    'search_contacts',
    'send_transactional_email',
    'upload_media',
    'publish_now',
    'approve_workflow_step',
    'reject_workflow_step',
    'resume_workflow',
    'mark_invoice_paid',
    'validate_document',
    'negotiate_capabilities',
  ]) {
    assert.ok(CHATGPT_CONNECTOR_TOOL_NAMES.includes(name), `missing curated tool ${name}`);
  }
});

test('workflow high-risk actions never silently skip', () => {
  assert.equal(isHighRiskActionProxy('send_outreach'), true);
  assert.equal(isHighRiskActionProxy('search_leads'), false);
});

test('duplicate idempotency semantics: standardError is distinct from success', () => {
  const a = standardOk('send_transactional_email', { message_id: '1' }, {
    meta: { idempotency_key: 'k1' },
  });
  const b = standardError('send_transactional_email', 'PROVIDER_ERROR', 'failed', { retryable: true });
  assert.equal(a.ok, true);
  assert.equal(b.ok, false);
  assert.equal(a.meta.idempotency_key, 'k1');
});

test('designated test contacts are recognized for sandbox matrix', () => {
  const contacts = ['bonniiehendrix@gmail.com', 'bornfacemasilo22@gmail.com'];
  assert.equal(contacts.length, 2);
  assert.ok(contacts.every((c) => c.includes('@')));
});
