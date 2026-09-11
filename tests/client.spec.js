const { test, expect } = require('@playwright/test');

test.describe('Client Dashboard Audit', () => {
    test.beforeEach(async ({ page }) => {
        // Pre-seed localStorage to bypass onboarding
        await page.addInitScript(() => {
            const userId = 'b4178de0-bb15-4d35-b145-d34af69bedea'; // Client User ID
            localStorage.setItem(`welcome_seen_${userId}`, 'true');
            localStorage.setItem(`onboarding_completed_${userId}`, 'true');
            localStorage.setItem('onboarding_completed', 'true');
        });

        await page.goto('/login');
        await page.fill('input[type="email"]', process.env.CLIENT_EMAIL);
        await page.fill('input[type="password"]', process.env.CLIENT_PASSWORD);
        await page.click('button[type="submit"]:has-text("Sign In")');
        await expect(page).toHaveURL(/\/dashboard/, { timeout: 30000 });

        // Wait for Alpha OS loading screen to disappear
        await expect(page.locator('text=Alpha OS')).toBeHidden({ timeout: 60000 });

        // Handle potential Welcome Modal (Enter Dashboard)
        const enterDashboardBtn = page.locator('button:has-text("Enter Dashboard")');
        if (await enterDashboardBtn.count() > 0 && await enterDashboardBtn.isVisible()) {
            await enterDashboardBtn.click();
            await page.waitForTimeout(1000);
        }

        // Handle potential Onboarding Flow (Skip)
        const skipBtn = page.locator('button:has-text("Skip Onboarding"), button:has-text("Skip")');
        if (await skipBtn.count() > 0 && await skipBtn.isVisible()) {
            await skipBtn.click();
            await page.waitForTimeout(1000);
        }

        await expect(page.locator('#main-content')).toBeVisible({ timeout: 20000 });
        await page.waitForTimeout(2000); // Allow session/state to fully settle
    });

    test('Navigation: Core pages load', async ({ page }) => {
        const pages = [
            '/dashboard', '/dashboard/projects', '/dashboard/calendar',
            '/dashboard/finance', '/dashboard/contracts', '/dashboard/ai-studio',
            '/dashboard/messages', '/dashboard/conference', '/dashboard/submit',
            '/dashboard/settings'
        ];

        for (const p of pages) {
            await page.goto(p, { timeout: 60000 });

            // Wait for any loading states specific to the dashboard page component
            await expect(page.locator('text=Establishing Neural Link')).toHaveCount(0, { timeout: 20000 });
            await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });

            await expect(page.locator('body')).not.toContainText('404', { timeout: 5000 });

            // Basic UI check to ensure it's not a blank page
            await expect(page.locator('header, nav, #main-content')).not.toHaveCount(0, { timeout: 5000 });
        }
    });

    test('Core Flow: My Projects Details', async ({ page }) => {
        await page.goto('/dashboard/projects');
        await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });

        // Wait for projects list to load
        await page.waitForTimeout(1000);

        // Try to click a project if any exist
        const projectItem = page.locator('.project-card, tr.project-row, [data-testid="project-item"]').first();
        if (await projectItem.count() > 0) {
            await projectItem.click();
            // Should stay within dashboard or go to a subpage
            await expect(page).toHaveURL(/\/dashboard\/projects\/.+/);
        } else {
            console.warn('No projects found for client audit');
        }
    });

    test('Core Flow: Submit Request', async ({ page }) => {
        await page.goto('/dashboard/submit');
        await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });

        // The submit tab has a specific form
        await expect(page.locator('text=Project Details, text=Submit New Project')).not.toHaveCount(0);

        // Fill form if fields are visible
        const subject = page.locator('input[name="subject"], input[placeholder*="Name"]');
        if (await subject.count() > 0) {
            await subject.fill('Audit Request');
            // ... fill more if needed
        }
    });
});
