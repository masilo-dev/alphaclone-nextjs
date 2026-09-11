/**
 * Tenant-admin module audit against live production.
 *
 * Requires TENANT_EMAIL and TENANT_PASSWORD in the environment.
 * Does not push. Writes JSON to /tmp/module-audit-report.json
 *
 * Usage:
 *   TENANT_EMAIL=... TENANT_PASSWORD=... node scripts/module-audit-all.cjs
 */
const { chromium, devices } = require('@playwright/test');
const fs = require('fs');
const MODULES = require('./tenant-admin-modules.cjs');

const BASE = process.env.BASE_URL || 'https://alphaclonesystems.com';
const EMAIL = process.env.TENANT_EMAIL || process.env.TEST_USER_EMAIL;
const PASSWORD = process.env.TENANT_PASSWORD || process.env.TEST_USER_PASSWORD;

if (!EMAIL || !PASSWORD) {
  console.error('Refusing to run: set TENANT_EMAIL and TENANT_PASSWORD (no hardcoded credentials).');
  process.exit(2);
}

const FAIL_PATTERNS = [
  /This section could not be loaded/i,
  /This section is not available/i,
  /Something went wrong/i,
  /Application error/i,
  /Unhandled Runtime Error/i,
  /Maximum update depth exceeded/i,
  /Minified React error/i,
  /Internal Server Error/i,
];

const FAKE_SUCCESS_PATTERNS = [
  /Action initiated for /i,
  /Attachment download started/i,
  /Receipt scanned & extracted/i,
];

async function dismiss(page) {
  for (const name of ['Accept All', 'Go to dashboard', 'Got it', 'Skip', 'Skip Onboarding', 'Not now', 'Dismiss']) {
    const btn = page.getByRole('button', { name: new RegExp(`^${name}$`, 'i') });
    if (await btn.count() && await btn.first().isVisible().catch(() => false)) {
      await btn.first().click().catch(() => {});
      await page.waitForTimeout(200);
    }
  }
}

