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

test('marketing navigation remains visible at laptop widths', async ({ page }) => {
  await page.goto('/');
  for (const width of [1200, 1280, 1360]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.locator('.mkt-nav-redesign')).toBeVisible();
    await expect(page.locator('.mkt-header-actions-redesign')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open navigation menu' })).toBeHidden();
    const fits = await page.locator('.mkt-header-bar').evaluate((bar) => {
      const nav = bar.querySelector('.mkt-nav-redesign');
      const actions = bar.querySelector('.mkt-header-actions-redesign');
      return nav.getBoundingClientRect().right <= actions.getBoundingClientRect().left;
    });
    expect(fits).toBe(true);
  }
});

test('marketing navigation uses the sheet at narrow widths', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 900 });
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
