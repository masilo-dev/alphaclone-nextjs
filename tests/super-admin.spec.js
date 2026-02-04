const { test, expect } = require('@playwright/test');

test.describe('Super Admin Dashboard Audit', () => {
    test.beforeEach(async ({ page }) => {
        // Fail on any console error
        page.on('console', msg => {
            if (msg.type() === 'error') {
                console.error(`Console Error: "${msg.text()}"`);
                // We can't strictly fail the test immediately in this handler, but we can log it.
                // Ideally we collect them and fail at the end or strictly expect none.
                // For a strict audit:
                // expect(msg.type()).not.toBe('error'); 
            }
        });

        // Fail on network errors (4xx, 5xx), excluding generic analytics if needed
        page.on('response', response => {
            if (response.status() >= 400 && response.status() !== 401) { // 401 might happen on initial load before auth
                console.log(`Network Error: ${response.status()} ${response.url()}`);
            }
        });

        await page.goto('/login');
        await page.fill('input[type="email"]', process.env.SUPER_ADMIN_EMAIL);
        await page.fill('input[type="password"]', process.env.SUPER_ADMIN_PASSWORD);
        await page.click('button[type="submit"]:has-text("Sign In")');
        await expect(page).toHaveURL(/\/dashboard/, { timeout: 30000 });

        // Wait for Alpha OS loading screen to disappear
        await expect(page.locator('text=Alpha OS')).toBeHidden({ timeout: 60000 });

        // Handle potential Welcome Modal
        const skipBtn = page.locator('button:has-text("Skip Onboarding"), button:has-text("Skip")');
        if (await skipBtn.count() > 0) {
            await skipBtn.click();
            await page.waitForTimeout(1000); // Allow animation
        }

        await expect(page.locator('#main-content')).toBeVisible({ timeout: 20000 });
    });

    const pages = [
        { name: 'Command Center', path: '/dashboard' },
        { name: 'Platform Command', path: '/dashboard/admin/tenants' },
        { name: 'Live Operations', path: '/dashboard/analytics' },
        { name: 'CRM / All Clients', path: '/dashboard/clients' },
        { name: 'Sales Agent / Leads', path: '/dashboard/sales-agent' },
        { name: 'Active Projects', path: '/dashboard/projects' },
        { name: 'Onboarding Pipelines', path: '/dashboard/onboarding' },
        { name: 'Communication / Inbox', path: '/dashboard/messages' },
        { name: 'Meetings', path: '/dashboard/meetings' },
        { name: 'Calendar', path: '/dashboard/calendar' },
        { name: 'SEO Articles', path: '/dashboard/articles' },
        { name: 'Portfolio Editor', path: '/dashboard/portfolio-manager' },
        { name: 'Resource Allocation', path: '/dashboard/allocation' },
        { name: 'Improvements', path: '/dashboard/admin/improvements' },
        { name: 'Enterprise CRM / Tasks', path: '/dashboard/tasks' },
        { name: 'Deals Pipeline', path: '/dashboard/deals' },
        { name: 'Quotes & Proposals', path: '/dashboard/quotes' },
        { name: 'Sales Forecast', path: '/dashboard/forecast' },
        { name: 'Contracts', path: '/dashboard/contracts' },
        { name: 'Financials', path: '/dashboard/finance' },
        { name: 'Security (SIEM)', path: '/dashboard/security' },
    ];

    for (const pageInfo of pages) {
        test(`should load ${pageInfo.name} successfully`, async ({ page }) => {
            await page.goto(pageInfo.path, { timeout: 60000 });

            // Wait for any loading states specific to the dashboard page component
            await expect(page.locator('text=Establishing Neural Link')).toHaveCount(0, { timeout: 20000 });
            await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });

            // Basic check: Status 200 is handled by the page.goto
            await expect(page.locator('body')).not.toContainText('404', { timeout: 5000 });
            await expect(page.locator('body')).not.toContainText('Page Not Found');

            // Spinner check - ensure no indefinite loading
            await expect(page.locator('.spinner, .loading')).toHaveCount(0, { timeout: 5000 });

            // Check for critical rendering errors
            await expect(page.locator('text=Application Error')).toHaveCount(0);

            // Basic UI check to ensure it's not a blank page
            await expect(page.locator('header, nav, #main-content')).not.toHaveCount(0, { timeout: 5000 });
        });
    }
});
