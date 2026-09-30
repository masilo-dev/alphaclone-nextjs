/**
 * 17-client-portal-security-qa.cjs
 *
 * QA Domain: Client Portal + Security + Tenant Isolation
 * Target: https://alphaclonesystems.com
 *
 * Sections:
 *  A. Find existing portal users
 *  B. Client portal login + isolation test
 *  C. Tenant dashboard protection (unauth redirect)
 *  D. IDOR object ID manipulation
 *  E. API / RLS tenant isolation (anon key)
 *  F. Contract rendering
 *  G. Cross-module client consistency
 *  H. Session expiry / expired cookie behavior
 */

'use strict';

require('dotenv').config({ path: '.env.production.local' });

const path    = require('path');
const fs      = require('fs');
const { chromium }    = require('playwright');
const { createClient } = require('@supabase/supabase-js');

// ── Config ────────────────────────────────────────────────────────────────────
const BASE_URL   = 'https://alphaclonesystems.com';
const TENANT_ID  = '066eb88e-3fb0-45c9-b4d1-c3c2063ea0d4';

const SUPABASE_URL      = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY          = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ANON_KEY) {
  console.error('[FATAL] Missing required env vars. Check .env.production.local');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const anon = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const SCREENSHOT_DIR = path.join(process.cwd(), 'qa', 'screenshots');
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const BROWSER_ARGS = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'];

// ── Result tracking ───────────────────────────────────────────────────────────
const findings     = [];
const passedChecks = [];
const consoleErrors  = [];
const networkErrors  = [];
const performanceTimings = {};

let findingSeq = 0;

function addFinding({ severity, title, route, steps, expected, actual, evidence, rootCause }) {
  findingSeq++;
  const id = `FIND-${String(findingSeq).padStart(3, '0')}`;
  findings.push({ id, severity, title, route, steps, expected, actual, evidence, rootCause });
  console.error(`\n  ❌ [${severity}] ${id}: ${title}`);
  console.error(`     Route: ${route}`);
  console.error(`     Actual: ${actual}`);
}

function addPass(msg) {
  passedChecks.push(msg);
  console.log(`  ✅ PASS: ${msg}`);
}

function attachTelemetry(page) {
  page.on('console', msg => {
    if (['error','warn'].includes(msg.type())) {
      const text = msg.text();
      consoleErrors.push(`[${msg.type().toUpperCase()}] ${text}`);
    }
  });
  page.on('pageerror', err => {
    consoleErrors.push(`[PAGEERROR] ${err.message}`);
  });
  page.on('response', res => {
    if (res.status() >= 400 && !res.url().includes('favicon')) {
      networkErrors.push(`HTTP ${res.status()} ${res.url()}`);
    }
  });
  page.on('requestfailed', req => {
    networkErrors.push(`FAILED ${req.url()} – ${req.failure()?.errorText || 'unknown'}`);
  });
}

/**
 * Generate a Supabase magic-link session and return browser cookies for
 * the given email (defaults to the tenant admin email).
 */
async function getBrowserCookiesForEmail(email) {
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });
  if (linkErr) throw new Error(`generateLink failed for ${email}: ${linkErr.message}`);

  const { data: authData, error: authErr } = await anon.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: 'magiclink',
  });
  if (authErr) throw new Error(`verifyOtp failed for ${email}: ${authErr.message}`);

  const session = authData.session;
  const domain  = new URL(BASE_URL).hostname;

  // Build the two cookies Supabase SSR expects
  const cookieName = `sb-${SUPABASE_URL.split('//')[1].split('.')[0]}-auth-token`;
  const cookieValue = JSON.stringify([session.access_token, session.refresh_token]);

  return [
    {
      name:     cookieName,
      value:    cookieValue,
      domain:   `.${domain}`,
      path:     '/',
      httpOnly: false,
      secure:   true,
      sameSite: 'Lax',
    },
  ];
}

// ── Section A: Find portal users ──────────────────────────────────────────────
async function sectionA() {
  console.log('\n════════════════════════════════════════════');
  console.log('A. Find Existing Client Portal Users');
  console.log('════════════════════════════════════════════');

  const { data: portalClients, error } = await admin
    .from('business_clients')
    .select('id, name, email, portal_enabled, portal_user_id')
    .eq('tenant_id', TENANT_ID)
    .eq('portal_enabled', true)
    .limit(5);

  if (error) {
    console.log(`  ⚠  Query error: ${error.message}`);
  }

  console.log(`  Portal-enabled clients found: ${portalClients?.length ?? 0}`);
  if (portalClients?.length) {
    portalClients.forEach(c =>
      console.log(`    • ${c.name} <${c.email}> id=${c.id} portal_user_id=${c.portal_user_id}`)
    );
  }

  // Fallback: any clients at all
  const { data: anyClients } = await admin
    .from('business_clients')
    .select('id, name, email, portal_enabled, portal_user_id')
    .eq('tenant_id', TENANT_ID)
    .limit(10);

  console.log(`  Total clients in tenant: ${anyClients?.length ?? 0}`);
  if (anyClients?.length) {
    anyClients.forEach(c =>
      console.log(`    • ${c.name} <${c.email}> id=${c.id} portal_enabled=${c.portal_enabled}`)
    );
  }

  return { portalClients: portalClients || [], anyClients: anyClients || [] };
}

