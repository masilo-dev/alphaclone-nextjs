const { test, expect } = require('@playwright/test');

const email = process.env.TENANT_EMAIL || process.env.TEST_USER_EMAIL;
const password = process.env.TENANT_PASSWORD || process.env.TEST_USER_PASSWORD;
const hasCredentials = Boolean(email && password);

async function loginAsTenant(page) {
  await page.route('**/rest/v1/rpc/get_user_tenants*', async (route) => {
    await route.continue();
  });

  await page.addInitScript(() => {
    const userId = 'df841125-59ce-4e09-aa2d-5b746ec03d9b';
    localStorage.setItem(`welcome_seen_${userId}`, 'true');
    localStorage.setItem(`onboarding_completed_${userId}`, 'true');
    localStorage.setItem('onboarding_completed', 'true');
  });

  await page.goto('/auth/login');
  const acceptCookies = page.getByRole('button', { name: 'Accept All' });
  if (await acceptCookies.count() > 0 && await acceptCookies.isVisible()) {
    await acceptCookies.click();
  }

  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.locator('button[type="submit"]').click();

  const loginError = page.getByText(/Incorrect email or password|permanently blocked|banned from registering/i);
  if (await loginError.isVisible({ timeout: 5000 }).catch(() => false)) {
    throw new Error(`Login failed for ${email}: ${(await loginError.textContent())?.trim()}`);
  }

  await expect(page).toHaveURL(/\/dashboard/, { timeout: 45000 });

  const enterDashboardBtn = page.locator('button:has-text("Enter Dashboard")');
  if (await enterDashboardBtn.count() > 0 && await enterDashboardBtn.isVisible()) {
    await enterDashboardBtn.click();
  }

  const goToDashboardBtn = page.getByRole('button', { name: 'Go to dashboard' });
  if (await goToDashboardBtn.count() > 0 && await goToDashboardBtn.isVisible()) {
    await goToDashboardBtn.click();
  }

  const skipBtn = page.locator('button:has-text("Skip Onboarding"), button:has-text("Skip")');
  if (await skipBtn.count() > 0 && await skipBtn.isVisible()) {
    await skipBtn.click();
  }

  await expect(page.locator('main').first()).toBeVisible({ timeout: 20000 });
  await expect(page.getByRole('heading', { name: /Dashboard|Workspace/i }).first()).toBeVisible({ timeout: 20000 });
}

async function expectRouteHealthy(page, path, expectedText) {
  await page.goto(path, { timeout: 60000 });
  const goToDashboardBtn = page.getByRole('button', { name: 'Go to dashboard' });
  if (await goToDashboardBtn.count() > 0 && await goToDashboardBtn.isVisible()) {
    await goToDashboardBtn.click();
  }
  await expect(page.locator('main').first()).toBeVisible({ timeout: 20000 });
  await expect(page.locator('body')).not.toContainText('This section could not be loaded.');
  await expect(page.locator('body')).not.toContainText('This section is not available');
  await expect(page.locator('body')).not.toContainText('404');
  if (expectedText) {
    await expect(page.getByText(expectedText).first()).toBeVisible({ timeout: 15000 });
  }
}

test.describe('Final Audit Smoke', () => {
  test.skip(!hasCredentials, 'Missing tenant credentials for smoke verification');
  test.setTimeout(120000);

  test.beforeEach(async ({ page }) => {
    await loginAsTenant(page);
  });

  test('Home, CRM, Deals, Quotes, Billing, Accounting, and Integrations load', async ({ page }) => {
    const checks = [
      { path: '/dashboard', text: /Workspace Modules|Start here|Revenue/i },
      { path: '/dashboard/crm', text: /CRM|Contacts|Pipeline/i },
      { path: '/dashboard/deals', text: /Deals|Pipeline/i },
      { path: '/dashboard/quotes', text: /Quotes|Proposals/i },
      { path: '/dashboard/business/billing', text: /Billing|Invoices|Revenue/i },
      { path: '/dashboard/accounting', text: /Accounting|Period|Banking/i },
      { path: '/dashboard/marketplace', text: /Integration Marketplace|Integrations|Marketplace/i },
      { path: '/dashboard/mail', text: /Mailbox|All channels|Compose|Mail/i },
    ];

    for (const check of checks) {
      await expectRouteHealthy(page, check.path, check.text);
    }
  });

  test('Delete Account dialog opens and can be cancelled safely', async ({ page }) => {
    await expectRouteHealthy(page, '/dashboard/settings', /Settings|Danger Zone|Account Preferences/i);
    await expect(page.getByText('Delete Account').first()).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: 'Delete Account' }).click();
    await expect(page.getByText('Warning Action')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/permanently delete your profile/i)).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByText('Warning Action')).toHaveCount(0);
  });
});
