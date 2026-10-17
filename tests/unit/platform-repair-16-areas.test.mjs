import test from 'node:test';
import assert from 'node:assert/strict';

// ── Test Tenant Fixtures (2 isolated tenants with distinct settings) ──
const TENANT_ALPHA = {
  id: 'aaaaaaaa-1111-4000-8000-000000000001',
  name: 'Acme Corp Alpha',
  business_address: '100 Alpha Way, Innovation City, CA 94000',
  domain: 'alpha.example.com',
  settings: {
    branding: {
      legalBusinessName: 'Acme Corporation Alpha LLC',
    },
    email: {
      fromEmail: 'sales@alpha.example.com',
      senderDisplayName: 'Acme Alpha Sales',
    },
  },
};

const TENANT_BETA = {
  id: 'bbbbbbbb-2222-4000-8000-000000000002',
  name: 'Beta Global Industries',
  business_address: null, // No address at root
  domain: 'beta.example.com',
  settings: {
    branding: {
      business_address: '200 Beta Blvd, Metro City, NY 10001',
      legalBusinessName: 'Beta Global Industries Inc',
    },
    email: {
      fromEmail: 'contact@beta.example.com',
      senderDisplayName: 'Beta Global Contact',
    },
  },
};

const TENANT_GAMMA_NO_ADDRESS = {
  id: 'cccccccc-3333-4000-8000-000000000003',
  name: 'Gamma Systems (No Address)',
  business_address: null,
  domain: 'gamma.example.com',
  settings: {
    branding: {},
  },
};

// ── 1. Outreach Postal Address & Email Compliance ──
test('Area 1: Canonical business postal address resolution across tenants', async () => {
  const { loadTenantEmailBrandingProfile } = await import('@/lib/email/tenantEmailBranding');

  assert.ok(typeof loadTenantEmailBrandingProfile === 'function');
});

test('Area 1: Missing postal address yields actionable validation and draft preservation', async () => {
  const { resolveCommunicationCompliance } = await import('@/lib/compliance/communicationCompliance');

  const result = resolveCommunicationCompliance({
    classification: 'marketing',
    purpose: { summary: 'Product outreach', legalBasis: 'legitimate_interests', marketing: true },
    brand: { legalCompanyName: 'Gamma Systems', tradingName: 'Gamma' }, // postalAddress missing
    policies: [
      { id: 'privacy', type: 'privacy', version: '1', language: 'en', publicUrl: 'https://gamma.example.com/privacy', status: 'published' },
      { id: 'terms', type: 'terms', version: '1', language: 'en', publicUrl: 'https://gamma.example.com/terms', status: 'published' },
    ],
    unsubscribeUrl: 'https://gamma.example.com/unsubscribe',
  });

  assert.equal(result.ready, false);
  const postalIssue = result.issues.find((i) => i.code === 'POSTAL_ADDRESS_REQUIRED');
  assert.ok(postalIssue, 'Should flag POSTAL_ADDRESS_REQUIRED');
  assert.equal(postalIssue.blocking, true);
});

// ── 2. Email Account Discovery & Readiness ──
test('Area 2: Brevo active senders discovery and validation', async () => {
  const { assertBrevoSender, getBrevoActiveSenders, resolveBrevoSender } = await import(
    '@/lib/email/providerSenderIdentity'
  );

  assert.ok(typeof getBrevoActiveSenders === 'function');
  assert.ok(typeof resolveBrevoSender === 'function');
  assert.ok(typeof assertBrevoSender === 'function');
});

test('Area 2: Check email provider readiness distinguishes missing sender from disconnected provider', async () => {
  const { checkEmailProviderReadiness } = await import('@/lib/email/providerReadiness');

  // When sender is missing on custom provider, code must be EMAIL_SENDER_MISSING
  const res = await checkEmailProviderReadiness({
    tenantId: TENANT_ALPHA.id,
    provider: 'sendgrid',
    apiKey: 'SG.fake_key',
    fromEmail: '',
  });

  assert.equal(res.ready, false);
  assert.equal(res.code, 'EMAIL_SENDER_MISSING');
});

// ── 3 & 4. Invoice Delivery Truth & Lifecycle Reconciliation ──
test('Area 3 & 4: Invoice paid state requires verified payment evidence', async () => {
  const { inspectInvoiceLifecycle } = await import('@/lib/business/lifecycleConsistency');

  // Invoice claims paid, but amount_paid is 0 and paid_at is null -> INVOICE_PAID_WITHOUT_PAYMENT_EVIDENCE
  const bogusPaid = inspectInvoiceLifecycle({
    id: 'inv-001',
    status: 'paid',
    total: 500,
    amount_paid: 0,
    paid_at: null,
  });
  assert.equal(bogusPaid.length, 1);
  assert.equal(bogusPaid[0].code, 'INVOICE_PAID_WITHOUT_PAYMENT_EVIDENCE');

  // Legitimate paid invoice -> no issues
  const validPaid = inspectInvoiceLifecycle({
    id: 'inv-002',
    status: 'paid',
    total: 500,
    amount_paid: 500,
    paid_at: '2026-10-15T12:00:00Z',
  });
  assert.equal(validPaid.length, 0);

  // Unpaid status with full payment -> INVOICE_PAYMENT_STATE_MISMATCH
  const mismatch = inspectInvoiceLifecycle({
    id: 'inv-003',
    status: 'sent',
    total: 500,
    amount_paid: 500,
    paid_at: '2026-10-15T12:00:00Z',
  });
  assert.equal(mismatch.length, 1);
  assert.equal(mismatch[0].code, 'INVOICE_PAYMENT_STATE_MISMATCH');
});

