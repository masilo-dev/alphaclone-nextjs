import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import crypto from 'node:crypto';
import sanitizeHtml from 'sanitize-html';
import { explicitRecipients } from '../../src/lib/email/mailboxNormalization.ts';
import { createRequire } from 'node:module';
const realRequire = createRequire(import.meta.url);

// Execute the real TypeScript modules with isolated external boundaries.
function load(path, dependencies = {}) {
  const source = fs.readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require: (name) => name === 'node:crypto' ? crypto : dependencies[name] || {}, crypto, console, setTimeout, clearTimeout, process, ...(dependencies.__globals || {}) }, { filename: path });
  return exports;
}
function memoryStore() {
  let row, evidence;
  return { setEvidence(value) { evidence = value; },
    async claim(id) { if (row) return false; row = { action_id: id, final_status: 'running' }; return true; },
    async read() { return row; }, async save(id, status, output) { row = { action_id: id, final_status: status, sanitized_output: output }; },
    async reconcile() { return evidence || null; } };
}
const { runEmailOperation } = load('src/lib/email/emailOperation.ts');

test('idempotent replay sends once and acceptance is never delivery', async () => {
  const store = memoryStore(); let sends = 0;
  const params = { store, execute: async () => { sends++; return { success: true, emailId: 'provider-1', deliveryStatus: 'provider_accepted' }; } };
  const first = await runEmailOperation(params); const retry = await runEmailOperation(params);
  assert.equal(sends, 1); assert.equal(first.deliveryStatus, 'provider_accepted'); assert.equal(retry.deliveryStatus, 'provider_accepted');
  assert.equal(retry.idempotent_replay, true); assert.equal(retry.deliveredAt, undefined);
});
test('unknown outcome blocks repeat and reconciles before any further execution', async () => {
  const store = memoryStore(); let sends = 0;
  const params = { store, execute: async () => { sends++; return { success: false, deliveryStatus: 'unknown', code: 'OUTCOME_UNKNOWN' }; } };
  await runEmailOperation(params); const blocked = await runEmailOperation(params);
  assert.equal(sends, 1); assert.equal(blocked.code, 'OUTCOME_UNKNOWN');
  store.setEvidence({ success: true, emailId: 'original', deliveryStatus: 'delivered', deliveredAt: '2026-10-06T19:32:00Z' });
  const reconciled = await runEmailOperation(params); assert.equal(sends, 1); assert.equal(reconciled.deliveryStatus, 'delivered');
});
test('concurrent replay does not run a second external write', async () => {
  const store = memoryStore(); let sends = 0, release;
  const barrier = new Promise((resolve) => { release = resolve; });
  const params = { store, execute: async () => { sends++; await barrier; return { success: true, deliveryStatus: 'provider_accepted' }; } };
  const first = runEmailOperation(params); const second = await runEmailOperation(params);
  assert.equal(second.status, 'unknown'); release(); await first; assert.equal(sends, 1);
});
function bulkFixture() {
  const ids = [1, 2, 3].map((n) => `00000000-0000-4000-8000-00000000000${n}`);
  const rows = [{ id: ids[0], email: ' OWNER@example.com ', first_name: 'A' }, { id: ids[1], email: 'owner@example.com', first_name: 'B' }, { id: ids[2], email: 'second@example.com', first_name: 'C' }];
  const sent = []; const store = memoryStore();
  const db = { from() { const query = { select() { return query; }, eq() { return query; }, in() { return Promise.resolve({ data: rows, error: null }); } }; return query; } };
  const module = load('src/lib/mcp/bulkOperations.ts', {
    '@/lib/supabase-admin': { createSupabaseAdminClient: () => db },
    '@/lib/concurrency/mapWithConcurrency': { mapWithConcurrency: (items, count, callback) => Promise.all(items.map(callback)) },
    '@/lib/email/sendEmailServer': { sendEmailServer: async (input) => { sent.push(input); return input.to === 'second@example.com' ? { success: false, code: 'EMAIL_PROVIDER_REJECTED', error: 'Rejected' } : { success: true, provider: input.preferredProvider, emailId: 'zoho-1', deliveryStatus: 'provider_accepted' }; } },
    '@/lib/email/preflightRecipients': { preflightOutreachRecipients: async (tenant, recipients) => ({ requested: recipients.length, eligibleRecipients: recipients, excluded: [], duplicates_removed: 0, invalid: 0 }) },
    '@/lib/mcp/ensureEmailProviderReady': { ensureEmailProviderReady: async () => {} },
    '@/lib/mcp/actionReceipts': { findReceiptByIdempotency: async () => null },
    '@/lib/tenant/platformTenant': { isUuid: () => true },
    '@/lib/email/emailOperation': { emailOperationStore: () => store, runEmailOperation },
  });
  return { ids, sent, execute: module.executeBulkEmail };
}
test('dry-run sends zero messages and deduplicates normalized CRM emails', async () => {
  const fixture = bulkFixture();
  const result = await fixture.execute({ contact_ids: fixture.ids, subject: 'Test', text: 'Test', dry_run: true }, { tenantId: 'tenant' });
  assert.equal(fixture.sent.length, 0); assert.equal(result.eligible, 2); assert.equal(result.skipped, 1);
  assert.equal(result.preflight.duplicates_removed, 1); assert.equal(result.processed, 0);
});
test('partial batch failure exposes accurate outcomes and explicit provider routing', async () => {
  const fixture = bulkFixture();
  const args = { contact_ids: fixture.ids, subject: 'Test', text: 'Test', dry_run: false, confirm_send: true, provider: 'zoho', idempotency_key: 'test-stable-key' };
  const result = await fixture.execute(args, { tenantId: 'tenant', userId: 'owner' });
  assert.equal(fixture.sent.length, 2); assert.equal(result.failed, 1); assert.equal(result.provider_accepted, 1);
  assert.equal(result.delivered, 0); assert.equal(result.success, false); assert.equal(result.recipients.length, 2);
  assert.ok(fixture.sent.every((input) => input.preferredProvider === 'zoho' && input.category === 'outreach'));
  assert.equal(new Set(fixture.sent.map((input) => input.idempotencyKey)).size, 2);
  await fixture.execute(args, { tenantId: 'tenant', userId: 'owner' }); assert.equal(fixture.sent.length, 2);
});
test('approval resume preserves complete args and persists structured execution result', async () => {
  const args = { provider: 'zoho', dry_run: false, confirm_send: true, contact_ids: ['one','two'], idempotency_key: 'original-key', text: 'Full content' };
  let received, persisted;
  const row = { id: 'approval', status: 'pending', action_key: 'mcp:send_bulk_email', payload: { source: 'mcp', args } };
  const db = { from() { let update; const query = { select() { return query; }, eq() { return query; }, update(value) { update = value; if (value.payload) persisted = value.payload; return query; }, async maybeSingle() { return { data: update ? { id: 'approval' } : row }; }, then(resolve) { return Promise.resolve({ error: null }).then(resolve); } }; return query; } };
  const { resumeApprovedTool } = load('src/lib/bonnie/resumeApprovedTool.ts', {
    '@/lib/supabase-admin': { createSupabaseAdminClient: () => db },
    '@/lib/bonnie/executeSingleBonnieTool': { executeSingleBonnieTool: async (input) => { received = input.args; return { success: false, tool: input.tool, summary: '1 failed', executionResult: { data: { failed: 1, recipients: [{ status: 'failed' }] } } }; } },
  });
  const result = await resumeApprovedTool({ tenantId: 'tenant', userId: 'owner', approvalId: 'approval' });
  assert.deepEqual(received, args); assert.equal(result.success, false); assert.equal(persisted.execution_result.result.data.failed, 1);
});
test('sanitizer drops style blocks and scripts while preserving inline layout', () => {
  const module = load('src/lib/email/sanitizeEmailHtmlServer.ts', {
    'sanitize-html': { default: sanitizeHtml }, '@/lib/email/escapeHtml': { escapeHtml: (value) => value },
  });
  const html = module.sanitizeEmailHtmlServer('<style>body{display:none}</style><script>alert(1)</script><table><tr><td style="color:red">Safe</td></tr></table>');
  assert.doesNotMatch(html, /<style|<script|alert\(1\)/); assert.match(html, /<table>/); assert.match(html, /style="color:red"/);
  const unsafe = module.sanitizeEmailHtmlServer('<td style="color:expression(alert(1));background-image:url(javascript:alert(1));width:100%">Safe</td>');
  assert.doesNotMatch(unsafe, /expression|javascript|background-image/); assert.match(unsafe, /width:100%/);
});

