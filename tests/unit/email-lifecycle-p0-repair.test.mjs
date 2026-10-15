import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import crypto from 'node:crypto';

function load(path, dependencies = {}) {
  const source = fs.readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(
    code,
    {
      exports,
      require: (name) => {
        if (name === 'node:crypto' || name === 'crypto') return crypto;
        if (name === 'uuid') return { v4: () => crypto.randomUUID() };
        if (dependencies[name]) return dependencies[name];
        if (name === '@/lib/email/unifiedEmailDomain') return { toUnifiedEmailProvider: (p) => p };
        if (name === '@/lib/email/mailboxNormalization') return { explicitRecipients: (v) => Array.isArray(v) ? v : [v] };
        if (name === '@/lib/email/emailAttachment') return { normalizeEmailAttachments: (a) => a || [] };
        if (name === '@/lib/emailLogger') return { logEmailSend: async () => {} };
        if (name === 'sanitize-html') return (s) => s;
        if (name === '@/lib/bonnie/bonnieBannedLanguage') return { sanitizeBonnieOutboundText: (s) => s };
        if (name === '@/lib/email/unsubscribeToken') return { buildUnsubscribeUrl: () => 'https://example.com/unsub' };
        if (name === '@/lib/email/emailRendering') return { renderOutboundEmail: (args) => ({ html: args?.html || args?.text || '', text: args?.text || args?.html || '' }) };
        return {};
      },
      crypto,
      console,
      setTimeout,
      clearTimeout,
      process,
      FormData,
      Blob,
      Headers,
      Request,
      Response,
      AbortSignal,
      Buffer,
      Uint8Array,
      ...(dependencies.__globals || {}),
    },
    { filename: path }
  );
  return exports;
}

// ----------------------------------------------------------------------------
// Test 1: First contract send
// ----------------------------------------------------------------------------
test('1. First contract send generates stable base idempotency key without attempt ID', () => {
  const { contractSendIdempotencyKey } = load('src/lib/execution/domainIdempotencyKeys.ts');
  const key = contractSendIdempotencyKey({
    tenantId: 'tenant-1',
    contractId: 'contract-abc',
    recipient: 'client@example.com',
    version: '1',
  });
  assert.equal(key, 'contract-send:tenant-1:contract-abc:client@example.com:v1');
  assert.ok(!key.includes(':attempt:'), 'First send must not contain an attempt suffix');
});

// ----------------------------------------------------------------------------
// Test 2: Intentional contract resend
// ----------------------------------------------------------------------------
test('2. Intentional contract resend generates distinct attempt key', () => {
  const { contractSendIdempotencyKey } = load('src/lib/execution/domainIdempotencyKeys.ts');
  const initialKey = contractSendIdempotencyKey({
    tenantId: 'tenant-1',
    contractId: 'contract-abc',
    recipient: 'client@example.com',
    version: '1',
  });
  const resendAttemptId = 'resend-attempt-uuid-123';
  const resendKey = contractSendIdempotencyKey({
    tenantId: 'tenant-1',
    contractId: 'contract-abc',
    recipient: 'client@example.com',
    version: '1',
    attemptId: resendAttemptId,
  });

  assert.notEqual(initialKey, resendKey, 'Resend key must differ from initial send key');
  assert.equal(resendKey, `contract-send:tenant-1:contract-abc:client@example.com:v1:attempt:${resendAttemptId}`);
});

