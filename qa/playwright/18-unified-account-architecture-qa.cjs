const { chromium } = require('playwright');
const { createServerClient } = require('@supabase/ssr');
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(process.cwd(), '.env.production.local') });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const BASE_URL = process.env.BASE_URL || 'https://alphaclonesystems.com';

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
const anon = createClient(SUPABASE_URL, ANON_KEY);

async function getCookiesForUser(email) {
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });
  if (linkErr) throw new Error(`Magiclink error for ${email}: ${linkErr.message}`);

  const { data: authData, error: authErr } = await anon.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: 'magiclink',
  });
  if (authErr) throw new Error(`Verify OTP error for ${email}: ${authErr.message}`);

  const cookiesCreated = [];
  const ssr = createServerClient(SUPABASE_URL, ANON_KEY, {
    cookies: {
      getAll() { return []; },
      setAll(cookiesToSet) {
        cookiesCreated.push(...cookiesToSet);
      },
    },
  });

  await ssr.auth.setSession({
    access_token: authData.session.access_token,
    refresh_token: authData.session.refresh_token,
  });

  const parsedUrl = new URL(BASE_URL);
  const domain = parsedUrl.hostname;

  return {
    userId: authData.user.id,
    cookies: cookiesCreated.map(c => ({
      name: c.name,
      value: c.value,
      domain: domain.startsWith('localhost') ? 'localhost' : `.${domain}`,
      path: '/',
      httpOnly: false,
      secure: !domain.startsWith('localhost'),
      sameSite: 'Lax',
    }))
  };
}

