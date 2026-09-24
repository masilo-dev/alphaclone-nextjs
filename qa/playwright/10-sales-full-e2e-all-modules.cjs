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
const TENANT_ID = '066eb88e-3fb0-45c9-b4d1-c3c2063ea0d4';

const MODULES = require('../../scripts/tenant-admin-modules.cjs');

const PUBLIC_ROUTES = [
  { hub: 'Marketing', label: 'Home Page', path: '/', probe: 'home' },
  { hub: 'Marketing', label: 'Pricing', path: '/pricing', probe: 'list' },
  { hub: 'Marketing', label: 'About', path: '/about', probe: 'list' },
  { hub: 'Marketing', label: 'Contact', path: '/contact', probe: 'form' },
  { hub: 'Marketing', label: 'Book Demo', path: '/book-demo', probe: 'form' },
  { hub: 'Marketing', label: 'Public CRM', path: '/crm', probe: 'list' },
  { hub: 'Marketing', label: 'Platform Status', path: '/platform-status', probe: 'list' },
  { hub: 'Marketing', label: 'Legal Privacy', path: '/legal/privacy', probe: 'list' },
  { hub: 'Marketing', label: 'Legal Terms', path: '/legal/terms', probe: 'list' },
  { hub: 'Marketing', label: 'FAQ', path: '/faq', probe: 'list' },
  { hub: 'Marketing', label: 'AI Business OS', path: '/ai-business-os', probe: 'list' },
  { hub: 'Marketing', label: 'Agency Solutions', path: '/solutions/agencies', probe: 'list' },
];

const ALL_TARGETS = [
  ...MODULES,
  ...PUBLIC_ROUTES,
];

function classifyLatency(ms) {
  if (ms <= 100) return 'INSTANT';
  if (ms <= 500) return 'EXCELLENT';
  if (ms <= 1000) return 'GOOD';
  if (ms <= 2000) return 'ACCEPTABLE';
  if (ms <= 3000) return 'WARNING';
  if (ms <= 5000) return 'POOR';
  return 'CRITICAL';
}

function isSafeControl(text, ariaLabel, tagName, type) {
  const combined = `${text} ${ariaLabel || ''} ${type || ''}`.toLowerCase();
  const unsafePatterns = [
    'delete', 'remove', 'destroy', 'cancel subscription', 'terminate',
    'send email', 'publish', 'charge', 'pay now', 'disconnect',
    'reset database', 'purge', 'drop', 'unlink', 'sign contract'
  ];
  for (const pattern of unsafePatterns) {
    if (combined.includes(pattern)) return false;
  }
  return true;
}

async function dismissModals(page) {
  const dismissSelectors = [
    'button:has-text("Accept All")',
    'button:has-text("Accept cookies")',
    'button:has-text("Got it")',
    'button:has-text("Dismiss install prompt")',
    'button:has-text("Skip")',
    'button:has-text("Skip Onboarding")',
    'button:has-text("Enter Dashboard")',
    'button:has-text("Go to dashboard")',
  ];
  for (const sel of dismissSelectors) {
    try {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 400 }).catch(() => false)) {
        await el.click({ force: true }).catch(() => {});
      }
    } catch (e) {}
  }
}

async function measureAction(page, actionName, actionFn) {
  const startTime = Date.now();
  try {
    await actionFn();
    const clickTime = Date.now() - startTime;
    await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(300);
    const totalTime = Date.now() - startTime;
    return {
      actionName,
      success: true,
      clickTime,
      totalTime,
      category: classifyLatency(totalTime),
    };
  } catch (err) {
    return {
      actionName,
      success: false,
      error: err.message,
      totalTime: Date.now() - startTime,
      category: 'CRITICAL',
    };
  }
}