// ── Section B: Client Portal Login Test ───────────────────────────────────────
async function sectionB(portalClients) {
  console.log('\n════════════════════════════════════════════');
  console.log('B. Client Portal Login & Isolation Test');
  console.log('════════════════════════════════════════════');

  const portalRoutes = ['/portal', '/client-portal', '/workspace', '/client'];

  if (!portalClients.length) {
    console.log('  ⚠  No portal-enabled clients found — running structural route checks only');
    addFinding({
      severity: 'P2',
      title: 'No portal-enabled clients exist for isolation testing',
      route: '/portal',
      steps: [
        'Query business_clients WHERE portal_enabled=true AND tenant_id=TENANT_ID',
      ],
      expected: 'At least one client with portal access to test isolation',
      actual: 'Zero portal-enabled clients found; full isolation test BLOCKED',
      evidence: 'Supabase query returned 0 rows',
      rootCause: 'Client portal feature may not be provisioned or portal_enabled flag not set',
    });

    // Still probe routes without a session
    const browser = await chromium.launch({ headless: true, args: BROWSER_ARGS });
    const context = await browser.newContext({ baseURL: BASE_URL });
    const page = await context.newPage();
    attachTelemetry(page);

    for (const route of portalRoutes) {
      const t0 = Date.now();
      const resp = await page.goto(BASE_URL + route, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => null);
      const ms = Date.now() - t0;
      const finalUrl = page.url();
      const status = resp?.status() ?? 0;
      console.log(`  [${route}] → ${finalUrl} (HTTP ${status}) ${ms}ms`);

      if (status === 500) {
        addFinding({
          severity: 'P1',
          title: `Portal route ${route} returns 500 (unauthenticated)`,
          route,
          steps: [`Navigate to ${BASE_URL + route} without session`],
          expected: 'Redirect to login page or 404',
          actual: `HTTP 500 server error`,
          evidence: `Status ${status}, finalUrl=${finalUrl}`,
          rootCause: 'Server-side crash on unauthenticated portal access',
        });
      } else if (!finalUrl.includes('/login') && !finalUrl.includes('/auth') && status !== 404) {
        // 200 response on a portal route without auth — suspicious
        if (status === 200) {
          const bodyText = await page.content().catch(() => '');
          const looksLikeData = /client|portal|dashboard/i.test(bodyText.substring(0, 3000));
          if (looksLikeData) {
            addFinding({
              severity: 'P0_SECURITY',
              title: `Portal route ${route} accessible without authentication`,
              route,
              steps: [`Navigate to ${BASE_URL + route} without any session cookies`],
              expected: 'Redirect to /login',
              actual: `HTTP 200 with apparent portal content — no auth required`,
              evidence: `finalUrl=${finalUrl}, status=200`,
              rootCause: 'Missing authentication middleware on portal route',
            });
          } else {
            addPass(`${route} — no portal content exposed without auth (HTTP ${status})`);
          }
        } else {
          addPass(`${route} → HTTP ${status} (not 500, not leaking data)`);
        }
      } else {
        addPass(`${route} → correctly redirects to login or returns 404`);
      }
    }

    await browser.close();
    return;
  }

  // We have portal clients — test with real portal session
  const client = portalClients[0];
  console.log(`  Testing portal isolation for: ${client.name} <${client.email}>`);

  const browser = await chromium.launch({ headless: true, args: BROWSER_ARGS });

  try {
    // Generate portal session
    let portalCookies;
    try {
      portalCookies = await getBrowserCookiesForEmail(client.email);
    } catch (err) {
      console.log(`  ⚠  Could not generate portal session: ${err.message}`);
      addFinding({
        severity: 'P2',
        title: 'Cannot generate magic-link for portal client email',
        route: '/portal',
        steps: [`Generate magic-link for ${client.email}`],
        expected: 'Session created successfully',
        actual: err.message,
        evidence: err.message,
        rootCause: 'Portal client email not in Supabase auth.users, or magic-link disabled',
      });
      await browser.close();
      return;
    }

    // Incognito context — no shared cookies
    const context = await browser.newContext({ baseURL: BASE_URL });
    await context.addCookies(portalCookies);
    const page = await context.newPage();
    attachTelemetry(page);

    // B1: Navigate to portal
    const t0 = Date.now();
    await page.goto(BASE_URL + '/portal', { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
    performanceTimings['portal_load'] = `${Date.now() - t0}ms`;
    const portalUrl = page.url();
    console.log(`  Portal URL after navigation: ${portalUrl}`);

    if (portalUrl.includes('/login') || portalUrl.includes('/auth')) {
      addFinding({
        severity: 'P1',
        title: 'Valid portal session does not grant access to /portal',
        route: '/portal',
        steps: ['Generate portal client magic-link', 'Inject cookies', 'Navigate to /portal'],
        expected: 'Portal workspace rendered for client',
        actual: `Redirected to ${portalUrl}`,
        evidence: `Final URL: ${portalUrl}`,
        rootCause: 'Session not recognised, or portal route auth guard not matching portal user role',
      });
    } else {
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'portal-client-view.png') });
      addPass(`Portal client ${client.name} can access /portal`);

      // B2: Client CANNOT see other clients' data
      const pageContent = await page.content();
      const otherClientNames = portalClients
        .filter(c => c.id !== client.id)
        .map(c => c.name);

      for (const name of otherClientNames) {
        if (pageContent.includes(name)) {
          addFinding({
            severity: 'P0_SECURITY',
            title: `Portal exposes another client's name: "${name}"`,
            route: '/portal',
            steps: [
              `Log in as ${client.name}`,
              'Inspect rendered portal page content',
            ],
            expected: `Only ${client.name}'s data visible`,
            actual: `Name "${name}" (another client) found in page content`,
            evidence: 'Page HTML contains cross-client name',
            rootCause: 'Missing client-scoped data filter on portal render',
          });
        }
      }
    }

    // B3: Portal user CANNOT access tenant /dashboard
    const dashResp = await page.goto(BASE_URL + '/dashboard', { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => null);
    const dashUrl  = page.url();
    const dashStatus = dashResp?.status() ?? 0;
    console.log(`  /dashboard as portal user → ${dashUrl} (HTTP ${dashStatus})`);

    if (dashUrl.includes('/dashboard') && dashStatus === 200) {
      // Check if we're looking at actual tenant dashboard content
      const dashContent = await page.content();
      if (/CRM|Deals|Contacts|Pipeline|Leads/i.test(dashContent)) {
        addFinding({
          severity: 'P0_SECURITY',
          title: 'Portal user can access tenant /dashboard',
          route: '/dashboard',
          steps: ['Authenticate as portal client', 'Navigate to /dashboard'],
          expected: 'Redirect to /login or /portal, NOT tenant dashboard',
          actual: `HTTP 200 with tenant dashboard content at ${dashUrl}`,
          evidence: 'Dashboard content rendered for portal user',
          rootCause: 'Role-based route guard does not block portal_client role from tenant dashboard',
        });
      } else {
        addPass('Portal user sees /dashboard but content is not tenant dashboard data');
      }
    } else {
      addPass(`Portal user blocked from /dashboard → redirected to ${dashUrl}`);
    }

    await context.close();
  } finally {
    await browser.close();
  }
}