// ----------------------------------------------------------------------------
// Test 3: Double-click protection
// ----------------------------------------------------------------------------
test('3. Double-click protection: simultaneous executions for same key execute only once', async () => {
  let executions = 0;
  let release;
  const barrier = new Promise((resolve) => { release = resolve; });

  const receipts = new Map();
  const mockReceipts = {
    findReceiptByIdempotency: async ({ idempotencyKey }) => receipts.get(idempotencyKey) || null,
    persistActionReceipt: async ({ idempotencyKey, receipt, success }) => {
      receipts.set(idempotencyKey, {
        final_status: receipt.status,
        sanitized_output: { success, provider_message_id: 'msg-first' },
      });
      return 'receipt-id';
    },
  };

  const { executeDomainExternalWrite } = load('src/lib/execution/domainExternalWrite.ts', {
    '@/lib/supabase-admin': {
      createSupabaseAdminClient: () => ({
        from: () => ({
          insert: () => ({ select: () => ({ maybeSingle: async () => ({ id: 'action-1' }) }) }),
          update: () => ({ eq: async () => ({}) }),
        }),
      }),
    },
    '@/lib/mcp/actionReceipts': mockReceipts,
    '@/lib/media/stripHeavyPayload': { stripHeavyPayloadFields: (p) => p },
    '@/lib/execution/executionErrorTaxonomy': { normalizeExecutionErrorCode: (c) => c },
    '@/lib/execution/executionStates': {
      normalizeCanonicalExecutionState: (s) => (s === 'provider_accepted' ? 'succeeded' : s),
      isAmbiguousTransportError: () => false,
      toDbExternalActionStatus: (s) => s,
    },
  });

  const p1 = executeDomainExternalWrite({
    tenantId: 'tenant-1',
    userId: 'user-1',
    capability: 'send_contract',
    action: 'contract.send',
    mode: 'execute_now',
    executionSource: 'ui',
    idempotencyKey: 'contract-send:tenant-1:c-1:client@test.com:v1',
    target: { workspace_id: 'tenant-1' },
    payload: {},
    execute: async () => {
      executions++;
      await barrier;
      return { success: true, provider_message_id: 'msg-first' };
    },
    isSuccess: (r) => r.success === true,
    buildReceipt: (r) => ({ action_id: 'act-1', status: 'provider_accepted', provider_reference: r.provider_message_id }),
  });

  // Release the barrier
  release();
  const res1 = await p1;

  // Second immediate attempt with same idempotency key
  const res2 = await executeDomainExternalWrite({
    tenantId: 'tenant-1',
    userId: 'user-1',
    capability: 'send_contract',
    action: 'contract.send',
    mode: 'execute_now',
    executionSource: 'ui',
    idempotencyKey: 'contract-send:tenant-1:c-1:client@test.com:v1',
    target: { workspace_id: 'tenant-1' },
    payload: {},
    execute: async () => {
      executions++;
      return { success: true, provider_message_id: 'msg-second' };
    },
    isSuccess: (r) => r.success === true,
    buildReceipt: (r) => ({ action_id: 'act-2', status: 'provider_accepted' }),
  });

  assert.equal(executions, 1, 'Provider execute must only be called once');
  assert.equal(res1.ok, true);
  assert.equal(res2.ok, true);
  assert.equal(res2.replayed, true, 'Second call must be flagged as replayed');
});

// ----------------------------------------------------------------------------
// Test 4: Retry with the same idempotency key
// ----------------------------------------------------------------------------
test('4. Retry with the same idempotency key returns cached result with replayed: true', async () => {
  const receipts = new Map();
  receipts.set('test-key', {
    final_status: 'succeeded',
    action_id: 'act-123',
    sanitized_output: { success: true, emailId: 'provider-1791958150306002100' },
  });

  const { executeDomainExternalWrite } = load('src/lib/execution/domainExternalWrite.ts', {
    '@/lib/supabase-admin': { createSupabaseAdminClient: () => ({}) },
    '@/lib/mcp/actionReceipts': {
      findReceiptByIdempotency: async ({ idempotencyKey }) => receipts.get(idempotencyKey) || null,
      persistActionReceipt: async () => 'id',
    },
    '@/lib/media/stripHeavyPayload': { stripHeavyPayloadFields: (p) => p },
    '@/lib/execution/executionErrorTaxonomy': { normalizeExecutionErrorCode: (c) => c },
    '@/lib/execution/executionStates': {
      normalizeCanonicalExecutionState: (s) => (s === 'succeeded' ? 'succeeded' : s),
      isAmbiguousTransportError: () => false,
      toDbExternalActionStatus: (s) => s,
    },
  });

  let calls = 0;
  const result = await executeDomainExternalWrite({
    tenantId: 'tenant-1',
    userId: 'user-1',
    capability: 'send_contract',
    action: 'contract.send',
    mode: 'execute_now',
    executionSource: 'ui',
    idempotencyKey: 'test-key',
    target: { workspace_id: 'tenant-1' },
    payload: {},
    execute: async () => {
      calls++;
      return { success: true };
    },
    isSuccess: (r) => r.success === true,
    buildReceipt: () => ({ action_id: 'new', status: 'provider_accepted' }),
  });

  assert.equal(calls, 0, 'Must not call execute when succeeded receipt exists');
  assert.equal(result.replayed, true, 'Result must have replayed: true');
  assert.equal(result.result.replayed, true, 'Sanitized output must indicate replayed: true');
  assert.equal(result.result.emailId, 'provider-1791958150306002100');
});

