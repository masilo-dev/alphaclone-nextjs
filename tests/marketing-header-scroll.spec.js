const { test, expect } = require('@playwright/test');

test('marketing header compacts on scroll and leaves anchor targets visible', async ({ page }) => {
  await page.goto('/');
  const header = page.locator('header.mkt-header-redesign');
  await expect(header).not.toHaveClass(/is-compact/);

  await page.evaluate(() => window.scrollTo(0, 500));
  await expect(header).toHaveClass(/is-compact/);
  await expect.poll(() => header.evaluate((el) => Math.round(el.getBoundingClientRect().height))).toBe(56);

  await page.locator('a[href="#workflow"]').first().click();
  const workflow = page.locator('#workflow');
  await expect.poll(() => workflow.evaluate((el) => Math.round(el.getBoundingClientRect().top))).toBeGreaterThanOrEqual(56);
});

test('laptop navigation moves into the sheet before labels wrap', async ({ page }) => {
  await page.setViewportSize({ width: 1360, height: 900 });
  await page.goto('/');
  await expect(page.locator('.mkt-nav-redesign')).toBeHidden();
  await page.getByRole('button', { name: 'Open navigation menu' }).click();
  await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toBeVisible();
  await expect(page.locator('.mkt-mobile-sheet-redesign select')).toBeVisible();
});

test('public marketing pages do not cover content with an install prompt', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(2000);
  await expect(page.getByRole('button', { name: 'Dismiss install prompt' })).toHaveCount(0);
});
