/**
 * Production audit — public routes, auth UI, and optional authenticated smoke.
 * Run against live: BASE_URL=https://alphaclonesystems.com npx playwright test tests/production-audit.spec.js -c playwright.smoke-remote.config.js
 */
const { test, expect } = require('@playwright/test');

const BASE = process.env.BASE_URL || 'https://alphaclonesystems.com';
const email = process.env.TENANT_EMAIL || process.env.TEST_USER_EMAIL || process.env.SUPER_ADMIN_EMAIL;
const password = process.env.TENANT_PASSWORD || process.env.TEST_USER_PASSWORD || process.env.SUPER_ADMIN_PASSWORD;
const hasCredentials = Boolean(email && password);

const VIEWPORTS = [
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'laptop-1280', width: 1280, height: 800 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'mobile-390', width: 390, height: 844 },
];

const PUBLIC_PATHS = [
  { path: '/', title: /Run your business|AlphaClone/i },
  { path: '/pricing', title: /pricing|plan|\$15/i },
  { path: '/about', title: /AlphaClone|about|mission/i },
  { path: '/contact', title: /contact|reach/i },
  { path: '/book-demo', title: /demo|book|schedule/i },
  { path: '/legal/privacy', title: /privacy/i },
  { path: '/legal/terms', title: /terms|service/i },
  { path: '/privacy-policy', title: /privacy/i },
  { path: '/terms-of-service', title: /terms/i },
  { path: '/auth/login', title: /sign in|log in|welcome|account/i },
  { path: '/auth/reset-password', title: /reset|password/i },
  { path: '/crm', title: /CRM|customer|relationship/i },
  { path: '/faq', title: /faq|question/i },
  { path: '/platform-status', title: /status|operational/i },
];

function trackErrors(page) {
  const errors = [];
  page.on('pageerror', (err) => {
    const text = String(err?.message || err);
    if (/ResizeObserver|Non-Error promise rejection|Loading chunk/i.test(text)) return;
    errors.push(text);
  });
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (
      /favicon|Download the React DevTools|Failed to load resource.*\.(png|jpg|webp|svg)/i.test(text)
    ) {
      return;
    }
    errors.push(text);
  });
  return errors;
}

async function dismissCookieIfPresent(page) {
  const accept = page.getByRole('button', { name: /Accept All|Accept cookies/i }).first();
  if (await accept.isVisible({ timeout: 2500 }).catch(() => false)) {
    await accept.click({ force: true }).catch(() => {});
  }
}

async function dismissInstallPromptIfPresent(page) {
  const gotIt = page.getByRole('button', { name: /Got it|Dismiss install prompt/i }).first();
  if (await gotIt.isVisible({ timeout: 1500 }).catch(() => false)) {
    await gotIt.click({ force: true }).catch(() => {});
  }
}

/** Production login is gated by Cloudflare Turnstile when NEXT_PUBLIC_TURNSTILE_SITE_KEY is set. */
async function hasTurnstileGate(page) {
  const widget = page.locator('iframe[src*="challenges.cloudflare.com"], [data-turnstile-widget]').first();
  return widget.isVisible({ timeout: 3000 }).catch(() => false);
}

async function submitLoginForm(page) {
  const submit = page.getByRole('button', { name: /Sign In with Email/i });
  await expect(submit).toBeVisible({ timeout: 10000 });
  if (await hasTurnstileGate(page)) {
    test.skip(true, 'Login submit requires Cloudflare Turnstile completion on production');
  }
  await submit.click();
}

async function login(page) {
  await page.goto('/auth/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await dismissCookieIfPresent(page);
  await dismissInstallPromptIfPresent(page);
  await page.locator('input[type="email"]').first().fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  await submitLoginForm(page);

  const loginError = page.getByText(/Incorrect email or password|permanently blocked|invalid/i);
  if (await loginError.isVisible({ timeout: 5000 }).catch(() => false)) {
    throw new Error('Login rejected — check authorized test credentials in environment');
  }
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 45000 });

  for (const label of ['Enter Dashboard', 'Go to dashboard', 'Skip Onboarding', 'Skip', 'Got it']) {
    const btn = page.getByRole('button', { name: new RegExp(label, 'i') });
    if (await btn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await btn.click().catch(() => {});
    }
  }
  await expect(page.locator('main, #main-content').first()).toBeVisible({ timeout: 20000 });
}