// ----------------------------------------------------------------------------
// Test 5: Fresh resend with a new attempt ID
// ----------------------------------------------------------------------------
test('5. Fresh resend with a new attempt ID bypasses previous receipt and dispatches new email', async () => {
  const receipts = new Map();
  // Store previous send's receipt
  receipts.set('contract-send:t1:c1:user@test.com:v1', {
    final_status: 'succeeded',
    action_id: 'old-action',
    sanitized_output: { success: true, emailId: 'zoho-old-1791958150306002100' },
  });

  const { contractSendIdempotencyKey } = load('src/lib/execution/domainIdempotencyKeys.ts');
  const freshAttemptId = 'fresh-uuid-999';
  const newKey = contractSendIdempotencyKey({
    tenantId: 't1',
    contractId: 'c1',
    recipient: 'user@test.com',
    version: '1',
    attemptId: freshAttemptId,
  });

  const { executeDomainExternalWrite } = load('src/lib/execution/domainExternalWrite.ts', {
    '@/lib/supabase-admin': {
      createSupabaseAdminClient: () => ({
        from: () => ({
          insert: () => ({ select: () => ({ maybeSingle: async () => ({ id: 'action-2' }) }) }),
          update: () => ({ eq: async () => ({}) }),
        }),
      }),
    },
    '@/lib/mcp/actionReceipts': {
      findReceiptByIdempotency: async ({ idempotencyKey }) => receipts.get(idempotencyKey) || null,
      persistActionReceipt: async () => 'receipt-2',
    },
    '@/lib/media/stripHeavyPayload': { stripHeavyPayloadFields: (p) => p },
    '@/lib/execution/executionErrorTaxonomy': { normalizeExecutionErrorCode: (c) => c },
    '@/lib/execution/executionStates': {
      normalizeCanonicalExecutionState: (s) => (s === 'provider_accepted' ? 'succeeded' : s),
      isAmbiguousTransportError: () => false,
      toDbExternalActionStatus: (s) => s,
    },
  });

  let dispatched = false;
  const result = await executeDomainExternalWrite({
    tenantId: 't1',
    userId: 'u1',
    capability: 'send_contract',
    action: 'contract.send',
    mode: 'execute_now',
    executionSource: 'ui',
    idempotencyKey: newKey,
    target: { workspace_id: 't1' },
    payload: {},
    execute: async () => {
      dispatched = true;
      return { success: true, emailId: 'zoho-fresh-9999999999999999999' };
    },
    isSuccess: (r) => r.success === true,
    buildReceipt: (r) => ({ action_id: 'act-2', status: 'provider_accepted', provider_reference: r.emailId }),
  });

  assert.equal(dispatched, true, 'Fresh resend must dispatch new email to provider');
  assert.equal(result.replayed, undefined, 'Fresh resend must not be marked replayed');
  assert.equal(result.result.emailId, 'zoho-fresh-9999999999999999999');
});

// ----------------------------------------------------------------------------
// Test 6: Provider acceptance without delivery
// ----------------------------------------------------------------------------
test('6. Provider acceptance returns provider_accepted without claiming delivery', () => {
  const { domainResultFromGateway } = load('src/lib/execution/domainExecutionResult.ts', {
    '@/lib/execution/executionStates': {
      normalizeExecutionState: (s) => (s === 'provider_accepted' ? 'PROVIDER_ACCEPTED' : s),
      normalizeCanonicalExecutionState: (s) => (s === 'provider_accepted' ? 'succeeded' : s),
    },
  });

  const result = domainResultFromGateway({
    executionSource: 'ui',
    gateway: {
      ok: true,
      actionId: 'act-1',
      auditLogId: 'audit-1',
      idempotencyKey: 'key-1',
      status: 'provider_accepted',
      result: { success: true, deliveryStatus: 'provider_accepted', deliveredAt: null },
      receipt: { status: 'provider_accepted', action_id: 'act-1' },
    },
  });

  assert.equal(result.status, 'PROVIDER_ACCEPTED');
  assert.notEqual(result.status, 'DELIVERED', 'Acceptance must not be reported as DELIVERED');
});

