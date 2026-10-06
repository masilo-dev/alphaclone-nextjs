import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import { JSDOM } from 'jsdom';
const require = createRequire(import.meta.url);
function load(file, mocks = {}, globals = {}) {
  const loadedModule = { exports: {} };
  const code = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(`(function(require,module,exports){${code}\n})`, { process, console, URL, Date, ...globals })(
    id => id in mocks ? mocks[id] : require(id), loadedModule, loadedModule.exports);
  return loadedModule.exports;
}
function fixture() {
  const dom = new JSDOM('<!doctype html>', { url: 'https://alphaclonesystems.com', runScripts: 'outside-only' });
  const win = dom.window;
  const b = load('src/lib/consent/consentBootstrap.ts', {}, { window: win, document: win.document, localStorage: win.localStorage, CustomEvent: win.CustomEvent });
  let actual = {}; let queued = 0;
  const writes = [];
  win.zaraz = { consent: {
    purposes: { 'f-random': { name: 'Functional' }, 'a-random': { name: 'Analytics' }, 'm-random': { name: 'Marketing' }, other: { name: 'Other' } },
    set: choices => { actual = { ...choices }; writes.push(actual); }, getAll: () => actual,
    sendQueuedEvents: () => queued++,
  } };
  const state = overrides => ({ essential: true, functional: false, analytics: true, marketing: false,
    version: b.CONSENT_VERSION, timestamp: new Date().toISOString(), anonymousId: 'anon-test', ...overrides });
  return { dom, win, b, state, writes, queued: () => queued };
}
test('strict validator rejects expired, future, missing timestamp, old version, and coerced choices', () => {
  const f = fixture(); const { b, state } = f;
  assert.ok(b.validateConsent(JSON.stringify(state()), b.CONSENT_VERSION, b.CONSENT_TTL));
  for (const patch of [{ version: 'old' }, { timestamp: undefined }, { timestamp: 'invalid' }, { timestamp: new Date(Date.now() + 60000).toISOString() }, { timestamp: new Date(Date.now() - b.CONSENT_TTL * 1000 - 1).toISOString() }, { analytics: 'false' }]) {
    assert.equal(b.validateConsent(JSON.stringify(state(patch)), b.CONSENT_VERSION, b.CONSENT_TTL), null);
  }
  f.win.close();
});
test('serialized head script restores valid saved Google and real purpose IDs after denied defaults', () => {
  const f = fixture(); f.win.localStorage.setItem('ac_cookie_consent', JSON.stringify(f.state()));
  vm.runInContext(f.b.buildConsentBootstrapScript(), f.dom.getInternalVMContext());
  const signals = f.win.dataLayer.map(args => Array.from(args));
  assert.equal(signals[0][1], 'default'); assert.equal(signals[0][2].analytics_storage, 'denied');
  assert.equal(signals[1][2].analytics_storage, 'granted');
  assert.deepEqual(f.writes.at(-1), { 'f-random': false, 'a-random': true, 'm-random': false, other: false });
  assert.equal(f.win.acConsentBridge.apply(), true); assert.equal(f.queued(), 1);
  const count = f.win.dataLayer.length;
  f.b.installConsentBridge(f.b.consentBootstrapConfig(), f.b.validateConsent);
  assert.equal(f.win.dataLayer.length, count); f.win.close();
});
test('blocked localStorage uses the validated first-party cookie', () => {
  const f = fixture(); f.win.document.cookie = `ac_cookie_consent=${encodeURIComponent(JSON.stringify(f.state()))}`;
  Object.defineProperty(f.win, 'localStorage', { get() { throw new Error('blocked'); } });
  vm.runInContext(f.b.buildConsentBootstrapScript(), f.dom.getInternalVMContext());
  assert.equal(f.win.acConsentBridge.read().analytics, true); f.win.close();
});
test('late Zaraz readiness applies latest denial rather than a stale grant', () => {
  const f = fixture(); const api = f.win.zaraz; delete f.win.zaraz;
  f.win.localStorage.setItem('ac_cookie_consent', JSON.stringify(f.state()));
  const bridge = f.b.installConsentBridge(f.b.consentBootstrapConfig(), f.b.validateConsent);
  f.win.localStorage.setItem('ac_cookie_consent', JSON.stringify(f.state({ analytics: false })));
  f.win.dispatchEvent(new f.win.CustomEvent('ac:cookie-consent'));
  f.win.zaraz = api; f.win.document.dispatchEvent(new f.win.Event('zarazConsentAPIReady'));
  assert.equal(f.writes.at(-1)['a-random'], false); assert.equal(bridge.read().analytics, false); assert.equal(f.queued(), 0); f.win.close();
});
test('unknown purposes are denied; missing or mismatched readback cannot claim success', () => {
  const f = fixture(); f.win.zaraz.consent.purposes = { unmapped: { name: 'Custom' } };
  const bridge = f.b.installConsentBridge(f.b.consentBootstrapConfig(), f.b.validateConsent);
  assert.equal(bridge.zaraz({ functional: true, analytics: true, marketing: true }), false);
  assert.deepEqual(f.writes.at(-1), { unmapped: false });
  f.win.zaraz.consent.getAll = () => ({});
  assert.equal(bridge.zaraz({ functional: false, analytics: false, marketing: false }), false); f.win.close();
});
test('explicit configured IDs support custom purpose names', () => {
  const f = fixture(); f.win.zaraz.consent.purposes = { abc: { name: 'A' }, def: { name: 'B' }, ghi: { name: 'C' } };
  const bridge = f.b.installConsentBridge({ version: f.b.CONSENT_VERSION, maxAge: f.b.CONSENT_TTL, purposeIds: { functional: 'abc', analytics: 'def', marketing: 'ghi' } }, f.b.validateConsent);
  assert.equal(bridge.zaraz({ functional: false, analytics: true, marketing: false }), true);
  assert.deepEqual(f.writes.at(-1), { abc: false, def: true, ghi: false }); f.win.close();
});
test('cross-tab rejection updates Google, Zaraz, and already-loaded Meta consent', () => {
  const f = fixture(); const meta = []; f.win.fbq = (...args) => meta.push(args);
  f.win.localStorage.setItem('ac_cookie_consent', JSON.stringify(f.state({ marketing: true })));
  f.b.installConsentBridge(f.b.consentBootstrapConfig(), f.b.validateConsent);
  f.win.localStorage.setItem('ac_cookie_consent', JSON.stringify(f.state({ analytics: false, marketing: false })));
  f.win.dispatchEvent(new f.win.StorageEvent('storage', { key: 'ac_cookie_consent' }));
  assert.equal(f.writes.at(-1)['m-random'], false);
  assert.equal(Array.from(f.win.dataLayer.at(-1))[2].analytics_storage, 'denied');
  assert.deepEqual(meta.at(-1), ['consent', 'revoke']); f.win.close();
});
const response = { json: (body, init) => ({ body, status: init?.status || 200 }) };
const payload = { recordId: 'c3b714bf-3e5b-47cb-bc94-9ca2ff326b34', anonymousId: 'anon-test', essential: true, functional: false, analytics: false, marketing: false, consentVersion: '2026-10-v2' };
function route(database) {
  return load('src/app/api/legal/consent-record/route.ts', {
    'next/server': { NextResponse: response },
    '@/lib/apiAuth': { createAdminSupabaseClientOrThrow: () => database },
    '@/lib/rateLimit': { rateLimitMiddleware: async () => null, rateLimitConfigs: { api: { standard: {} } } },
    '@/lib/verifyTurnstile': { readClientIp: () => '127.0.0.1' },
  });
}
const request = () => ({ json: async () => payload, headers: new Headers() });
test('database insert failure returns failure rather than a false success receipt', async () => {
  const r = route({ from: table => { assert.equal(table, 'cookie_consent_records'); return { insert: async () => ({ error: { code: '42P01' } }) }; } });
  const result = await r.POST(request()); assert.equal(result.status, 503); assert.equal(result.body.success, undefined);
});
test('cookie record retries acknowledge matching UUIDs but reject conflicting choices', async () => {
  const existing = { anonymous_id: payload.anonymousId, tenant_id: process.env.LEGAL_SITE_TENANT_ID || process.env.CONTACT_TENANT_ID || process.env.DEFAULT_TENANT_ID || null, consent_version: payload.consentVersion, essential: true, functional: false, analytics: false, marketing: false };
  const query = { insert: async () => ({ error: { code: '23505' } }), select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: existing }) };
  assert.equal((await route({ from: () => query }).POST(request())).body.replayed, true);
  existing.analytics = true; assert.equal((await route({ from: () => query }).POST(request())).status, 409);
});
test('cookie records use configured tenant and omit IP without a private secret', async () => {
  let inserted; const old = process.env.LEGAL_SITE_TENANT_ID;
  process.env.LEGAL_SITE_TENANT_ID = 'c3b714bf-3e5b-47cb-bc94-9ca2ff326b35';
  try {
    const result = await route({ from: () => ({ insert: async value => { inserted = value; return { error: null }; } }) }).POST(request());
    assert.equal(result.body.success, true); assert.equal(inserted.tenant_id, process.env.LEGAL_SITE_TENANT_ID);
    assert.equal(inserted.id, payload.recordId); if (!process.env.CONSENT_IP_HASH_SECRET) assert.equal(inserted.ip_hash, null);
  } finally { if (old === undefined) delete process.env.LEGAL_SITE_TENANT_ID; else process.env.LEGAL_SITE_TENANT_ID = old; }
});
test('failed audit logging remains queued and retries the same record UUID', async () => {
  const f = fixture(); const attempts = []; let succeed = false;
  const manager = load('src/lib/consent/consentManager.ts', { './consentBootstrap': f.b }, {
    window: f.win, document: f.win.document, localStorage: f.win.localStorage, CustomEvent: f.win.CustomEvent,
    crypto: globalThis.crypto, AbortSignal,
    fetch: async (_url, input) => { attempts.push(JSON.parse(input.body)); return { ok: succeed, json: async () => ({ success: succeed }) }; },
  });
  manager.saveConsentState({ functional: false, analytics: false, marketing: false });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(JSON.parse(f.win.localStorage.getItem('ac_pending_consent_records')).length, 1);
  succeed = true; await manager.flushConsentAuditQueue();
  assert.equal(attempts.length, 2); assert.equal(attempts[0].recordId, attempts[1].recordId);
  assert.equal(JSON.parse(f.win.localStorage.getItem('ac_pending_consent_records')).length, 0); f.win.close();
});