// ── Section C: Tenant Dashboard Protection ────────────────────────────────────
async function sectionC() {
  console.log('\n════════════════════════════════════════════');
  console.log('C. Tenant Dashboard Protection (Unauth Redirect)');
  console.log('════════════════════════════════════════════');

  const protectedRoutes = [
    '/dashboard',
    '/dashboard/crm',
    '/dashboard/clients',
    '/dashboard/deals',
    '/dashboard/projects',
    '/dashboard/contracts',
    '/dashboard/settings',
  ];

  const browser = await chromium.launch({ headless: true, args: BROWSER_ARGS });
  const context = await browser.newContext({ baseURL: BASE_URL });
  const page = await context.newPage();
  attachTelemetry(page);

  try {
    for (const route of protectedRoutes) {
      const t0 = Date.now();
      const resp = await page.goto(BASE_URL + route, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => null);
      const ms = Date.now() - t0;
      const finalUrl = page.url();
      const status = resp?.status() ?? 0;

      console.log(`  [${route}] → ${finalUrl} (HTTP ${status}) ${ms}ms`);
      performanceTimings[`unauth_redirect${route.replace(/\//g, '_')}`] = `${ms}ms`;

      if (status === 500) {
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'tenant-protection-redirect.png') });
        addFinding({
          severity: 'P0_SECURITY',
          title: `Protected route ${route} returns 500 without auth`,
          route,
          steps: ['Open fresh browser (no cookies)', `Navigate to ${BASE_URL + route}`],
          expected: 'Redirect to /login',
          actual: `HTTP 500 server crash`,
          evidence: `Status 500, final URL: ${finalUrl}`,
          rootCause: 'Server-side rendering failure before auth check',
        });
      } else if (finalUrl.includes('/login') || finalUrl.includes('/auth/login') || finalUrl.includes('/signin')) {
        addPass(`Unauth access to ${route} → correctly redirects to login`);
        // Take screenshot of first redirect for evidence
        if (route === '/dashboard') {
          await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'tenant-protection-redirect.png') });
        }
      } else if (finalUrl.includes(route) && status === 200) {
        // Still on the protected route — auth bypass
        const content = await page.content();
        const hasDashboardContent = /CRM|Deals|Contacts|Pipeline|Leads|Settings/i.test(content);
        if (hasDashboardContent) {
          await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'tenant-protection-redirect.png') });
          addFinding({
            severity: 'P0_SECURITY',
            title: `Protected route ${route} accessible without authentication`,
            route,
            steps: ['Open fresh browser (no cookies)', `Navigate to ${BASE_URL + route}`],
            expected: 'Redirect to /login',
            actual: `HTTP 200 with dashboard content — no auth required!`,
            evidence: `Final URL: ${finalUrl}, content contains dashboard keywords`,
            rootCause: 'Authentication middleware not applied to this route',
          });
        } else {
          addPass(`${route} returns 200 but no dashboard content exposed (may be loading state)`);
        }
      } else {
        addPass(`${route} → ${finalUrl} (HTTP ${status}) — no data exposure`);
      }
    }
  } finally {
    await browser.close();
  }
}

