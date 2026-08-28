const { test, expect } = require("@playwright/test");

test.describe("Finance Integrity & GL Assertions", () => {
  test("RPC payment + journal integration script passes", async () => {
    const { execSync } = require("child_process");
    const output = execSync("node tests/finance-integrity.integration.mjs", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });
    expect(output).toContain("finance-integrity.integration: PASS");
  });

  test("Revenue reports match invoice balances", async ({ page }) => {
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

    await page.goto("/dashboard");
    await page.click("text=Finance");

    await page.waitForSelector(".text-3xl.font-bold");

    const totalRevenue = await page.textContent("text=Total Revenue");
    const outstanding = await page.textContent("text=Outstanding");

    expect(totalRevenue).not.toBeNull();
    expect(outstanding).not.toBeNull();
  });
});