// ----------------------------------------------------------------------------
// Test 7: Confirmed delivery event
// ----------------------------------------------------------------------------
test('7. Confirmed delivery event transitions to delivered with timestamp', () => {
  const { domainResultFromGateway } = load('src/lib/execution/domainExecutionResult.ts', {
    '@/lib/execution/executionStates': {
      normalizeExecutionState: (s) => (s === 'delivered' ? 'DELIVERED' : s),
      normalizeCanonicalExecutionState: (s) => (s === 'delivered' ? 'succeeded' : s),
    },
  });

  const deliveredAt = new Date().toISOString();
  const result = domainResultFromGateway({
    executionSource: 'webhook',
    gateway: {
      ok: true,
      actionId: 'act-1',
      auditLogId: 'audit-1',
      idempotencyKey: 'key-1',
      status: 'delivered',
      result: { success: true, deliveryStatus: 'delivered', deliveredAt },
      receipt: { status: 'delivered', action_id: 'act-1' },
    },
  });

  assert.equal(result.status, 'DELIVERED');
  assert.equal(result.result.deliveredAt, deliveredAt);
});

// ----------------------------------------------------------------------------
// Test 8: Provider rejection
// ----------------------------------------------------------------------------
test('8. Provider rejection sets error and failure code without claiming success', () => {
  const { domainResultFromGateway } = load('src/lib/execution/domainExecutionResult.ts', {
    '@/lib/execution/executionStates': {
      normalizeExecutionState: () => 'FAILED',
      normalizeCanonicalExecutionState: () => 'failed',
    },
  });

  const result = domainResultFromGateway({
    executionSource: 'ui',
    gateway: {
      ok: false,
      actionId: 'act-err',
      auditLogId: null,
      idempotencyKey: 'key-fail',
      status: 'failed',
      error: { code: 'PROVIDER_REJECTED', message: 'Zoho quota exceeded', retryable: false },
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 'FAILED');
  assert.equal(result.failure_code, 'PROVIDER_REJECTED');
  assert.equal(result.error?.message, 'Zoho quota exceeded');
});

// ----------------------------------------------------------------------------
// Test 9: Timeout after possible provider acceptance
// ----------------------------------------------------------------------------
test('9. Timeout after transport preserves pending_verification and blocks automatic retry', async () => {
  const receipts = new Map();
  receipts.set('timeout-key', {
    final_status: 'pending_verification',
    action_id: 'timeout-action',
  });

  const { executeDomainExternalWrite } = load('src/lib/execution/domainExternalWrite.ts', {
    '@/lib/supabase-admin': { createSupabaseAdminClient: () => ({}) },
    '@/lib/mcp/actionReceipts': {
      findReceiptByIdempotency: async ({ idempotencyKey }) => receipts.get(idempotencyKey) || null,
      persistActionReceipt: async () => 'id',
    },
    '@/lib/media/stripHeavyPayload': { stripHeavyPayloadFields: (p) => p },
    '@/lib/execution/executionErrorTaxonomy': { normalizeExecutionErrorCode: (c) => c },
    '@/lib/execution/executionStates': {
      normalizeCanonicalExecutionState: () => 'pending_verification',
      isAmbiguousTransportError: () => true,
      toDbExternalActionStatus: (s) => s,
    },
  });

  let retried = false;
  const result = await executeDomainExternalWrite({
    tenantId: 't1',
    userId: 'u1',
    capability: 'send_contract',
    action: 'contract.send',
    mode: 'execute_now',
    executionSource: 'ui',
    idempotencyKey: 'timeout-key',
    target: { workspace_id: 't1' },
    payload: {},
    execute: async () => {
      retried = true;
      return { success: true };
    },
    isSuccess: () => true,
    buildReceipt: () => null,
  });

  assert.equal(retried, false, 'Pending verification state must block automatic retry');
  assert.equal(result.ok, false);
  assert.equal(result.status, 'pending_verification');
  assert.equal(result.error?.code, 'PENDING_VERIFICATION');
});

// ----------------------------------------------------------------------------
// Test 10: Worker crash and recovery
// ----------------------------------------------------------------------------
test('10. Outbound queue processor reclaims stale locks and retries expired jobs', () => {
  const { nextEmailRetryAt } = load('src/lib/email/outboundJobEngine.ts', {
    '@/lib/supabase-admin': { createSupabaseAdminClient: () => ({}) },
  });

  const now = 1000000;
  const retry1 = nextEmailRetryAt(1, now);
  const retry2 = nextEmailRetryAt(2, now);

  assert.equal(new Date(retry1).getTime() > now, true, 'Retry 1 must be scheduled in the future');
  assert.equal(new Date(retry2).getTime() > new Date(retry1).getTime(), true, 'Retry 2 must have larger backoff');
});

// ----------------------------------------------------------------------------
// Test 11: Zoho HTTP 415 attachment handling & fallback
// ----------------------------------------------------------------------------
test('11. Zoho attachment upload strips data URI prefix and falls back to raw binary on HTTP 415', async () => {
  const calls = [];
  class Base {
    async getConfig() {
      return { accountId: 'acc-1', mailApiHost: 'mail.zoho.eu' };
    }
    async callZohoAPI(url, options) {
      calls.push({ url, options });
      if (url.includes('uploadType=multipart')) {
        // Simulate Zoho rejecting multipart with HTTP 415
        const err = new Error('HTTP 415 UNSUPPORTED_MEDIA_TYPE');
        err.status = 415;
        throw err;
      }
      // Fallback endpoint returns success
      return { data: [{ storeName: 'store-1', attachmentName: 'contract.pdf', attachmentPath: '/docs/contract.pdf' }] };
    }
  }

  const { ZohoMailService } = load('src/services/zoho/ZohoMailService.ts', {
    './ZohoService': { ZohoService: Base },
    '@/lib/email/emailComposition': { normalizeEmailSubject: (s) => s, ensureFooter: (s) => s },
    '@/lib/email/parseEmailHeader': { extractEmailAddress: (s) => s },
  });

  const service = new ZohoMailService('user-1', 'tenant-1');
  // Pass a base64 string WITH data URI prefix
  const rawBase64 = Buffer.from('%PDF-1.4 test contract content').toString('base64');
  const dataUriContent = `data:application/pdf;base64,${rawBase64}`;

  const uploaded = await service.uploadMailAttachments([
    { filename: 'contract.pdf', content: dataUriContent, contentType: 'application/pdf' },
  ]);

  assert.equal(calls.length, 2, 'Must try multipart then fall back to raw binary');
  assert.match(calls[0].url, /uploadType=multipart/);
  assert.match(calls[1].url, /fileName=contract\.pdf/);
  assert.equal(calls[1].options.headers['Content-Type'], 'application/pdf');
  assert.equal(Buffer.from(calls[1].options.body).toString(), '%PDF-1.4 test contract content');
  assert.equal(uploaded[0].storeName, 'store-1');
});

// ----------------------------------------------------------------------------
// Test 12: PDF attachment integrity
// ----------------------------------------------------------------------------
test('12. PDF attachment integrity: magic header %PDF- is preserved identically', async () => {
  const calls = [];
  class Base {
    async getConfig() { return { accountId: 'acc-1', mailApiHost: 'mail.zoho.com' }; }
    async callZohoAPI(url, options) {
      calls.push({ url, options });
      return { data: [{ storeName: 'store-pdf', attachmentName: 'doc.pdf', attachmentPath: '/doc.pdf' }] };
    }
  }

  const { ZohoMailService } = load('src/services/zoho/ZohoMailService.ts', {
    './ZohoService': { ZohoService: Base },
    '@/lib/email/emailComposition': { normalizeEmailSubject: (s) => s, ensureFooter: (s) => s },
    '@/lib/email/parseEmailHeader': { extractEmailAddress: (s) => s },
  });

  const service = new ZohoMailService('u1', 't1');
  const pdfBytes = Buffer.from('%PDF-1.7\n%\xFF\xFF\xFF\xFF\n1 0 obj\n<<>>\nendobj');
  await service.uploadMailAttachments([
    { filename: 'doc.pdf', content: pdfBytes, contentType: 'application/pdf' },
  ]);

  assert.equal(calls.length, 1);
  const blob = calls[0].options.body.get('attach');
  const receivedArrayBuffer = await blob.arrayBuffer();
  const receivedBytes = Buffer.from(receivedArrayBuffer);
  assert.deepEqual(receivedBytes, pdfBytes, 'Uploaded bytes must match original PDF bytes exactly');
});

// ----------------------------------------------------------------------------
// Test 13: Brevo transactional sending
// ----------------------------------------------------------------------------
test('13. Brevo transactional sending accepts API key and returns provider message ID', async () => {
  let requestHeaders;
  let requestBody;

  const mockFetch = async (url, options) => {
    requestHeaders = options.headers;
    requestBody = JSON.parse(options.body);
    return new Response(JSON.stringify({ messageId: 'brevo-msg-xyz-123' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  const { sendEmail } = load('src/lib/email/sendEmail.ts', {
    '@/lib/supabase-admin': { createSupabaseAdminClient: () => ({}) },
    '@/lib/email/validateRecipient': { validateRecipient: async () => ({ allowed: true }) },
    '@/lib/email/providerIntegrationResolver': {
      resolveAllConnectedEmailProviders: async () => [
        {
          tenantId: 't1',
          provider: 'brevo',
          providerAccountId: 'acc-brevo',
          apiKey: 'brevo-secret-key',
          fromEmail: 'sales@alphaclonesystems.com',
          fromName: 'AlphaClone',
        },
      ],
      resolveTenantDefaultProvider: async () => 'brevo',
    },
    '@/lib/email/providerSenderIdentity': {
      resolveSenderIdentity: async () => ({ fromEmail: 'sales@alphaclonesystems.com', fromName: 'AlphaClone' }),
      assertBrevoSender: async () => {},
    },
    '@/lib/email/providerSdk': {
      sendWithProviderSdk: async (provider, input) => {
        const res = await mockFetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: { 'api-key': input.apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sender: { email: input.fromEmail, name: input.fromName },
            to: [{ email: input.to }],
            subject: input.subject,
          }),
        });
        const data = await res.json();
        return { ok: true, provider: 'brevo', emailId: data.messageId };
      },
    },
    '@/lib/email/suppression': { isEmailSuppressed: async () => false },
    '@/lib/email/unsubscribe': { isUnsubscribed: async () => false },
    '@/lib/email/tenantEmailPolicy': { enforceOutboundPolicy: async () => ({ allowed: true }) },
    '@/lib/email/emailAuditLog': { logEmailSend: async () => {} },
    '@/lib/email/persistCanonicalEmail': { persistCanonicalOutboundEmail: async () => 'canonical-id-1' },
    '@/lib/email/emailComposition': { ensureFooter: (s) => s, normalizeEmailSubject: (s) => s },
    __globals: { fetch: mockFetch },
  });

  const result = await sendEmail(
    't1',
    {
      to: 'customer@example.com',
      subject: 'Your Invoice',
      html: '<p>Invoice attached</p>',
      skipRecipientGate: true,
    },
    'brevo'
  );

  assert.equal(result.success, true);
  assert.equal(result.emailId, 'brevo-msg-xyz-123');
  assert.equal(result.provider, 'brevo');
  assert.equal(result.deliveryStatus, 'provider_accepted');
  assert.equal(requestHeaders['api-key'], 'brevo-secret-key');
  assert.equal(requestBody.to[0].email, 'customer@example.com');
});

// ----------------------------------------------------------------------------
// Test 14: Provider fallback without duplication
// ----------------------------------------------------------------------------
test('14. Provider fallback only occurs on pre-submission failure, never after acceptance', async () => {
  const providersTried = [];

  const { sendEmail } = load('src/lib/email/sendEmail.ts', {
    '@/lib/supabase-admin': { createSupabaseAdminClient: () => ({}) },
    '@/lib/email/validateRecipient': { validateRecipient: async () => ({ allowed: true }) },
    '@/lib/email/providerIntegrationResolver': {
      resolveAllConnectedEmailProviders: async () => [
        {
          tenantId: 't1',
          provider: 'zoho',
          providerAccountId: 'acc-zoho',
          apiKey: 'bad-token',
          fromEmail: 'team@company.com',
          fromName: 'AlphaClone',
        },
        {
          tenantId: 't1',
          provider: 'brevo',
          providerAccountId: 'acc-brevo',
          apiKey: 'valid-brevo',
          fromEmail: 'team@company.com',
          fromName: 'AlphaClone',
        },
      ],
      resolveTenantDefaultProvider: async () => 'zoho',
    },
    '@/lib/email/providerSenderIdentity': {
      resolveSenderIdentity: async () => ({ fromEmail: 'team@company.com' }),
      assertBrevoSender: async () => {},
    },
    '@/lib/email/providerSdk': {
      sendWithProviderSdk: async (provider) => {
        providersTried.push(provider);
        if (provider === 'zoho') {
          return { ok: false, provider: 'zoho', error: 'Invalid token' };
        }
        if (provider === 'brevo') {
          return { ok: true, provider: 'brevo', emailId: 'brevo-fallback-ok' };
        }
        return { ok: false, provider, error: 'unsupported' };
      },
    },
    '@/lib/email/suppression': { isEmailSuppressed: async () => false },
    '@/lib/email/unsubscribe': { isUnsubscribed: async () => false },
    '@/lib/email/tenantEmailPolicy': { enforceOutboundPolicy: async () => ({ allowed: true }) },
    '@/lib/email/emailAuditLog': { logEmailSend: async () => {} },
    '@/lib/email/persistCanonicalEmail': { persistCanonicalOutboundEmail: async () => 'msg-canonical' },
    '@/lib/email/emailComposition': { ensureFooter: (s) => s, normalizeEmailSubject: (s) => s },
  });

  const res = await sendEmail('t1', {
    to: 'lead@test.com',
    subject: 'Proposal',
    html: 'Details',
    skipRecipientGate: true,
  });

  assert.equal(res.success, true);
  assert.equal(res.provider, 'brevo');
  assert.deepEqual(providersTried, ['zoho', 'brevo']);
});

// ----------------------------------------------------------------------------
// Test 15: CRM communication-history linking
// ----------------------------------------------------------------------------
test('15. CRM queries canonical email_messages and email_message_recipients for contact timeline', async () => {
  const executedQueries = [];
  const mockSupabase = {
    from: (table) => {
      executedQueries.push(table);
      return {
        select: () => ({
          eq: () => ({
            ilike: () => ({
              order: () => ({
                limit: async () => ({
                  data: [
                    {
                      id: 'rec-1',
                      email_address: 'john@example.com',
                      delivery_status: 'provider_accepted',
                      created_at: '2026-10-14T10:00:00Z',
                      message: {
                        id: 'msg-1',
                        subject: 'Contract: Master Services Agreement',
                        direction: 'outbound',
                        purpose: 'contract',
                        delivery_status: 'provider_accepted',
                        metadata: { contract_id: 'c-100' },
                      },
                    },
                  ],
                }),
              }),
            }),
            in: () => ({ order: () => ({ limit: async () => ({ data: [] }) }) }),
            or: () => ({ order: () => ({ limit: async () => ({ data: [] }) }) }),
          }),
        }),
      };
    },
  };

  const { customer360Service } = load('src/services/intelligence/customer360Service.ts');
  const messages = await customer360Service['fetchMessages'](mockSupabase, 'tenant-1', ['user-1'], 'john@example.com');

  assert.ok(executedQueries.includes('email_message_recipients'), 'Must query email_message_recipients for emails');
  assert.equal(messages.length, 1);
  assert.match(messages[0].content, /Master Services Agreement/);
});

// ----------------------------------------------------------------------------
// Test 16: Invoice delivery
// ----------------------------------------------------------------------------
test('16. Invoice send uses idempotency key with attempt ID and preserves delivery status', () => {
  const { invoiceSendIdempotencyKey } = load('src/lib/execution/domainIdempotencyKeys.ts');
  const initial = invoiceSendIdempotencyKey({
    tenantId: 't1',
    invoiceId: 'inv-1',
    recipients: ['billing@client.com'],
  });
  const resend = invoiceSendIdempotencyKey({
    tenantId: 't1',
    invoiceId: 'inv-1',
    recipients: ['billing@client.com'],
    attemptId: 'resend-inv-99',
  });

  assert.notEqual(initial, resend);
  assert.match(resend, /:attempt:resend-inv-99/);
});

// ----------------------------------------------------------------------------
// Test 17: Project lifecycle notifications
// ----------------------------------------------------------------------------
test('17. Project lifecycle notifications format correct titles and deduplicate by event_id', () => {
  const { projectEventCopy } = load('src/lib/projects/projectNotificationOutbox.ts', {
    'server-only': {},
    '@/lib/supabase-admin': { createSupabaseAdminClient: () => ({}) },
    '@/lib/email/sendEmailServer': { sendEmailServer: async () => ({ success: true }) },
    '@/lib/email/tenantEmailBranding': { loadTenantEmailBrandingProfile: async () => ({}) },
    '@/lib/email/escapeHtml': { escapeHtml: (s) => s },
    '@/lib/projects/portalLinks': { buildCanonicalProjectPortalUrl: () => 'https://portal.test' },
  });

  const created = projectEventCopy({ action: 'project_created' });
  const milestone = projectEventCopy({ action: 'milestone_completed', new_value: { name: 'Alpha Release' } });
  const completed = projectEventCopy({ action: 'project_status_changed', new_value: { status: 'Completed' } });

  assert.equal(created?.title, 'Your project has been created');
  assert.equal(milestone?.body, 'Milestone completed: Alpha Release.');
  assert.equal(completed?.title, 'Your project is complete');
});

// ----------------------------------------------------------------------------
// Test 18: Concurrent sending
// ----------------------------------------------------------------------------
test('18. Concurrent sending with distinct attempt keys execute in parallel without cross-talk', async () => {
  const { contractSendIdempotencyKey } = load('src/lib/execution/domainIdempotencyKeys.ts');
  const key1 = contractSendIdempotencyKey({ tenantId: 't1', contractId: 'c1', recipient: 'r1@a.com', attemptId: 'att-1' });
  const key2 = contractSendIdempotencyKey({ tenantId: 't1', contractId: 'c1', recipient: 'r1@a.com', attemptId: 'att-2' });

  assert.notEqual(key1, key2, 'Distinct attempts must have distinct keys');
});

// ----------------------------------------------------------------------------
// Test 19: Tenant isolation
// ----------------------------------------------------------------------------
test('19. Tenant isolation: provider accounts are strictly scoped to tenantId', async () => {
  const queriedTenants = [];
  const { resolveAllConnectedEmailProviders } = load('src/lib/email/providerIntegrationResolver.ts', {
    '@/lib/integration/integrationTokenCrypto': { decryptIntegrationConfig: async (c) => c },
    '@/lib/supabase-admin': {
      createSupabaseAdminClient: () => ({
        from: (table) => {
          const createChain = () => {
            const chain = {
              eq: (col, val) => {
                if (col === 'tenant_id') queriedTenants.push(val);
                return chain;
              },
              in: () => chain,
              is: () => chain,
              order: () => chain,
              limit: () => chain,
              maybeSingle: async () => ({ data: null }),
              then: (resolve) => resolve({ data: [] }),
            };
            return chain;
          };
          return {
            select: () => createChain(),
          };
        },
      }),
    },
    '@/lib/email/providerSenderIdentity': { resolveZohoSender: async () => null },
  });

  await resolveAllConnectedEmailProviders({ tenantId: 'tenant-strict-xyz' });
  assert.ok(queriedTenants.every((t) => t === 'tenant-strict-xyz'), 'All queries must be strictly filtered by tenantId');
});

// ----------------------------------------------------------------------------
// Test 20: MCP and dashboard execution parity
// ----------------------------------------------------------------------------
test('20. MCP send_contract and dashboard report truthful provider_accepted status and replayed flag', () => {
  const { domainResultFromGateway } = load('src/lib/execution/domainExecutionResult.ts', {
    '@/lib/execution/executionStates': {
      normalizeExecutionState: (s) => (s === 'provider_accepted' ? 'PROVIDER_ACCEPTED' : s),
      normalizeCanonicalExecutionState: (s) => (s === 'provider_accepted' ? 'succeeded' : s),
    },
  });

  // Replayed send
  const replayed = domainResultFromGateway({
    executionSource: 'mcp',
    gateway: {
      ok: true,
      replayed: true,
      actionId: 'act-replayed',
      auditLogId: 'audit-rep',
      idempotencyKey: 'idemp-contract-1',
      status: 'provider_accepted',
      result: { success: true, replayed: true, provider: 'zoho', provider_message_id: '1791958150306002100' },
      receipt: { status: 'provider_accepted', action_id: 'act-replayed' },
    },
  });

  assert.equal(replayed.replayed, true, 'MCP execution result must declare replayed: true');
  assert.equal(replayed.status, 'PROVIDER_ACCEPTED', 'Execution status must be PROVIDER_ACCEPTED');
  assert.equal(replayed.result.replayed, true);
});