// ── Section D: IDOR Testing ───────────────────────────────────────────────────
async function sectionD(anyClients) {
  console.log('\n════════════════════════════════════════════');
  console.log('D. IDOR Object ID Manipulation');
  console.log('════════════════════════════════════════════');

  if (!anyClients.length) {
    console.log('  ⚠  No clients available for IDOR test — BLOCKED');
    addFinding({
      severity: 'P2',
      title: 'IDOR test BLOCKED — no client IDs available',
      route: '/dashboard/clients/[id]',
      steps: ['Query business_clients'],
      expected: 'Client IDs to test',
      actual: 'Zero rows returned',
      evidence: 'Empty query result',
      rootCause: 'No clients in tenant; test cannot run',
    });
    return;
  }

  // Get tenant cookies for authenticated session
  let tenantCookies;
  try {
    tenantCookies = await getBrowserCookiesForEmail('bonnie@alphaclonesystems.com');
  } catch (err) {
    console.log(`  ⚠  Cannot get tenant cookies: ${err.message}`);
    return;
  }

  // Manufacture non-existent / cross-tenant IDs to probe
  const realId = anyClients[0].id;
  const idVariants = generateIdVariants(realId);

  console.log(`  Real client ID: ${realId}`);
  console.log(`  Testing ${idVariants.length} ID variants for IDOR…`);

  const testRouteTemplates = [
    id => `/dashboard/clients/${id}`,
    id => `/dashboard/projects?clientId=${id}`,
  ];

  // Also test with anon key directly querying another tenant's data
  const { data: crossTenantData, error: crossErr } = await admin
    .from('business_clients')
    .select('id, name, tenant_id')
    .neq('tenant_id', TENANT_ID)
    .limit(3);

  const crossIds = (crossTenantData || []).map(r => r.id);
  console.log(`  Cross-tenant IDs found for IDOR test: ${crossIds.length}`);

  const browser = await chromium.launch({ headless: true, args: BROWSER_ARGS });
  const context = await browser.newContext({ baseURL: BASE_URL });
  await context.addCookies(tenantCookies);
  const page = await context.newPage();
  attachTelemetry(page);

  try {
    // Inject localStorage for tenant context
    await context.addInitScript(() => {
      localStorage.setItem('welcome_seen_681241e7-6e31-455b-89e0-a2bfda699135', 'true');
      localStorage.setItem('business_welcome_seen_681241e7-6e31-455b-89e0-a2bfda699135', '1');
    });

    const allIdsToTest = [...idVariants, ...crossIds];

    for (const routeFn of testRouteTemplates) {
      for (const testId of allIdsToTest.slice(0, 6)) { // cap at 6 per route
        const route = routeFn(testId);
        const t0 = Date.now();
        const resp = await page.goto(BASE_URL + route, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => null);
        const ms = Date.now() - t0;
        const finalUrl = page.url();
        const status = resp?.status() ?? 0;

        const content = await page.content().catch(() => '');
        const containsData = detectDataLeakage(content);

        console.log(`  [IDOR] ${route} → HTTP ${status} in ${ms}ms | data=${containsData}`);

        if (containsData && status === 200) {
          await page.screenshot({ path: path.join(SCREENSHOT_DIR, `idor-leak-${testId.substring(0,8)}.png`) });
          addFinding({
            severity: 'P0_SECURITY',
            title: `IDOR: Manipulated ID exposes data at ${route}`,
            route,
            steps: [
              'Log in as tenant bonnie@alphaclonesystems.com',
              `Navigate to ${BASE_URL + route} with non-owned ID`,
            ],
            expected: 'HTTP 404 or 403, no client data rendered',
            actual: `HTTP ${status} with data content rendered for ID ${testId}`,
            evidence: `Data leak detected in page content`,
            rootCause: 'Missing tenant_id scoping on server-side data fetch for this route',
          });
        } else if (status === 404 || status === 403 || finalUrl.includes('/404') || finalUrl.includes('/not-found')) {
          addPass(`IDOR probe ${route} → correctly returns ${status} / not-found`);
        } else if (status === 500) {
          addFinding({
            severity: 'P1',
            title: `IDOR probe causes 500 error on ${route}`,
            route,
            steps: [`Navigate to ${BASE_URL + route} with modified ID`],
            expected: '404 or 403',
            actual: 'HTTP 500 server crash on invalid ID',
            evidence: `Status 500, finalUrl=${finalUrl}`,
            rootCause: 'Server does not validate ID before fetching; uncaught DB error',
          });
        } else {
          addPass(`IDOR probe ${route} → HTTP ${status}, no data leakage detected`);
        }
      }
    }
  } finally {
    await browser.close();
  }
}

/** Generate UUID variants likely to resolve to different tenants */
function generateIdVariants(uuid) {
  if (!uuid || uuid.length < 36) return ['00000000-0000-0000-0000-000000000001'];
  const parts = uuid.split('-');

  // Flip last char of last segment
  const flipped = [...uuid];
  const lastIdx = uuid.length - 1;
  flipped[lastIdx] = flipped[lastIdx] === '0' ? '1' : '0';

  // Increment last byte
  const incremented = [...uuid];
  const secondLast = uuid.length - 2;
  incremented[secondLast] = String.fromCharCode(
    (incremented[secondLast].charCodeAt(0) + 1 - 48) % 10 + 48
  );

  return [
    flipped.join(''),
    incremented.join(''),
    '00000000-0000-0000-0000-000000000001',
    'ffffffff-ffff-ffff-ffff-ffffffffffff',
  ];
}

/** Heuristic: does page content contain client data? */
function detectDataLeakage(html) {
  if (!html) return false;
  // Must show meaningful content, not just a 404 or error page
  const looksLikeErrorPage = /404|not found|page not found|no record|doesn't exist/i.test(html.substring(0, 5000));
  if (looksLikeErrorPage) return false;
  // Look for data fields typical of client records
  const dataPatterns = [
    /client[_\s]name/i,
    /email.*@/i,
    /"name"\s*:/,
    /"email"\s*:/,
    /phone.*\d{7}/,
    /"tenant_id"\s*:/,
  ];
  return dataPatterns.some(p => p.test(html.substring(0, 20000)));
}

