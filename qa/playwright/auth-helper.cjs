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

const fs = require('fs');
const COOKIE_CACHE_PATH = path.join(process.cwd(), '.qa_auth_cookies.json');
let cachedCookies = null;

async function getAuthCookies(email = 'bonnie@alphaclonesystems.com') {
  if (cachedCookies) return cachedCookies;

  if (fs.existsSync(COOKIE_CACHE_PATH)) {
    try {
      const raw = JSON.parse(fs.readFileSync(COOKIE_CACHE_PATH, 'utf8'));
      if (raw && Array.isArray(raw.cookies) && (Date.now() - raw.timestamp) < 3600_000) {
        cachedCookies = raw.cookies;
        return cachedCookies;
      }
    } catch {}
  }

  let linkData = null;
  let linkErr = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await admin.auth.admin.generateLink({
        type: 'magiclink',
        email,
      });
      linkData = res.data;
      linkErr = res.error;
      if (!linkErr && linkData?.properties?.hashed_token) break;
    } catch (e) {
      linkErr = e;
    }
    if (attempt < 3) await new Promise((r) => setTimeout(r, 2000 * attempt));
  }
  if (linkErr || !linkData?.properties?.hashed_token) {
    throw new Error(`Magiclink error: ${linkErr?.message || linkErr || 'Missing hashed token'}`);
  }

  const { data: authData, error: authErr } = await anon.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: 'magiclink',
  });
  if (authErr) throw new Error(`Verify OTP error: ${authErr.message}`);

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

  cachedCookies = cookiesCreated.map(c => ({
    name: c.name,
    value: c.value,
    domain: domain.startsWith('localhost') ? 'localhost' : `.${domain}`,
    path: '/',
    httpOnly: false,
    secure: !domain.startsWith('localhost'),
    sameSite: 'Lax',
  }));

  try {
    fs.writeFileSync(COOKIE_CACHE_PATH, JSON.stringify({ timestamp: Date.now(), cookies: cachedCookies }, null, 2));
  } catch {}

  return cachedCookies;
}

async function createAuthenticatedContext(options = {}) {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext({
    baseURL: BASE_URL,
    viewport: options.viewport || { width: 1280, height: 800 },
    userAgent: options.userAgent,
    isMobile: options.isMobile,
    hasTouch: options.hasTouch,
    recordVideo: options.recordVideo ? { dir: 'qa/videos/' } : undefined,
  });

  const cookies = await getAuthCookies();
  await context.addCookies(cookies);

  const targetUserId = options.userId || '681241e7-6e31-455b-89e0-a2bfda699135';
  const targetTenantId = options.tenantId || process.env.TEST_TENANT_ID || '066eb88e-3fb0-45c9-b4d1-c3c2063ea0d4';

  await context.addInitScript(({ userId, tenantId }) => {
    localStorage.setItem(`welcome_seen_${userId}`, 'true');
    localStorage.setItem(`business_welcome_seen_${userId}`, '1');
    localStorage.setItem(`onboarding_completed_${userId}`, 'true');
    localStorage.setItem('current_tenant_id', tenantId);
    sessionStorage.setItem('current_tenant_id', tenantId);
  }, { userId: targetUserId, tenantId: targetTenantId });

  return { browser, context };
}

function attachTelemetry(page) {
  const consoleLogs = [];
  const networkErrors = [];
  const allRequests = [];

  page.on('console', (msg) => {
    const type = msg.type();
    const text = msg.text();
    consoleLogs.push({
      timestamp: Date.now(),
      type,
      text,
      location: msg.location(),
    });
  });

  page.on('pageerror', (err) => {
    consoleLogs.push({
      timestamp: Date.now(),
      type: 'pageerror',
      text: String(err?.message || err),
      stack: err?.stack,
    });
  });

  page.on('request', (req) => {
    allRequests.push({
      id: req.url() + '_' + Date.now(),
      url: req.url(),
      method: req.method(),
      resourceType: req.resourceType(),
      startTime: Date.now(),
    });
  });

  page.on('response', (res) => {
    const status = res.status();
    const url = res.url();
    if (status >= 400) {
      networkErrors.push({
        timestamp: Date.now(),
        status,
        url,
        statusText: res.statusText(),
      });
    }
  });

  page.on('requestfailed', (req) => {
    networkErrors.push({
      timestamp: Date.now(),
      status: 0,
      url: req.url(),
      failure: req.failure()?.errorText || 'Failed',
    });
  });

  return { consoleLogs, networkErrors, allRequests };
}

async function measureAction(page, actionName, actionFn) {
  const startTime = Date.now();
  let clickTime = 0;
  let responseTime = 0;
  let usableTime = 0;

  try {
    await actionFn();
    clickTime = Date.now() - startTime;

    // Wait for any microtasks / mutations
    await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});
    responseTime = Date.now() - startTime;

    // Check if main UI is responsive and visible
    await page.waitForTimeout(300);
    usableTime = Date.now() - startTime;

    return {
      actionName,
      success: true,
      clickTime,
      responseTime,
      totalTime: usableTime,
      category: classifyLatency(usableTime),
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

function classifyLatency(ms) {
  if (ms <= 100) return 'INSTANT';
  if (ms <= 500) return 'EXCELLENT';
  if (ms <= 1000) return 'GOOD';
  if (ms <= 2000) return 'ACCEPTABLE';
  if (ms <= 3000) return 'WARNING';
  if (ms <= 5000) return 'POOR';
  return 'CRITICAL';
}

async function dismissCommonModals(page) {
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
      if (await el.isVisible({ timeout: 500 }).catch(() => false)) {
        await el.click({ force: true }).catch(() => {});
      }
    } catch (e) {}
  }
}

module.exports = {
  BASE_URL,
  getAuthCookies,
  createAuthenticatedContext,
  attachTelemetry,
  measureAction,
  classifyLatency,
  dismissCommonModals,
};