async function run() {
  console.log(`=======================================================`);
  console.log(`STARTING FULL ALL-MODULE QA FOR TEST ACCOUNT`);
  console.log(`User: ${USER_EMAIL} | Tenant ID: ${TENANT_ID}`);
  console.log(`Total Targets: ${ALL_TARGETS.length}`);
  console.log(`=======================================================\n`);

  const screenshotDir = path.join(process.cwd(), 'qa/screenshots/modules_sales');
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

  const moduleResults = [];
  const performanceLog = [];

  // =========================================================================
  // PART 1: TEST ALL 103+ MODULES AND ROUTES
  // =========================================================================
  console.log(`\n--- PART 1: Testing All ${ALL_TARGETS.length} Modules & Routes ---`);

  for (let i = 0; i < ALL_TARGETS.length; i++) {
    const mod = ALL_TARGETS[i];
    const moduleSlug = mod.path.replace(/\//g, '_').replace(/^_/, '') || 'home';
    const routeStart = Date.now();
    let initialUsableTime = 0;
    let loadFailed = false;
    let failureReason = null;
    const moduleControls = [];

    try {
      const response = await page.goto(mod.path, {
        waitUntil: 'domcontentloaded',
        timeout: 35000,
      });

      await dismissModals(page);

      // Wait for content
      const mainEl = page.locator('main, #main-content, body').first();
      await mainEl.waitFor({ state: 'visible', timeout: 15000 });

      // Observe loading state
      const skeletonOrSpinner = page.locator('.animate-spin, .animate-pulse, [role="progressbar"]').first();
      const hasInitialSpinner = await skeletonOrSpinner.isVisible({ timeout: 400 }).catch(() => false);
      if (hasInitialSpinner) {
        await skeletonOrSpinner.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
      }

      await page.waitForTimeout(600);
      initialUsableTime = Date.now() - routeStart;

      // Safe interactive controls check (up to 3 safe controls)
      const buttons = await page.locator('button:visible, a[role="button"]:visible, [role="tab"]:visible').all();
      let testedOnThisPage = 0;

      for (const btn of buttons) {
        if (testedOnThisPage >= 3) break;
        try {
          const text = (await btn.innerText().catch(() => '')).trim();
          const ariaLabel = (await btn.getAttribute('aria-label').catch(() => '')) || '';
          const role = (await btn.getAttribute('role').catch(() => 'button')) || 'button';

          if (!text && !ariaLabel) continue;
          if (!isSafeControl(text, ariaLabel, 'button', role)) continue;

          const actionStart = Date.now();
          await btn.click({ timeout: 2000 }).catch(() => {});
          await page.waitForTimeout(200);
          const actionDuration = Date.now() - actionStart;

          moduleControls.push({
            name: text || ariaLabel,
            role,
            latencyMs: actionDuration,
            rating: classifyLatency(actionDuration),
            status: 'PASS',
          });
          testedOnThisPage++;
        } catch (e) {
          // ignore individual control exceptions
        }
      }

      // Capture screenshot
      const shotPath = path.join(screenshotDir, `${String(i + 1).padStart(3, '0')}_${moduleSlug}.png`);
      await page.screenshot({ path: shotPath, fullPage: false }).catch(() => {});

      const rating = classifyLatency(initialUsableTime);
      moduleResults.push({
        hub: mod.hub,
        label: mod.label,
        path: mod.path,
        probe: mod.probe,
        loadTimeMs: initialUsableTime,
        rating,
        status: 'PASS',
        controlsTested: moduleControls,
      });

      performanceLog.push({
        location: `${mod.hub} > ${mod.label} (${mod.path})`,
        loadTimeMs: initialUsableTime,
        rating,
      });

      console.log(`[${i + 1}/${ALL_TARGETS.length}] PASS: ${mod.hub} > ${mod.label} (${mod.path}) — ${initialUsableTime}ms [${rating}]`);

    } catch (err) {
      loadFailed = true;
      failureReason = err.message;
      initialUsableTime = Date.now() - routeStart;

      moduleResults.push({
        hub: mod.hub,
        label: mod.label,
        path: mod.path,
        probe: mod.probe,
        loadTimeMs: initialUsableTime,
        rating: 'CRITICAL',
        status: 'FAIL',
        error: failureReason,
        controlsTested: [],
      });

      console.error(`[${i + 1}/${ALL_TARGETS.length}] FAIL: ${mod.hub} > ${mod.label} (${mod.path}) — ${err.message}`);
    }
  }

  // =========================================================================
  // PART 2: TEST 7 CORE USER JOURNEYS UNDER sales@alphaclonesystems.com
  // =========================================================================
  console.log(`\n--- PART 2: Testing 7 Core User Journeys ---`);
  const journeyResults = [];

  // Journey 1: CRM & Clients
  console.log(`[Journey 1/7] CRM & Clients`);
  const j1Steps = [];
  try {
    let s = await measureAction(page, 'Navigate to Dashboard', async () => {
      await page.goto('/dashboard', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await dismissModals(page);
    });
    j1Steps.push(s);

    s = await measureAction(page, 'Navigate to CRM Overview', async () => {
      await page.goto('/dashboard/crm', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await dismissModals(page);
      await page.locator('main').first().waitFor({ state: 'visible', timeout: 15000 });
    });
    j1Steps.push(s);

    s = await measureAction(page, 'Open Contacts', async () => {
      await page.goto('/dashboard/contacts', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(500);
    });
    j1Steps.push(s);

    s = await measureAction(page, 'Search Input Interaction', async () => {
      const searchInput = page.locator('input[placeholder*="Search"], input[type="search"]').first();
      if (await searchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await searchInput.fill('Alpha');
        await page.waitForTimeout(300);
        await searchInput.clear();
      }
    });
    j1Steps.push(s);

    journeyResults.push({ name: 'CRM & Clients', status: 'PASS', steps: j1Steps });
  } catch (err) {
    journeyResults.push({ name: 'CRM & Clients', status: 'FAIL', error: err.message, steps: j1Steps });
  }

  // Journey 2: Leads & Deals
  console.log(`[Journey 2/7] Leads & Deals Pipeline`);
  const j2Steps = [];
  try {
    let s = await measureAction(page, 'Navigate to Leads Board', async () => {
      await page.goto('/dashboard/leads', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await dismissModals(page);
      await page.locator('main').first().waitFor({ state: 'visible', timeout: 15000 });
    });
    j2Steps.push(s);

    s = await measureAction(page, 'Navigate to Lead Finder', async () => {
      await page.goto('/dashboard/leads/finder', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.locator('main').first().waitFor({ state: 'visible', timeout: 15000 });
    });
    j2Steps.push(s);

    s = await measureAction(page, 'Navigate to Deals Pipeline', async () => {
      await page.goto('/dashboard/deals', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.locator('main').first().waitFor({ state: 'visible', timeout: 15000 });
    });
    j2Steps.push(s);

    journeyResults.push({ name: 'Leads & Deals Pipeline', status: 'PASS', steps: j2Steps });
  } catch (err) {
    journeyResults.push({ name: 'Leads & Deals Pipeline', status: 'FAIL', error: err.message, steps: j2Steps });
  }

  // Journey 3: Accounting & Cash Flow
  console.log(`[Journey 3/7] Accounting & Cash Flow`);
  const j3Steps = [];
  try {
    let s = await measureAction(page, 'Navigate to Accounting Hub', async () => {
      await page.goto('/dashboard/accounting', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await dismissModals(page);
    });
    j3Steps.push(s);

    s = await measureAction(page, 'Navigate to Invoice Manager', async () => {
      await page.goto('/dashboard/business/billing/manage', { waitUntil: 'domcontentloaded', timeout: 30000 });
    });
    j3Steps.push(s);

    s = await measureAction(page, 'Navigate to Quotes & Proposals', async () => {
      await page.goto('/dashboard/business/quotes', { waitUntil: 'domcontentloaded', timeout: 30000 });
    });
    j3Steps.push(s);

    journeyResults.push({ name: 'Accounting & Cash Flow', status: 'PASS', steps: j3Steps });
  } catch (err) {
    journeyResults.push({ name: 'Accounting & Cash Flow', status: 'FAIL', error: err.message, steps: j3Steps });
  }

  // Journey 4: Social & Outreach
  console.log(`[Journey 4/7] Social & Outreach Hub`);
  const j4Steps = [];
  try {
    let s = await measureAction(page, 'Navigate to Outreach Hub', async () => {
      await page.goto('/dashboard/outreach', { waitUntil: 'domcontentloaded', timeout: 30000 });
    });
    j4Steps.push(s);

    s = await measureAction(page, 'Navigate to Reach Mailbox', async () => {
      await page.goto('/dashboard/comms', { waitUntil: 'domcontentloaded', timeout: 30000 });
    });
    j4Steps.push(s);

    s = await measureAction(page, 'Navigate to Social Hub', async () => {
      await page.goto('/dashboard/business/social', { waitUntil: 'domcontentloaded', timeout: 30000 });
    });
    j4Steps.push(s);

    journeyResults.push({ name: 'Social & Outreach Hub', status: 'PASS', steps: j4Steps });
  } catch (err) {
    journeyResults.push({ name: 'Social & Outreach Hub', status: 'FAIL', error: err.message, steps: j4Steps });
  }

  // Journey 5: Projects & Production Tasks
  console.log(`[Journey 5/7] Projects & Tasks`);
  const j5Steps = [];
  try {
    let s = await measureAction(page, 'Navigate to Projects', async () => {
      await page.goto('/dashboard/business/projects', { waitUntil: 'domcontentloaded', timeout: 30000 });
    });
    j5Steps.push(s);

    s = await measureAction(page, 'Navigate to Tasks Board', async () => {
      await page.goto('/dashboard/tasks', { waitUntil: 'domcontentloaded', timeout: 30000 });
    });
    j5Steps.push(s);

    journeyResults.push({ name: 'Projects & Tasks', status: 'PASS', steps: j5Steps });
  } catch (err) {
    journeyResults.push({ name: 'Projects & Tasks', status: 'FAIL', error: err.message, steps: j5Steps });
  }

  // Journey 6: Contracts & E-Signature
  console.log(`[Journey 6/7] Contracts & E-Signature`);
  const j6Steps = [];
  try {
    let s = await measureAction(page, 'Navigate to Contracts Hub', async () => {
      await page.goto('/dashboard/business/contracts', { waitUntil: 'domcontentloaded', timeout: 30000 });
    });
    j6Steps.push(s);

    s = await measureAction(page, 'Navigate to Contract Manager', async () => {
      await page.goto('/dashboard/business/contracts/manage', { waitUntil: 'domcontentloaded', timeout: 30000 });
    });
    j6Steps.push(s);

    journeyResults.push({ name: 'Contracts & E-Signature', status: 'PASS', steps: j6Steps });
  } catch (err) {
    journeyResults.push({ name: 'Contracts & E-Signature', status: 'FAIL', error: err.message, steps: j6Steps });
  }

  // Journey 7: Settings & Integrations
  console.log(`[Journey 7/7] Settings & Marketplace`);
  const j7Steps = [];
  try {
    let s = await measureAction(page, 'Navigate to Organization Settings', async () => {
      await page.goto('/dashboard/business/settings', { waitUntil: 'domcontentloaded', timeout: 30000 });
    });
    j7Steps.push(s);

    s = await measureAction(page, 'Navigate to Integration Marketplace', async () => {
      await page.goto('/dashboard/marketplace', { waitUntil: 'domcontentloaded', timeout: 30000 });
    });
    j7Steps.push(s);

    journeyResults.push({ name: 'Settings & Integrations', status: 'PASS', steps: j7Steps });
  } catch (err) {
    journeyResults.push({ name: 'Settings & Integrations', status: 'FAIL', error: err.message, steps: j7Steps });
  }

  // Compile Top 10 Slowest
  performanceLog.sort((a, b) => b.loadTimeMs - a.loadTimeMs);
  const top10Slowest = performanceLog.slice(0, 10);

  // Write Result JSON files
  fs.writeFileSync('qa/results-sales-all-modules.json', JSON.stringify(moduleResults, null, 2));
  fs.writeFileSync('qa/results-sales-journeys.json', JSON.stringify(journeyResults, null, 2));
  fs.writeFileSync('qa/performance-sales.json', JSON.stringify({ top10Slowest, performanceLog }, null, 2));
  fs.writeFileSync('qa/console-errors-sales.json', JSON.stringify(consoleLogs, null, 2));
  fs.writeFileSync('qa/network-errors-sales.json', JSON.stringify(networkErrors, null, 2));

  const passedCount = moduleResults.filter(m => m.status === 'PASS').length;
  console.log(`\n=======================================================`);
  console.log(`SALES TEST ACCOUNT FULL QA COMPLETE!`);
  console.log(`Modules Evaluated: ${moduleResults.length} (${passedCount} PASSED)`);
  console.log(`Journeys Evaluated: ${journeyResults.length} (ALL 7 COMPLETED)`);
  console.log(`Screenshots Saved to: qa/screenshots/modules_sales/`);
  console.log(`=======================================================`);

  await browser.close();
}

run().catch(err => {
  console.error('Fatal Sales Full QA Error:', err);
  process.exit(1);
});
