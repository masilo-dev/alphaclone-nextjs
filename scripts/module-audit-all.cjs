/**
 * Full module-by-module production audit for tenant_admin.
 * Does NOT push. Writes JSON report to /tmp/module-audit-report.json
 */
const { chromium, devices } = require('@playwright/test');
const fs = require('fs');

const BASE = process.env.BASE_URL || 'https://alphaclonesystems.com';
const EMAIL = process.env.TENANT_EMAIL || 'sales@alphaclonesystems.com';
const PASSWORD = process.env.TENANT_PASSWORD || 'Amgseries@22';
const USER_ID = 'd8fd4aea-2987-4313-90e2-e6600539ec56';

/** All tenant_admin routes from TENANT_ADMIN_NAV_ITEMS + key aliases */
const MODULES = [
  // Core
  { hub: 'Core', label: 'Workspace home', path: '/dashboard' },
  { hub: 'Core', label: 'Bonnie AI', path: '/dashboard/business/bonnie' },
  { hub: 'Core', label: 'Approvals', path: '/dashboard/bonnie/approvals' },

  // Sales Hub
  { hub: 'Sales Hub', label: 'CRM overview', path: '/dashboard/crm' },
  { hub: 'Sales Hub', label: 'CRM workspace', path: '/dashboard/crm/workspace' },
  { hub: 'Sales Hub', label: 'Outreach', path: '/dashboard/outreach' },
  { hub: 'Sales Hub', label: 'Sales console', path: '/dashboard/crm/console' },
  { hub: 'Sales Hub', label: 'Leads Board', path: '/dashboard/leads' },
  { hub: 'Sales Hub', label: 'Deals Pipeline', path: '/dashboard/deals' },
  { hub: 'Sales Hub', label: 'Contacts', path: '/dashboard/contacts' },
  { hub: 'Sales Hub', label: 'Accounts', path: '/dashboard/crm/accounts' },
  { hub: 'Sales Hub', label: 'CRM Reports', path: '/dashboard/crm/reports' },
  { hub: 'Sales Hub', label: 'Sales Forecast', path: '/dashboard/forecast' },
  { hub: 'Sales Hub', label: 'Goals & Targets', path: '/dashboard/goals' },
  { hub: 'Sales Hub', label: 'Annual Planning', path: '/dashboard/planning' },
  { hub: 'Sales Hub', label: 'Jobs & Queue', path: '/dashboard/jobs' },
  { hub: 'Sales Hub', label: 'Production Tasks', path: '/dashboard/tasks' },
  { hub: 'Sales Hub', label: 'Lead Finder', path: '/dashboard/leads/campaigns' },
  { hub: 'Sales Hub', label: 'Lead Ingestion', path: '/dashboard/business/ingestion' },
  { hub: 'Sales Hub', label: 'Webhooks', path: '/dashboard/webhooks' },

  // Marketing Hub
  { hub: 'Marketing Hub', label: 'Email Campaigns', path: '/dashboard/business/campaigns' },
  { hub: 'Marketing Hub', label: 'Sequences', path: '/dashboard/marketing/sequences' },
  { hub: 'Marketing Hub', label: 'Deliverability', path: '/dashboard/marketing/deliverability' },
  { hub: 'Marketing Hub', label: 'Branded Forms', path: '/dashboard/business/forms' },
  { hub: 'Marketing Hub', label: 'Social overview', path: '/dashboard/business/social' },
  { hub: 'Marketing Hub', label: 'Compose', path: '/dashboard/business/social/compose' },
  { hub: 'Marketing Hub', label: 'Schedule', path: '/dashboard/business/social-command' },
  { hub: 'Marketing Hub', label: 'LinkedIn', path: '/dashboard/business/linkedin' },
  { hub: 'Marketing Hub', label: 'Facebook', path: '/dashboard/business/facebook' },
  { hub: 'Marketing Hub', label: 'Instagram', path: '/dashboard/business/instagram' },
  { hub: 'Marketing Hub', label: 'X (Twitter)', path: '/dashboard/business/x' },
  { hub: 'Marketing Hub', label: 'SMS Outreach', path: '/dashboard/business/sms' },

  // Money Hub
  { hub: 'Money Hub', label: 'Accounting', path: '/dashboard/accounting' },
  { hub: 'Money Hub', label: 'Banking', path: '/dashboard/accounting/banking' },
  { hub: 'Money Hub', label: 'Bills Payable', path: '/dashboard/accounting/bills' },
  { hub: 'Money Hub', label: 'Vendors', path: '/dashboard/vendors' },
  { hub: 'Money Hub', label: 'Period Close', path: '/dashboard/accounting/period-close' },
  { hub: 'Money Hub', label: 'Billing overview', path: '/dashboard/business/billing' },
  { hub: 'Money Hub', label: 'Invoices', path: '/dashboard/business/billing/manage' },
  { hub: 'Money Hub', label: 'Finance & expenses', path: '/dashboard/finance/manage' },
  { hub: 'Money Hub', label: 'Quotes & Proposals', path: '/dashboard/business/quotes' },
  { hub: 'Money Hub', label: 'Cash Flow Forecast', path: '/dashboard/business/cash-flow' },
  { hub: 'Money Hub', label: 'Tax Estimator', path: '/dashboard/business/tax-estimator' },

  // Insights Hub
  { hub: 'Insights Hub', label: 'Executive Dashboard', path: '/dashboard/executive' },
  { hub: 'Insights Hub', label: 'Analytics', path: '/dashboard/analytics' },
  { hub: 'Insights Hub', label: 'Performance', path: '/dashboard/performance' },
  { hub: 'Insights Hub', label: 'Revenue Reports', path: '/dashboard/business/reports' },
  { hub: 'Insights Hub', label: 'Reporting', path: '/dashboard/reporting' },
  { hub: 'Insights Hub', label: 'Notifications', path: '/dashboard/notifications' },

  // Documents Hub
  { hub: 'Documents Hub', label: 'Document Hub', path: '/dashboard/business/documents' },
  { hub: 'Documents Hub', label: 'Document Vault', path: '/dashboard/business/vault' },
  { hub: 'Documents Hub', label: 'Contracts', path: '/dashboard/business/contracts' },
  { hub: 'Documents Hub', label: 'Contract Manager', path: '/dashboard/business/contracts/manage' },
  { hub: 'Documents Hub', label: 'Active Projects', path: '/dashboard/business/projects' },
  { hub: 'Documents Hub', label: 'Project Manager', path: '/dashboard/business/projects/manage' },
  { hub: 'Documents Hub', label: 'Client Onboarding', path: '/dashboard/business/onboarding' },

  // Channels
  { hub: 'Channels', label: 'Deep-Desk Tickets', path: '/dashboard/business/tickets' },
  { hub: 'Channels', label: 'Team Messages', path: '/dashboard/business/messages' },
  { hub: 'Channels', label: 'Mail', path: '/dashboard/mail' },
  { hub: 'Channels', label: 'WhatsApp', path: '/dashboard/business/whatsapp' },

  // Schedule & meet
  { hub: 'Schedule', label: 'Calendar', path: '/dashboard/business/calendar' },
  { hub: 'Schedule', label: 'Booking Links', path: '/dashboard/business/booking' },
  { hub: 'Schedule', label: 'MS Teams', path: '/dashboard/business/teams' },

  // Workspace
  { hub: 'Workspace', label: 'Integration Marketplace', path: '/dashboard/marketplace' },
  { hub: 'Workspace', label: 'Workflow Builder', path: '/dashboard/business/workflows' },
  { hub: 'Workspace', label: 'Platform guide', path: '/dashboard/help' },
  { hub: 'Workspace', label: 'System Settings', path: '/dashboard/business/settings' },
];

