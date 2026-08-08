const { test, expect } = require("@playwright/test");

const email = process.env.TEST_USER_EMAIL;
const password = process.env.TEST_USER_PASSWORD;
const hasCredentials = Boolean(email && password);

test.describe("Mobile unified inbox", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test.skip(!hasCredentials, "Missing TEST_USER_EMAIL/TEST_USER_PASSWORD");
  test.setTimeout(120000);

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("onboarding_completed", "true");
    });
    await page.goto("/auth/login");
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
  });

  test("Mail inbox is usable on mobile viewport", async ({ page }) => {
    await page.goto("/dashboard/mail");
    await expect(page.getByRole("tab", { name: "Mailbox" })).toBeVisible({
      timeout: 15000,
    });
    await expect(
      page.getByRole("button", { name: /Compose/i }).first(),
    ).toBeVisible();

    await page.getByRole("tab", { name: "All channels" }).click();
    await expect(
      page.getByRole("tab", { name: "All channels" }),
    ).toHaveAttribute("aria-selected", "true");
  });

  test("Desktop mail keeps scrolling inside the inbox, not the dashboard shell", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/dashboard/mail");
    await expect(
      page.getByRole("region", { name: "Email mailbox" }),
    ).toBeVisible({
      timeout: 15000,
    });

    const mainOverflow = await page.locator("#main-content").evaluate((el) => {
      const style = window.getComputedStyle(el);
      return {
        overflowY: style.overflowY,
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
      };
    });
    expect(mainOverflow.overflowY).toBe("hidden");
    expect(mainOverflow.scrollHeight).toBeLessThanOrEqual(
      mainOverflow.clientHeight + 8,
    );

    const scrollablePaneCount = await page
      .locator(
        '[role="list"][aria-label$="messages"], [aria-label="Email mailbox"] .overflow-y-auto',
      )
      .count();
    expect(scrollablePaneCount).toBeGreaterThan(0);
  });

  test("Desktop business messages uses a contained chat scroller", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/dashboard/business/messages");
    await expect(page.locator("#main-content")).toBeVisible({ timeout: 15000 });

    const mainOverflow = await page.locator("#main-content").evaluate((el) => {
      const style = window.getComputedStyle(el);
      return {
        overflowY: style.overflowY,
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
      };
    });
    expect(mainOverflow.overflowY).toBe("hidden");
    expect(mainOverflow.scrollHeight).toBeLessThanOrEqual(
      mainOverflow.clientHeight + 8,
    );

    await expect(page.locator('[data-tour="messages"]')).toBeVisible({
      timeout: 15000,
    });
  });

  test("Mobile: folder tabs remain tappable", async ({ page }) => {
    await page.goto("/dashboard/mail");
    const sentTab = page.getByRole("tab", { name: "sent" });
    if (await sentTab.isVisible()) {
      await sentTab.click();
      await expect(sentTab).toHaveAttribute("aria-selected", "true");
    }
  });
});
