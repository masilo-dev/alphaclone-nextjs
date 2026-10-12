import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import crypto from 'node:crypto';
import sanitizeHtml from 'sanitize-html';
import { z } from 'zod';

function load(path, dependencies = {}, globals = {}) {
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require: n => n === 'node:crypto' ? crypto : dependencies[n] || {}, crypto,
    console, process, setTimeout, clearTimeout, setInterval, clearInterval, Buffer, Request, Response, Headers, URL, Event, Error,
    fetch: () => { throw new Error('Unmocked network is prohibited'); }, ...globals }, { filename: path });
  return exports;
}
const approval = load('src/lib/email/outreachApproval.ts');
test('approval binds user, tenant, recipients, content, attachment bytes and sender revision', () => {
  const payload = { tenantId: 'tenant-a', leadEmail: 'test@example.com', body: 'approved', attachments: [{ content: 'AAA' }] };
  const token = approval.signOutreachApproval('test-only-secret', 'user-a', payload, 'sender-1', 1000);
  assert.equal(approval.verifyOutreachApproval(token, 'test-only-secret', 'user-a', payload, 'sender-1', 1100), true);
  for (const changed of [{ ...payload, tenantId: 'tenant-b' }, { ...payload, leadEmail: 'other@example.com' }, { ...payload, body: 'edited' }, { ...payload, attachments: [{ content: 'BBB' }] }]) {
    assert.equal(approval.verifyOutreachApproval(token, 'test-only-secret', 'user-a', changed, 'sender-1', 1100), false);
  }
  assert.equal(approval.verifyOutreachApproval(token, 'test-only-secret', 'user-b', payload, 'sender-1', 1100), false);
  assert.equal(approval.verifyOutreachApproval(token, 'test-only-secret', 'user-a', payload, 'sender-2', 1100), false);
  assert.equal(approval.verifyOutreachApproval(token, 'test-only-secret', 'user-a', payload, 'sender-1', 601001), false);
  assert.equal(approval.outreachOperationKey('user-a', payload), approval.outreachOperationKey('user-a', { ...payload }));
});
const policy = load('src/lib/readRequestPolicy.ts');
test('concurrent reads coalesce; mutations execute once without retry', async () => {
  let calls = 0, release;
  const wait = new Promise(r => release = r);
  const read = policy.createReadRequestClient({ fetch: async () => { calls++; await wait; return Response.json({ ok: true }); } });
  const requests = Array.from({ length: 20 }, () => read('https://db.example/rest/v1/profiles?id=eq.user'));
  release(); const results = await Promise.all(requests);
  assert.equal(calls, 1); for (const response of results) assert.equal((await response.json()).ok, true);
  calls = 0;
  const send = policy.createReadRequestClient({ fetch: async () => { calls++; return new Response('lost', { status: 502 }); } });
  assert.equal((await send('https://db.example/rest/v1/rpc/send', { method: 'POST' })).status, 502);
  assert.equal(calls, 1);
});
test('read backoff respects Retry-After and cooldown stops widget fan-out', async () => {
  let calls = 0, time = 0; const waits = [];
  const read = policy.createReadRequestClient({ now: () => time, random: () => 0,
    sleep: async ms => { waits.push(ms); time += ms; }, fetch: async () => { calls++; return new Response('outage', { status: 503, headers: { 'Retry-After': '2' } }); } });
  assert.equal((await read('https://db.example/profiles')).status, 503); assert.equal(calls, 2); assert.equal(waits[0], 2000);
  for (const widget of ['tasks', 'messages', 'history']) assert.equal((await read(`https://db.example/${widget}`)).status, 503);
  assert.equal(calls, 2);
  time += 6000; await read('https://db.example/messages'); assert.equal(calls, 4);
});
test('authorization and absence never retry; auth POST tokens never retry', async () => {
  for (const status of [401, 403, 404]) {
    let calls = 0; const read = policy.createReadRequestClient({ fetch: async () => { calls++; return new Response('', { status }); } });
    await read('https://db.example/data'); assert.equal(calls, 1);
  }
  let calls = 0; const read = policy.createReadRequestClient({ fetch: async () => { calls++; return new Response('', { status: 503 }); } });
  await read('https://db.example/auth/v1/token', { method: 'POST' }); assert.equal(calls, 1);
});
function browserFixture() {
  const counts = new Map(), target = new EventTarget();
  const originalAdd = target.addEventListener.bind(target), originalRemove = target.removeEventListener.bind(target);
  target.addEventListener = (name, fn) => { counts.set(name, (counts.get(name) || 0) + 1); originalAdd(name, fn); };
  target.removeEventListener = (name, fn) => { counts.set(name, (counts.get(name) || 0) - 1); originalRemove(name, fn); };
  target.matchMedia = () => ({ matches: false }); target.navigator = {};
  return { target, counts };
}
const install = load('src/lib/pwa/installLifecycle.ts');
test('install has one owner, early capture, one prompt per click, dismissal and listener cleanup', async () => {
  const { target, counts } = browserFixture();
  for (let n = 0; n < 20; n++) install.installEventOwner(target);
  assert.equal(counts.get('beforeinstallprompt'), 1); assert.equal(counts.get('appinstalled'), 1);
  let prompts = 0, choose;
  const event = new Event('beforeinstallprompt', { cancelable: true });
  event.prompt = async () => { prompts++; }; event.userChoice = new Promise(r => choose = r);
  target.dispatchEvent(event); assert.equal(event.defaultPrevented, true); assert.equal(target.deferredPrompt, event);
  const first = install.promptCapturedInstall(target); const duplicate = await install.promptCapturedInstall(target);
  assert.equal(duplicate.outcome, 'unavailable'); choose({ outcome: 'dismissed' }); await first;
  assert.equal(prompts, 1); assert.equal(target.deferredPrompt, null);
  assert.equal((await install.promptCapturedInstall(target)).outcome, 'unavailable');
  target.dispatchEvent(new Event('appinstalled')); assert.equal(install.installEventOwner(target).installed, true);
  install.installEventOwner(target).dispose(); assert.equal(counts.get('beforeinstallprompt'), 0); assert.equal(counts.get('appinstalled'), 0);
});
test('the exact early bootstrap executes and repeated evaluation does not add owners', () => {
  const { target, counts } = browserFixture();
  const code = install.buildInstallBootstrapScript();
  vm.runInNewContext(code, { window: target, Event }); vm.runInNewContext(code, { window: target, Event });
  assert.equal(counts.get('beforeinstallprompt'), 1); assert.equal(counts.get('appinstalled'), 1);
});
test('service worker bypasses mutation requests, including outreach', () => {
  const { bypassAuthenticationFetch } = load('src/lib/pwa/authNetworkBypass.ts');
  let bypasses = 0;
  bypassAuthenticationFetch({ request: new Request('https://app.example/api/outreach/send', { method: 'POST' }), stopImmediatePropagation: () => bypasses++ }, 'https://app.example');
  assert.equal(bypasses, 1);
});
function queryFixture(resolve) {
  return { from(table) {
    const state = { table, filters: {}, operation: 'select' };
    const q = new Proxy({}, { get(_, key) {
      if (key === 'then') return (yes, no) => Promise.resolve(resolve(state)).then(yes, no);
      return (...args) => {
        if (key === 'eq' || key === 'is') state.filters[args[0]] = args[1];
        if (key === 'neq') state.exclude = { ...state.exclude, [args[0]]: args[1] };
        if (key === 'insert' || key === 'update') { state.operation = key; state.values = args[0]; }
        return q;
      };
    } }); return q;
  } };
}
const fakeResponse = { NextResponse: { json: (value, init) => Response.json(value, init) } };
const tenantId = '10000000-0000-4000-8000-000000000001', userId = '20000000-0000-4000-8000-000000000001';
const run = load('src/lib/email/emailOperation.ts').runEmailOperation;
function memoryStore(evidenceInput) {
  let row, evidence;
  return { async claim(id) { if (row) return false; row = { action_id: id, final_status: 'running', sanitized_input: evidenceInput ? { recipient_hash: evidenceInput.recipientHash } : {} }; return true; },
    async read() { return row; }, async save(id, status, output) { row = { ...row, action_id: id, final_status: status, sanitized_output: output }; },
    async reconcile() { return evidence || null; }, setEvidence(value) { evidence = value; } };
}
function outreachFixture(sendImpl = async () => ({})) {
  let sends = 0; const stores = new Map();
  const admin = queryFixture(async s => {
    if (s.table === 'mcp_action_receipts') {
      const found = [];
      for (const [key, store] of stores) {
        const row = await store.read();
        if (!row || key === s.exclude?.idempotency_key) continue;
        if (s.filters['sanitized_input->>recipient_hash'] &&
          (row.sanitized_input.recipient_hash !== s.filters['sanitized_input->>recipient_hash'] || !['running', 'unknown_execution_state'].includes(row.final_status))) continue;
        if (s.filters.idempotency_key && key !== s.filters.idempotency_key) continue;
        found.push(row);
      }
      return { data: s.filters.idempotency_key ? found[0] || null : found, error: null };
    }
    return { data: s.table === 'lead_outreach_log' && s.operation === 'insert' ? { id: 'log-test' } : s.table === 'tenants' ? { name: 'Test workspace' } : s.table === 'integrations' ? [] : null, error: null };
  });
  const access = { admin, user: { id: userId, email: 'owner@example.com', user_metadata: {} } };
  const connections = { getConnection: async () => ({ user_id: userId, microsoft_email: 'owner@example.com' }), sendEmail: async () => { sends++; return sendImpl(); } };
  const module = load('src/app/api/outreach/send/route.ts', {
    'next/server': fakeResponse,
    '@/lib/email/outreachApproval': approval,
    '@/lib/email/emailOperation': { runEmailOperation: run, emailOperationStore: (tenant, tool, key, evidenceInput) => { if (!stores.has(key)) stores.set(key, memoryStore(evidenceInput)); return stores.get(key); } },
    '@/services/server/microsoftServerService': { microsoftServerService: connections },
    '@/lib/apiAuth': { requireTenantAccess: async (tenant) => { if (tenant !== tenantId) throw { status: 403 }; return access; }, createAdminSupabaseClientOrThrow: () => admin, routeErrorResponse: err => Response.json({ error: 'blocked' }, { status: err.status || 503 }) },
    '@/schemas/validation': { outreachSendSchema: { safeParse: data => ({ success: true, data }) } },
    '@/lib/email/suppression': { isEmailSuppressed: async () => false },
    '@/lib/email/unsubscribe': { isUnsubscribed: async () => false },
    '@/lib/email/validateRecipient': { validateRecipient: async () => ({ allowed: true }) },
    '@/lib/email/emailComposition': { normalizeEmailSubject: x => x.trim() },
    '@/lib/email/unsubscribeToken': { buildUnsubscribeUrl: () => 'https://example.com/unsubscribe' },
    '@/lib/email/template': { buildEmail: p => p.bodyHtml },
    '@/lib/email/emailRendering': { renderOutboundEmail: p => ({ html: p.html || p.text }) },
    'sanitize-html': sanitizeHtml,
    '@/services/intelligence/signalCaptureAdminService': { captureUnifiedMessageFromWebhook: async () => {} },
    '@/lib/email/persistCanonicalEmail': { persistCanonicalOutboundEmail: async () => {} },
  });
  const payload = { tenantId, leadEmail: 'controlled@example.com', subject: 'Mock test', body: 'Approved test body', autoSend: true, consentGranted: true, confidenceScore: 100, preferredProvider: 'microsoft', deliveryProviders: ['microsoft'] };
  const request = (data, headers = {}) => new Request('https://app.example/api/outreach/send', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(data) });
  return { module, payload, request, get sends() { return sends; }, stores };
}
process.env.AUTH_SECRET = 'test-only-approval-secret';
test('real outreach handler rejects stale approval and cross-tenant requests without contacting provider', async () => {
  const f = outreachFixture();
  const issued = await (await f.module.POST(f.request(f.payload, { 'x-outreach-phase': 'approve' }))).json();
  const rejected = await f.module.POST(f.request({ ...f.payload, body: 'Unapproved edit' }, { 'x-outreach-approval': issued.approvalToken }));
  assert.equal(rejected.status, 409); assert.equal(f.sends, 0);
  const forbidden = await f.module.POST(f.request({ ...f.payload, tenantId: 'other' }));
  assert.equal(forbidden.status, 403); assert.equal(f.sends, 0);
});
test('real outreach handler sends once under concurrency, replays acceptance and retains correlation identity', async () => {
  const f = outreachFixture();
  const issued = await (await f.module.POST(f.request(f.payload, { 'x-outreach-phase': 'approve' }))).json();
  const results = await Promise.all(Array.from({ length: 10 }, () => f.module.POST(f.request(f.payload, { 'x-outreach-approval': issued.approvalToken }))));
  assert.equal(f.sends, 1);
  const retry = await f.module.POST(f.request(f.payload, { 'x-outreach-approval': issued.approvalToken }));
  const data = await retry.json(); assert.equal(data.deliveryStatus, 'provider_accepted'); assert.equal(data.idempotent_replay, true);
  assert.equal(retry.headers.get('x-request-id'), issued.operationId); assert.equal(f.sends, 1);
  assert.ok(results.every(r => [200, 409].includes(r.status)));
});
test('lost provider response remains unknown, blocks retry and reconciles acceptance without a second send', async () => {
  const f = outreachFixture(async () => { throw new Error('ECONNRESET after provider acceptance'); });
  const issued = await (await f.module.POST(f.request(f.payload, { 'x-outreach-phase': 'approve' }))).json();
  for (let n = 0; n < 3; n++) {
    const response = await f.module.POST(f.request(f.payload, { 'x-outreach-approval': issued.approvalToken }));
    assert.equal(response.status, 409); assert.equal((await response.json()).deliveryStatus, 'unknown');
  }
  assert.equal(f.sends, 1);
  f.stores.get(issued.operationId).setEvidence({ success: true, deliveryStatus: 'provider_accepted', emailId: 'mock-provider-accepted-1' });
  const reconciled = await (await f.module.POST(f.request(f.payload, { 'x-outreach-approval': issued.approvalToken }))).json();
  assert.equal(reconciled.emailId, 'mock-provider-accepted-1'); assert.equal(f.sends, 1);
});
test('document detail resolves the list Doc OS identity and does not fan out for an absent document', async () => {
  const trace = []; let exists = true;
  const admin = queryFixture(s => { trace.push(s); return { error: null, data: s.table === 'doc_os_documents' && exists ? {
    document_id: '30000000-0000-4000-8000-000000000001', tenant_id: tenantId, title: 'Mock contract', status: 'draft', structured_data: {}, created_at: '2026-10-12', updated_at: '2026-10-12', version: 1,
  } : null }; });
  const bridge = load('src/lib/documents/docOsCatalogBridge.ts');
  const realZod = await import('zod');
  const handler = load('src/app/api/tenant/[tenantId]/documents/[documentId]/route.ts', {
    'next/server': fakeResponse, zod: realZod,
    '@/lib/apiAuth': { requireTenantAccess: async () => ({ admin }), routeErrorResponse: () => Response.json({ error: 'unavailable' }, { status: 503 }) },
    '@/lib/documents/docOsCatalogBridge': bridge,
  });
  const context = { params: Promise.resolve({ tenantId, documentId: '30000000-0000-4000-8000-000000000001' }) };
  const response = await handler.GET(new Request('https://app.example/document'), context);
  assert.equal(response.status, 200); assert.equal((await response.json()).document.source, 'doc_os');
  assert.ok(trace.every(s => s.filters.tenant_id === tenantId)); assert.equal(trace.length, 3);
  exists = false; trace.length = 0;
  assert.equal((await handler.GET(new Request('https://app.example/document'), context)).status, 404); assert.equal(trace.length, 3);
});
test('preferences failed read performs no write; successful merge preserves unknown keys', async () => {
  let readsFail = true, writes = 0, saved;
  const module = load('src/services/userDashboardPreferencesService.ts', {
    '@/lib/profileRead': { readUserProfileState: async () => { if (readsFail) throw new Error('503'); return { dashboard_preferences: { otherFeature: { keep: true }, widgetOrder: ['existing'] } }; }, invalidateProfileReads() {} },
    '@/lib/supabase': { supabase: queryFixture(s => { if (s.operation === 'update') { writes++; saved = s.values.dashboard_preferences; } return { data: { id: userId }, error: null }; }) },
  });
  assert.equal((await module.mergeDashboardPreferences(userId, { commandHistory: ['new'] })).ok, false); assert.equal(writes, 0);
  readsFail = false; assert.equal((await module.mergeDashboardPreferences(userId, { commandHistory: ['new'] })).ok, true);
  assert.equal(saved.otherFeature.keep, true); assert.equal(saved.widgetOrder[0], 'existing');
});
class AuthError extends Error { constructor(status, message, code) { super(message); this.status = status; this.code = code; } }
test('real tenant authorization validates bearer identity, denies foreign tenant, and returns 503 on membership outage', async () => {
  for (const mode of ['allowed', 'foreign', 'outage', 'expired']) {
    const queries = [];
    const admin = { ...queryFixture(s => {
      queries.push(s);
      if (s.table === 'profiles') return { data: { id: userId, account_status: 'active' }, error: null };
      return { data: mode === 'allowed' && s.filters.tenant_id === tenantId && s.filters.user_id === userId ? { tenant_id: tenantId, role: 'owner' } : null,
        error: mode === 'outage' ? { code: 'PGRST002' } : null };
    }), auth: { getUser: async token => ({ data: { user: mode === 'expired' || token !== 'test-token' ? null : { id: userId } }, error: null }) } };
    const auth = load('src/lib/apiAuth.ts', {
      'next/server': fakeResponse,
      './supabase-admin': { createSupabaseAdminClient: () => admin, hasSupabaseServiceRole: () => true },
      './api/routeAuthError': { RouteAuthError: AuthError },
      '@/config/env': { ENV: { VITE_SUPABASE_URL: 'https://test.example' } },
      './transientDbError': { withTransientDbRetry: fn => fn(), isTransientDatabaseError: error => error?.status === 503 },
    });
    const request = new Request('https://app.example/api/dashboard/stats', { headers: { Authorization: 'Bearer test-token' } });
    if (mode === 'allowed') {
      assert.equal((await auth.requireTenantAccess(tenantId, request)).membership.role, 'owner');
    } else {
      await assert.rejects(() => auth.requireTenantAccess(mode === 'foreign' ? 'foreign-tenant' : tenantId, request), e => e.status === (mode === 'expired' ? 401 : mode === 'outage' ? 503 : 403));
    }
    for (const query of queries.filter(q => q.table === 'tenant_users')) assert.equal(query.filters.user_id, userId);
  }
});
test('dashboard availability errors never fan out and successful period metrics remain authorized', async () => {
  for (const mode of ['healthy', 'outage', 'forbidden']) {
    let databaseCalls = 0;
    const db = { rpc: async () => { databaseCalls++; return mode === 'outage' ? { error: { code: 'PGRST002', message: 'schema cache unavailable' } } : { data: { totalLeads: 7 }, error: null }; },
      ...queryFixture(() => { databaseCalls++; return { count: 2, error: null }; }) };
    const stats = load('src/app/api/dashboard/stats/route.ts', {
      'next/server': fakeResponse,
      '@/lib/apiAuth': { requireTenantAccess: async () => { if (mode === 'forbidden') throw new AuthError(403, 'Forbidden'); return { supabase: db, user: { id: userId } }; } },
      '@/lib/api/clientErrorResponse': { clientErrorResponse: err => Response.json({ error: 'blocked' }, { status: err.status || 503 }) },
      '@/lib/supabase-admin': { createSupabaseAdminClient: () => db },
      '@/lib/analytics/normalizeDashboardStats': { normalizeDashboardStats: x => x },
      '@/services/dashboardStatsService': { dashboardStatsService: { getHomePeriodMetrics: async () => ({ revenue: 5, newLeads: 3 }) } },
    });
    const req = { nextUrl: new URL(`https://app.example/api/dashboard/stats?tenantId=${tenantId}`), headers: new Headers() };
    const response = await stats.GET(req);
    assert.equal(response.status, mode === 'healthy' ? 200 : mode === 'outage' ? 503 : 403);
    assert.equal(databaseCalls, mode === 'healthy' ? 2 : mode === 'outage' ? 1 : 0);
    if (mode === 'healthy') assert.equal((await response.json()).stats.totalLeads, 7);
  }
});
test('presence consumers share one heartbeat; cleanup removes listeners and hidden tabs do no RPC', async () => {
  const window = new EventTarget(), document = new EventTarget(); document.visibilityState = 'visible';
  let rpcCalls = 0, release, time = 0, timerId = 0;
  const timers = new Map(), counts = new Map();
  const add = window.addEventListener.bind(window), remove = window.removeEventListener.bind(window);
  window.addEventListener = (event, fn) => { counts.set(event, (counts.get(event) || 0) + 1); add(event, fn); };
  window.removeEventListener = (event, fn) => { counts.set(event, (counts.get(event) || 0) - 1); remove(event, fn); };
  const barrier = new Promise(r => release = r);
  const service = load('src/services/presenceService.ts', { '../lib/supabase': { supabase: {
    auth: { getUser: async () => ({ data: { user: { id: userId } } }) },
    rpc: async () => { rpcCalls++; if (rpcCalls === 1) await barrier; return { error: null }; },
  } } }, { window, document, Date: class extends Date { static now() { return time; } },
    setInterval: fn => { const id = ++timerId; timers.set(id, fn); return id; }, clearInterval: id => timers.delete(id) }).presenceService;
  const a = service.initializePresence(userId), b = service.initializePresence(userId);
  release(); await Promise.all([a, b]);
  assert.equal(rpcCalls, 1); assert.equal(timers.size, 1); assert.equal(counts.get('focus'), 1);
  document.visibilityState = 'hidden'; for (const tick of timers.values()) tick();
  await new Promise(r => setTimeout(r, 0)); assert.equal(rpcCalls, 1);
  document.visibilityState = 'visible'; await service.cleanup(userId); assert.equal(timers.size, 1);
  await service.cleanup(userId); assert.equal(timers.size, 0); assert.equal(counts.get('focus'), 0); assert.equal(counts.get('mousemove'), 0);
});
test('presence retries after transient cooldown without marking the feature permanently unsupported', async () => {
  let clock = 0, calls = 0;
  const window = new EventTarget(), document = new EventTarget(); document.visibilityState = 'visible';
  const service = load('src/services/presenceService.ts', { '../lib/supabase': { supabase: {
    auth: { getUser: async () => ({ data: { user: { id: userId } } }) },
    rpc: async () => ({ error: ++calls === 1 ? { code: 'PGRST002', message: 'schema cache unavailable' } : null }),
  } } }, { window, document, Date: class extends Date { static now() { return clock; } }, setInterval: () => 1, clearInterval() {} }).presenceService;
  await service.initializePresence(userId); await service.updatePresence(userId, 'online'); assert.equal(calls, 1);
  clock = 60_000; assert.equal((await service.updatePresence(userId, 'online')).error, null); assert.equal(calls, 2);
  await service.cleanup(userId);
});

