const { test, expect } = require('@playwright/test');

test.describe('Signup flow', () => {
  test('registration form loads with required fields', async ({ page }) => {
    await page.goto('/auth/login?register=true&type=business&plan=starter');

    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(
      page.locator('button[type="submit"]:has-text("Create Account"), button[type="submit"]:has-text("Sign Up")')
    ).toBeVisible();
  });

  test('registration validates empty submit', async ({ page }) => {
    await page.goto('/auth/login?register=true&type=business&plan=starter');
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 15000 });

    const submit = page.locator(
      'button[type="submit"]:has-text("Create Account"), button[type="submit"]:has-text("Sign Up")'
    );
    await submit.click();

    await expect(page).toHaveURL(/register=true/);
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });
});

test.describe('Admin API security', () => {
  test('unauthenticated admin tenants API returns 401', async ({ request }) => {
    const res = await request.get('/api/admin/tenants');
    expect(res.status()).toBe(401);
  });

  test('unauthenticated admin security-logs API returns 401', async ({ request }) => {
    const res = await request.get('/api/admin/security-logs');
    expect(res.status()).toBe(401);
  });

  test('unauthenticated bonnie quota requires auth', async ({ request }) => {
    const res = await request.get('/api/bonnie/quota?tenantId=00000000-0000-0000-0000-000000000001');
    expect([401, 403]).toContain(res.status());
  });
});
