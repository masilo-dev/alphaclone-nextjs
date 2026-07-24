const { test, expect } = require("@playwright/test");

test.describe("Mobile Sanity Check", () => {
  // Config uses devices['iPhone 12'] so viewport is already set

  test("Login and Menu Interaction", async ({ page }) => {
    // Pre-seed localStorage
    await page.addInitScript(() => {
      const userId = "d8fd4aea-2987-4313-90e2-e6600539ec56";
      localStorage.setItem(`welcome_seen_${userId}`, "true");
      localStorage.setItem(`onboarding_completed_${userId}`, "true");
      localStorage.setItem("onboarding_completed", "true");
    });

    await page.goto("/auth/login");
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('button:has-text("Sign In")')).toBeVisible();

    await page.fill('input[type="email"]', process.env.TENANT_EMAIL);
    await page.fill('input[type="password"]', process.env.TENANT_PASSWORD);
    await page.click('button[type="submit"]:has-text("Sign In")');
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30000 });

    await expect(page.locator("text=Alpha OS")).toBeHidden({ timeout: 60000 });

    const enterDashboardBtn = page.locator(
      'button:has-text("Enter Dashboard")',
    );
    if (
      (await enterDashboardBtn.count()) > 0 &&
      (await enterDashboardBtn.isVisible())
    ) {
      await enterDashboardBtn.click();
      await page.waitForTimeout(1000);
    }

    const skipBtn = page.locator(
      'button:has-text("Skip Onboarding"), button:has-text("Skip")',
    );
    if ((await skipBtn.count()) > 0 && (await skipBtn.isVisible())) {
      await skipBtn.click();
      await page.waitForTimeout(1000);
    }

    await expect(page.locator("main").first()).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(2000); // Allow session to settle

    // Mobile shell uses compact icon sidebar navigation (no hamburger drawer).
    const width = page.viewportSize().width;
    if (width < 768) {
      await expect(
        page.getByRole("button", { name: "Workspace home" }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Bonnie AI", exact: true }),
      ).toBeVisible();
      await expect(page.getByRole("button", { name: "Log Out" })).toBeVisible();
    }
  });

  test("No horizontal scrolling on Dashboard", async ({ page }) => {
    await page.goto("/auth/login");
    await page.fill('input[type="email"]', process.env.TENANT_EMAIL);
    await page.fill('input[type="password"]', process.env.TENANT_PASSWORD);
    await page.click('button[type="submit"]:has-text("Sign In")');
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30000 });

    // Wait for Alpha OS loading screen to disappear
    await expect(page.locator("text=Alpha OS")).toBeHidden({ timeout: 60000 });

    // Handle potential Welcome Modal
    const skipBtn = page.locator(
      'button:has-text("Skip Onboarding"), button:has-text("Skip")',
    );
    if ((await skipBtn.count()) > 0) {
      await skipBtn.click();
      await page.waitForTimeout(1000); // Allow animation
    }

    await expect(page.locator("main").first()).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(2000); // Allow session to settle

    await page.goto("/dashboard");

    await page.waitForTimeout(2000); // Wait for layout settling

    const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const clientWidth = await page.evaluate(() => document.body.clientWidth);

    // Allow small buffer for scrollbar/rounding
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5);
  });
});
