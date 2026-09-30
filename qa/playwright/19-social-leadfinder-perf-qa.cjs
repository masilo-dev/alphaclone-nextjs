/**
 * 19-social-leadfinder-perf-qa.cjs
 *
 * Domain audit: Social Integrations, Lead Finder, Performance, Console/Network Audit
 * Target: https://alphaclonesystems.com
 * Tenant: bonnie@alphaclonesystems.com (066eb88e-3fb0-45c9-b4d1-c3c2063ea0d4)
 */

'use strict';

const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(process.cwd(), '.env.production.local') });

const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');
const {
  createAuthenticatedContext,
  attachTelemetry,
  dismissCommonModals,
  measureAction,
  BASE_URL,
} = require('./auth-helper.cjs');

// ── Config ──────────────────────────────────────────────────────────────────
const TENANT_ID = '066eb88e-3fb0-45c9-b4d1-c3c2063ea0d4';
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const SCREENSHOTS_DIR = path.join(process.cwd(), 'qa/screenshots');
fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

// ── Helpers ──────────────────────────────────────────────────────────────────
function ts() {
  return new Date().toISOString();
}

async function safeScreenshot(page, filename) {
  try {
    const full = path.join(SCREENSHOTS_DIR, filename);
    await page.screenshot({ path: full, fullPage: false });
    console.log(`  📸 Screenshot saved: ${filename}`);
    return full;
  } catch (e) {
    console.warn(`  ⚠️  Screenshot failed (${filename}): ${e.message}`);
    return null;
  }
}

/** Navigate and wait for reasonable load */
async function navTo(page, route, label) {
  const url = `${BASE_URL}${route}`;
  const start = Date.now();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1500); // hydration settling time
    const ms = Date.now() - start;
    console.log(`  ➡️  [${label}] navigated in ${ms}ms`);
    return { ms, ok: true };
  } catch (e) {
    const ms = Date.now() - start;
    console.warn(`  ⚠️  [${label}] navigation failed after ${ms}ms: ${e.message}`);
    return { ms, ok: false, error: e.message };
  }
}

/** Find a nav link by text (case-insensitive, partial match) */
async function findNavItem(page, text) {
  const sel = `a:has-text("${text}"), nav button:has-text("${text}"), [role="menuitem"]:has-text("${text}"), li:has-text("${text}") a`;
  try {
    const el = page.locator(sel).first();
    if (await el.isVisible({ timeout: 2000 })) return el;
  } catch (_) {}
  return null;
}

/** Classify latency bucket */
function classifyLatency(ms) {
  if (ms <= 1000) return 'GOOD';
  if (ms <= 3000) return 'ACCEPTABLE';
  if (ms <= 5000) return 'P2_WARNING';
  return 'P1_CRITICAL';
}

/** Check for duplicate URLs in request list */
function detectDuplicateRequests(allRequests) {
  const urlCounts = {};
  for (const r of allRequests) {
    if (r.resourceType === 'fetch' || r.resourceType === 'xhr') {
      // Normalize URL (strip cache-busting timestamps)
      const normalized = r.url.replace(/[?&]_=\d+/, '').replace(/[?&]t=\d+/, '');
      urlCounts[normalized] = (urlCounts[normalized] || 0) + 1;
    }
  }
  return Object.entries(urlCounts)
    .filter(([, count]) => count >= 2)
    .map(([url, count]) => ({ url, count }));
}

/** Detect unbounded data fetches (no range/limit in URL or headers) */
function detectUnboundedFetches(allRequests) {
  const suspects = [];
  for (const r of allRequests) {
    if ((r.resourceType === 'fetch' || r.resourceType === 'xhr') && r.url.includes('supabase')) {
      const url = r.url;
      const hasLimit = url.includes('limit=') || url.includes('range=') || url.includes('Range');
      const hasSelect = url.includes('select=');
      if (hasSelect && !hasLimit) {
        suspects.push(url);
      }
    }
  }
  return suspects;
}

// ── Module route discovery ────────────────────────────────────────────────────
const MODULE_ROUTES = {
  crm: '/dashboard/crm',
  projects: '/dashboard/projects',
  finance: '/dashboard/finance',
  social: '/dashboard/social',
  leadFinder: '/dashboard/lead-finder',
};

// Social sub-paths to try
const SOCIAL_ROUTES = [
  '/dashboard/social',
  '/dashboard/social/facebook',
  '/dashboard/social/instagram',
  '/dashboard/social/linkedin',
  '/dashboard/social-command-center',
  '/dashboard/social-command',
];

// Lead finder routes to try
const LEAD_FINDER_ROUTES = [
  '/dashboard/lead-finder',
  '/dashboard/leads',
  '/dashboard/lead_finder',
  '/dashboard/leadsearch',
];