test.describe('Production audit — public website', () => {
  for (const vp of VIEWPORTS) {
    test(`homepage healthy at ${vp.name}`, async ({ page }) => {
      test.setTimeout(90000);
      await page.setViewportSize({ width: vp.width, height: vp.height });
      const errors = trackErrors(page);
      await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await dismissCookieIfPresent(page);

      await expect(page.locator('h1').first()).toBeVisible();
      await expect(page.getByRole('link', { name: /Log in|Sign in/i }).first()).toBeVisible();

      const overflow = await page.evaluate(() => ({
        sw: document.documentElement.scrollWidth,
        cw: document.documentElement.clientWidth,
      }));
      expect(overflow.sw).toBeLessThanOrEqual(overflow.cw + 4);

      expect(errors, errors.join(' | ')).toEqual([]);
    });
  }

  test('public routes respond with HTTP 200', async ({ request }) => {
    test.setTimeout(180000);
    for (const { path } of PUBLIC_PATHS) {
      const res = await request.get(`${BASE}${path}`, { timeout: 45000, maxRedirects: 5 });
      expect(res.status(), `${path} status`).toBeLessThan(400);
    }
  });

  for (const { path, title } of PUBLIC_PATHS) {
    test(`page renders: ${path}`, async ({ page }) => {
      test.setTimeout(60000);
      const errors = trackErrors(page);
      await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await dismissCookieIfPresent(page);
      await expect(page.locator('body')).not.toContainText('Application Error');
      await expect(page.locator('body')).not.toContainText('Internal Server Error');
      if (title) {
        await expect(page.locator('h1, h2').filter({ hasText: title }).first()).toBeVisible({
          timeout: 15000,
        });
      }
      expect(errors, `${path}: ${errors.join(' | ')}`).toEqual([]);
    });
  }

  test('Book Demo links to Cal.com or booking flow', async ({ page }) => {
    await page.goto(`${BASE}/book-demo`, { waitUntil: 'domcontentloaded' });
    await dismissCookieIfPresent(page);
    const calLink = page.locator('a[href*="cal.com"], iframe[src*="cal.com"]');
    const hasCal = (await calLink.count()) > 0;
    const onBooking = /book-demo|\/book|cal\.com/i.test(page.url());
    expect(hasCal || onBooking).toBeTruthy();
  });

  test('footer legal links resolve', async ({ page }) => {
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    await dismissCookieIfPresent(page);
    for (const name of ['Privacy Policy', 'Terms of Service', 'Security Policy']) {
      const link = page.getByRole('link', { name }).first();
      await expect(link).toBeVisible();
      const href = await link.getAttribute('href');
      expect(href).toBeTruthy();
      const res = await page.request.get(href.startsWith('http') ? href : `${BASE}${href}`);
      expect(res.status()).toBeLessThan(400);
    }
  });

  test('mobile navigation opens and closes', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    await dismissCookieIfPresent(page);
    const menu = page.getByRole('button', { name: /Open navigation|menu/i });
    await expect(menu).toBeVisible();
    await menu.click();
    await expect(page.getByRole('link', { name: /Pricing|Log in|Start/i }).first()).toBeVisible();
  });
});