test('structured approval output preserves all recipient outcomes beyond summary truncation', () => {
  const module = load('src/lib/bonnie/executeSingleBonnieTool.ts', { '@/lib/bonnie/bonnieToolCatalog': { BONNIE_CUSTOM_TOOLS: [] } });
  const outcomes = Array.from({ length: 100 }, (_, i) => ({ email: `owner${i}@example.com`, status: 'provider_accepted', message_id: `provider-${i}` }));
  const result = module.extractStructuredToolResult({ content: [{ text: JSON.stringify({ data: { recipients: outcomes } }) }] });
  assert.equal(result.data.recipients.length, 100); assert.equal(result.data.recipients[99].message_id, 'provider-99');
});
test('MCP approval response returns failures and complete execution payload', async () => {
  const registry = new Map(); const executionResult = { data: { failed: 1, provider_accepted: 1, recipients: [{ status: 'failed' }, { status: 'provider_accepted' }] } };
  const db = { from() { const query = { select() { return query; }, eq() { return query; }, async maybeSingle() { return { data: { status: 'pending', risk_level: 'medium', payload: {} } }; } }; return query; } };
  load('src/lib/mcp/tools/bonnie-approvals.ts', {
    zod: realRequire('zod'), '../tool-registry': { registerTool: (group, definition) => registry.set(definition.name, definition) },
    '@/lib/supabase-admin': { createSupabaseAdminClient: () => db },
    '@/lib/bonnie/resumeBonnieMission': { approveAndResumeBonnieMission: async () => ({ execution: { success: false, result: { executionResult }, error: 'Partial failure' }, continuation: { continued: false } }) },
  });
  const result = await registry.get('approve_pending_action').handler({ tenant_id: 'tenant', approval_id: 'approval', resume_mission: false }, { userId: 'owner' });
  const response = JSON.parse(result.content[0].text); assert.equal(result.isError, true); assert.equal(response.success, false);
  assert.equal(response.result.data.recipients.length, 2); assert.equal(response.result.data.failed, 1);
});

