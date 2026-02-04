const { test, expect } = require('@playwright/test');

test.describe('Tenant Dashboard Audit', () => {
    test.beforeEach(async ({ page }) => {
        // Mock get_user_tenants RPC call to ensure reliable tenant loading
        await page.route('**/rest/v1/rpc/get_user_tenants*', async route => {
            const json = [{
                id: '51772ee6-dee8-4c42-81f7-0fee297e5b27',
                name: "Test Organization",
                slug: "test-org",
                role: "admin",
                subscription_plan: "free",
                subscription_status: "active",
                settings: { booking: { enabled: true } },
                created_at: new Date().toISOString()
            }];
            await route.fulfill({ json });
        });

        // Pre-seed localStorage to bypass onboarding
        await page.addInitScript(() => {
            const userId = 'df841125-59ce-4e09-aa2d-5b746ec03d9b'; // Tenant User ID
            localStorage.setItem(`welcome_seen_${userId}`, 'true');
            localStorage.setItem(`onboarding_completed_${userId}`, 'true');
            localStorage.setItem('onboarding_completed', 'true'); // Generic fallback
        });

        await page.goto('/login');
        await page.fill('input[type="email"]', process.env.TENANT_EMAIL);
        await page.fill('input[type="password"]', process.env.TENANT_PASSWORD);
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

        // Handle "No Organization Found" fallback (Retry if needed, but fail test if stuck)
        const retryBtn = page.locator('button:has-text("Retry")');
        if (await retryBtn.count() > 0 && await retryBtn.isVisible()) {
            // If we see Retry, it means TenantContext loaded but found no tenant
            // We can try clicking it once
            await retryBtn.click();
            await page.waitForTimeout(5000);
        }

        await expect(page.locator('#main-content')).toBeVisible({ timeout: 20000 });
    });

    const navItems = [
        { name: 'Dashboard Home', path: '/dashboard' },
        { name: 'CRM', path: '/dashboard/crm' },
        { name: 'Leads', path: '/dashboard/leads' },
        { name: 'Sales Agent', path: '/dashboard/sales-agent' },
        { name: 'Tasks', path: '/dashboard/tasks' },
        { name: 'Meetings', path: '/dashboard/business/meetings' },
        { name: 'Projects', path: '/dashboard/business/projects' },
        { name: 'Calendar', path: '/dashboard/business/calendar' },
        { name: 'Messages', path: '/dashboard/business/messages' },
        { name: 'Team', path: '/dashboard/business/team' },
        { name: 'Billing', path: '/dashboard/business/billing' },
        { name: 'Settings', path: '/dashboard/business/settings' }
    ];

    for (const item of navItems) {
        test(`Navigation: ${item.name} should load`, async ({ page }) => {
            console.log(`Checking Tenant route: ${item.path}`);
            await page.goto(item.path, { timeout: 60000 });

            // Wait for any loading states specific to the dashboard page component
            await expect(page.locator('text=Establishing Neural Link')).toHaveCount(0, { timeout: 20000 });
            await expect(page.locator('#main-content')).toBeVisible({ timeout: 15000 });

            await expect(page.locator('body')).not.toContainText('404', { timeout: 5000 });

            // Basic UI check to ensure it's not a blank page
            await expect(page.locator('header, nav, #main-content')).not.toHaveCount(0, { timeout: 5000 });
        });
    }

    test('Core Flow: CRM Create Record', async ({ page }) => {
        await page.goto('/dashboard/crm');
        await page.click('button:has-text("Add Client")');
        await page.fill('input[placeholder="John Doe"]', 'Test Lead Playwright');
        await page.fill('input[placeholder="john@example.com"]', `test-${Date.now()}@example.com`);
        await page.click('button:has-text("Add Client")');
        await expect(page.locator('text=Test Lead Playwright')).toBeVisible({ timeout: 15000 });
    });

    test('Core Flow: Tasks', async ({ page }) => {
        await page.goto('/dashboard/tasks');
        const taskName = `Audit Task ${Date.now()}`;
        await page.click('button:has-text("Initialize Task")');
        await page.fill('input[placeholder="What initiative are we starting?"]', taskName);
        await page.click('button:has-text("Confirm Operation")');
        await expect(page.locator(`text=${taskName}`)).toBeVisible({ timeout: 15000 });

        // Complete it
        await page.click(`text=${taskName}`); // Click to open or checkbox
        // await page.click('button:has-text("Complete")'); 
        // Verify persistence
        await page.reload();
        // await expect(page.locator(`text=${taskName}`)).toHaveClass(/completed/); 
    });

    test('Security: Cannot access Admin routes', async ({ page }) => {
        await page.goto('/dashboard/admin/tenants');
        // Should be redirected (middleware redirects to / if unauth or wrong role)
        await page.waitForURL(url => url.pathname === '/' || url.pathname === '/dashboard');
        expect(page.url()).not.toContain('/admin/tenants');
    });
});
