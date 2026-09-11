/**
 * One-shot authenticated route audit. Credentials via env only — never logged.
 * Usage: TENANT_EMAIL=... TENANT_PASSWORD=... node scripts/run-authenticated-audit.mjs
 */
import { chromium } from '@playwright/test';

const BASE = process.env.BASE_URL || 'https://alphaclonesystems.com';
const email = process.env.TENANT_EMAIL || process.env.SUPER_ADMIN_EMAIL;
const password = process.env.TENANT_PASSWORD || process.env.SUPER_ADMIN_PASSWORD;

if (!email || !password) {
  console.error('Missing TENANT_EMAIL/TENANT_PASSWORD');
  process.exit(1);
}

const ROUTES = [
  '/dashboard',
  '/dashboard/crm',
  '/dashboard/leads',
  '/dashboard/deals',
  '/dashboard/outreach',
  '/dashboard/business/campaigns',
  '/dashboard/business/billing',
  '/dashboard/business/billing/manage',
  '/dashboard/business/contracts',
  '/dashboard/business/documents',
  '/dashboard/business/calendar',
  '/dashboard/business/projects',
  '/dashboard/tasks',
  '/dashboard/goals',
  '/dashboard/business/reports',
  '/dashboard/business/workflows',
  '/dashboard/business/bonnie',
  '/dashboard/marketplace',
  '/dashboard/settings',
  '/dashboard/admin/tenants',
  '/dashboard/admin/operations',
];

async function dismissOverlays(page) {
  for (const name of [/Accept All/i, /Got it/i, /Dismiss install/i, /Enter Dashboard/i, /Go to dashboard/i, /Skip/i]) {
    const btn = page.getByRole('button', { name }).first();
    if (await btn.isVisible({ timeout: 800 }).catch(() => false)) {
      await btn.click({ force: true }).catch(() => {});
    }
  }
}

async function login(page) {
  await page.goto(`${BASE}/auth/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await dismissOverlays(page);
  await page.locator('input[type="email"]').first().fill(email);
  await page.locator('input[type="password"]').first().fill(password);

  const submit = page.getByRole('button', { name: /Sign In with Email/i });
  const turnstile = page.locator('iframe[src*="challenges.cloudflare.com"]').first();
  if (await turnstile.isVisible({ timeout: 5000 }).catch(() => false)) {
    await submit.waitFor({ state: 'visible', timeout: 60000 });
    await page.waitForFunction(
      () => {
        const btn = [...document.querySelectorAll('button')].find((b) =>
          /Sign In with Email/i.test(b.textContent || ''),
        );
        return btn && !btn.disabled;
      },
      { timeout: 90000 },
    );
  }
  await submit.click();
  await page.waitForURL(/\/dashboard/, { timeout: 90000 });
  await dismissOverlays(page);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ baseURL: BASE });
const page = await context.newPage();
const apiFailures = [];

page.on('response', (res) => {
  const url = res.url();
  if (res.status() >= 500 && /\/api\//.test(url)) {
    apiFailures.push({ status: res.status(), url });
  }
});

try {
  await login(page);
  const results = [];

  for (const path of ROUTES) {
    apiFailures.length = 0;
    const errors = [];
    page.removeAllListeners('pageerror');
    page.on('pageerror', (e) => errors.push(String(e.message || e)));

    await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await dismissOverlays(page);
    await page.locator('main, #main-content').first().waitFor({ timeout: 25000 }).catch(() => {});

    const body = await page.locator('body').innerText();
    const blocked =
      /could not be loaded|Application Error|Internal Server Error|403 Forbidden|Access denied/i.test(body);
    const hasMain = await page.locator('main, #main-content').first().isVisible().catch(() => false);

    results.push({
      path,
      ok: hasMain && !blocked,
      blocked,
      api500: [...apiFailures],
      pageErrors: errors.slice(0, 3),
    });
  }

  console.log(JSON.stringify({ base: BASE, account: email.replace(/(.{2}).+(@.*)/, '$1***$2'), results }, null, 2));
} finally {
  await browser.close();
}