test.describe('Production audit — authentication UI', () => {
  test('invalid password shows error, not success', async ({ page }) => {
    test.setTimeout(60000);
    await page.goto(`${BASE}/auth/login`, { waitUntil: 'domcontentloaded' });
    await dismissCookieIfPresent(page);
    await dismissInstallPromptIfPresent(page);
    await page.locator('input[type="email"]').first().fill('nonexistent-audit-user@example.invalid');
    await page.locator('input[type="password"]').first().fill('wrong-password-not-real');

    if (await hasTurnstileGate(page)) {
      const submit = page.getByRole('button', { name: /Sign In with Email/i });
      await expect(submit).toBeDisabled();
      test.info().annotations.push({
        type: 'note',
        description: 'Submit correctly disabled until Turnstile completes (production security gate)',
      });
      return;
    }

    await submitLoginForm(page);
    await expect(page.getByText(/incorrect|invalid|wrong|password/i).first()).toBeVisible({
      timeout: 15000,
    });
    await expect(page).not.toHaveURL(/\/dashboard/);
  });

  test('empty submit keeps user on login', async ({ page }) => {
    await page.goto(`${BASE}/auth/login`, { waitUntil: 'domcontentloaded' });
    await dismissCookieIfPresent(page);
    await page.locator('button[type="submit"]').first().click();
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test('protected dashboard redirects unauthenticated user', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/crm`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(3000);
    const url = page.url();
    expect(url).toMatch(/\/auth\/login|\/login/);
  });

  test('password reset page loads', async ({ page }) => {
    await page.goto(`${BASE}/auth/reset-password`, { waitUntil: 'domcontentloaded' });
    await dismissCookieIfPresent(page);
    await expect(page.locator('input[type="email"]').first()).toBeVisible();
  });
});

test.describe('Production audit — authenticated dashboard', () => {
  test.skip(!hasCredentials, 'Missing authorized test credentials in environment');

  test.beforeEach(async ({ page }) => {
    test.setTimeout(120000);
    await login(page);
  });

  const DASHBOARD_ROUTES = [
    { path: '/dashboard', label: /Dashboard|Workspace|Revenue/i },
    { path: '/dashboard/crm', label: /CRM|Contacts|Pipeline/i },
    { path: '/dashboard/leads', label: /Leads|Lead/i },
    { path: '/dashboard/deals', label: /Deals|Pipeline/i },
    { path: '/dashboard/outreach', label: /Outreach|Email/i },
    { path: '/dashboard/business/campaigns', label: /Campaign|Marketing/i },
    { path: '/dashboard/business/billing', label: /Billing|Invoice|Revenue/i },
    { path: '/dashboard/business/billing/manage', label: /Invoice|Create|Billing/i },
    { path: '/dashboard/business/contracts', label: /Contract/i },
    { path: '/dashboard/business/documents', label: /Document|Vault/i },
    { path: '/dashboard/business/calendar', label: /Calendar|Meeting/i },
    { path: '/dashboard/business/projects', label: /Project/i },
    { path: '/dashboard/tasks', label: /Task/i },
    { path: '/dashboard/goals', label: /Goal/i },
    { path: '/dashboard/business/reports', label: /Report|Analytics/i },
    { path: '/dashboard/business/workflows', label: /Automation|Workflow/i },
    { path: '/dashboard/business/bonnie', label: /Bonnie|Assistant|AI/i },
    { path: '/dashboard/marketplace', label: /Integration|Marketplace/i },
    { path: '/dashboard/settings', label: /Settings|Account/i },
    { path: '/dashboard/admin/tenants', label: /Tenant|Platform|Admin/i },
  ];

  for (const route of DASHBOARD_ROUTES) {
    test(`module loads: ${route.path}`, async ({ page }) => {
      const failedRequests = [];
      page.on('response', (res) => {
        const url = res.url();
        if (res.status() >= 500 && /\/api\//.test(url)) {
          failedRequests.push(`${res.status()} ${url}`);
        }
      });

      await page.goto(route.path, { timeout: 60000 });
      await expect(page.locator('main, #main-content').first()).toBeVisible({ timeout: 20000 });
      await expect(page.locator('body')).not.toContainText('This section could not be loaded');
      await expect(page.locator('body')).not.toContainText('Application Error');

      if (route.label) {
        await expect(
          page.locator('main, #main-content').getByText(route.label).first(),
        ).toBeVisible({ timeout: 15000 });
      }

      const critical500 = failedRequests.filter((r) => !/\/operations-brief/.test(r));
      expect(critical500, critical500.join('\n')).toEqual([]);
    });
  }

  test('logout clears session', async ({ page }) => {
    await page.goto('/dashboard/settings', { timeout: 60000 });
    const signOut = page.getByRole('button', { name: /Sign out|Log out/i }).first();
    if (await signOut.isVisible({ timeout: 5000 }).catch(() => false)) {
      await signOut.click();
    } else {
      test.skip(true, 'Sign out control not found on settings page');
    }
    await expect(page).toHaveURL(/\/auth\/login|\/login|\//, { timeout: 20000 });
    await page.goto('/dashboard/crm');
    await page.waitForTimeout(2000);
    expect(page.url()).toMatch(/\/auth\/login|\/login/);
  });
});