const FAIL_PATTERNS = [
  /This section could not be loaded/i,
  /This section is not available/i,
  /Something went wrong/i,
  /Application error/i,
  /Unhandled Runtime Error/i,
  /Maximum update depth exceeded/i,
  /Minified React error/i,
];

async function dismiss(page) {
  for (const name of ['Accept All', 'Go to dashboard', 'Got it', 'Skip', 'Skip Onboarding', 'Not now', 'Dismiss']) {
    const btn = page.getByRole('button', { name: new RegExp(`^${name}$`, 'i') });
    if (await btn.count() && await btn.first().isVisible().catch(() => false)) {
      await btn.first().click().catch(() => {});
      await page.waitForTimeout(200);
    }
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    ...devices['Desktop Chrome'],
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  const results = [];
  let consoleErrors = [];
  let networkFails = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 400));
  });
  page.on('pageerror', (err) => {
    consoleErrors.push(`PAGEERROR: ${err.message}`.slice(0, 400));
  });
  page.on('response', (res) => {
    if (res.status() >= 500) {
      networkFails.push({ status: res.status(), url: res.url().slice(0, 200), method: res.request().method() });
    }
  });

  // Login
  await page.addInitScript((userId) => {
    localStorage.setItem(`welcome_seen_${userId}`, 'true');
    localStorage.setItem(`onboarding_completed_${userId}`, 'true');
    localStorage.setItem('onboarding_completed', 'true');
    localStorage.setItem('ac_cookie_consent', JSON.stringify({
      essential: true, functional: true, analytics: true, timestamp: new Date().toISOString(),
    }));
  }, USER_ID);

  await page.goto(`${BASE}/auth/login`, { waitUntil: 'domcontentloaded' });
  await dismiss(page);
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/dashboard/, { timeout: 60000 });
  await page.waitForTimeout(2000);
  await dismiss(page);
  console.log('LOGIN OK');

  for (let i = 0; i < MODULES.length; i++) {
    const mod = MODULES[i];
    consoleErrors = [];
    networkFails = [];
    const start = Date.now();
    let status = 'pass';
    const issues = [];
    let title = null;
    let snippet = '';
    let finalUrl = '';

    try {
      await page.goto(`${BASE}${mod.path}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(2200);
      await dismiss(page);
      finalUrl = page.url();

      const main = page.locator('main').first();
      const mainVisible = await main.isVisible().catch(() => false);
      if (!mainVisible) {
        status = 'fail';
        issues.push('main content not visible');
      }

      const bodyText = await page.locator('body').innerText().catch(() => '');
      snippet = bodyText.replace(/\s+/g, ' ').slice(0, 280);
      title = await page.locator('main h1, main h2').first().textContent().catch(() => null);

      for (const re of FAIL_PATTERNS) {
        if (re.test(bodyText)) {
          status = 'fail';
          issues.push(`UI error text: ${re.source}`);
        }
      }

      // Blank / nearly empty main
      const mainText = await main.innerText().catch(() => '');
      if (mainVisible && mainText.replace(/\s+/g, '').length < 12) {
        status = 'fail';
        issues.push('main content appears blank/empty');
      }

      // React crash / infinite loop in console
      const criticalConsole = consoleErrors.filter((e) =>
        /Maximum update depth|Minified React error|#185|ChunkLoadError|Hydration|is not defined|Cannot read prop/i.test(e)
      );
      if (criticalConsole.length) {
        status = 'fail';
        issues.push(`critical console: ${criticalConsole[0].slice(0, 160)}`);
      }

      // 5xx on page-related APIs
      if (networkFails.length) {
        status = 'fail';
        issues.push(`5xx responses: ${networkFails.slice(0, 3).map((f) => `${f.status} ${f.url}`).join(' | ')}`);
      }

      // Redirected away from dashboard unexpectedly
      if (!finalUrl.includes('/dashboard') && !finalUrl.includes('/auth')) {
        status = 'fail';
        issues.push(`unexpected redirect: ${finalUrl}`);
      }

      if (status === 'fail') {
        const safe = mod.path.replace(/\//g, '_').replace(/^_/, '');
        await page.screenshot({ path: `/tmp/audit-fail-${safe}.png`, fullPage: true }).catch(() => {});
      }
    } catch (err) {
      status = 'fail';
      issues.push(`navigation/crash: ${err.message.slice(0, 200)}`);
      finalUrl = page.url();
    }

    const row = {
      hub: mod.hub,
      label: mod.label,
      path: mod.path,
      status,
      issues,
      title: title?.trim()?.slice(0, 80) || null,
      finalUrl,
      ms: Date.now() - start,
      consoleErrors: [...new Set(consoleErrors)].slice(0, 8),
      networkFails: networkFails.filter((f, idx, arr) => arr.findIndex((x) => x.url === f.url) === idx).slice(0, 8),
      snippet,
    };
    results.push(row);
    const mark = status === 'pass' ? '✓' : '✗';
    console.log(`${mark} [${mod.hub}] ${mod.label} (${mod.path}) ${issues.join('; ') || 'ok'}`);
  }

  const failed = results.filter((r) => r.status === 'fail');
  const passed = results.filter((r) => r.status === 'pass');
  const byHub = {};
  for (const r of results) {
    byHub[r.hub] = byHub[r.hub] || { pass: 0, fail: 0, fails: [] };
    byHub[r.hub][r.status === 'pass' ? 'pass' : 'fail']++;
    if (r.status === 'fail') byHub[r.hub].fails.push({ label: r.label, path: r.path, issues: r.issues });
  }

  const report = {
    timestamp: new Date().toISOString(),
    base: BASE,
    account: EMAIL,
    totals: { modules: results.length, passed: passed.length, failed: failed.length },
    productionReady: failed.length === 0,
    byHub,
    failures: failed.map((f) => ({
      hub: f.hub, label: f.label, path: f.path, issues: f.issues, title: f.title, consoleErrors: f.consoleErrors, networkFails: f.networkFails,
    })),
    results,
  };

  fs.writeFileSync('/tmp/module-audit-report.json', JSON.stringify(report, null, 2));
  console.log('\n=== SUMMARY ===');
  console.log(JSON.stringify(report.totals, null, 2));
  console.log('productionReady:', report.productionReady);
  console.log('Failures:', failed.length);
  for (const f of failed) console.log(`  - [${f.hub}] ${f.label}: ${f.issues.join('; ')}`);
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
