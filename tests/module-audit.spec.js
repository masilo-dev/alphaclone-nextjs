/**
 * Authenticated tenant-admin module audit.
 * Verifies load, crash, 5xx, blank, and that critical surfaces exist.
 * Does not create invoices, send email, or publish social posts.
 *
 * TENANT_EMAIL / TENANT_PASSWORD required. Example:
 * BASE_URL=https://alphaclonesystems.com TENANT_EMAIL=... TENANT_PASSWORD=... \
 *   npx playwright test tests/module-audit.spec.js -c playwright.smoke-remote.config.js
 */
const { test, expect } = require('@playwright/test');
const MODULES = require('../scripts/tenant-admin-modules.cjs');

const email = process.env.TENANT_EMAIL || process.env.TEST_USER_EMAIL;
const password = process.env.TENANT_PASSWORD || process.env.TEST_USER_PASSWORD;
const hasCredentials = Boolean(email && password);

test.describe('Tenant-admin module functional audit', () => {
  test.skip(!hasCredentials, 'Set TENANT_EMAIL and TENANT_PASSWORD to run authenticated module audit');

  test.beforeEach(async ({ page }) => {
    test.setTimeout(90000);
    await page.goto('/auth/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
    const accept = page.getByRole('button', { name: /Accept All|Accept cookies/i }).first();
    if (await accept.isVisible({ timeout: 2500 }).catch(() => false)) {
      await accept.click({ force: true }).catch(() => {});
    }
    await page.locator('input[type="email"]').first().fill(email);
    await page.locator('input[type="password"]').first().fill(password);
    const turnstile = page.locator('iframe[src*="challenges.cloudflare.com"]').first();
    if (await turnstile.isVisible({ timeout: 2000 }).catch(() => false)) {
      test.skip(true, 'Production login is gated by Cloudflare Turnstile');
    }
    await page.getByRole('button', { name: /Sign In with Email/i }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 45000 });
  });

  for (const mod of MODULES) {
    test(`${mod.hub} / ${mod.label} (${mod.path})`, async ({ page }) => {
      test.setTimeout(60000);
      const serverErrors = [];
      page.on('response', (res) => {
        if (res.status() >= 500) serverErrors.push(`${res.status()} ${res.url()}`);
      });
      const pageErrors = [];
      page.on('pageerror', (err) => pageErrors.push(String(err.message || err)));

      await page.goto(mod.path, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await expect(page.locator('main').first()).toBeVisible({ timeout: 20000 });
      await expect(page.locator('body')).not.toContainText('This section could not be loaded.');
      await expect(page.locator('body')).not.toContainText('Application error');
      await expect(page.locator('body')).not.toContainText('Minified React error');

      const mainText = (await page.locator('main').innerText()).replace(/\s+/g, '');
      expect(mainText.length, 'blank main').toBeGreaterThan(12);

      expect(pageErrors, pageErrors.join(' | ')).toEqual([]);
      expect(serverErrors, serverErrors.join(' | ')).toEqual([]);

      if (mod.probe === 'form') {
        const field = page.locator('form input, form textarea, form select, input, textarea').first();
        await expect(field, `${mod.path} should expose a form control`).toBeVisible({ timeout: 8000 });
      }
      if (mod.probe === 'chat') {
        const composer = page.locator('textarea, [contenteditable="true"]').first();
        await expect(composer, `${mod.path} should expose a composer`).toBeVisible({ timeout: 8000 });
      }
    });
  }
});