test('unresolved recipient hold survives edits and changing providers', async () => {
  const f = outreachFixture(async () => { throw new Error('ECONNRESET after possible acceptance'); });
  const approval1 = await (await f.module.POST(f.request(f.payload, { 'x-outreach-phase': 'approve' }))).json();
  await f.module.POST(f.request(f.payload, { 'x-outreach-approval': approval1.approvalToken }));
  const edited = { ...f.payload, body: 'Edited and approved again', preferredProvider: 'brevo' };
  const approval2 = await (await f.module.POST(f.request(edited, { 'x-outreach-phase': 'approve' }))).json();
  const blocked = await f.module.POST(f.request(edited, { 'x-outreach-approval': approval2.approvalToken }));
  assert.equal(blocked.status, 409); assert.equal((await blocked.json()).code, 'OUTCOME_UNKNOWN'); assert.equal(f.sends, 1);
});
test('annotation changes preserve the original email operation identity', () => {
  const payload = { tenantId, leadEmail: 'CONTROLLED@example.com', subject: 'Test', body: 'same body', pitchAngle: 'old', score: 10 };
  assert.equal(approval.outreachOperationKey(userId, payload), approval.outreachOperationKey(userId, { ...payload, leadEmail: 'controlled@example.com', pitchAngle: 'new', score: 90 }));
});

