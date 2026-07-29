const { test, expect } = require("@playwright/test");

async function openMobileMenu(page) {
<<<<<<< HEAD
  const menuButton = page.locator('button[aria-label="Menu"]');
  await expect(menuButton).toBeVisible();
  await menuButton.click();
}
=======
    const menuButton = page.locator('button[aria-label="Menu"]');
    await expect(menuButton).toBeVisible();
    await menuButton.click();
}

async function navigateViaShell(page, sectionLabel, itemLabel, expectedUrl) {
    await openMobileMenu(page);
    await page.getByRole('button', { name: sectionLabel }).click();
    await page.getByRole('button', { name: itemLabel }).click();
    await expect(page).toHaveURL(new RegExp(expectedUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
}

test.describe('Mobile Production Readiness', () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
            const userId = 'df841125-59ce-4e09-aa2d-5b746ec03d9b';
            localStorage.setItem(`welcome_seen_${userId}`, 'true');
            localStorage.setItem(`onboarding_completed_${userId}`, 'true');
            localStorage.setItem('onboarding_completed', 'true');
        });
>>>>>>> origin/main

async function navigateViaShell(page, sectionLabel, itemLabel, expectedUrl) {
  await openMobileMenu(page);
  await page.getByRole("button", { name: sectionLabel }).click();
  await page.getByRole("button", { name: itemLabel }).click();
  await expect(page).toHaveURL(
    new RegExp(expectedUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
  );
}

test.describe("Mobile Production Readiness", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const userId = "df841125-59ce-4e09-aa2d-5b746ec03d9b";
      localStorage.setItem(`welcome_seen_${userId}`, "true");
      localStorage.setItem(`onboarding_completed_${userId}`, "true");
      localStorage.setItem("onboarding_completed", "true");
    });

<<<<<<< HEAD
    await page.goto("/login");
    await page.fill(
      'input[type="email"]',
      process.env.TENANT_EMAIL || "admin@alphaclone.io",
    );
    await page.fill(
      'input[type="password"]',
      process.env.TENANT_PASSWORD || "Password123!",
    );
    await page.click('button[type="submit"]:has-text("Sign In")');
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("Contacts import flow is reachable from the current mobile CRM shell", async ({
    page,
  }) => {
    await navigateViaShell(
      page,
      "Acquire and nurture",
      "Step 2: Capture contacts",
      "/dashboard/contacts",
    );

    await expect(page.getByText("Contacts")).toBeVisible();
    const importButton = page.getByRole("button", { name: "Import" });
    await expect(importButton).toBeVisible();
    await importButton.click();

    await expect(page.getByText("Import Clients")).toBeVisible();
  });

  test("Revenue shell routes load on mobile without blank states", async ({
    page,
  }) => {
    await navigateViaShell(
      page,
      "Revenue and legal",
      "Billing Center",
      "/dashboard/business/billing",
    );
    await expect(page.getByText("Billing Hub")).toBeVisible();

    await navigateViaShell(
      page,
      "Revenue and legal",
      "Revenue Analytics",
      "/dashboard/business/daily-summary",
    );
    await expect(page.getByText("Daily Summary Dashboard")).toBeVisible();
  });

  test("Mail entry point stays reachable from the current mobile shell", async ({
    page,
  }) => {
    await navigateViaShell(
      page,
      "Acquire and nurture",
      "Gmail",
      "/dashboard/mail",
    );

    const connectState = page.getByText("Unified Communication Hub");
    const inboxState = page.getByText("Inbox");
    await expect(connectState.or(inboxState).first()).toBeVisible();
  });
=======
    test('Contacts import flow is reachable from the current mobile CRM shell', async ({ page }) => {
        await navigateViaShell(page, 'Acquire and nurture', 'Step 2: Capture contacts', '/dashboard/contacts');

        await expect(page.getByText('Contacts')).toBeVisible();
        const importButton = page.getByRole('button', { name: 'Import' });
        await expect(importButton).toBeVisible();
        await importButton.click();

        await expect(page.getByText('Import Clients')).toBeVisible();
    });

    test('Revenue shell routes load on mobile without blank states', async ({ page }) => {
        await navigateViaShell(page, 'Revenue and legal', 'Billing Center', '/dashboard/business/billing');
        await expect(page.getByText('Billing Hub')).toBeVisible();

        await navigateViaShell(page, 'Revenue and legal', 'Revenue Analytics', '/dashboard/business/daily-summary');
        await expect(page.getByText('Daily Summary Dashboard')).toBeVisible();
    });

    test('Mail entry point stays reachable from the current mobile shell', async ({ page }) => {
        await navigateViaShell(page, 'Acquire and nurture', 'Gmail', '/dashboard/mail');

        const connectState = page.getByText('Unified Communication Hub');
        const inboxState = page.getByText('Inbox');
        await expect(connectState.or(inboxState).first()).toBeVisible();
    });
>>>>>>> origin/main
});