// ── Section E: API / RLS Tenant Isolation ─────────────────────────────────────
async function sectionE() {
  console.log('\n════════════════════════════════════════════');
  console.log('E. API / RLS Tenant Isolation (Anon Key)');
  console.log('════════════════════════════════════════════');

  const tables = [
    { table: 'business_clients', cols: 'id, name, tenant_id' },
    { table: 'leads',            cols: 'id, email, tenant_id' },
    { table: 'deals',            cols: 'id, name, tenant_id' },
    { table: 'contracts',        cols: 'id, title, tenant_id' },
    { table: 'projects',         cols: 'id, name, tenant_id' },
  ];

  for (const { table, cols } of tables) {
    const t0 = Date.now();
    const { data, error } = await anon.from(table).select(cols).limit(20);
    const ms = Date.now() - t0;

    console.log(`  [RLS] ${table}: ${data?.length ?? 'N/A'} rows returned | error=${error?.message ?? 'none'} (${ms}ms)`);

    if (error) {
      // RLS error is actually good — blocked as expected
      if (/rls|permission|policy|denied/i.test(error.message)) {
        addPass(`RLS blocks anon access to ${table}: ${error.message}`);
      } else {
        addFinding({
          severity: 'P1',
          title: `Unexpected error querying ${table} with anon key`,
          route: `/api/${table}`,
          steps: [`createClient(url, ANON_KEY).from('${table}').select('${cols}')`],
          expected: '0 rows or RLS policy error',
          actual: `Error: ${error.message}`,
          evidence: error.message,
          rootCause: 'Table may not exist or unexpected RLS configuration',
        });
      }
      continue;
    }

    if (!data || data.length === 0) {
      addPass(`RLS correctly returns 0 rows from ${table} for unauthenticated anon client`);
      continue;
    }

    // Data returned — check if any cross-tenant rows slipped through
    const crossTenantRows = data.filter(row => row.tenant_id && row.tenant_id !== TENANT_ID);
    const ownTenantRows   = data.filter(row => row.tenant_id && row.tenant_id === TENANT_ID);

    if (crossTenantRows.length > 0) {
      addFinding({
        severity: 'P0_SECURITY',
        title: `RLS FAILURE: Anon key returns cross-tenant rows from ${table}`,
        route: `/supabase/${table}`,
        steps: [
          `createClient(SUPABASE_URL, ANON_KEY)`,
          `anon.from('${table}').select('${cols}') — NO session, NO tenant filter`,
        ],
        expected: '0 rows (RLS should enforce tenant isolation)',
        actual: `${crossTenantRows.length} rows from OTHER tenants returned without authentication`,
        evidence: `tenant_ids exposed: ${[...new Set(crossTenantRows.map(r => r.tenant_id))].join(', ')}`,
        rootCause: 'Row Level Security policy missing or misconfigured on table',
      });
    } else if (ownTenantRows.length > 0) {
      addFinding({
        severity: 'P0_SECURITY',
        title: `RLS FAILURE: Anon key returns ${ownTenantRows.length} rows from ${table} without auth`,
        route: `/supabase/${table}`,
        steps: [
          `createClient(SUPABASE_URL, ANON_KEY)`,
          `anon.from('${table}').select('${cols}') — NO session`,
        ],
        expected: '0 rows (anon should not read tenant data)',
        actual: `${ownTenantRows.length} tenant rows exposed without any authentication`,
        evidence: `First row id: ${ownTenantRows[0].id}, tenant_id: ${ownTenantRows[0].tenant_id}`,
        rootCause: 'RLS policy for anon role is absent or uses overly permissive SELECT',
      });
    } else {
      // Data returned but no tenant_id column (possible)
      addFinding({
        severity: 'P1',
        title: `Anon key returns ${data.length} rows from ${table} (no tenant_id to verify cross-tenant)`,
        route: `/supabase/${table}`,
        steps: [
          `createClient(SUPABASE_URL, ANON_KEY).from('${table}').select('${cols}')`,
        ],
        expected: '0 rows for unauthenticated access',
        actual: `${data.length} rows returned — RLS may not be enforced`,
        evidence: `Sample row: ${JSON.stringify(data[0])}`,
        rootCause: 'RLS policy for anon role may be missing or too permissive',
      });
    }
  }
}