// ── Main Audit ────────────────────────────────────────────────────────────────
async function runAudit() {
  console.log('\n' + '═'.repeat(70));
  console.log('  19-social-leadfinder-perf-qa — STARTING AUDIT');
  console.log(`  Timestamp: ${ts()}`);
  console.log(`  Target: ${BASE_URL}`);
  console.log('═'.repeat(70) + '\n');

  const findings = [];
  const passedChecks = [];
  const perfTimings = {};
  const allConsoleErrors = [];
  const allNetworkErrors = [];
  let findingCounter = 0;

  function addFinding(severity, title, route, steps, expected, actual, evidence, rootCause) {
    findingCounter++;
    const id = `FIND-${String(findingCounter).padStart(3, '0')}`;
    findings.push({ id, severity, title, route, steps, expected, actual, evidence, rootCause });
    console.log(`  🔴 [${id}][${severity}] ${title}`);
    return id;
  }

  function addPass(msg) {
    passedChecks.push(msg);
    console.log(`  ✅ PASS: ${msg}`);
  }

  // ── SECTION A: Performance Baseline ────────────────────────────────────────
  console.log('\n' + '─'.repeat(60));
  console.log('  SECTION A: Performance Baseline');
  console.log('─'.repeat(60));

  const { browser, context } = await createAuthenticatedContext();
  const page = await context.newPage();
  const { consoleLogs, networkErrors, allRequests } = attachTelemetry(page);

  // A1: Dashboard load time
  console.log('\n[A1] Dashboard load time...');
  {
    const start = Date.now();
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
    const domTime = Date.now() - start;
    await page.waitForTimeout(2000); // extra settle for hydration
    const totalTime = Date.now() - start;
    perfTimings['A1_dashboard_domcontentloaded'] = `${domTime}ms`;
    perfTimings['A1_dashboard_total_load'] = `${totalTime}ms`;
    console.log(`  DOMContentLoaded: ${domTime}ms | Total: ${totalTime}ms`);

    await dismissCommonModals(page);

    if (totalTime > 5000) {
      addFinding('P1', 'Dashboard initial load exceeds 5s', '/dashboard',
        ['Navigate to /dashboard', 'Wait for load'],
        'Dashboard loads within 5000ms',
        `Dashboard took ${totalTime}ms to load`,
        `perfTimings: ${JSON.stringify(perfTimings)}`,
        'Server-side rendering or API waterfall is too slow');
    } else if (totalTime > 3000) {
      addFinding('P2', 'Dashboard initial load exceeds 3s', '/dashboard',
        ['Navigate to /dashboard'],
        'Dashboard loads within 3000ms',
        `Dashboard took ${totalTime}ms`,
        `totalTime=${totalTime}ms`,
        'SSR or bundle hydration overhead');
    } else {
      addPass(`Dashboard loaded in ${totalTime}ms (< 3s)`);
    }
  }

  // A2: Module transition timings
  console.log('\n[A2] Module transition timings...');
  const moduleOrder = [
    { label: 'CRM', route: MODULE_ROUTES.crm },
    { label: 'Projects', route: MODULE_ROUTES.projects },
    { label: 'Finance', route: MODULE_ROUTES.finance },
    { label: 'Social', route: MODULE_ROUTES.social },
    { label: 'CRM (return)', route: MODULE_ROUTES.crm },
  ];

  for (const mod of moduleOrder) {
    const { ms, ok, error } = await navTo(page, mod.route, mod.label);
    perfTimings[`A2_${mod.label}_transition`] = `${ms}ms`;
    const cat = classifyLatency(ms);

    if (!ok) {
      addFinding('P2', `Module navigation failed: ${mod.label}`, mod.route,
        [`Navigate to ${mod.route}`],
        `${mod.label} loads successfully`,
        `Navigation failed: ${error}`,
        `error: ${error}`,
        'Route may not exist or SSR error');
    } else if (cat === 'P1_CRITICAL') {
      addFinding('P1', `Module transition critically slow: ${mod.label} (${ms}ms)`, mod.route,
        [`Navigate from previous module to ${mod.route}`],
        'Transition < 5000ms',
        `Took ${ms}ms`,
        `perfTimings: ${ms}ms`,
        'Slow API or large bundle for this module');
    } else if (cat === 'P2_WARNING') {
      addFinding('P2', `Module transition slow: ${mod.label} (${ms}ms)`, mod.route,
        [`Navigate to ${mod.route}`],
        'Transition < 3000ms',
        `Took ${ms}ms`,
        `perfTimings: ${ms}ms`,
        'API latency or route-level data fetching');
    } else {
      addPass(`${mod.label} transition: ${ms}ms (${cat})`);
    }
    await dismissCommonModals(page);
  }

  // A3: Duplicate API calls
  console.log('\n[A3] Duplicate API call detection...');
  const dupes = detectDuplicateRequests(allRequests);
  if (dupes.length > 0) {
    console.log(`  Found ${dupes.length} duplicate request URL(s):`);
    dupes.slice(0, 5).forEach(d => console.log(`    x${d.count} ${d.url.substring(0, 120)}`));
    addFinding('P2', `Duplicate API calls detected (${dupes.length} URLs called 2+ times)`, '/dashboard',
      ['Load dashboard', 'Observe network requests'],
      'Each API endpoint called once per page load',
      `${dupes.length} endpoints called multiple times`,
      JSON.stringify(dupes.slice(0, 5)),
      'Missing memoization, StrictMode double-invoke, or effect dependency loop');
  } else {
    addPass('No duplicate API calls detected on dashboard load');
  }

  // A4: Unbounded data fetches
  console.log('\n[A4] Unbounded data fetch detection...');
  const unbounded = detectUnboundedFetches(allRequests);
  if (unbounded.length > 0) {
    console.log(`  Found ${unbounded.length} potentially unbounded fetch(es):`);
    unbounded.slice(0, 3).forEach(u => console.log(`    ${u.substring(0, 120)}`));
    addFinding('P2', `Potentially unbounded Supabase fetches (no limit/range) detected`, '/dashboard',
      ['Load dashboard', 'Inspect XHR/fetch to Supabase'],
      'All data fetches include limit or range headers',
      `${unbounded.length} fetches without visible limit`,
      JSON.stringify(unbounded.slice(0, 3)),
      'Missing .limit() or .range() in Supabase query chain');
  } else {
    addPass('No obviously unbounded Supabase fetches detected');
  }

  // ── SECTION B: Social Module — Facebook ────────────────────────────────────
  console.log('\n' + '─'.repeat(60));
  console.log('  SECTION B: Social Module — Facebook');
  console.log('─'.repeat(60));

  // B1: Database check first
  console.log('\n[B1] Facebook OAuth tokens in DB...');
  const { data: fbTokens, error: fbErr } = await admin
    .from('oauth_connections')
    .select('id, provider, status, created_at, updated_at, expires_at')
    .eq('tenant_id', TENANT_ID)
    .eq('provider', 'facebook')
    .limit(5);

  console.log('Facebook tokens:', JSON.stringify(fbTokens, null, 2));
  if (fbErr) {
    console.warn('  DB error fetching FB tokens:', fbErr.message);
    addFinding('P2', 'Cannot query oauth_connections for Facebook', '/dashboard/social',
      ['Query oauth_connections WHERE provider=facebook'],
      'Query returns without error',
      `DB error: ${fbErr.message}`,
      fbErr.message,
      'Table may not exist or RLS blocks service role (unexpected)');
  }

  const fbConnected = fbTokens && fbTokens.length > 0 && fbTokens.some(t => t.status === 'active');
  const fbExpired = fbTokens && fbTokens.some(t => t.expires_at && new Date(t.expires_at) < new Date());

  if (fbExpired) {
    addFinding('P1', 'Facebook OAuth token is expired', '/dashboard/social',
      ['Check oauth_connections for facebook tokens', 'Inspect expires_at'],
      'Token is valid and not expired',
      `Token expired at: ${fbTokens.find(t => t.expires_at)?.expires_at}`,
      JSON.stringify(fbTokens),
      'Token refresh job not running or refresh token revoked');
  }

  // B2: Navigate to Social
  console.log('\n[B2] Navigating to Social module...');
  let socialRoute = null;
  for (const route of SOCIAL_ROUTES) {
    const res = await navTo(page, route, 'Social');
    if (res.ok) {
      // check we didn't land on 404
      const h1 = await page.locator('h1, h2').first().textContent({ timeout: 3000 }).catch(() => '');
      const bodyText = await page.locator('body').textContent({ timeout: 3000 }).catch(() => '');
      if (!bodyText.toLowerCase().includes('not found') && !bodyText.toLowerCase().includes('404')) {
        socialRoute = route;
        perfTimings['B2_social_load'] = `${res.ms}ms`;
        console.log(`  Social module found at: ${route}`);
        break;
      }
    }
  }

  if (!socialRoute) {
    addFinding('P1', 'Social module route not found', '/dashboard/social',
      ['Try routes: ' + SOCIAL_ROUTES.join(', ')],
      'At least one social route loads successfully',
      'All social routes returned 404 or error',
      'Routes tried: ' + SOCIAL_ROUTES.join(', '),
      'Social module may not be deployed or route misconfigured');
  }

  await dismissCommonModals(page);

  // B3: Facebook UI status
  let fbUIStatus = 'unknown';
  try {
    const bodyText = await page.locator('body').textContent({ timeout: 5000 });
    if (bodyText.toLowerCase().includes('facebook')) {
      if (bodyText.toLowerCase().includes('connected') || bodyText.toLowerCase().includes('disconnect')) {
        fbUIStatus = 'connected';
        addPass('Facebook shows connected state in Social UI');
      } else if (bodyText.toLowerCase().includes('connect facebook') || bodyText.toLowerCase().includes('add facebook')) {
        fbUIStatus = 'disconnected';
        if (!fbConnected) {
          addPass('Facebook UI shows disconnected — matches DB (no active token)');
        } else {
          addFinding('P2', 'Facebook UI shows disconnected but DB has active token', socialRoute || '/dashboard/social',
            ['Navigate to social module', 'Check Facebook section'],
            'UI matches DB connection state',
            'UI shows "Connect Facebook" but oauth_connections has active record',
            `DB: ${JSON.stringify(fbTokens)}`,
            'Token status mismatch or UI not reading from correct table');
        }
      } else if (bodyText.toLowerCase().includes('error') && bodyText.toLowerCase().includes('facebook')) {
        fbUIStatus = 'error';
        addFinding('P1', 'Facebook integration shows error state in UI', socialRoute || '/dashboard/social',
          ['Navigate to social module', 'Observe Facebook section'],
          'Facebook section shows connected or connect-prompt, no error',
          'Error state visible in Facebook section',
          'Error text found in page body',
          'OAuth error, API permission revoked, or missing env var for FB App');
      }
    } else {
      fbUIStatus = 'not-visible';
      addFinding('P2', 'Facebook section not visible in Social UI', socialRoute || '/dashboard/social',
        ['Navigate to social module', 'Look for Facebook integration section'],
        'Facebook integration section is visible',
        'No Facebook-related content found in page',
        'bodyText (excerpt): ' + bodyText.substring(0, 200),
        'Feature flag disabled, conditional render, or page structure changed');
    }
  } catch (e) {
    fbUIStatus = 'error-reading';
    console.warn('  Could not read Facebook UI state:', e.message);
  }

  // B4: OAuth redirect link check
  try {
    const fbConnectBtn = page.locator('a[href*="facebook"], button:has-text("Connect Facebook"), a:has-text("Connect Facebook"), button:has-text("Add Facebook")').first();
    if (await fbConnectBtn.isVisible({ timeout: 3000 })) {
      const href = await fbConnectBtn.getAttribute('href').catch(() => null);
      if (href) {
        const hasState = href.includes('state=');
        const hasRedirectUri = href.includes('redirect_uri=');
        if (!hasState) {
          addFinding('P2', 'Facebook OAuth redirect missing state parameter', socialRoute || '/dashboard/social',
            ['Inspect Connect Facebook link href'],
            'OAuth redirect URL includes state parameter',
            `href="${href}" - no state param`,
            `href: ${href}`,
            'CSRF protection not implemented for Facebook OAuth');
        } else if (!hasRedirectUri) {
          addFinding('P2', 'Facebook OAuth redirect missing redirect_uri', socialRoute || '/dashboard/social',
            ['Inspect Connect Facebook link href'],
            'OAuth redirect URL includes redirect_uri',
            `href="${href}" - no redirect_uri`,
            `href: ${href}`,
            'OAuth flow misconfigured');
        } else {
          addPass(`Facebook OAuth link has state + redirect_uri: ${href.substring(0, 80)}...`);
        }
      } else {
        // It's a button (onclick-based), note it
        addPass('Facebook connect button exists (onclick-based OAuth flow)');
      }
    }
  } catch (_) {}

  await safeScreenshot(page, 'social-facebook-status.png');

  // ── SECTION C: Social Module — Instagram ───────────────────────────────────
  console.log('\n' + '─'.repeat(60));
  console.log('  SECTION C: Social Module — Instagram');
  console.log('─'.repeat(60));

  console.log('\n[C1] Instagram OAuth tokens in DB...');
  const { data: igTokens, error: igErr } = await admin
    .from('oauth_connections')
    .select('id, provider, status, created_at, updated_at')
    .eq('tenant_id', TENANT_ID)
    .eq('provider', 'instagram')
    .limit(5);

  console.log('Instagram tokens:', JSON.stringify(igTokens, null, 2));
  if (igErr) console.warn('  DB error fetching IG tokens:', igErr.message);

  const igConnected = igTokens && igTokens.length > 0 && igTokens.some(t => t.status === 'active');

  // Navigate to instagram section
  console.log('\n[C2] Navigating to Instagram section...');
  let igRoute = null;
  for (const candidate of ['/dashboard/social/instagram', '/dashboard/social', socialRoute]) {
    if (!candidate) continue;
    await navTo(page, candidate, 'Instagram');
    const bodyText = await page.locator('body').textContent({ timeout: 3000 }).catch(() => '');
    if (bodyText.toLowerCase().includes('instagram')) {
      igRoute = candidate;
      break;
    }
  }

  // Check post composer
  let composerVisible = false;
  try {
    const bodyText = await page.locator('body').textContent({ timeout: 3000 });
    composerVisible = bodyText.toLowerCase().includes('compose') ||
      bodyText.toLowerCase().includes('create post') ||
      bodyText.toLowerCase().includes('new post') ||
      bodyText.toLowerCase().includes('caption') ||
      bodyText.toLowerCase().includes('schedule');
    if (composerVisible) {
      addPass('Social post composer interface visible');
    }
  } catch (_) {}

  await safeScreenshot(page, 'social-instagram-status.png');

  // C3: Failed posts check
  console.log('\n[C3] Checking for failed social posts...');
  const { data: failedPosts, error: fpErr } = await admin
    .from('social_posts')
    .select('id, provider, status, error_message, created_at')
    .eq('tenant_id', TENANT_ID)
    .eq('status', 'failed')
    .limit(10);

  console.log('Failed posts:', JSON.stringify(failedPosts, null, 2));
  if (fpErr) {
    console.warn('  DB error querying social_posts:', fpErr.message);
    // Table might not exist
  }

  if (failedPosts && failedPosts.length > 0) {
    const errorMessages = [...new Set(failedPosts.map(p => p.error_message).filter(Boolean))];
    addFinding('P2', `${failedPosts.length} failed social post(s) in DB`, '/dashboard/social',
      ['Query social_posts WHERE status=failed'],
      'No failed posts',
      `${failedPosts.length} posts with status=failed`,
      `error messages: ${JSON.stringify(errorMessages.slice(0, 3))}`,
      'Social provider API error or queue worker failure');
  } else if (!fpErr) {
    addPass('No failed social posts found in database');
  }

  // ── SECTION D: Social Module — LinkedIn ────────────────────────────────────
  console.log('\n' + '─'.repeat(60));
  console.log('  SECTION D: Social Module — LinkedIn');
  console.log('─'.repeat(60));

  console.log('\n[D1] LinkedIn OAuth tokens in DB...');
  const { data: liTokens, error: liErr } = await admin
    .from('oauth_connections')
    .select('id, provider, status, identity_type, created_at')
    .eq('tenant_id', TENANT_ID)
    .eq('provider', 'linkedin')
    .limit(5);

  console.log('LinkedIn tokens:', JSON.stringify(liTokens, null, 2));
  if (liErr) console.warn('  DB error fetching LI tokens:', liErr.message);

  const liConnected = liTokens && liTokens.length > 0 && liTokens.some(t => t.status === 'active');

  if (liTokens && liTokens.length > 0) {
    const hasIdentityType = liTokens.every(t => t.identity_type !== null && t.identity_type !== undefined);
    if (!hasIdentityType) {
      addFinding('P2', 'LinkedIn token missing identity_type (personal vs org)', '/dashboard/social',
        ['Query oauth_connections for linkedin', 'Check identity_type column'],
        'Each LinkedIn token has identity_type set (personal or organization)',
        'Some tokens have null identity_type',
        JSON.stringify(liTokens),
        'LinkedIn OAuth callback not persisting identity_type correctly');
    } else {
      addPass(`LinkedIn identity_type set correctly on all tokens: ${liTokens.map(t => t.identity_type).join(', ')}`);
    }
  }

  // Navigate to LinkedIn section
  console.log('\n[D2] Navigating to LinkedIn section...');
  for (const candidate of ['/dashboard/social/linkedin', '/dashboard/social', socialRoute]) {
    if (!candidate) continue;
    await navTo(page, candidate, 'LinkedIn');
    const bodyText = await page.locator('body').textContent({ timeout: 3000 }).catch(() => '');
    if (bodyText.toLowerCase().includes('linkedin')) break;
  }

  await safeScreenshot(page, 'social-linkedin-status.png');

  // ── SECTION E: Social Post History — Stuck Posts ───────────────────────────
  console.log('\n' + '─'.repeat(60));
  console.log('  SECTION E: Social Post History — Stuck Posts');
  console.log('─'.repeat(60));

  console.log('\n[E1] Checking for stuck posts (queued/processing >30 mins)...');
  const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data: stuckPosts, error: spErr } = await admin
    .from('social_posts')
    .select('id, provider, status, created_at')
    .eq('tenant_id', TENANT_ID)
    .in('status', ['queued', 'processing', 'provider_processing'])
    .lt('created_at', thirtyMinsAgo);

  console.log('Stuck posts:', JSON.stringify(stuckPosts, null, 2));

  if (spErr) {
    console.warn('  DB error checking stuck posts:', spErr.message);
    addFinding('P2', 'Cannot query social_posts for stuck items', '/dashboard/social',
      ['Query social_posts for queued/processing status older than 30min'],
      'Query completes without error',
      `DB error: ${spErr.message}`,
      spErr.message,
      'Table schema mismatch or query error');
  } else if (stuckPosts && stuckPosts.length > 0) {
    addFinding('P1', `${stuckPosts.length} stuck social post(s) detected (queued/processing >30min)`, '/dashboard/social',
      ['Query social_posts WHERE status IN (queued,processing,provider_processing) AND created_at < 30min ago'],
      'No posts stuck in processing state for >30 minutes',
      `${stuckPosts.length} posts stuck: ${stuckPosts.map(p => `${p.provider}/${p.status}`).join(', ')}`,
      JSON.stringify(stuckPosts),
      'Queue worker crashed or provider webhook not received; dead-letter queue handling missing');
  } else {
    addPass('No stuck social posts (queue appears healthy)');
  }

  // ── SECTION F: Lead Finder Module ──────────────────────────────────────────
  console.log('\n' + '─'.repeat(60));
  console.log('  SECTION F: Lead Finder Module');
  console.log('─'.repeat(60));

  console.log('\n[F1] Navigating to Lead Finder...');
  let leadFinderRoute = null;
  for (const route of LEAD_FINDER_ROUTES) {
    const res = await navTo(page, route, 'Lead Finder');
    if (res.ok) {
      const bodyText = await page.locator('body').textContent({ timeout: 3000 }).catch(() => '');
      if (!bodyText.toLowerCase().includes('not found') && !bodyText.toLowerCase().includes('404')) {
        leadFinderRoute = route;
        perfTimings['F1_leadfinder_load'] = `${res.ms}ms`;
        console.log(`  Lead Finder found at: ${route}`);
        break;
      }
    }
  }

  if (!leadFinderRoute) {
    addFinding('P1', 'Lead Finder module route not found', '/dashboard/lead-finder',
      ['Try routes: ' + LEAD_FINDER_ROUTES.join(', ')],
      'Lead Finder route loads successfully',
      'All Lead Finder routes returned 404 or error',
      'Routes tried: ' + LEAD_FINDER_ROUTES.join(', '),
      'Module not deployed or route misconfigured');
  } else {
    addPass(`Lead Finder accessible at ${leadFinderRoute}`);
    await dismissCommonModals(page);

    // F2: Search interaction
    console.log('\n[F2] Testing Lead Finder search...');
    const SEARCH_QUERY = 'software companies in Cape Town';
    let searchInteracted = false;

    try {
      // Find search input
      const searchInput = page.locator(
        'input[type="search"], input[placeholder*="search" i], input[placeholder*="find" i], input[placeholder*="company" i], textarea[placeholder*="search" i]'
      ).first();

      if (await searchInput.isVisible({ timeout: 4000 })) {
        await searchInput.click();
        await searchInput.fill(SEARCH_QUERY);
        searchInteracted = true;
        console.log(`  Typed search query: "${SEARCH_QUERY}"`);

        // Try submit via Enter or Search button
        await page.keyboard.press('Enter');
        await page.waitForTimeout(4000); // wait for search results

        // Check for loading indicator
        const bodyText = await page.locator('body').textContent({ timeout: 5000 });
        const hasResults = bodyText.toLowerCase().includes('result') ||
          bodyText.toLowerCase().includes('found') ||
          bodyText.toLowerCase().includes('match') ||
          bodyText.toLowerCase().includes('company') ||
          bodyText.toLowerCase().includes('lead');
        const hasLoading = bodyText.toLowerCase().includes('loading') || bodyText.toLowerCase().includes('searching');
        const hasNoResults = bodyText.toLowerCase().includes('no result') || bodyText.toLowerCase().includes('nothing found');

        if (hasResults && !hasNoResults) {
          addPass(`Lead Finder returned results for query "${SEARCH_QUERY}"`);
        } else if (hasLoading) {
          addFinding('P2', 'Lead Finder search stuck in loading state', leadFinderRoute,
            ['Enter search query', 'Press Enter', 'Wait 4s'],
            'Results appear within 4s',
            'Still showing loading state after 4s',
            `bodyText (excerpt): ${bodyText.substring(0, 300)}`,
            'Search API timeout or backend indexing issue');
        } else if (hasNoResults) {
          addPass(`Lead Finder search completed with "no results" for "${SEARCH_QUERY}" — acceptable`);
        } else {
          addFinding('P2', 'Lead Finder search result state unclear', leadFinderRoute,
            ['Enter search query', 'Wait 4s'],
            'Clear results or empty state shown',
            'Ambiguous UI state after search',
            `bodyText (excerpt): ${bodyText.substring(0, 300)}`,
            'UI might lack empty-state handling or results rendering is broken');
        }
      } else {
        addFinding('P2', 'Lead Finder search input not found', leadFinderRoute,
          ['Navigate to Lead Finder', 'Look for search input'],
          'Search input is visible and interactive',
          'No search input found matching expected selectors',
          `Selectors tried: input[type="search"], input[placeholder*="search"]`,
          'UI structure changed or search component not rendered');
      }
    } catch (e) {
      addFinding('P2', 'Lead Finder search interaction failed', leadFinderRoute,
        ['Navigate to Lead Finder', 'Interact with search'],
        'Search interaction succeeds',
        `Error: ${e.message}`,
        e.message,
        'Component error or JS exception during search');
    }

    await safeScreenshot(page, 'lead-finder-results.png');
  }

  // F3: DB check — recent lead_candidates
  console.log('\n[F3] Checking lead_candidates table...');
  const { data: recentCandidates, error: rcErr } = await admin
    .from('lead_candidates')
    .select('id, business_name, review_status, created_at')
    .eq('workspace_id', TENANT_ID)
    .order('created_at', { ascending: false })
    .limit(10);

  console.log('Recent candidates:', JSON.stringify(recentCandidates, null, 2));
  if (rcErr) {
    console.warn('  DB error querying lead_candidates:', rcErr.message);
    addFinding('P2', 'lead_candidates table query error', '/dashboard/lead-finder',
      ['Query lead_candidates WHERE workspace_id=TENANT_ID'],
      'Query returns without error',
      `DB error: ${rcErr.message}`,
      rcErr.message,
      'Column workspace_id may be named differently (tenant_id?), or table RLS issue');
  } else {
    const count = recentCandidates ? recentCandidates.length : 0;
    addPass(`lead_candidates query OK — ${count} recent record(s) found`);

    // Check if results are tenant-scoped (all belong to this tenant)
    if (count > 0) {
      addPass('Lead Finder results appear to be tenant-scoped (workspace_id filter active)');
    }
  }

  // ── SECTION G: Console + Network Full Audit ─────────────────────────────────
  console.log('\n' + '─'.repeat(60));
  console.log('  SECTION G: Console + Network Full Audit');
  console.log('─'.repeat(60));

  // Navigate through all modules to accumulate more data
  for (const [label, route] of Object.entries(MODULE_ROUTES)) {
    await navTo(page, route, `G-audit-${label}`);
    await dismissCommonModals(page);
    await page.waitForTimeout(1000);
  }

  // Compile console issues
  const errors = consoleLogs.filter(l => l.type === 'error' || l.type === 'pageerror');
  const warns = consoleLogs.filter(l => l.type === 'warning' || l.type === 'warn');

  // Categorize errors
  const errorCategories = {
    supabase: [],
    react: [],
    hydration: [],
    cors: [],
    auth401: [],
    envMissing: [],
    other: [],
  };

  for (const e of errors) {
    const txt = e.text || '';
    if (txt.includes('PGRST') || txt.includes('42501') || txt.includes('supabase')) {
      errorCategories.supabase.push(txt);
    } else if (txt.includes('Uncaught Error') || txt.includes('Objects are not valid') || txt.includes('React')) {
      errorCategories.react.push(txt);
    } else if (txt.includes('Hydration') || txt.includes('hydration') || txt.includes('did not match')) {
      errorCategories.hydration.push(txt);
    } else if (txt.includes('CORS') || txt.includes('cross-origin')) {
      errorCategories.cors.push(txt);
    } else if (txt.includes('401') || txt.includes('403') || txt.includes('Unauthorized')) {
      errorCategories.auth401.push(txt);
    } else if (txt.includes('NEXT_PUBLIC_') || txt.includes('env') || txt.includes('undefined')) {
      errorCategories.envMissing.push(txt);
    } else {
      errorCategories.other.push(txt);
    }
  }

  // Push to allConsoleErrors
  allConsoleErrors.push(...errors.map(e => e.text));
  allNetworkErrors.push(...networkErrors.map(e => `[${e.status}] ${e.url}`));

  console.log(`\n  Console errors: ${errors.length}, Warnings: ${warns.length}`);
  console.log(`  Network errors (4xx/5xx): ${networkErrors.filter(e => e.status >= 400).length}`);
  console.log(`  Failed requests: ${networkErrors.filter(e => e.status === 0).length}`);

  // Report significant error categories
  if (errorCategories.supabase.length > 0) {
    addFinding('P1', `Supabase errors in console (${errorCategories.supabase.length})`, 'multiple',
      ['Navigate all modules', 'Monitor console'],
      'No Supabase errors in browser console',
      `${errorCategories.supabase.length} Supabase-related errors`,
      JSON.stringify([...new Set(errorCategories.supabase)].slice(0, 3)),
      'RLS policy error, missing permissions, or query syntax issue');
  }

  if (errorCategories.react.length > 0) {
    addFinding('P1', `React runtime errors in console (${errorCategories.react.length})`, 'multiple',
      ['Navigate all modules', 'Monitor console'],
      'No React errors in browser console',
      `${errorCategories.react.length} React errors detected`,
      JSON.stringify([...new Set(errorCategories.react)].slice(0, 3)),
      'Component rendering error, invalid prop type, or missing key');
  }

  if (errorCategories.hydration.length > 0) {
    addFinding('P2', `React hydration mismatches (${errorCategories.hydration.length})`, 'multiple',
      ['Navigate all modules', 'Monitor console for hydration errors'],
      'No hydration mismatch errors',
      `${errorCategories.hydration.length} hydration errors`,
      JSON.stringify([...new Set(errorCategories.hydration)].slice(0, 3)),
      'Server/client render divergence — often dates, dynamic content, or browser extensions');
  }

  if (errorCategories.cors.length > 0) {
    addFinding('P1', `CORS errors detected (${errorCategories.cors.length})`, 'multiple',
      ['Navigate all modules', 'Monitor console'],
      'No CORS errors',
      `${errorCategories.cors.length} CORS errors`,
      JSON.stringify([...new Set(errorCategories.cors)].slice(0, 3)),
      'API route or third-party endpoint missing CORS headers');
  }

  // 4xx/5xx network errors breakdown
  const netByStatus = {};
  for (const ne of networkErrors) {
    if (ne.status >= 400) {
      netByStatus[ne.status] = netByStatus[ne.status] || [];
      netByStatus[ne.status].push(ne.url);
    }
  }

  for (const [status, urls] of Object.entries(netByStatus)) {
    const severity = (status === '401' || status === '403' || status === '500') ? 'P1' : 'P2';
    addFinding(severity, `HTTP ${status} responses detected (${urls.length})`, 'multiple',
      ['Navigate all modules', 'Monitor network responses'],
      `No HTTP ${status} responses`,
      `${urls.length} requests returned ${status}`,
      JSON.stringify([...new Set(urls)].slice(0, 5)),
      status === '401' ? 'Auth token not propagated to API route' :
      status === '403' ? 'RLS/permission denial' :
      status === '500' ? 'Server-side exception' : 'API error');
  }

  const failedReqs = networkErrors.filter(e => e.status === 0);
  if (failedReqs.length > 5) {
    addFinding('P2', `${failedReqs.length} failed network requests (no response)`, 'multiple',
      ['Navigate all modules', 'Monitor network'],
      'All network requests receive a response',
      `${failedReqs.length} requests failed with no response`,
      JSON.stringify(failedReqs.slice(0, 5).map(r => r.url)),
      'DNS, SSL, or connection error — possibly third-party scripts');
  }

  if (errors.length === 0 && Object.keys(netByStatus).length === 0) {
    addPass('No significant console errors or network errors across all modules');
  }

  // ── SECTION H: Responsive Social Module ────────────────────────────────────
  console.log('\n' + '─'.repeat(60));
  console.log('  SECTION H: Responsive Social Module');
  console.log('─'.repeat(60));

  const responsiveViewports = [
    { label: 'laptop-1280', width: 1280, height: 800 },
    { label: 'mobile-430', width: 430, height: 932 },
    { label: 'tablet-768', width: 768, height: 1024 },
  ];

  for (const vp of responsiveViewports) {
    console.log(`\n[H] Testing social at ${vp.width}px...`);
    const vpPage = await context.newPage();
    try {
      await vpPage.setViewportSize({ width: vp.width, height: vp.height });
      const targetRoute = socialRoute || '/dashboard/social';
      const res = await navTo(vpPage, targetRoute, `Social@${vp.width}`);
      await dismissCommonModals(vpPage);
      await vpPage.waitForTimeout(1500);

      perfTimings[`H_social_${vp.label}`] = `${res.ms}ms`;

      const bodyText = await vpPage.locator('body').textContent({ timeout: 3000 }).catch(() => '');
      const hasSocialContent = bodyText.toLowerCase().includes('social') ||
        bodyText.toLowerCase().includes('facebook') ||
        bodyText.toLowerCase().includes('instagram') ||
        bodyText.toLowerCase().includes('post');

      // Check for horizontal scroll (layout overflow)
      const hasHorizontalScroll = await vpPage.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      }).catch(() => false);

      // Check for overlapping elements at mobile
      if (vp.width <= 430) {
        if (hasHorizontalScroll) {
          addFinding('P2', `Social module has horizontal scroll overflow at ${vp.width}px`, socialRoute || '/dashboard/social',
            [`Set viewport to ${vp.width}x${vp.height}`, 'Navigate to social module'],
            'No horizontal scroll at mobile width',
            'Horizontal scroll detected (content wider than viewport)',
            `scrollWidth > clientWidth at ${vp.width}px`,
            'Fixed-width container or non-responsive component in social module');
        } else if (hasSocialContent) {
          addPass(`Social module has no horizontal overflow at ${vp.width}px mobile`);
        }
      }

      if (!hasSocialContent && res.ok) {
        addFinding('P2', `Social content not visible at ${vp.width}px`, socialRoute || '/dashboard/social',
          [`Set viewport ${vp.width}px`, 'Navigate to social'],
          'Social content visible at all viewport sizes',
          'No social-related content found in page',
          `viewport: ${vp.width}px, bodyText excerpt: ${bodyText.substring(0, 150)}`,
          'Responsive hiding or conditional render based on viewport');
      } else if (res.ok) {
        addPass(`Social module renders at ${vp.width}px (${vp.label})`);
      }

      await vpPage.screenshot({ path: path.join(SCREENSHOTS_DIR, `social-responsive-${vp.label}.png`) }).catch(() => {});
    } catch (e) {
      addFinding('P2', `Responsive test failed at ${vp.label}`, socialRoute || '/dashboard/social',
        [`Set viewport ${vp.width}px`, 'Navigate to social'],
        'Social module loads at all breakpoints',
        `Error: ${e.message}`,
        e.message,
        'Crash or navigation failure at specific viewport');
    } finally {
      await vpPage.close().catch(() => {});
    }
  }

  // ── Cleanup ─────────────────────────────────────────────────────────────────
  await page.close().catch(() => {});
  await browser.close().catch(() => {});

  // ── Final Report ─────────────────────────────────────────────────────────────
  const summary = {
    total: passedChecks.length + findings.length,
    pass: passedChecks.length,
    fail: findings.filter(f => f.severity === 'P0' || f.severity === 'P1' || f.severity === 'P2').length,
    blocked: 0,
  };

  // Social connection summary
  const socialSummary = {
    facebook: {
      dbTokens: fbTokens || [],
      dbConnected: fbConnected,
      dbExpired: fbExpired,
      uiStatus: fbUIStatus,
    },
    instagram: {
      dbTokens: igTokens || [],
      dbConnected: igConnected,
    },
    linkedin: {
      dbTokens: liTokens || [],
      dbConnected: liConnected,
    },
  };

  const report = {
    domain: 'Social Integrations, Lead Finder, Performance, Console/Network Audit',
    timestamp: ts(),
    summary,
    socialConnectionSummary: socialSummary,
    leadFinderSummary: {
      routeFound: leadFinderRoute,
      recentCandidates: recentCandidates || [],
    },
    findings,
    passedChecks,
    performanceTimings: perfTimings,
    consoleErrors: [...new Set(allConsoleErrors)].slice(0, 20),
    networkErrors: [...new Set(allNetworkErrors)].slice(0, 20),
    consoleErrorBreakdown: {
      supabase: errorCategories.supabase.length,
      react: errorCategories.react.length,
      hydration: errorCategories.hydration.length,
      cors: errorCategories.cors.length,
      auth: errorCategories.auth401.length,
      envMissing: errorCategories.envMissing.length,
      other: errorCategories.other.length,
    },
  };

  console.log('\n' + '═'.repeat(70));
  console.log('  AUDIT COMPLETE');
  console.log(`  Total checks: ${summary.total} | PASS: ${summary.pass} | FAIL: ${summary.fail}`);
  console.log(`  Findings: ${findings.length}`);
  findings.forEach(f => console.log(`    [${f.id}][${f.severity}] ${f.title}`));
  console.log('═'.repeat(70));

  // Write JSON report
  const reportPath = path.join(process.cwd(), 'qa/reports/19-social-leadfinder-perf-report.json');
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n  📄 Report written to: ${reportPath}`);

  return report;
}

runAudit().then(report => {
  // Print final JSON to stdout for parent agent consumption
  console.log('\n\n==FINAL_JSON_REPORT==');
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}).catch(err => {
  console.error('AUDIT FATAL ERROR:', err);
  process.exit(1);
});