test('provider authentication rejection is distinct from unknown delivery and retry replays safely', async () => {
  const f = outreachFixture(async () => { throw Object.assign(new Error('unauthorized'), { status: 401, providerRequestId: 'mock-request-rejected' }); });
  const issued = await (await f.module.POST(f.request(f.payload, { 'x-outreach-phase': 'approve' }))).json();
  const response = await f.module.POST(f.request(f.payload, { 'x-outreach-approval': issued.approvalToken }));
  assert.equal(response.status, 400); const data = await response.json();
  assert.equal(data.status, 'failed'); assert.equal(data.code, 'OUTREACH_PROVIDER_AUTH_FAILED');
  const replay = await f.module.POST(f.request(f.payload, { 'x-outreach-approval': issued.approvalToken }));
  assert.equal(replay.status, 400); assert.equal(f.sends, 1);
});
test('read coalescing cannot share different authentication contexts', async () => {
  const policy = load('src/lib/readRequestPolicy.ts'); let calls = 0;
  const read = policy.createReadRequestClient({ fetch: async (_url, init) => { calls++; return Response.json({ actor: new Headers(init.headers).get('Authorization') }); } });
  const [a, b] = await Promise.all([
    read('https://mock.example/profiles', { headers: { Authorization: 'Bearer synthetic-a' } }),
    read('https://mock.example/profiles', { headers: { Authorization: 'Bearer synthetic-b' } }),
  ]);
  assert.equal(calls, 2); assert.equal((await a.json()).actor, 'Bearer synthetic-a'); assert.equal((await b.json()).actor, 'Bearer synthetic-b');
});