// ── Section F: Contract Rendering ─────────────────────────────────────────────
async function sectionF() {
  console.log('\n════════════════════════════════════════════');
  console.log('F. Contract Rendering Test');
  console.log('════════════════════════════════════════════');

  // Find a contract via admin
  const { data: contracts, error } = await admin
    .from('contracts')
    .select('id, title, status, content')
    .eq('tenant_id', TENANT_ID)
    .limit(5);

  if (error || !contracts?.length) {
    console.log(`  ⚠  No contracts found: ${error?.message || 'empty'} — BLOCKED`);
    addFinding({
      severity: 'P3',
      title: 'Contract rendering test BLOCKED — no contracts in tenant',
      route: '/dashboard/contracts',
      steps: ['Query contracts table for tenant'],
      expected: 'At least one contract to render-test',
      actual: error?.message || 'Zero contracts returned',
      evidence: 'Empty Supabase query result',
      rootCause: 'No contracts created yet in this tenant',
    });
    return;
  }

  console.log(`  Found ${contracts.length} contracts to test`);
  contracts.forEach(c => console.log(`    • ${c.title} (${c.status}) id=${c.id}`));

  let tenantCookies;
  try {
    tenantCookies = await getBrowserCookiesForEmail('bonnie@alphaclonesystems.com');
  } catch (err) {
    console.log(`  ⚠  Cannot get tenant cookies: ${err.message}`);
    return;
  }

  const browser = await chromium.launch({ headless: true, args: BROWSER_ARGS });
  const context = await browser.newContext({ baseURL: BASE_URL });
  await context.addCookies(tenantCookies);
  await context.addInitScript(() => {
    localStorage.setItem('welcome_seen_681241e7-6e31-455b-89e0-a2bfda699135', 'true');
    localStorage.setItem('business_welcome_seen_681241e7-6e31-455b-89e0-a2bfda699135', '1');
  });

  const page = await context.newPage();
  attachTelemetry(page);

  try {
    const contract = contracts[0];
    const contractRoute = `/dashboard/contracts/${contract.id}`;

    const t0 = Date.now();
    const resp = await page.goto(BASE_URL + contractRoute, { waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => null);
    performanceTimings['contract_page_load'] = `${Date.now() - t0}ms`;

    const finalUrl = page.url();
    const status = resp?.status() ?? 0;
    console.log(`  Contract page: ${finalUrl} (HTTP ${status})`);

    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'contract-render.png') });

    const content = await page.content();
    const bodyText = await page.evaluate(() => document.body?.innerText || '').catch(() => '');

    // CRITICAL: detect bad rendering patterns
    const badPatterns = [
      { pattern: /\{\{[^}]+\}\}/,        label: 'Unrendered template variables {{var}}' },
      { pattern: /&lt;[a-z]/i,           label: 'HTML-escaped markup &lt;tag&gt;' },
      { pattern: /"content"\s*:\s*"/,    label: 'Raw JSON in page body' },
      { pattern: /<html[^>]*>.*<body/is, label: 'Raw HTML document in view' },
      { pattern: /\[object Object\]/,    label: '[object Object] serialisation artifact' },
      { pattern: /undefined/,            label: 'Unresolved "undefined" variable' },
      { pattern: /null/,                 label: 'Unresolved "null" value in content' },
    ];

    let renderIssues = [];
    for (const { pattern, label } of badPatterns) {
      if (pattern.test(bodyText.substring(0, 10000))) {
        renderIssues.push(label);
      }
    }

    if (renderIssues.length > 0) {
      addFinding({
        severity: 'P1',
        title: `Contract ${contract.title} renders with bad template artifacts`,
        route: contractRoute,
        steps: [
          'Log in as tenant admin',
          `Navigate to ${BASE_URL + contractRoute}`,
          'Inspect rendered page body text',
        ],
        expected: 'Formatted contract document with proper variable substitution',
        actual: `Rendering issues detected: ${renderIssues.join('; ')}`,
        evidence: `Screenshot: qa/screenshots/contract-render.png | Issues: ${renderIssues.join(', ')}`,
        rootCause: 'Contract template engine not substituting variables, or content serialized as raw JSON/HTML',
      });
    } else if (status === 200 && finalUrl.includes('/contracts/')) {
      addPass(`Contract "${contract.title}" renders without raw template artifacts`);
    } else if (status === 404) {
      addFinding({
        severity: 'P1',
        title: `Contract detail page returns 404 for valid contract ID`,
        route: contractRoute,
        steps: ['Navigate to existing contract by ID'],
        expected: 'Contract document rendered',
        actual: `HTTP 404 — route not found`,
        evidence: `ID ${contract.id}, status=404`,
        rootCause: 'Contract detail route not implemented or ID format mismatch',
      });
    } else {
      addPass(`Contract page loaded (HTTP ${status}) at ${finalUrl}`);
    }

    // Also check: contracts list page renders
    const t1 = Date.now();
    await page.goto(BASE_URL + '/dashboard/contracts', { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
    performanceTimings['contracts_list_load'] = `${Date.now() - t1}ms`;
    const listContent = await page.content();
    if (listContent.includes(contract.title)) {
      addPass(`Contracts list page shows contract "${contract.title}"`);
    }
  } finally {
    await browser.close();
  }
}

