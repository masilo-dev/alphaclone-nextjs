const fs = require('fs');
const path = require('path');
const {
  BASE_URL,
  createAuthenticatedContext,
  dismissCommonModals,
  measureAction,
} = require('./auth-helper.cjs');

async function runSpecializedQA() {
  console.log(`=======================================================`);
  console.log(`STARTING SPECIALIZED QA: SUPER ADMIN, TENANT, CLIENT PORTAL`);
  console.log(`=======================================================\n`);

  const { browser, context } = await createAuthenticatedContext();
  const page = await context.newPage();
  const screenshotDir = path.join(process.cwd(), 'qa/screenshots/specialized');
  fs.mkdirSync(screenshotDir, { recursive: true });

  const results = {
    superAdmin: [],
    tenantDashboard: [],
    clientPortal: [],
  };

  // =========================================================================
  // 1. SUPER ADMIN DASHBOARD DEEP QA
  // =========================================================================
  console.log('--- 1. Testing Super Admin Dashboard ---');
  try {
    // A. Main Command Center
    let step = await measureAction(page, 'Super Admin Command Center (/dashboard)', async () => {
      await page.goto('/dashboard', { waitUntil: 'domcontentloaded', timeout: 35000 });
      await dismissCommonModals(page);
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(screenshotDir, '01_super_admin_command_center.png') });
    });
    results.superAdmin.push(step);

    // Click Refresh on Command Center
    step = await measureAction(page, 'Command Center Refresh Action', async () => {
      const refreshBtn = page.locator('button:has-text("Refresh")').first();
      if (await refreshBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await refreshBtn.click();
        await page.waitForTimeout(500);
      }
    });
    results.superAdmin.push(step);

    // B. Tenants Management
    step = await measureAction(page, 'Super Admin Tenants Hub (/dashboard/admin/tenants)', async () => {
      const tenantsLink = page.locator('a[href*="tenants"], button:has-text("Tenants")').first();
      if (await tenantsLink.isVisible({ timeout: 2000 }).catch(() => false)) {
        await tenantsLink.click();
      } else {
        await page.goto('/dashboard/admin/tenants', { waitUntil: 'domcontentloaded' });
      }
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(screenshotDir, '02_super_admin_tenants.png') });
    });
    results.superAdmin.push(step);

    // C. Operations & Logs
    step = await measureAction(page, 'Super Admin Ops & Logs (/dashboard/admin/operations)', async () => {
      await page.goto('/dashboard/admin/operations', { waitUntil: 'domcontentloaded' }).catch(async () => {
        await page.goto('/dashboard/operations');
      });
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(screenshotDir, '03_super_admin_ops_logs.png') });
    });
    results.superAdmin.push(step);

    // D. Executive Analytics
    step = await measureAction(page, 'Super Admin Executive Analytics (/dashboard/executive)', async () => {
      await page.goto('/dashboard/executive', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(screenshotDir, '04_super_admin_executive.png') });
    });
    results.superAdmin.push(step);

  } catch (err) {
    console.error('Super Admin QA error:', err);
    results.superAdmin.push({ actionName: 'Super Admin Suite', success: false, error: err.message });
  }

  // =========================================================================
  // 2. TENANT DASHBOARD DEEP QA
  // =========================================================================
  console.log('\n--- 2. Testing Tenant Dashboard ---');
  try {
    // A. Tenant Operations Home
    let step = await measureAction(page, 'Tenant Operations Home (/dashboard/operations)', async () => {
      await page.goto('/dashboard/operations', { waitUntil: 'domcontentloaded' });
      await dismissCommonModals(page);
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(screenshotDir, '05_tenant_operations.png') });
    });
    results.tenantDashboard.push(step);

    // B. Tenant CRM Workspace
    step = await measureAction(page, 'Tenant CRM Workspace (/dashboard/crm/workspace)', async () => {
      await page.goto('/dashboard/crm/workspace', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(screenshotDir, '06_tenant_crm_workspace.png') });
    });
    results.tenantDashboard.push(step);

    // C. Tenant Billing & Subscription Settings
    step = await measureAction(page, 'Tenant Billing Hub (/dashboard/business/billing)', async () => {
      await page.goto('/dashboard/business/billing', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(screenshotDir, '07_tenant_billing.png') });
    });
    results.tenantDashboard.push(step);

    // D. Tenant Organization Settings
    step = await measureAction(page, 'Tenant Settings (/dashboard/business/settings)', async () => {
      await page.goto('/dashboard/business/settings', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(screenshotDir, '08_tenant_settings.png') });
    });
    results.tenantDashboard.push(step);

  } catch (err) {
    console.error('Tenant Dashboard QA error:', err);
    results.tenantDashboard.push({ actionName: 'Tenant Suite', success: false, error: err.message });
  }

  // =========================================================================
  // 3. CLIENT PORTAL DEEP QA
  // =========================================================================
  console.log('\n--- 3. Testing Client Portal ---');
  try {
    // A. Portal Login Page
    let step = await measureAction(page, 'Client Portal Login Screen (/portal-login)', async () => {
      await page.goto('/portal-login', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(screenshotDir, '09_client_portal_login.png') });
    });
    results.clientPortal.push(step);

    // Test form fields on portal-login
    step = await measureAction(page, 'Portal Login Inputs Interaction', async () => {
      const emailInput = page.locator('input[type="email"]').first();
      if (await emailInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await emailInput.fill('client@example.com');
        await page.waitForTimeout(200);
        await emailInput.clear();
      }
    });
    results.clientPortal.push(step);

    // B. Live Client Portal Workspace with Real Project Token
    const realToken = 'b4c6c01b-4461-4022-8577-0ccc0f50bd9a'; // Yakazuma Store
    step = await measureAction(page, `Live Client Portal (/portal/${realToken})`, async () => {
      await page.goto(`/portal/${realToken}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(3000);
      await page.screenshot({ path: path.join(screenshotDir, '10_client_portal_workspace.png') });
    });
    results.clientPortal.push(step);

    // C. Click through all Portal Tabs (Projects, Invoices, Quotes, Contracts, Messages)
    const portalTabs = ['projects', 'invoices', 'quotes', 'contracts', 'documents', 'messages'];
    for (const tabName of portalTabs) {
      step = await measureAction(page, `Client Portal Tab: ${tabName}`, async () => {
        const tabEl = page.locator(`button:has-text("${tabName}"), a:has-text("${tabName}")`).first();
        if (await tabEl.isVisible({ timeout: 2000 }).catch(() => false)) {
          await tabEl.click();
          await page.waitForTimeout(800);
          await page.screenshot({ path: path.join(screenshotDir, `11_portal_tab_${tabName}.png`) });
        }
      });
      results.clientPortal.push(step);
    }

  } catch (err) {
    console.error('Client Portal QA error:', err);
    results.clientPortal.push({ actionName: 'Client Portal Suite', success: false, error: err.message });
  }

  await browser.close();

  fs.writeFileSync('qa/results-specialized.json', JSON.stringify(results, null, 2));
  console.log(`\n=======================================================`);
  console.log(`SPECIALIZED QA COMPLETE (Super Admin, Tenant, Portal)!`);
  console.log(`=======================================================\n`);
}

runSpecializedQA().catch(console.error);
