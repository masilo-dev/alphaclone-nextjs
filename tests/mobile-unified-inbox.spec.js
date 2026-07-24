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

  test("Mobile: folder tabs remain tappable", async ({ page }) => {
    await page.goto("/dashboard/mail");
    const sentTab = page.getByRole("tab", { name: "sent" });
    if (await sentTab.isVisible()) {
      await sentTab.click();
      await expect(sentTab).toHaveAttribute("aria-selected", "true");
    }
  });
});
