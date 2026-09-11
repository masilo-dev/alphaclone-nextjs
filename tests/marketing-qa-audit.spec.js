/**
 * Marketing site Q/A audit — full usage paths against localhost.
 * Run: npx playwright test tests/marketing-qa-audit.spec.js --project=chromium --retries=0
 */
const { test, expect } = require('@playwright/test');

const BASE = process.env.PLAYWRIGHT_BASE_URL || process.env.BASE_URL || 'http://127.0.0.1:3000';

async function dismissCookieIfPresent(page) {
  const accept = page.getByRole('button', { name: /Accept All/i }).first();
  if (await accept.isVisible({ timeout: 2500 }).catch(() => false)) {
    await accept.click({ force: true }).catch(() => {});
    await page.waitForTimeout(250);
  }
  // Ensure banner is out of the way for subsequent clicks
  await page.locator('[aria-label*="cookie" i], text=Cookie preferences').first()
    .waitFor({ state: 'hidden', timeout: 3000 })
    .catch(() => {});
}

function trackErrors(page) {
  const errors = [];
  page.on('pageerror', (err) => {
    const text = String(err?.message || err);
    if (
      /Supabase credentials are missing|Supabase is not configured|Invalid or unexpected token|lockdown|SES_/i.test(
        text,
      )
    ) {
      return;
    }
    errors.push(text);
  });
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (
      /Supabase credentials are missing|Supabase is not configured|Download the React DevTools|webpack-hmr|WebSocket connection|ERR_INVALID_HTTP_RESPONSE|Fast Refresh|Local setup required|Invalid or unexpected token/i.test(
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
    test.setTimeout(60000);
    const errors = trackErrors(page);
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await dismissCookieIfPresent(page);

    await expect(page.locator('h1')).toContainText(/Run your entire business/i);
    await expect(page.locator('.mkt-shell, .mkt-marketing-background').first()).toBeAttached();
    await expect(page.locator('.hero-data-wave').first()).toBeAttached();
    await expect(page.locator('.mkt-hero--compact').first()).toBeVisible();
    await expect(page.locator('.mkt-bg-orb').first()).toBeAttached();
    await expect(page.locator('.hero-data-wave-drift--left').first()).toBeAttached();
    await expect(page.locator('.mkt-feature-card .alpha-icon').first()).toBeVisible();
    await expect(page.locator('.mkt-feature-card').first()).toBeVisible();
    await expect(page.locator('.mkt-preview')).toHaveCount(0);

    // Atmosphere motion should be active (not reduced-motion in CI chromium)
    const waveAnim = await page.locator('.hero-data-wave-drift--left').first().evaluate((el) => {
      const style = getComputedStyle(el);
      return style.animationName;
    });
    expect(waveAnim).toMatch(/mkt-wave-drift/i);
    const orbAnim = await page.locator('.mkt-bg-orb--a').evaluate((el) => getComputedStyle(el).animationName);
    expect(orbAnim).toMatch(/mkt-orb-drift/i);
    await expect(page.locator('.mkt-partner-chip').first()).toBeVisible();
    await expect(page.getByText('Facebook', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Stripe', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Microsoft 365', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Slack', { exact: true }).first()).toBeVisible();

    // Click / press motion on partner chips (CSS :active) — don't release on the link
    const chip = page.locator('.mkt-partner-chip').first();
    await chip.scrollIntoViewIfNeeded();
    const box = await chip.boundingBox();
    expect(box).toBeTruthy();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    const pressMotion = await chip.evaluate((el) => ({
      transform: getComputedStyle(el).transform,
      animation: getComputedStyle(el).animationName,
      href: el.getAttribute('href'),
      hasBurst: Boolean(el.querySelector('.mkt-partner-chip-burst')),
    }));
    // Move off the chip before mouseup so we don't navigate to /ecosystem
    await page.mouse.move(8, 8);
    await page.mouse.up();
    expect(pressMotion.href).toBe('/ecosystem');
    expect(pressMotion.hasBurst).toBe(true);
    expect(pressMotion.animation).toMatch(/mkt-chip-click/i);
    expect(pressMotion.transform).not.toBe('none');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('link', { name: /Start free for 14 days/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Book a demo/i }).first()).toBeVisible();

    expect(errors, `Homepage errors: ${errors.join(' | ')}`).toEqual([]);
  });

  test('2) Header Product dropdown + nav icons', async ({ page }) => {
    test.setTimeout(60000);
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    await dismissCookieIfPresent(page);

    const productTrigger = page.locator('details.mkt-nav-item', { hasText: 'Product' }).locator('summary');
    await expect(productTrigger).toBeVisible({ timeout: 15000 });
    await productTrigger.click();
    const menu = page.locator('#marketing-nav-product').first();
    await expect(menu).toBeVisible({ timeout: 10000 });
    await expect(menu.locator('.alpha-icon').first()).toBeVisible();
    // Menu links use role="menuitem"
    await menu.getByRole('menuitem', { name: /^CRM$/i }).click();
    await expect(page).toHaveURL(/\/crm/, { timeout: 15000 });
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