test('Zoho sender recovery chooses the connected provider account rather than guessing', () => {
  const { zohoAccountSender } = load('src/lib/email/providerSenderIdentity.ts');
  const rows = [{ accountId: 'other', primaryEmailAddress: 'other@example.com' }, { accountId: 'selected', mailAddress: 'sender@example.com' }];
  assert.equal(zohoAccountSender(rows, 'selected'), 'sender@example.com');
  assert.equal(zohoAccountSender(rows), undefined); assert.equal(zohoAccountSender(rows, 'missing'), undefined);
});
test('Brevo refuses an unverified configured sender before transmission', async () => {
  const { assertBrevoSender } = load('src/lib/email/providerSenderIdentity.ts', { __globals: {
    AbortSignal, fetch: async () => ({ ok: true, json: async () => ({ senders: [{ email: 'sales@example.com', active: true }] }) }),
  } });
  await assertBrevoSender('test-credential', 'sales@example.com');
  await assert.rejects(() => assertBrevoSender('test-credential', 'wrong@example.com'), /EMAIL_SENDER_NOT_VERIFIED/);
});
test('Brevo reconciliation maps acceptance, blocking and deferral without inventing delivery', () => {
  const { brevoDeliveryEvent } = load('src/lib/email/reconcileBrevoMessage.ts');
  assert.equal(brevoDeliveryEvent('requests'), 'provider_accepted'); assert.equal(brevoDeliveryEvent('blocked'), 'failed');
  assert.equal(brevoDeliveryEvent('soft_bounce'), 'deferred'); assert.equal(brevoDeliveryEvent('delivered'), 'delivered');
  assert.equal(brevoDeliveryEvent('unknown'), null);
});

