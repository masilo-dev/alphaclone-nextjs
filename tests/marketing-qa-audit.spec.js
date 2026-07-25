/**
 * Marketing site Q/A audit — full usage paths against localhost.
 * Run: npx playwright test tests/marketing-qa-audit.spec.js --project=chromium --retries=0
 */
const { test, expect } = require('@playwright/test');

const BASE = process.env.PLAYWRIGHT_BASE_URL || process.env.BASE_URL || 'http://127.0.0.1:3000';

async function dismissCookieIfPresent(page) {
  const accept = page.getByRole('button', { name: /Accept All/i }).first();
  if (await accept.isVisible({ timeout: 2000 }).catch(() => false)) {
    await accept.click().catch(() => {});
    await page.waitForTimeout(200);
  }
}

function trackErrors(page) {
  const errors = [];
  page.on('pageerror', (err) => errors.push(String(err?.message || err)));
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (
      /Supabase credentials are missing|Supabase is not configured|Download the React DevTools|webpack-hmr|WebSocket connection|ERR_INVALID_HTTP_RESPONSE|Fast Refresh|Local setup required/i.test(
        text,
      )
    ) {
      return;
    }
    if (/Failed to load resource.*favicon/i.test(text)) return;
    errors.push(text);
  });
  return errors;
}

test.use({ viewport: { width: 1440, height: 900 } });

test.describe('Marketing Q/A audit', () => {
  test('1) Homepage loads with atmosphere + custom icons', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    await dismissCookieIfPresent(page);

    await expect(page.locator('h1')).toContainText(/Run your entire business/i);
    await expect(page.locator('.mkt-shell, .mkt-marketing-background').first()).toBeAttached();
    await expect(page.locator('.hero-data-wave').first()).toBeAttached();
    await expect(page.locator('.mkt-feature-card .alpha-icon').first()).toBeVisible();
    await expect(page.locator('.mkt-feature-card').first()).toBeVisible();
    await expect(page.locator('.mkt-preview').first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Start free for 14 days/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Book a demo/i }).first()).toBeVisible();

    expect(errors, `Homepage errors: ${errors.join(' | ')}`).toEqual([]);
  });

  test('2) Header Product dropdown + nav icons', async ({ page }) => {
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    await dismissCookieIfPresent(page);

    const productTrigger = page.locator('details.mkt-nav-item', { hasText: 'Product' }).locator('summary');
    await expect(productTrigger).toBeVisible();
    await productTrigger.click();
    await expect(page.locator('#marketing-nav-product, .mkt-simple-menu').first()).toBeVisible();
    await expect(page.locator('.mkt-simple-menu .alpha-icon').first()).toBeVisible();
    await page.getByRole('link', { name: /^CRM$/i }).first().click();
    await expect(page).toHaveURL(/\/crm/);
  });

  test('3) Pricing page usable', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto(`${BASE}/pricing`, { waitUntil: 'domcontentloaded' });
    await dismissCookieIfPresent(page);

    await expect(page.locator('h1, h2').filter({ hasText: /pricing|plan/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Start free|trial|Get started/i }).first()).toBeVisible();
    await expect(page.locator('.mkt-price-card, article').first()).toBeVisible();
    expect(errors, `Pricing errors: ${errors.join(' | ')}`).toEqual([]);
  });

  test('4) Login page UI loads (local setup banner OK)', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto(`${BASE}/auth/login`, { waitUntil: 'domcontentloaded' });
    await dismissCookieIfPresent(page);

    const email = page.locator('input[type="email"], input[name="email"]').first();
    await expect(email).toBeVisible();
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
    await expect(page.locator('button[type="submit"]').first()).toBeVisible();
    await email.fill('qa@example.com');
    await expect(email).toHaveValue('qa@example.com');
    expect(errors, `Login errors: ${errors.join(' | ')}`).toEqual([]);
  });

  test('5) Trial CTA routes to register login', async ({ page }) => {
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    await dismissCookieIfPresent(page);
    await page.getByRole('link', { name: /Start free for 14 days/i }).first().click();
    await expect(page).toHaveURL(/\/auth\/login/);
    expect(page.url()).toMatch(/register=true|plan=/i);
  });

  test('6) Demo CTA routes to booking', async ({ page }) => {
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    await dismissCookieIfPresent(page);
    await page.getByRole('link', { name: /Book a demo/i }).first().click();
    await expect(page).toHaveURL(/book-demo|\/book|\/demo/i);
  });

  test('7) Marketing pages respond OK', async ({ request }) => {
    test.setTimeout(180000);
    const paths = [
      '/',
      '/pricing',
      '/about',
      '/contact',
      '/crm',
      '/faq',
      '/ecosystem',
      '/who-we-serve',
      '/auth/login',
      '/security-policy',
      '/book-demo',
    ];
    for (const path of paths) {
      let lastError = null;
      let ok = false;
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
          const res = await request.get(`${BASE}${path}`, { timeout: 45000 });
          expect(res.status(), `${path} => ${res.status()}`).toBeLessThan(400);
          ok = true;
          break;
        } catch (error) {
          lastError = error;
          await new Promise((resolve) => setTimeout(resolve, 750 * attempt));
        }
      }
      if (!ok) throw lastError;
    }
  });

  test('8) Mobile homepage — no horizontal overflow, menu usable', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    await dismissCookieIfPresent(page);

    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 2);

    await expect(page.locator('h1')).toBeVisible();
    await expect(page.getByRole('link', { name: /Start free for 14 days/i }).first()).toBeVisible();

    const menuBtn = page.getByRole('button', { name: /Open navigation|menu/i });
    await expect(menuBtn).toBeVisible();
    await menuBtn.click();
    await expect(page.getByRole('link', { name: /Start free for 14 days/i }).first()).toBeVisible();
  });

  test('9) FAQ accordion expands', async ({ page }) => {
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    await dismissCookieIfPresent(page);
    const faq = page.locator('#faq');
    await faq.scrollIntoViewIfNeeded();
    const trigger = faq.locator('button, [role="button"]').first();
    await expect(trigger).toBeVisible();
    await trigger.click();
    await expect(faq).toContainText(/trial|card|cancel|plan|data|Yes/i);
  });

  test('10) Contact page form fields present', async ({ page }) => {
    await page.goto(`${BASE}/contact`, { waitUntil: 'domcontentloaded' });
    await dismissCookieIfPresent(page);
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('input[name="name"], input[placeholder*="Name" i]').first()).toBeVisible();
    await expect(page.locator('input[type="email"], input[name="email"]').first()).toBeVisible();
    await expect(page.locator('textarea, [name="message"]').first()).toBeVisible();
  });

  test('11) How-it-works display icons mount', async ({ page }) => {
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    await dismissCookieIfPresent(page);
    await page.locator('#how-it-works').scrollIntoViewIfNeeded();
    await expect(page.locator('#how-it-works .mkt-step').first()).toBeVisible();
    // Display icons are lg:flex — on 1440 they should show
    await expect(page.locator('#how-it-works .alpha-icon').first()).toBeVisible();
  });
});
