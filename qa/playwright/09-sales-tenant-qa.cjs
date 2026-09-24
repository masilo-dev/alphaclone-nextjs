const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');
const { createServerClient } = require('@supabase/ssr');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(process.cwd(), '.env.production.local') });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const BASE_URL = process.env.BASE_URL || 'https://alphaclonesystems.com';

const USER_EMAIL = 'sales@alphaclonesystems.com';
const USER_PASS = process.env.TEST_USER_PASSWORD || '';
const TEST_RECIPIENT = 'bonniiehendrix@gmail.com';
const TENANT_ID = '066eb88e-3fb0-45c9-b4d1-c3c2063ea0d4';

function classifyLatency(ms) {
  if (ms <= 100) return 'INSTANT';
  if (ms <= 500) return 'EXCELLENT';
  if (ms <= 1000) return 'GOOD';
  if (ms <= 2000) return 'ACCEPTABLE';
  if (ms <= 3000) return 'WARNING';
  if (ms <= 5000) return 'POOR';
  return 'CRITICAL';
}

async function runSalesTenantQA() {
  console.log(`=======================================================`);
  console.log(`STARTING SALES TENANT DASHBOARD & EMAIL DELIVERY QA`);
  console.log(`User: ${USER_EMAIL} | Tenant ID: ${TENANT_ID}`);
  console.log(`=======================================================\n`);

  const screenshotDir = path.join(process.cwd(), 'qa/screenshots/tenant_sales');
  fs.mkdirSync(screenshotDir, { recursive: true });

  const anon = createClient(SUPABASE_URL, ANON_KEY);
  const { data: authData, error: authError } = await anon.auth.signInWithPassword({
    email: USER_EMAIL,
    password: USER_PASS,
  });

  if (authError || !authData.session) {
    throw new Error(`Authentication failed for ${USER_EMAIL}: ${authError?.message}`);
  }
  console.log(`[AUTH] Successfully signed in as ${USER_EMAIL} (UID: ${authData.user.id})`);

  const cookiesCreated = [];
  const ssr = createServerClient(SUPABASE_URL, ANON_KEY, {
    cookies: {
      getAll() { return []; },
      setAll(cookiesToSet) { cookiesCreated.push(...cookiesToSet); },
    },
  });

  await ssr.auth.setSession({
    access_token: authData.session.access_token,
    refresh_token: authData.session.refresh_token,
  });

  const parsedUrl = new URL(BASE_URL);
  const domain = '.' + parsedUrl.hostname;
  const cookies = cookiesCreated.map(c => ({
    name: c.name,
    value: c.value,
    domain,
    path: '/',
    httpOnly: false,
    secure: true,
    sameSite: 'Lax',
  }));

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext({
    baseURL: BASE_URL,
    viewport: { width: 1280, height: 800 },
  });

  await context.addCookies(cookies);

  const userId = authData.user.id;
  await context.addInitScript(({ uid, tid }) => {
    localStorage.setItem(`welcome_seen_${uid}`, 'true');
    localStorage.setItem(`business_welcome_seen_${uid}`, '1');
    localStorage.setItem(`onboarding_completed_${uid}`, 'true');
    localStorage.setItem('current_tenant_id', tid);
    sessionStorage.setItem('current_tenant_id', tid);
  }, { uid: userId, tid: TENANT_ID });

  const page = await context.newPage();

  const consoleLogs = [];
  const networkErrors = [];

  page.on('console', msg => {
    consoleLogs.push({ type: msg.type(), text: msg.text(), time: Date.now() });
  });
  page.on('pageerror', err => {
    consoleLogs.push({ type: 'pageerror', text: String(err?.message || err), time: Date.now() });
  });
  page.on('response', res => {
    if (res.status() >= 400) {
      networkErrors.push({ status: res.status(), url: res.url(), statusText: res.statusText() });
    }
  });

  const testResults = {
    user: USER_EMAIL,
    tenantId: TENANT_ID,
    timestamp: new Date().toISOString(),
    modules: [],
    emailTest: null,
    summary: {},
  };

  const routesToTest = [
    { name: 'Tenant Overview', path: '/dashboard', screenshot: '01_tenant_overview.png' },
    { name: 'Operations Command', path: '/dashboard/operations', screenshot: '02_tenant_operations.png' },
    { name: 'CRM Overview', path: '/dashboard/crm', screenshot: '03_crm_overview.png' },
    { name: 'CRM Workspace', path: '/dashboard/crm/workspace', screenshot: '04_crm_workspace.png' },
    { name: 'Contacts & Accounts', path: '/dashboard/contacts', screenshot: '05_contacts.png' },
    { name: 'Leads Board', path: '/dashboard/leads', screenshot: '06_leads_board.png' },
    { name: 'Lead Finder', path: '/dashboard/leads/finder', screenshot: '07_lead_finder.png' },
    { name: 'Deals Pipeline', path: '/dashboard/deals', screenshot: '08_deals_pipeline.png' },
    { name: 'Outreach Hub', path: '/dashboard/outreach', screenshot: '09_outreach_hub.png' },
    { name: 'Reach Mailbox', path: '/dashboard/comms', screenshot: '10_comms_mailbox.png' },
    { name: 'Accounting Dashboard', path: '/dashboard/accounting', screenshot: '11_accounting.png' },
    { name: 'Invoices & Billing Management', path: '/dashboard/business/billing/manage', screenshot: '12_invoices_manage.png' },
    { name: 'Quotes & Proposals', path: '/dashboard/business/quotes', screenshot: '13_quotes.png' },
    { name: 'Subscription & Billing Hub', path: '/dashboard/business/billing', screenshot: '14_subscription_billing.png' },
    { name: 'Tenant Organization Settings', path: '/dashboard/business/settings', screenshot: '15_tenant_settings.png' },
    { name: 'Marketplace & Integrations', path: '/dashboard/marketplace', screenshot: '16_marketplace.png' },
  ];

  for (const item of routesToTest) {
    console.log(`Testing [${item.name}] at ${item.path}...`);
    const start = Date.now();
    try {
      await page.goto(item.path, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(1500); // Allow data fetch & hydration
      const duration = Date.now() - start;

      // Safe control check: check if interactive buttons exist and are active
      const buttonCount = await page.locator('button, a[role="button"]').count();
      const hasContent = (await page.innerText('body')).length > 50;

      await page.screenshot({ path: path.join(screenshotDir, item.screenshot) });

      testResults.modules.push({
        name: item.name,
        path: item.path,
        loadTimeMs: duration,
        rating: classifyLatency(duration),
        status: hasContent ? 'PASS' : 'WARN_EMPTY',
        buttonCount,
      });
      console.log(`  -> ${item.name}: ${duration}ms [${classifyLatency(duration)}]`);
    } catch (err) {
      console.error(`  -> ERROR on ${item.name}:`, err.message);
      testResults.modules.push({
        name: item.name,
        path: item.path,
        loadTimeMs: Date.now() - start,
        status: 'FAIL',
        error: err.message,
      });
    }
  }

  // =========================================================================
  // TEST SAFE AUTHORIZED EMAIL DELIVERY TO bonniiehendrix@gmail.com
  // =========================================================================
  console.log(`\n--- Testing Safe Email Delivery to ${TEST_RECIPIENT} ---`);
  try {
    const emailPayload = {
      tenantId: TENANT_ID,
      to: TEST_RECIPIENT,
      subject: 'AlphaClone Systems QA Verification - Automated Test',
      body_html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #0f172a;">AlphaClone Systems Production QA Verification</h2>
          <p>This is an automated QA test email verifying that tenant email delivery is functioning end-to-end.</p>
          <p><strong>Tenant:</strong> ALPHACLONE SYSTEMS (${TENANT_ID})</p>
          <p><strong>Sender:</strong> ${USER_EMAIL}</p>
          <p><strong>Recipient:</strong> ${TEST_RECIPIENT}</p>
          <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
          <p style="font-size: 12px; color: #64748b;">Automated test run generated by AlphaClone Systems E2E QA Agent.</p>
        </div>
      `,
    };

    const emailSendResult = await page.evaluate(async (payload) => {
      try {
        const res = await fetch('/api/email/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const status = res.status;
        const text = await res.text();
        let json = null;
        try { json = JSON.parse(text); } catch (e) {}
        return { status, ok: res.ok, json, raw: text };
      } catch (e) {
        return { status: 0, ok: false, error: e.message };
      }
    }, emailPayload);

    console.log('Email Send Response:', JSON.stringify(emailSendResult, null, 2));
    testResults.emailTest = {
      target: TEST_RECIPIENT,
      sender: USER_EMAIL,
      payload: { to: emailPayload.to, subject: emailPayload.subject },
      result: emailSendResult,
      status: emailSendResult.ok ? 'PASS' : 'FAIL',
    };
  } catch (emailErr) {
    console.error('Email send exception:', emailErr);
    testResults.emailTest = {
      target: TEST_RECIPIENT,
      sender: USER_EMAIL,
      error: emailErr.message,
      status: 'FAIL',
    };
  }

  // Summary Metrics
  const passedModules = testResults.modules.filter(m => m.status === 'PASS').length;
  testResults.summary = {
    totalModules: testResults.modules.length,
    passedModules,
    failedModules: testResults.modules.length - passedModules,
    consoleErrorCount: consoleLogs.filter(l => l.type === 'error' || l.type === 'pageerror').length,
    networkErrorCount: networkErrors.length,
    emailDeliveryStatus: testResults.emailTest?.status,
  };

  fs.writeFileSync('qa/results-sales-tenant.json', JSON.stringify(testResults, null, 2));
  fs.writeFileSync('qa/console-errors-sales-tenant.json', JSON.stringify(consoleLogs, null, 2));
  fs.writeFileSync('qa/network-errors-sales-tenant.json', JSON.stringify(networkErrors, null, 2));

  console.log(`\n=======================================================`);
  console.log(`SALES TENANT QA COMPLETED: ${passedModules}/${testResults.modules.length} modules passed.`);
  console.log(`Email Test Status: ${testResults.emailTest?.status}`);
  console.log(`=======================================================`);

  await browser.close();
}

runSalesTenantQA().catch(err => {
  console.error('Fatal Sales Tenant QA Error:', err);
  process.exit(1);
});
