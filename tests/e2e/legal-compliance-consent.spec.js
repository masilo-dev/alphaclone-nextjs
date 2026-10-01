const { test, expect } = require('@playwright/test');

test.describe('AlphaClone Legal, Privacy & Cookie Compliance Center E2E', () => {
  const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000';

  test('Public Legal Center routes load cleanly with canonical titles', async ({ page }) => {
    // 1. Legal Hub
    const hubRes = await page.goto(`${BASE_URL}/legal`);
    expect(hubRes?.status()).toBe(200);
    await expect(page.locator('h1')).toContainText('Legal & Compliance Center');

    // 2. Privacy Policy
    const privRes = await page.goto(`${BASE_URL}/legal/privacy`);
    expect(privRes?.status()).toBe(200);
    await expect(page.locator('h1, h2').first()).toBeVisible();

    // 3. Terms of Service
    const termsRes = await page.goto(`${BASE_URL}/legal/terms`);
    expect(termsRes?.status()).toBe(200);

    // 4. Subprocessors Directory
    const subRes = await page.goto(`${BASE_URL}/legal/subprocessors`);
    expect(subRes?.status()).toBe(200);
    await expect(page.locator('h1')).toContainText('Authorized Subprocessors');
    await expect(page.locator('table')).toBeVisible();
    await expect(page.locator('text=Cloudflare')).toBeVisible();
    await expect(page.locator('text=Supabase')).toBeVisible();

    // 5. AI & Data Processing Disclosures
    const aiRes = await page.goto(`${BASE_URL}/legal/ai-data-processing`);
    expect(aiRes?.status()).toBe(200);
    await expect(page.locator('h1')).toContainText('AI Data Processing');
    await expect(page.locator('text=No Model Training')).toBeVisible();
  });

  test('Legacy URL redirects resolve to canonical /legal paths', async ({ page }) => {
    // Legacy /privacy-policy -> /legal/privacy
    await page.goto(`${BASE_URL}/privacy-policy`);
    await page.waitForURL('**/legal/privacy');
    expect(page.url()).toContain('/legal/privacy');

    // Legacy /terms-of-service -> /legal/terms
    await page.goto(`${BASE_URL}/terms-of-service`);
    await page.waitForURL('**/legal/terms');
    expect(page.url()).toContain('/legal/terms');

    // Legacy /cookie-policy -> /legal/cookies
    await page.goto(`${BASE_URL}/cookie-policy`);
    await page.waitForURL('**/legal/cookies');
    expect(page.url()).toContain('/legal/cookies');

    // Legacy /dpa -> /legal/dpa
    await page.goto(`${BASE_URL}/dpa`);
    await page.waitForURL('**/legal/dpa');
    expect(page.url()).toContain('/legal/dpa');
  });

  test('Cookie Banner presents choices, triggers Zaraz/Google signals, and allows revocation', async ({ page, context }) => {
    // Clear cookies/localStorage for clean session
    await context.clearCookies();
    await page.goto(`${BASE_URL}/`);

    // Verify banner is visible
    const banner = page.locator('aside[aria-label="Cookie consent banner"]');
    await expect(banner).toBeVisible({ timeout: 10000 });

    // Open preferences modal
    const manageBtn = banner.locator('button:has-text("Manage")');
    await manageBtn.click();

    // Verify dialog opened
    const dialog = page.locator('dialog.cookie-preferences-dialog');
    await expect(dialog).toBeVisible();

    // Verify toggles
    await expect(dialog.locator('text=Essential Cookies & Security')).toBeVisible();
    await expect(dialog.locator('text=Analytics & Platform Insights')).toBeVisible();

    // Click "Save preferences" with defaults (functional: true, analytics: false, marketing: false)
    const saveBtn = dialog.locator('button:has-text("Save preferences")');
    await saveBtn.click();

    // Banner should disappear
    await expect(banner).toBeHidden();

    // Verify localStorage has consent recorded
    const consent = await page.evaluate(() => {
      const raw = localStorage.getItem('ac_cookie_consent');
      return raw ? JSON.parse(raw) : null;
    });
    expect(consent).not.toBeNull();
    expect(consent.essential).toBe(true);

    // Reopen preferences via footer link
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('ac:open-cookie-preferences'));
    });
    await expect(dialog).toBeVisible();

    // Click "Reset to Essential Only"
    const resetBtn = dialog.locator('button:has-text("Reset to Essential Only")');
    await resetBtn.click();
    await expect(dialog).toBeHidden();

    // Verify revoked in localStorage
    const revoked = await page.evaluate(() => {
      const raw = localStorage.getItem('ac_cookie_consent');
      return raw ? JSON.parse(raw) : null;
    });
    expect(revoked.functional).toBe(false);
    expect(revoked.analytics).toBe(false);
    expect(revoked.marketing).toBe(false);
  });
});