test('approval policy receives the stable retry key before queuing', async () => {
  let queuedArgs;
  const { guardToolExecution } = load('src/lib/execution/toolExecutionGuard.ts', {
    '@/lib/execution/domainCapabilityGuard': { capabilityRequiresIdempotencyKey: () => true },
    '@/lib/mcp/toolRiskTiers': { mcpToolRequiresIdempotency: () => true,
      ensureMcpIdempotencyKey: ({ args }) => args.idempotency_key ||= 'stable-original' },
    '@/lib/ai/ToolPolicyGate': { evaluateToolPolicy: async ({ args }) => {
      queuedArgs = { ...args }; return { outcome: 'queue_approval', approvalId: 'approval', reason: 'Approval required' };
    } },
  });
  const args = { provider: 'zoho', dry_run: false, confirm_send: true };
  await guardToolExecution({ tenantId: 'tenant', userId: 'owner', toolName: 'send_bulk_email', args, options: { executionSource: 'mcp' } });
  assert.equal(queuedArgs.idempotency_key, 'stable-original'); assert.equal(queuedArgs.confirm_send, true);
  await guardToolExecution({ tenantId: 'tenant', userId: 'owner', toolName: 'send_bulk_email', args, options: { executionSource: 'mcp' } });
  assert.equal(args.idempotency_key, 'stable-original');
});

function providerFixture() {
  const calls = [];
  const { sendEmail } = load('src/lib/email/sendEmail.ts', {
    '@/lib/supabase-admin': { createSupabaseAdminClient: () => ({}) },
    'uuid': { v4: () => 'local-id' },
    '@/lib/email/unsubscribe': { isUnsubscribed: async () => false },
    '@/lib/email/suppression': { isEmailSuppressed: async () => false },
    '@/lib/email/validateRecipient': { validateRecipient: async () => ({ allowed: true }) },
    '@/lib/email/mailboxNormalization':{explicitRecipients},
    '@/lib/email/emailComposition': { normalizeEmailSubject: (s) => s },
    '@/lib/email/providerIntegrationResolver': { resolveAllConnectedEmailProviders: async () => [
      { provider: 'zoho', fromEmail: 'sender@example.com', fromName: 'Sender', providerAccountId: 'zoho-account' },
      { provider: 'brevo', fromEmail: 'sender@example.com', fromName: 'Sender', providerAccountId: 'brevo-account' },
    ] },
    '@/lib/email/providerSenderIdentity': { assertBrevoSender: async () => {} },
    '@/lib/email/emailAttachment': { normalizeEmailAttachments: () => [] },
    '@/lib/email/providerSdk': { sendWithProviderSdk: async (provider) => { calls.push(provider); return { ok: false, error: 'network timeout' }; } },
  });
  const payload = { to: 'owner@example.com', subject: 'Test', text: 'Test', skipFooter: true, skipBonnieQualityCheck: true, listUnsubscribeUrl: 'https://example.com/unsubscribe' };
  return { calls, sendEmail, payload };
}
test('canonical provider adapter respects an explicit route despite other connected accounts', async () => {
  const fixture = providerFixture(); const result = await fixture.sendEmail('tenant', fixture.payload, 'brevo');
  assert.deepEqual(fixture.calls, ['brevo']); assert.equal(result.deliveryStatus, 'unknown');
});
test('unknown provider response prevents fallback to another connected provider', async () => {
  const fixture = providerFixture(); const result = await fixture.sendEmail('tenant', fixture.payload);
  assert.deepEqual(fixture.calls, ['zoho']); assert.equal(result.code, 'OUTCOME_UNKNOWN');
});

test('durable claims and checkpoints use compatible receipt columns and exact tenant scope', async () => {
  const writes = [], filters = [];
  const compatibleColumns = new Set(['tenant_id','tool','idempotency_key','action_id','final_status','success','entity_type','sanitized_output','provider','provider_reference']);
  const db = { from(table) { assert.equal(table, 'mcp_action_receipts'); const q = {
    insert(value) { writes.push(value); return Promise.resolve({ error: null }); },
    update(value) { writes.push(value); return q; }, eq(key, value) { filters.push([key,value]); return q; },
    then(resolve) { return Promise.resolve({ error: null }).then(resolve); },
  }; return q; } };
  const { emailOperationStore } = load('src/lib/email/emailOperation.ts', {
    '@/lib/supabase-admin': { createSupabaseAdminClient: () => db },
    '@/lib/email/sanitizeEmailExecutionEvidence': { sanitizeForAudit: (x) => x },
  });
  const store = emailOperationStore('workspace-original', 'email_batch', 'stable-key');
  await store.claim('operation'); await store.save('operation','failed', { failed: 1, recipients: [{status:'failed'}] });
  assert.ok(writes.every((value) => Object.keys(value).every((key) => compatibleColumns.has(key))));
  assert.ok(filters.some(([key,value]) => key === 'tenant_id' && value === 'workspace-original'));
  assert.ok(filters.some(([key,value]) => key === 'idempotency_key' && value === 'stable-key'));
});