async function probeModule(page, probe) {
  const notes = [];
  let functional = 'render-only';

  const search = page.locator('input[type="search"], input[placeholder*="Search" i], input[placeholder*="search" i]').first();
  if (await search.isVisible().catch(() => false)) {
    await search.fill('audit');
    notes.push('search-input-writable');
    functional = 'action-visible';
  }

  const action = page.getByRole('button', { name: /^(New |Create |Add |Send |Save |Find |Compose |Upload )/i }).first();
  if (await action.isVisible().catch(() => false)) {
    notes.push(`primary-action:${(await action.textContent())?.trim()?.slice(0, 40)}`);
    functional = 'action-visible';
  }

  if (probe === 'chat') {
    const composer = page.locator('textarea, [contenteditable="true"], input[placeholder*="Ask" i], input[placeholder*="Message" i]').first();
    if (await composer.isVisible().catch(() => false)) {
      notes.push('composer-visible');
      functional = 'action-visible';
    }
  }

  if (probe === 'calendar') {
    const grid = page.locator('.fc, [data-testid*="calendar" i], [role="grid"]').first();
    if (await grid.isVisible().catch(() => false)) {
      notes.push('calendar-grid-visible');
      functional = 'action-visible';
    }
  }

  if (probe === 'pipeline') {
    const columns = page.locator('[data-testid*="pipeline" i], [data-kanban], [class*="pipeline"]').first();
    if (await columns.isVisible().catch(() => false)) {
      notes.push('pipeline-surface-visible');
      functional = 'action-visible';
    }
  }

  if (probe === 'form') {
    const field = page.locator('form input, form textarea, form select').first();
    if (await field.isVisible().catch(() => false)) {
      notes.push('form-field-visible');
      functional = 'action-visible';
    }
  }

  return { functional, notes };
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    ...devices['Desktop Chrome'],
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  const results = [];
  let consoleErrors = [];
  let networkFails = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 400));
  });
  page.on('pageerror', (err) => {
    consoleErrors.push(`PAGEERROR: ${err.message}`.slice(0, 400));
  });
  page.on('response', (res) => {
    if (res.status() >= 500) {
      networkFails.push({ status: res.status(), url: res.url().slice(0, 200), method: res.request().method() });
    }
  });

  await page.goto(`${BASE}/auth/login`, { waitUntil: 'domcontentloaded' });
  await dismiss(page);
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/dashboard/, { timeout: 60000 });
  await page.waitForTimeout(2000);
  await dismiss(page);
  console.log('LOGIN OK');

  for (const mod of MODULES) {
    consoleErrors = [];
    networkFails = [];
    const start = Date.now();
    let status = 'pass';
    const issues = [];
    let title = null;
    let snippet = '';
    let finalUrl = '';
    let functional = 'render-only';
    let probeNotes = [];

    try {
      await page.goto(`${BASE}${mod.path}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(2200);
      await dismiss(page);
      finalUrl = page.url();

      const main = page.locator('main').first();
      const mainVisible = await main.isVisible().catch(() => false);
      if (!mainVisible) {
        status = 'fail';
        issues.push('main content not visible');
      }

      const bodyText = await page.locator('body').innerText().catch(() => '');
      snippet = bodyText.replace(/\s+/g, ' ').slice(0, 280);
      title = await page.locator('main h1, main h2').first().textContent().catch(() => null);

      for (const re of FAIL_PATTERNS) {
        if (re.test(bodyText)) {
          status = 'fail';
          issues.push(`UI error text: ${re.source}`);
        }
      }
      for (const re of FAKE_SUCCESS_PATTERNS) {
        if (re.test(bodyText)) {
          status = 'fail';
          issues.push(`fake-success text: ${re.source}`);
        }
      }

      const mainText = await main.innerText().catch(() => '');
      if (mainVisible && mainText.replace(/\s+/g, '').length < 12) {
        status = 'fail';
        issues.push('main content appears blank/empty');
      }

      const criticalConsole = consoleErrors.filter((e) =>
        /Maximum update depth|Minified React error|#185|ChunkLoadError|Hydration|is not defined|Cannot read prop/i.test(e)
      );
      if (criticalConsole.length) {
        status = 'fail';
        issues.push(`critical console: ${criticalConsole[0].slice(0, 160)}`);
      }

      if (networkFails.length) {
        status = 'fail';
        issues.push(`5xx responses: ${networkFails.slice(0, 3).map((f) => `${f.status} ${f.url}`).join(' | ')}`);
      }

      if (!finalUrl.includes('/dashboard') && !finalUrl.includes('/auth')) {
        status = 'fail';
        issues.push(`unexpected redirect: ${finalUrl}`);
      }

      const probed = await probeModule(page, mod.probe);
      functional = probed.functional;
      probeNotes = probed.notes;
      if (['form', 'chat', 'calendar', 'pipeline'].includes(mod.probe) && functional === 'render-only') {
        status = status === 'fail' ? 'fail' : 'partial';
        issues.push(`critical surface missing for probe=${mod.probe}`);
      }

      if (status === 'fail') {
        const safe = mod.path.replace(/\//g, '_').replace(/^_/, '');
        await page.screenshot({ path: `/tmp/audit-fail-${safe}.png`, fullPage: true }).catch(() => {});
      }
    } catch (err) {
      status = 'fail';
      issues.push(`navigation/crash: ${String(err.message || err).slice(0, 200)}`);
      finalUrl = page.url();
    }

    const row = {
      hub: mod.hub,
      label: mod.label,
      path: mod.path,
      probe: mod.probe,
      status,
      functional,
      probeNotes,
      issues,
      title: title?.trim()?.slice(0, 80) || null,
      finalUrl,
      ms: Date.now() - start,
      consoleErrors: [...new Set(consoleErrors)].slice(0, 8),
      networkFails: networkFails.filter((f, idx, arr) => arr.findIndex((x) => x.url === f.url) === idx).slice(0, 8),
      snippet,
    };
    results.push(row);
    const mark = status === 'pass' ? '✓' : status === 'partial' ? '~' : '✗';
    console.log(`${mark} [${mod.hub}] ${mod.label} (${mod.path}) ${issues.join('; ') || functional}`);
  }

  const failed = results.filter((r) => r.status === 'fail');
  const partial = results.filter((r) => r.status === 'partial');
  const passed = results.filter((r) => r.status === 'pass');
  const byHub = {};
  for (const r of results) {
    byHub[r.hub] = byHub[r.hub] || { pass: 0, partial: 0, fail: 0, fails: [] };
    byHub[r.hub][r.status] += 1;
    if (r.status === 'fail') byHub[r.hub].fails.push({ label: r.label, path: r.path, issues: r.issues });
  }

  const report = {
    timestamp: new Date().toISOString(),
    base: BASE,
    account: EMAIL,
    totals: { modules: results.length, passed: passed.length, partial: partial.length, failed: failed.length },
    productionReady: failed.length === 0 && partial.length === 0,
    byHub,
    failures: failed.map((f) => ({
      hub: f.hub, label: f.label, path: f.path, issues: f.issues, title: f.title, consoleErrors: f.consoleErrors, networkFails: f.networkFails,
    })),
    results,
  };

  fs.writeFileSync('/tmp/module-audit-report.json', JSON.stringify(report, null, 2));
  console.log('\n=== SUMMARY ===');
  console.log(JSON.stringify(report.totals, null, 2));
  console.log('productionReady:', report.productionReady);
  for (const f of failed) console.log(`  - [${f.hub}] ${f.label}: ${f.issues.join('; ')}`);
  await browser.close();
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