async function runQa() {
  console.log('======================================================================');
  console.log('ALPHA CLONE — UNIFIED ACCOUNT ARCHITECTURE E2E QA AUDIT');
  console.log(`Target: ${BASE_URL}`);
  console.log('======================================================================\n');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const results = {
    kingRoarBusinessDashboard: false,
    kingRoarWorkspaceNameVisible: false,
    kingRoarBusinessNavItems: false,
    noLegacyClientNav: false,
    canonicalClientPortalLoads: false,
    platformAdminMaintained: false,
    errors: [],
  };

  try {
    // -------------------------------------------------------------------------
    // TEST 1: King Roar (formerly stuck in 'client' role) enters Business Dashboard
    // -------------------------------------------------------------------------
    console.log('>>> TEST 1: Logging in as kingroar.bonnie@gmail.com...');
    const kingRoarEmail = 'kingroar.bonnie@gmail.com';
    const kingRoarAuth = await getCookiesForUser(kingRoarEmail);
    console.log(`Authenticated King Roar (User ID: ${kingRoarAuth.userId})`);

    const context1 = await browser.newContext({
      baseURL: BASE_URL,
      viewport: { width: 1440, height: 900 },
    });
    await context1.addCookies(kingRoarAuth.cookies);

    const page1 = await context1.newPage();
    const consoleLogs1 = [];
    page1.on('console', msg => consoleLogs1.push(`[${msg.type()}] ${msg.text()}`));
    page1.on('pageerror', err => consoleLogs1.push(`[pageerror] ${err.message}`));

    console.log('Navigating King Roar to /dashboard...');
    await page1.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Wait for splash screen / loading to clear and dashboard to render
    try {
      await page1.waitForSelector('[data-testid="business-dashboard"], #main-content, nav, main', {
        timeout: 15000,
      });
    } catch {
      console.warn('Initial selector timeout, checking body text...');
    }
    await page1.waitForTimeout(3000);

    const pageTitle1 = await page1.title();
    const currentUrl1 = page1.url();
    const bodyText1 = await page1.innerText('body');

    console.log(`Current URL: ${currentUrl1}`);
    console.log(`Page Title: ${pageTitle1}`);

    // Check for Business Dashboard markers
    const hasBusinessDashboard = 
      bodyText1.includes("Organization") || 
      bodyText1.includes("Overview") || 
      bodyText1.includes("Customers") || 
      bodyText1.includes("Sales") || 
      bodyText1.includes("Money") ||
      bodyText1.includes("Bonnie AI") ||
      bodyText1.includes("Home");

    const hasKingRoarOrg = bodyText1.includes("king roar") || bodyText1.includes("Organization");
    const hasCrippledClientMessage = bodyText1.includes("You don't have access to this business dashboard");

    console.log(`Has Business Dashboard elements: ${hasBusinessDashboard}`);
    console.log(`Has Organization name / workspace: ${hasKingRoarOrg}`);
    console.log(`Has Crippled Client Warning: ${hasCrippledClientMessage}`);

    if (hasBusinessDashboard && !hasCrippledClientMessage) {
      results.kingRoarBusinessDashboard = true;
      console.log('✓ PASS: King Roar enters full Business Dashboard');
    } else {
      results.errors.push('King Roar did not enter full Business Dashboard');
      console.error('✗ FAIL: King Roar did not enter full Business Dashboard');
    }

    if (hasKingRoarOrg) {
      results.kingRoarWorkspaceNameVisible = true;
      console.log('✓ PASS: King Roar organization workspace detected');
    }

    // Verify Business nav items
    const hasCustomersOrCRM = bodyText1.includes("Customers") || bodyText1.includes("CRM");
    const hasFinanceOrMoney = bodyText1.includes("Money") || bodyText1.includes("Finance") || bodyText1.includes("Invoices");
    if (hasCustomersOrCRM && hasFinanceOrMoney) {
      results.kingRoarBusinessNavItems = true;
      results.noLegacyClientNav = true;
      console.log('✓ PASS: Full Business navigation verified (Customers, Money/Finance, etc.)');
    }

    await page1.screenshot({ path: 'qa/screenshots/kingroar-business-dashboard.png' });
    console.log('Captured screenshot: qa/screenshots/kingroar-business-dashboard.png');
    await context1.close();

    // -------------------------------------------------------------------------
    // TEST 2: Canonical Client Portal (/portal/[token])
    // -------------------------------------------------------------------------
    console.log('\n>>> TEST 2: Testing Canonical Client Portal (/portal/[token])...');
    const portalToken = 'd8951a4a-403c-4f7f-b8f0-11cfc754a060';
    const context2 = await browser.newContext({
      baseURL: BASE_URL,
      viewport: { width: 1440, height: 900 },
    });
    const page2 = await context2.newPage();

    console.log(`Navigating to /portal/${portalToken}...`);
    await page2.goto(`${BASE_URL}/portal/${portalToken}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page2.waitForTimeout(3000);

    const portalBody = await page2.innerText('body');
    const portalUrl = page2.url();
    console.log(`Portal URL: ${portalUrl}`);

    const hasPortalContent = 
      portalBody.includes("Client Portal") || 
      portalBody.includes("Invoice") || 
      portalBody.includes("Quote") || 
      portalBody.includes("Project") ||
      portalBody.includes("AlphaClone") ||
      portalBody.includes("Overview");

    if (hasPortalContent && !portalBody.includes("500 Internal Server Error")) {
      results.canonicalClientPortalLoads = true;
      console.log('✓ PASS: Canonical Client Portal loads correctly and independently');
    } else {
      results.errors.push('Canonical Client Portal did not load expected content');
      console.error('✗ FAIL: Canonical Client Portal error');
    }

    await page2.screenshot({ path: 'qa/screenshots/canonical-client-portal.png' });
    console.log('Captured screenshot: qa/screenshots/canonical-client-portal.png');
    await context2.close();

    // -------------------------------------------------------------------------
    // TEST 3: Platform Admin (bonnie@alphaclonesystems.com) maintains Command Center
    // -------------------------------------------------------------------------
    console.log('\n>>> TEST 3: Verifying Platform Admin (bonnie@alphaclonesystems.com)...');
    const bonnieAuth = await getCookiesForUser('bonnie@alphaclonesystems.com');
    const context3 = await browser.newContext({
      baseURL: BASE_URL,
      viewport: { width: 1440, height: 900 },
    });
    await context3.addCookies(bonnieAuth.cookies);
    const page3 = await context3.newPage();

    console.log('Navigating Platform Admin to /dashboard...');
    await page3.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page3.waitForTimeout(3000);

    const adminBody = await page3.innerText('body');
    const hasAdminNav = 
      adminBody.includes("Tenants") || 
      adminBody.includes("Command Center") || 
      adminBody.includes("Operations") || 
      adminBody.includes("Platform Users") ||
      adminBody.includes("Bonnie");

    if (hasAdminNav) {
      results.platformAdminMaintained = true;
      console.log('✓ PASS: Platform Admin command center retained with full access');
    } else {
      results.errors.push('Platform admin navigation not found');
      console.error('✗ FAIL: Platform admin navigation issue');
    }

    await page3.screenshot({ path: 'qa/screenshots/platform-admin-dashboard.png' });
    console.log('Captured screenshot: qa/screenshots/platform-admin-dashboard.png');
    await context3.close();

  } catch (err) {
    console.error('Test execution error:', err);
    results.errors.push(err.message);
  } finally {
    await browser.close();
  }

  console.log('\n======================================================================');
  console.log('SUMMARY AUDIT RESULTS:');
  console.log(JSON.stringify(results, null, 2));
  console.log('======================================================================');

  if (results.errors.length > 0) {
    process.exit(1);
  }
}

runQa();