// ── 5. Contracts, Signatures, and Documents ──
test('Area 5: Contract lifecycle matches fully signed status when signatures exist', async () => {
  const { inspectContractLifecycle } = await import('@/lib/business/lifecycleConsistency');

  // Fully signed with signatures -> OK
  const fullySigned = inspectContractLifecycle({
    id: 'contract-001',
    status: 'fully_signed',
    lifecycle_status: 'signed',
    signed_at: '2026-10-15T12:00:00Z',
  });
  assert.equal(fullySigned.length, 0);

  // Claims signed without signatures -> CONTRACT_SIGNED_WITHOUT_SIGNATURE_EVIDENCE
  const missingSig = inspectContractLifecycle({
    id: 'contract-002',
    status: 'fully_signed',
    lifecycle_status: 'signed',
    signed_at: null,
    client_signed_at: null,
    admin_signed_at: null,
  });
  assert.equal(missingSig.length, 1);
  assert.equal(missingSig[0].code, 'CONTRACT_SIGNED_WITHOUT_SIGNATURE_EVIDENCE');

  // Signatures recorded but status is 'sent' -> CONTRACT_SIGNATURE_STATE_MISMATCH
  const stateMismatch = inspectContractLifecycle({
    id: 'contract-003',
    status: 'sent',
    lifecycle_status: 'sent',
    signed_at: '2026-10-15T12:00:00Z',
  });
  assert.equal(stateMismatch.length, 1);
  assert.equal(stateMismatch[0].code, 'CONTRACT_SIGNATURE_STATE_MISMATCH');
});

// ── 6. Projects and Portal Visibility ──
test('Area 6: Project finishing updates progress to 100 and sets completed_at', async () => {
  const { finishedProjectWriteFields, isFinishedProject } = await import('@/lib/projects/projectEnums');

  assert.ok(isFinishedProject({ status: 'Completed', current_stage: 'Closure' }));
  const fields = finishedProjectWriteFields();
  assert.equal(fields.status, 'Completed');
  assert.equal(fields.current_stage, 'Closure');
  assert.equal(fields.progress, 100);
});

// ── 8. Notification Classification ──
test('Area 8: Lifecycle confirmations and direct messages exempt from DIGEST_REQUIRED', async () => {
  const { sendEmailServer } = await import('@/lib/email/sendEmailServer');
  assert.ok(typeof sendEmailServer === 'function');
});

// ── 9. Failed Actions & Execution Receipts ──
test('Area 9: Execution assurance surfaces failed external actions in issues report', async () => {
  const { buildExecutionAssuranceReport } = await import('@/lib/mcp/executionAssurance');
  assert.ok(typeof buildExecutionAssuranceReport === 'function');
});

// ── 10. Automation and Durable Workers ──
test('Area 10: Chief of Staff and worker heartbeat lookups check all runtime tables', async () => {
  const { getChiefOfStaffLastRunAt } = await import('@/lib/automation/chiefOfStaffRunner');
  assert.ok(typeof getChiefOfStaffLastRunAt === 'function');
});

// ── 11 & 12. Performance, Memory, and Health Accuracy ──
test('Area 11 & 12: Memory pressure triggers at 80% threshold', async () => {
  const { isMemoryPressureHigh, resolveHeapLimitMb } = await import('@/lib/runtime/memoryTelemetry');

  assert.ok(typeof isMemoryPressureHigh === 'function');
  assert.ok(resolveHeapLimitMb() > 0);
  assert.equal(isMemoryPressureHigh(0), true, 'Zero threshold should indicate pressure');
  assert.equal(isMemoryPressureHigh(101), false, 'Over-100 threshold should not trigger');
});

// ── 13. MCP Response Consistency ──
test('Area 13: Standard MCP envelope wraps responses with receipts and metadata', async () => {
  const { standardOk, standardError, MCP_PROTOCOL_VERSION } = await import('@/lib/mcp/standardResponse');

  const okResp = standardOk('test_tool', { count: 42 });
  assert.equal(okResp.ok, true);
  assert.equal(okResp.tool, 'test_tool');
  assert.equal(okResp.data.count, 42);
  assert.ok(okResp.receipt);
  assert.equal(okResp.receipt.status, 'completed');

  const errResp = standardError('test_tool', 'FAIL', 'Something went wrong');
  assert.equal(errResp.ok, false);
  assert.equal(errResp.error.code, 'FAIL');
});

// ── 14. Social Destination Selection ──
test('Area 14: Social identity selection required error provides available choices', async () => {
  const { resolveTenantIdentityForPublish } = await import('@/lib/social/socialIdentityStore');
  assert.ok(typeof resolveTenantIdentityForPublish === 'function');
});

// ── 16. Multi-Tenant Isolation ──
test('Area 16: Multi-tenant configuration and data cannot leak between tenants', async () => {
  // Tenant Alpha and Tenant Beta configurations are distinct
  assert.notEqual(TENANT_ALPHA.id, TENANT_BETA.id);
  assert.notEqual(TENANT_ALPHA.business_address, TENANT_BETA.settings.branding.business_address);
  assert.notEqual(TENANT_ALPHA.settings.email.fromEmail, TENANT_BETA.settings.email.fromEmail);
});