test('Zoho verifies sender identities on the selected account without silent substitution', async () => {
  const rows = [{ accountId:'chosen', primaryEmailAddress:'chosen@example.com' }, { accountId:'other', primaryEmailAddress:'other@example.com' }];
  class Base {
    async getConfig() { return { accountId:'chosen', mailApiHost:'mail.zoho.eu' }; }
    async callZohoAPI() { return { data:rows }; }
  }
  const { ZohoMailService } = load('src/services/zoho/ZohoMailService.ts', { './ZohoService': { ZohoService: Base } });
  const service = new ZohoMailService();
  assert.deepEqual(Array.from(await service.getSenderAddresses()), ['chosen@example.com']);
  service.getMailBase = async () => ({ base:'https://mail.zoho.eu/api/accounts/chosen', accountId:'chosen' });
  await assert.rejects(() => service.sendEmail({ fromAddress:'other@example.com', toAddress:'owner@example.com', subject:'Test', content:'Test' }), /EMAIL_SENDER_NOT_VERIFIED/);
});

test('Zoho uploads PDF bytes before sending only file-store references',async()=>{
 const calls=[];
 class Base {async getConfig(){return {accountId:'chosen',mailApiHost:'mail.zoho.eu'}};async callZohoAPI(url,options){calls.push({url,options});if(url.includes('/attachments?'))return {data:{storeName:'store',attachmentName:'TEST_ONLY.pdf',attachmentPath:'/Mail/test.pdf'}};return {data:{messageId:'provider-1'}}}}
 const {ZohoMailService}=load('src/services/zoho/ZohoMailService.ts',{'./ZohoService':{ZohoService:Base},'@/lib/email/emailComposition':{normalizeEmailSubject:v=>v,ensureFooter:v=>v},'@/lib/email/parseEmailHeader':{extractEmailAddress:v=>v},__globals:{Buffer}});
 const service=new ZohoMailService();service.getSenderAddresses=async()=>['chosen@example.com'];
 await service.sendEmail({fromAddress:'chosen@example.com',toAddress:'bonniiehendrix@gmail.com',subject:'TEST ONLY',content:'Nonbinding test',attachments:[{filename:'TEST_ONLY.pdf',content:Buffer.from('%PDF-test').toString('base64'),contentType:'application/pdf'}]});
 assert.equal(calls.length,2);assert.match(calls[0].url,/accounts\/chosen\/messages\/attachments\?fileName=TEST_ONLY.pdf/);assert.equal(Buffer.from(calls[0].options.body).toString(),'%PDF-test');const body=JSON.parse(calls[1].options.body);assert.deepEqual(body.attachments,[{storeName:'store',attachmentName:'TEST_ONLY.pdf',attachmentPath:'/Mail/test.pdf'}]);assert.equal(body.toAddress,'bonniiehendrix@gmail.com');assert.equal(body.attachments[0].content,undefined);
});
test('incomplete Zoho upload evidence prevents the send POST',async()=>{
 let requests=0;class Base{async getConfig(){return {accountId:'chosen',mailApiHost:'mail.zoho.eu'}};async callZohoAPI(){requests++;return {data:{storeName:'incomplete'}}}}
 const {ZohoMailService}=load('src/services/zoho/ZohoMailService.ts',{'./ZohoService':{ZohoService:Base},'@/lib/email/emailComposition':{normalizeEmailSubject:v=>v,ensureFooter:v=>v},'@/lib/email/parseEmailHeader':{extractEmailAddress:v=>v},__globals:{Buffer}});const service=new ZohoMailService();service.getSenderAddresses=async()=>['chosen@example.com'];
 await assert.rejects(()=>service.sendEmail({fromAddress:'chosen@example.com',toAddress:'bonniiehendrix@gmail.com',subject:'TEST ONLY',content:'Test',attachments:[{filename:'TEST_ONLY.pdf',content:'JVBERi10ZXN0'}]}),/complete attachment reference/);assert.equal(requests,1);
});
