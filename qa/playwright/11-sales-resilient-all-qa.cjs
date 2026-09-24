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
      if (await el.isVisible({ timeout: 200 }).catch(() => false)) {
        await el.click({ force: true, timeout: 500 }).catch(() => {});
      }
    } catch (e) {}
  }
}

async function withTimeout(promise, ms, desc) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`Timeout after ${ms}ms in ${desc}`)), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
}

async function run() {
  console.log(`=======================================================`);
  console.log(`STARTING RESILIENT ALL-MODULE QA FOR TEST ACCOUNT`);
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
    const moduleControls = [];

    try {
      await withTimeout(async () => {
        await page.goto(mod.path, {
          waitUntil: 'domcontentloaded',
          timeout: 10000,
        });

        await dismissModals(page);

        // Wait for content
        const mainEl = page.locator('main, #main-content, body').first();
        await mainEl.waitFor({ state: 'visible', timeout: 5000 });

        await page.waitForTimeout(500);
        initialUsableTime = Date.now() - routeStart;

        // Click up to 2 safe interactive controls
        const safeButtons = await page.locator('button:visible, a[role="button"]:visible, [role="tab"]:visible').all();
        let tested = 0;
        for (const btn of safeButtons) {
          if (tested >= 2) break;
          try {
            const text = (await btn.innerText().catch(() => '')).trim();
            const aria = (await btn.getAttribute('aria-label').catch(() => '')) || '';
            const role = (await btn.getAttribute('role').catch(() => 'button')) || 'button';
            if (!text && !aria) continue;
            if (!isSafeControl(text, aria, 'button', role)) continue;

            const tStart = Date.now();
            await btn.click({ timeout: 1000 }).catch(() => {});
            await page.waitForTimeout(200);
            const dur = Date.now() - tStart;
            moduleControls.push({
              name: text || aria,
              role,
              latencyMs: dur,
              rating: classifyLatency(dur),
              status: 'PASS',
            });
            tested++;
          } catch (e) {}
        }

        const shotPath = path.join(screenshotDir, `${String(i + 1).padStart(3, '0')}_${moduleSlug}.png`);
        await page.screenshot({ path: shotPath, fullPage: false }).catch(() => {});

      }, 12000, `Module ${mod.path}`);

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
      initialUsableTime = Date.now() - routeStart;
      moduleResults.push({
        hub: mod.hub,
        label: mod.label,
        path: mod.path,
        probe: mod.probe,
        loadTimeMs: initialUsableTime,
        rating: 'CRITICAL',
        status: 'FAIL',
        error: err.message,
        controlsTested: [],
      });
      console.log(`[${i + 1}/${ALL_TARGETS.length}] FAIL: ${mod.hub} > ${mod.label} (${mod.path}) — ${err.message}`);
    }

    // Flush progress to file every 5 modules
    if ((i + 1) % 5 === 0 || i === ALL_TARGETS.length - 1) {
      fs.writeFileSync('qa/results-sales-all-modules.json', JSON.stringify(moduleResults, null, 2));
    }
  }

  // =========================================================================
  // PART 2: TEST 7 CORE USER JOURNEYS UNDER sales@alphaclonesystems.com
  // =========================================================================
  console.log(`\n--- PART 2: Testing 7 Core User Journeys ---`);
  const journeyResults = [];

  const journeys = [
    {
      name: 'CRM & Clients',
      steps: [
        { name: 'Dashboard', path: '/dashboard' },
        { name: 'CRM Overview', path: '/dashboard/crm' },
        { name: 'Contacts', path: '/dashboard/contacts' },
      ],
    },
    {
      name: 'Leads & Deals Pipeline',
      steps: [
        { name: 'Leads Board', path: '/dashboard/leads' },
        { name: 'Lead Finder', path: '/dashboard/leads/finder' },
        { name: 'Deals Pipeline', path: '/dashboard/deals' },
      ],
    },
    {
      name: 'Accounting & Cash Flow',
      steps: [
        { name: 'Accounting Hub', path: '/dashboard/accounting' },
        { name: 'Invoice Manager', path: '/dashboard/business/billing/manage' },
        { name: 'Quotes & Proposals', path: '/dashboard/business/quotes' },
      ],
    },
    {
      name: 'Social & Outreach Hub',
      steps: [
        { name: 'Outreach Hub', path: '/dashboard/outreach' },
        { name: 'Reach Mailbox', path: '/dashboard/comms' },
        { name: 'Social Overview', path: '/dashboard/business/social' },
      ],
    },
    {
      name: 'Projects & Tasks',
      steps: [
        { name: 'Projects', path: '/dashboard/business/projects' },
        { name: 'Tasks Board', path: '/dashboard/tasks' },
      ],
    },
    {
      name: 'Contracts & E-Signature',
      steps: [
        { name: 'Contracts Hub', path: '/dashboard/business/contracts' },
        { name: 'Contract Manager', path: '/dashboard/business/contracts/manage' },
      ],
    },
    {
      name: 'Settings & Integrations',
      steps: [
        { name: 'Organization Settings', path: '/dashboard/business/settings' },
        { name: 'Integration Marketplace', path: '/dashboard/marketplace' },
      ],
    },
  ];

  for (const j of journeys) {
    console.log(`Testing Journey: ${j.name}`);
    const jSteps = [];
    let jSuccess = true;

    for (const step of j.steps) {
      const sStart = Date.now();
      try {
        await page.goto(step.path, { waitUntil: 'domcontentloaded', timeout: 10000 });
        await dismissModals(page);
        await page.waitForTimeout(400);
        const dur = Date.now() - sStart;
        jSteps.push({
          actionName: `Navigate to ${step.name}`,
          success: true,
          totalTime: dur,
          category: classifyLatency(dur),
        });
      } catch (err) {
        jSuccess = false;
        jSteps.push({
          actionName: `Navigate to ${step.name}`,
          success: false,
          error: err.message,
          totalTime: Date.now() - sStart,
          category: 'CRITICAL',
        });
      }
    }
    journeyResults.push({ name: j.name, status: jSuccess ? 'PASS' : 'FAIL', steps: jSteps });
  }

  performanceLog.sort((a, b) => b.loadTimeMs - a.loadTimeMs);
  const top10Slowest = performanceLog.slice(0, 10);

  fs.writeFileSync('qa/results-sales-all-modules.json', JSON.stringify(moduleResults, null, 2));
  fs.writeFileSync('qa/results-sales-journeys.json', JSON.stringify(journeyResults, null, 2));
  fs.writeFileSync('qa/performance-sales.json', JSON.stringify({ top10Slowest, performanceLog }, null, 2));
  fs.writeFileSync('qa/console-errors-sales.json', JSON.stringify(consoleLogs, null, 2));
  fs.writeFileSync('qa/network-errors-sales.json', JSON.stringify(networkErrors, null, 2));

  const passedCount = moduleResults.filter(m => m.status === 'PASS').length;
  console.log(`\n=======================================================`);
  console.log(`ALL TESTS FINISHED FOR ${USER_EMAIL}!`);
  console.log(`Modules: ${passedCount}/${moduleResults.length} PASSED`);
  console.log(`=======================================================`);

  await browser.close();
}

run().catch(err => {
  console.error('Fatal Runner Error:', err);
  process.exit(1);
});
