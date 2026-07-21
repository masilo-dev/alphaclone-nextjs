const { test, expect } = require('@playwright/test');

const email = process.env.TENANT_EMAIL || process.env.TEST_USER_EMAIL;
const password = process.env.TENANT_PASSWORD || process.env.TEST_USER_PASSWORD;
const hasCredentials = Boolean(email && password);

async function loginAsTenant(page) {
  await page.addInitScript(() => {
    const userId = 'df841125-59ce-4e09-aa2d-5b746ec03d9b';
    localStorage.setItem(`welcome_seen_${userId}`, 'true');
    localStorage.setItem(`onboarding_completed_${userId}`, 'true');
    localStorage.setItem('onboarding_completed', 'true');
  });

  await page.goto('/auth/login');
  const acceptCookies = page.getByRole('button', { name: 'Accept All' });
  if ((await acceptCookies.count()) > 0 && (await acceptCookies.isVisible())) {
    await acceptCookies.click();
  }

  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 45000 });

  const skipBtn = page.locator('button:has-text("Skip Onboarding"), button:has-text("Skip")');
  if ((await skipBtn.count()) > 0 && (await skipBtn.isVisible())) {
    await skipBtn.click();
  }
}

test.describe('Unified Inbox', () => {
  test.skip(!hasCredentials, 'Missing tenant credentials');
  test.setTimeout(120000);

  test.beforeEach(async ({ page }) => {
    await loginAsTenant(page);
  });

  test('Mail route loads merged inbox with mailbox and channels tabs', async ({ page }) => {
    await page.goto('/dashboard/mail', { timeout: 60000 });
    await expect(page.locator('main').first()).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole('tab', { name: 'Mailbox' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('tab', { name: 'All channels' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Compose/i }).first()).toBeVisible();
  });

  test('Channels tab loads aggregated feed', async ({ page }) => {
    await page.goto('/dashboard/mail?tab=channels', { timeout: 60000 });
    await expect(page.getByRole('tab', { name: 'All channels' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText(/Unified Inbox|All Channels|Pending/i).first()).toBeVisible({
      timeout: 15000,
    });
  });

  test('Legacy unified-inbox route opens channels tab', async ({ page }) => {
    await page.goto('/dashboard/business/unified-inbox', { timeout: 60000 });
    await expect(page.getByRole('tab', { name: 'All channels' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('tab', { name: 'Mailbox' })).toBeVisible();
  });

  test('Accessibility: inbox tabs and search are labeled', async ({ page }) => {
    await page.goto('/dashboard/mail', { timeout: 60000 });
    await expect(page.getByRole('tablist', { name: 'Inbox views' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('searchbox', { name: 'Search mail' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Email mailbox' })).toBeVisible();
  });
});