test('invoice lifecycle client preserves queued run identity and truthful recovery message', async () => {
  const client = load('src/lib/invoices/startInvoiceLifecycleFromDashboard.ts', {}, {
    fetch: async () => Response.json({ run_id: 'controlled-run', message: 'Queued; no email confirmed.' }, { status: 202 }),
  });
  const result = await client.startInvoiceLifecycleFromDashboard({ tenantId: 'test', invoiceId: 'invoice' });
  assert.equal(result.runId, 'controlled-run');
  assert.match(result.message, /no email confirmed/);
  assert.match(result.message, /controlled-run/);
});
test('invoice lifecycle client surfaces approval or backend failure without claiming a send', async () => {
  for (const status of [403, 503]) {
    let calls = 0;
    const client = load('src/lib/invoices/startInvoiceLifecycleFromDashboard.ts', {}, {
      fetch: async () => { calls++; return Response.json({ error: 'Delivery blocked; review required' }, { status }); },
    });
    await assert.rejects(client.startInvoiceLifecycleFromDashboard({ tenantId: 'test', invoiceId: 'invoice' }), /review required/);
    assert.equal(calls, 1);
  }
});

test('invoice lifecycle route uses guarded command, accepts approved invoice and preserves denial', async () => {
  const tenantId = '11111111-1111-4111-8111-111111111111';
  const invoiceId = '22222222-2222-4222-8222-222222222222';
  for (const allowed of [true, false]) {
    let commandInput;
    const query = { select() { return this; }, eq() { return this; }, async maybeSingle() { return { data: { id: invoiceId, status: 'approved', clients: { email: 'controlled@example.test' } }, error: null }; } };
    const route = load('src/app/api/invoices/lifecycle/route.ts', {
      'next/server': { NextResponse: { json: (body, options) => Response.json(body, options) } },
      zod: { z },
      '@/lib/apiAuth': { requireTenantAccess: async () => ({ user: { id: 'test-user' }, admin: { from: () => query } }), routeErrorResponse: () => Response.json({ error: 'unexpected' }, { status: 500 }) },
      '@/lib/server/dailyResourceQuota': { validateDailyResourceQuota: async () => {} },
      '@/lib/execution/commands/invoiceSendCommand': { executeInvoiceSendCommand: async input => { commandInput = input; return allowed ? { ok: true, result: { durable: true, status: 'queued', run_id: 'test-run' } } : { ok: false, failure_code: 'APPROVAL_REQUIRED', error: { message: 'Approval required' } }; } },
      '@/lib/execution/domainCapabilityGuard': { mapProviderCodeToHttpStatus: () => 403 },
    });
    const response = await route.POST(new Request('https://app.example/api/invoices/lifecycle', { method: 'POST', body: JSON.stringify({ tenantId, invoiceId }) }));
    assert.equal(commandInput.executionSource, 'ui');
    assert.equal(commandInput.tenantId, tenantId);
    assert.equal(response.status, allowed ? 202 : 403);
    const body = await response.json();
    if (allowed) { assert.equal(body.run_id, 'test-run'); assert.match(body.message, /no email has been confirmed/); }
    else { assert.equal(body.code, 'APPROVAL_REQUIRED'); assert.equal(body.success, undefined); }
  }
});
