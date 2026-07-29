<<<<<<< HEAD
const { test, expect } = require("@playwright/test");

test.describe("Mobile Audit & Restoration Verification", () => {
=======
const { test, expect } = require('@playwright/test');

test.describe('Mobile Audit & Restoration Verification', () => {
>>>>>>> origin/main
  test.use({ viewport: { width: 390, height: 844 } }); // iPhone 12 viewport

  test.beforeEach(async ({ page }) => {
    // Inject bypass for onboarding/welcome
    await page.addInitScript(() => {
<<<<<<< HEAD
      const userId = "audit-test-user";
      localStorage.setItem(`welcome_seen_${userId}`, "true");
      localStorage.setItem(`onboarding_completed_${userId}`, "true");
      localStorage.setItem("onboarding_completed", "true");
    });

    await page.goto("/auth/login");
    const email = process.env.TEST_USER_EMAIL;
    const password = process.env.TEST_USER_PASSWORD;
    if (!email || !password)
      test.skip(true, "Missing TEST_USER_EMAIL/TEST_USER_PASSWORD");

    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');

=======
      const userId = 'audit-test-user';
      localStorage.setItem(`welcome_seen_${userId}`, 'true');
      localStorage.setItem(`onboarding_completed_${userId}`, 'true');
      localStorage.setItem('onboarding_completed', 'true');
    });

    await page.goto('/auth/login');
    // Use environment variables or provided credentials
    const email = process.env.TEST_USER_EMAIL || 'inf@movanah.eu';
    const password = process.env.TEST_USER_PASSWORD || 'Masilo@2';
    
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    
>>>>>>> origin/main
    // Wait for dashboard or redirect
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
  });

<<<<<<< HEAD
  test("Lead Finder functionality check", async ({ page }) => {
    // Navigate to Sales Agent / Lead Finder
    await page.goto("/dashboard/leads/find");

    // Check if the search input is visible
    const searchInput = page.locator('input[placeholder*="niche"]');
    await expect(searchInput).toBeVisible();

    // Perform a search
    await searchInput.fill("Plumbers");
    const locationInput = page.locator('input[placeholder*="location"]');
    await locationInput.fill("Austin, TX");

    await page.click('button:has-text("Find Leads")');

    // Check for results or loading state
    // We expect the results to appear eventually
    const resultsContainer = page.locator(
      ".lead-results-container, .leads-list",
    );
    await expect(resultsContainer).toBeVisible({ timeout: 30000 });
  });

  test("Accessibility: Font size verification", async ({ page }) => {
    await page.goto("/dashboard");

    // Check various elements for minimum font size (12px)
    const smallTextElements = await page.evaluate(() => {
      const all = document.querySelectorAll("*");
=======
  test('Lead Finder functionality check', async ({ page }) => {
    // Navigate to Sales Agent / Lead Finder
    await page.goto('/dashboard/leads/find');
    
    // Check if the search input is visible
    const searchInput = page.locator('input[placeholder*="niche"]');
    await expect(searchInput).toBeVisible();
    
    // Perform a search
    await searchInput.fill('Plumbers');
    const locationInput = page.locator('input[placeholder*="location"]');
    await locationInput.fill('Austin, TX');
    
    await page.click('button:has-text("Find Leads")');
    
    // Check for results or loading state
    // We expect the results to appear eventually
    const resultsContainer = page.locator('.lead-results-container, .leads-list');
    await expect(resultsContainer).toBeVisible({ timeout: 30000 });
  });

  test('Accessibility: Font size verification', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Check various elements for minimum font size (12px)
    const smallTextElements = await page.evaluate(() => {
      const all = document.querySelectorAll('*');
>>>>>>> origin/main
      const tooSmall = [];
      for (const el of all) {
        const style = window.getComputedStyle(el);
        const fontSize = parseFloat(style.fontSize);
<<<<<<< HEAD
        if (fontSize > 0 && fontSize < 11.5) {
          // Allowing a tiny bit of rounding slack
          // Ignore icons or specific small decorators if they are not meant to be read
          if (el.tagName !== "svg" && el.innerText.trim().length > 0) {
            tooSmall.push({
              tag: el.tagName,
              text: el.innerText.substring(0, 20),
              size: style.fontSize,
=======
        if (fontSize > 0 && fontSize < 11.5) { // Allowing a tiny bit of rounding slack
          // Ignore icons or specific small decorators if they are not meant to be read
          if (el.tagName !== 'svg' && el.innerText.trim().length > 0) {
            tooSmall.push({
              tag: el.tagName,
              text: el.innerText.substring(0, 20),
              size: style.fontSize
>>>>>>> origin/main
            });
          }
        }
      }
      return tooSmall;
    });
<<<<<<< HEAD

    expect(
      smallTextElements.length,
      `Found ${smallTextElements.length} elements with font size < 12px: ${JSON.stringify(smallTextElements.slice(0, 5))}`,
    ).toBe(0);
  });

  test("Mobile Navigation: Sidebar responsiveness", async ({ page }) => {
    // Open sidebar via hamburger (if collapsed)
    const menuButton = page.locator(
      'button[aria-label="Menu"], button:has(.lucide-menu)',
    );
    if (await menuButton.isVisible()) {
      await menuButton.click();
    }

    // Check if sidebar is open
    const sidebar = page.locator("aside");
    await expect(sidebar).toBeVisible();

    // Click a navigation item
    const crmLink = page.getByRole("button", { name: /CRM|Contacts/i });
    await crmLink.click();

=======
    
    expect(smallTextElements.length, `Found ${smallTextElements.length} elements with font size < 12px: ${JSON.stringify(smallTextElements.slice(0, 5))}`).toBe(0);
  });

  test('Mobile Navigation: Sidebar responsiveness', async ({ page }) => {
    // Open sidebar via hamburger (if collapsed)
    const menuButton = page.locator('button[aria-label="Menu"], button:has(.lucide-menu)');
    if (await menuButton.isVisible()) {
      await menuButton.click();
    }
    
    // Check if sidebar is open
    const sidebar = page.locator('aside');
    await expect(sidebar).toBeVisible();
    
    // Click a navigation item
    const crmLink = page.getByRole('button', { name: /CRM|Contacts/i });
    await crmLink.click();
    
>>>>>>> origin/main
    // Verify navigation and sidebar closing (on mobile)
    await expect(page).toHaveURL(/\/dashboard\/(crm|contacts)/);
    // On mobile, the sidebar should auto-close
    await expect(sidebar).not.toBeVisible();
  });
});