// ── Section G: Cross-Module Client Consistency ────────────────────────────────
async function sectionG(anyClients) {
  console.log('\n════════════════════════════════════════════');
  console.log('G. Cross-Module Client Consistency');
  console.log('════════════════════════════════════════════');

  if (!anyClients.length) {
    console.log('  ⚠  No clients — BLOCKED');
    return;
  }

  const target = anyClients[0];
  console.log(`  Target client: ${target.name} (${target.id})`);

  let tenantCookies;
  try {
    tenantCookies = await getBrowserCookiesForEmail('bonnie@alphaclonesystems.com');
  } catch (err) {
    console.log(`  ⚠  Cannot get cookies: ${err.message}`);
    return;
  }

  const browser = await chromium.launch({ headless: true, args: BROWSER_ARGS });
  const context = await browser.newContext({ baseURL: BASE_URL });
  await context.addCookies(tenantCookies);
  await context.addInitScript(() => {
    localStorage.setItem('welcome_seen_681241e7-6e31-455b-89e0-a2bfda699135', 'true');
    localStorage.setItem('business_welcome_seen_681241e7-6e31-455b-89e0-a2bfda699135', '1');
  });

  const page = await context.newPage();
  attachTelemetry(page);

  try {
    // Path 1: Clients list → client detail
    const t0 = Date.now();
    await page.goto(BASE_URL + '/dashboard/clients', { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(2000);
    const clientsUrl = page.url();
    console.log(`  [G1] Clients list → ${clientsUrl}`);

    const clientLink = page.locator(`text=${target.name}`).first();
    const clientLinkVisible = await clientLink.isVisible({ timeout: 3000 }).catch(() => false);

    let detailUrlFromList = null;
    if (clientLinkVisible) {
      await clientLink.click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(1500);
      detailUrlFromList = page.url();
      console.log(`    → ${detailUrlFromList}`);
      addPass(`G1: Navigated to client detail from clients list: ${detailUrlFromList}`);
    } else {
      console.log(`  ⚠  Client "${target.name}" not visible in list (may need scroll / search)`);
    }

    // Path 2: Direct URL by ID
    const directUrl = `${BASE_URL}/dashboard/clients/${target.id}`;
    await page.goto(directUrl, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const directFinalUrl = page.url();
    const directContent = await page.content();
    const directHasName = directContent.includes(target.name);
    console.log(`  [G2] Direct client URL (${target.id}) → ${directFinalUrl} | hasName=${directHasName}`);
    performanceTimings['client_detail_direct'] = `${Date.now() - t0}ms`;

    if (!directHasName && !directFinalUrl.includes('/404')) {
      addFinding({
        severity: 'P2',
        title: `Client detail page does not display client name "${target.name}"`,
        route: `/dashboard/clients/${target.id}`,
        steps: [`Navigate to ${directUrl}`],
        expected: `Page renders client name "${target.name}"`,
        actual: 'Client name not found in page content',
        evidence: `finalUrl=${directFinalUrl}`,
        rootCause: 'Client data not rendered or route mismatch',
      });
    } else if (directHasName) {
      addPass(`G2: Direct client URL renders correct client name "${target.name}"`);
    }

    // Path 3: Deals → client link
    await page.goto(BASE_URL + '/dashboard/deals', { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(2000);
    const dealsContent = await page.content();
    if (dealsContent.includes(target.name)) {
      addPass(`G3: Client "${target.name}" appears in deals view`);
    } else {
      console.log(`  [G3] Client not found in deals view (may have no deals)`);
    }

    // Path 4: Projects → client link
    await page.goto(BASE_URL + '/dashboard/projects', { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(2000);
    const projectsContent = await page.content();
    if (projectsContent.includes(target.name)) {
      addPass(`G4: Client "${target.name}" appears in projects view`);
    } else {
      console.log(`  [G4] Client not in projects view (may have no projects)`);
    }

    // Consistency check: if we got detail from list AND direct URL, IDs must match
    if (detailUrlFromList && directFinalUrl) {
      const listId = extractIdFromUrl(detailUrlFromList);
      const directId = extractIdFromUrl(directFinalUrl);
      if (listId && directId && listId !== directId) {
        addFinding({
          severity: 'P1',
          title: 'Cross-module client links point to different IDs',
          route: '/dashboard/clients',
          steps: [
            `Click "${target.name}" from clients list → ${detailUrlFromList}`,
            `Navigate directly to /dashboard/clients/${target.id} → ${directFinalUrl}`,
          ],
          expected: 'Same canonical client ID in both paths',
          actual: `List link resolves to ${listId}, direct URL resolves to ${directId}`,
          evidence: `List URL: ${detailUrlFromList} | Direct URL: ${directFinalUrl}`,
          rootCause: 'Client list may be using a different identifier (crm_contact_id vs business_clients.id)',
        });
      } else if (listId && directId) {
        addPass(`G-consistency: Both navigation paths resolve to same client ID (${listId})`);
      }
    }
  } finally {
    await browser.close();
  }
}

function extractIdFromUrl(url) {
  const match = url.match(/\/([0-9a-f-]{36})/i);
  return match ? match[1] : null;
}

// ── Section H: Session Expiry Behavior ───────────────────────────────────────
async function sectionH() {
  console.log('\n════════════════════════════════════════════');
  console.log('H. Session Expiry / Expired Cookie Behavior');
  console.log('════════════════════════════════════════════');

  const browser = await chromium.launch({ headless: true, args: BROWSER_ARGS });

  try {
    // Strategy 1: set an intentionally expired auth cookie
    const context = await browser.newContext({ baseURL: BASE_URL });
    const domain = new URL(BASE_URL).hostname;
    const cookieName = `sb-${SUPABASE_URL.split('//')[1].split('.')[0]}-auth-token`;

    await context.addCookies([{
      name: cookieName,
      value: JSON.stringify(['expired_token_abc123', 'expired_refresh_xyz']),
      domain: `.${domain}`,
      path: '/',
      httpOnly: false,
      secure: true,
      sameSite: 'Lax',
      // Expired in the past
      expires: Math.floor(Date.now() / 1000) - 86400,
    }]);

    const page = await context.newPage();
    attachTelemetry(page);

    const t0 = Date.now();
    const resp = await page.goto(BASE_URL + '/dashboard', { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => null);
    const ms = Date.now() - t0;
    const finalUrl = page.url();
    const status = resp?.status() ?? 0;

    console.log(`  [H1 expired cookie] /dashboard → ${finalUrl} (HTTP ${status}) ${ms}ms`);

    if (status === 500) {
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'session-expiry-crash.png') });
      addFinding({
        severity: 'P1',
        title: 'Expired cookie causes 500 error on /dashboard',
        route: '/dashboard',
        steps: ['Set expired auth cookie', 'Navigate to /dashboard'],
        expected: 'Graceful redirect to /login',
        actual: 'HTTP 500 server crash',
        evidence: `Status 500, finalUrl=${finalUrl}`,
        rootCause: 'Auth token validation not gracefully handling expired/invalid JWT',
      });
    } else if (finalUrl.includes('/login') || finalUrl.includes('/auth') || finalUrl.includes('/signin')) {
      addPass(`H: Expired cookie → graceful redirect to ${finalUrl} (not a crash)`);
    } else {
      const content = await page.content();
      const hasDashboardContent = /CRM|Deals|Pipeline|Contacts|Settings/i.test(content);
      if (hasDashboardContent) {
        addFinding({
          severity: 'P0_SECURITY',
          title: 'Expired cookie still grants access to /dashboard',
          route: '/dashboard',
          steps: ['Set an expired auth cookie', 'Navigate to /dashboard'],
          expected: 'Redirect to /login — expired session rejected',
          actual: `Dashboard content rendered at ${finalUrl} with expired cookie`,
          evidence: 'Page contains dashboard keywords despite expired token',
          rootCause: 'JWT expiry not validated server-side, or cookie expiry not checked',
        });
      } else {
        addPass(`H: Expired cookie → no dashboard content exposed (HTTP ${status}, url=${finalUrl})`);
      }
    }

    // Strategy 2: completely garbled/forged token
    const context2 = await browser.newContext({ baseURL: BASE_URL });
    await context2.addCookies([{
      name: cookieName,
      value: 'forge.eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhdHRhY2tlciIsInRlbmFudF9pZCI6IjA2NmViODhlLTNmYjAtNDVjOS1iNGQxLWMzYzIwNjNlYTBkNCJ9.INVALID_SIGNATURE',
      domain: `.${domain}`,
      path: '/',
      httpOnly: false,
      secure: true,
      sameSite: 'Lax',
    }]);

    const page2 = await context2.newPage();
    attachTelemetry(page2);

    const resp2 = await page2.goto(BASE_URL + '/dashboard/crm', { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => null);
    const finalUrl2 = page2.url();
    const status2 = resp2?.status() ?? 0;
    const content2 = await page2.content();
    const hasData2 = /CRM|Deals|Pipeline|Contacts/i.test(content2);

    console.log(`  [H2 forged JWT] /dashboard/crm → ${finalUrl2} (HTTP ${status2}) hasData=${hasData2}`);

    if (hasData2 && status2 === 200) {
      addFinding({
        severity: 'P0_SECURITY',
        title: 'Forged JWT token grants dashboard access',
        route: '/dashboard/crm',
        steps: ['Craft a forged JWT with tenant_id claim', 'Set as auth cookie', 'Navigate to /dashboard/crm'],
        expected: 'HTTP 401 or redirect to /login',
        actual: 'Dashboard rendered with forged token',
        evidence: 'Page contains CRM/Dashboard keywords',
        rootCause: 'JWT signature verification not enforced server-side',
      });
    } else if (finalUrl2.includes('/login') || status2 === 401 || status2 === 403) {
      addPass('H2: Forged JWT correctly rejected — redirected to login');
    } else {
      addPass(`H2: Forged JWT → HTTP ${status2} at ${finalUrl2}, no data exposure`);
    }

    await context2.close();
  } finally {
    await browser.close();
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  AlphaClone QA #17 — Client Portal + Security + Tenant ISO   ║');
  console.log(`║  Target: ${BASE_URL}                          ║`);
  console.log(`║  Tenant: ${TENANT_ID}     ║`);
  console.log(`║  Time:   ${new Date().toISOString()}                    ║`);
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  const startTime = Date.now();

  try {
    const { portalClients, anyClients } = await sectionA();
    await sectionB(portalClients);
    await sectionC();
    await sectionD(anyClients);
    await sectionE();
    await sectionF();
    await sectionG(anyClients);
    await sectionH();
  } catch (err) {
    console.error('\n[FATAL] Unhandled error in main:', err);
    findings.push({
      id: `FIND-${String(++findingSeq).padStart(3, '0')}`,
      severity: 'P0_SECURITY',
      title: 'Script terminated with unhandled exception',
      route: '/',
      steps: ['Run 17-client-portal-security-qa.cjs'],
      expected: 'Full audit completes',
      actual: err.message,
      evidence: err.stack,
      rootCause: 'Unexpected runtime error — audit may be incomplete',
    });
  }

  const totalMs = Date.now() - startTime;
  performanceTimings['total_audit'] = `${totalMs}ms`;

  const total   = findings.length + passedChecks.length;
  const pass    = passedChecks.length;
  const fail    = findings.filter(f => !f.severity?.includes('BLOCKED')).length;
  const blocked = findings.filter(f => f.title?.includes('BLOCKED')).length;

  const report = {
    domain: 'Client Portal + Security + Tenant Isolation',
    timestamp: new Date().toISOString(),
    summary: { total, pass, fail, blocked },
    findings,
    passedChecks,
    performanceTimings,
    consoleErrors: [...new Set(consoleErrors)].slice(0, 30),
    networkErrors: [...new Set(networkErrors)].slice(0, 30),
  };

  // Write JSON report
  const reportPath = path.join(process.cwd(), 'qa', 'results-security-portal.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                    AUDIT COMPLETE                             ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log(`║  Total checks : ${String(total).padEnd(44)}║`);
  console.log(`║  Passed       : ${String(pass).padEnd(44)}║`);
  console.log(`║  Failed       : ${String(fail).padEnd(44)}║`);
  console.log(`║  Blocked      : ${String(blocked).padEnd(44)}║`);
  console.log(`║  Duration     : ${String(totalMs + 'ms').padEnd(44)}║`);
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`\n  Report → ${reportPath}`);

  // Print findings summary
  if (findings.length > 0) {
    console.log('\n  FINDINGS:');
    findings.forEach(f => {
      console.log(`    [${f.severity}] ${f.id}: ${f.title}`);
    });
  }

  console.log('\n__REPORT_JSON_START__');
  console.log(JSON.stringify(report));
  console.log('__REPORT_JSON_END__');

  process.exit(fail > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('[FATAL]', err);
  process.exit(2);
});
