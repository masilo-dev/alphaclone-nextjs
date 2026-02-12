const { test, expect } = require('@playwright/test');

test.describe('Mobile Production Readiness', () => {
    test.beforeEach(async ({ page }) => {
        // Pre-seed localStorage to bypass onboarding/welcome
        await page.addInitScript(() => {
            const userId = 'df841125-59ce-4e09-aa2d-5b746ec03d9b';
            localStorage.setItem(`welcome_seen_${userId}`, 'true');
            localStorage.setItem(`onboarding_completed_${userId}`, 'true');
            localStorage.setItem('onboarding_completed', 'true');
        });

        await page.goto('/login');
        await page.fill('input[type="email"]', process.env.TENANT_EMAIL || 'admin@alphaclone.io');
        await page.fill('input[type="password"]', process.env.TENANT_PASSWORD || 'Password123!');
        await page.click('button[type="submit"]:has-text("Sign In")');
        await expect(page).toHaveURL(/\/dashboard/);
    });

    test('CRM Client Import visibility on mobile', async ({ page }) => {
        await page.click('button[aria-label="Menu"], .hamburger');
        await page.click('text=CRM');

        // Wait for CRM tab to load
        await expect(page.locator('text=CRM Management')).toBeVisible();

        // Check for Import button
        const importBtn = page.locator('button:has-text("Import Clients")');
        await expect(importBtn).toBeVisible();
        await importBtn.click();

        // Modal should appear
        await expect(page.locator('text=Import Business Clients')).toBeVisible();
        await expect(page.locator('text=Drop CSV or Excel files')).toBeVisible();
    });

    test('Reports and Exports on mobile', async ({ page }) => {
        // Check Finance exports
        await page.click('button[aria-label="Menu"], .hamburger');
        await page.click('text=Finance');
        await expect(page.locator('text=Financial Center')).toBeVisible();

        await expect(page.locator('button:has-text("Export PDF")')).toBeVisible();
        await expect(page.locator('button:has-text("Export Excel")')).toBeVisible();

        // Check Analytics exports
        await page.click('button[aria-label="Menu"], .hamburger');
        await page.click('text=Analytics');
        await expect(page.locator('text=Live Operations')).toBeVisible();

        await expect(page.locator('button:has-text("PDF")')).toBeVisible();
        await expect(page.locator('button:has-text("Excel")')).toBeVisible();
    });

    test('Gmail connection state on mobile', async ({ page }) => {
        await page.click('button[aria-label="Menu"], .hamburger');
        await page.click('text=Communications');

        await expect(page.locator('text=Communication Center')).toBeVisible();

        // Check for Gmail button
        const gmailBtn = page.locator('button:has-text("Connect Gmail")');
        if (await gmailBtn.count() > 0) {
            await expect(gmailBtn).toBeVisible();
        } else {
            await expect(page.locator('text=Gmail Connected')).toBeVisible();
        }
    });
});
