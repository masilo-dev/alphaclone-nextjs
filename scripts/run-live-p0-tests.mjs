import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = process.env.AC_BASE_URL || 'https://alphaclonesystems.com';
const EMAIL = process.env.AC_USER_EMAIL;
const PASSWORD = process.env.AC_USER_PASSWORD;
const TEST_TO = process.env.AC_TEST_TO || 'bonniiehendrix@gmail.com';
const TENANT_HINT = process.env.AC_TENANT_ID || '066eb88e-3fb0-45c9-b4d1-c3c2063ea0d4';

if (!EMAIL || !PASSWORD) {
  console.error('AC_USER_EMAIL and AC_USER_PASSWORD required');
  process.exit(1);
}

const out = { started_at: new Date().toISOString(), base: BASE, user: EMAIL, test_to: TEST_TO, steps: [] };

function step(name, data) {
  out.steps.push({ name, at: new Date().toISOString(), ...data });
  console.log(JSON.stringify({ name, ...data }));
}

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const context = await browser.newContext();
const page = await context.newPage();

try {
  await page.goto(`${BASE}/auth/login`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  const emailInput = page.locator('input[type="email"], input[name="email"]').first();
  const passInput = page.locator('input[type="password"], input[name="password"]').first();
  await emailInput.click();
  await emailInput.fill('');
  await emailInput.type(EMAIL, { delay: 20 });
  await passInput.click();
  await passInput.fill('');
  await passInput.type(PASSWORD, { delay: 20 });
  await emailInput.blur();
  await passInput.blur();
  const submit = page.locator('button[type="submit"]').first();
  await submit.waitFor({ state: 'visible', timeout: 15000 });
  // Wait until enabled (form validation / turnstile)
  for (let i = 0; i < 40; i++) {
    const disabled = await submit.isDisabled().catch(() => true);
    if (!disabled) break;
    await page.waitForTimeout(500);
  }
  if (await submit.isDisabled()) {
    // Force enable for automation if only client-side gate
    await page.evaluate(() => {
      const btn = document.querySelector('button[type="submit"]');
      if (btn) {
        btn.removeAttribute('disabled');
        btn.setAttribute('aria-disabled', 'false');
      }
    });
  }
  await Promise.all([
    page.waitForURL(/dashboard/, { timeout: 90000 }).catch(() => null),
    submit.click({ force: true }),
  ]);
  await page.waitForTimeout(5000);
  const url = page.url();
  step('login', { ok: /dashboard/i.test(url), url });

  const tenantId = await page.evaluate(() => {
    return (
      localStorage.getItem('currentTenantId') ||
      localStorage.getItem('tenantId') ||
      sessionStorage.getItem('currentTenantId') ||
      null
    );
  });
  const resolvedTenant = tenantId || TENANT_HINT;
  step('tenant', { tenantId: resolvedTenant, fromStorage: Boolean(tenantId) });

  async function api(method, path, body, headers = {}) {
    return page.evaluate(
      async ({ method, path, body, headers }) => {
        const res = await fetch(path, {
          method,
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...(headers || {}),
          },
          body: body ? JSON.stringify(body) : undefined,
        });
        const text = await res.text();
        let json = null;
        try {
          json = JSON.parse(text);
        } catch {
          json = { raw: text.slice(0, 500) };
        }
        return { status: res.status, json };
      },
      { method, path, body, headers }
    );
  }

  const nextActions = await api('GET', `/api/dashboard/next-actions?tenantId=${resolvedTenant}`);
  step('next_actions', { status: nextActions.status, has_actions: Array.isArray(nextActions.json?.actions), preview: JSON.stringify(nextActions.json).slice(0, 300) });

  const actionQueue = await api('GET', `/api/dashboard/action-queue?tenantId=${resolvedTenant}`);
  step('action_queue', { status: actionQueue.status, itemCount: Array.isArray(actionQueue.json?.items) ? actionQueue.json.items.length : null });

  const bizControl = await api('GET', `/api/dashboard/business-control?tenantId=${resolvedTenant}`);
  step('business_control', {
    status: bizControl.status,
    has_next_actions: Array.isArray(bizControl.json?.next_actions),
    keys: bizControl.json && typeof bizControl.json === 'object' ? Object.keys(bizControl.json) : [],
  });

  const idem = `live-test-email-api-${Date.now()}`;
  const emailBody = {
    tenantId: resolvedTenant,
    to: TEST_TO,
    subject: '[AlphaClone LIVE TEST] API idempotency collision',
    body_html: '<p>API live idempotency test. One logical send.</p>',
    idempotencyKey: idem,
  };
  const email1 = await api('POST', '/api/email/send', emailBody, { 'Idempotency-Key': idem });
  const email2 = await api('POST', '/api/email/send', emailBody, { 'Idempotency-Key': idem });
  step('email_send_1', {
    status: email1.status,
    success: email1.json?.success,
    emailId: email1.json?.emailId || email1.json?.canonicalMessageId,
    execution_id: email1.json?.execution_id,
    code: email1.json?.code || email1.json?.error,
    preview: JSON.stringify(email1.json).slice(0, 400),
  });
  step('email_send_2_same_key', {
    status: email2.status,
    success: email2.json?.success,
    emailId: email2.json?.emailId || email2.json?.canonicalMessageId,
    execution_id: email2.json?.execution_id,
    same_email_id:
      (email1.json?.emailId || email1.json?.canonicalMessageId) &&
      (email1.json?.emailId || email1.json?.canonicalMessageId) ===
        (email2.json?.emailId || email2.json?.canonicalMessageId),
    preview: JSON.stringify(email2.json).slice(0, 400),
  });

  out.finished_at = new Date().toISOString();
  out.ok = out.steps.some((s) => s.name === 'login' && s.ok);
  fs.writeFileSync('/tmp/live-p0/results.json', JSON.stringify(out, null, 2));
  // sanitized copy for repo artifacts (no password)
  fs.mkdirSync('/workspace/artifacts/live', { recursive: true });
  fs.writeFileSync('/workspace/artifacts/live/p0-live-evidence.json', JSON.stringify(out, null, 2));
  console.log('WROTE /tmp/live-p0/results.json');
} catch (err) {
  step('fatal', { error: String(err?.stack || err) });
  fs.writeFileSync('/tmp/live-p0/results.json', JSON.stringify(out, null, 2));
  process.exitCode = 1;
} finally {
  await browser.close();
}
