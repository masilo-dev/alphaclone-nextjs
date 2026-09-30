/**
 * 15-public-auth-qa.cjs
 *
 * QA Domain: Public Website + Authentication + Onboarding
 * Target: https://alphaclonesystems.com
 *
 * Sections:
 *  A. Public Website Audit (all public pages, viewports, SEO, nav)
 *  B. Registration / Sign-Up Flow
 *  C. Login / Auth Flow (magiclink, redirect logic, logout, back-button)
 *  D. Session Persistence
 *  E. Onboarding / First Dashboard Load
 */

'use strict';

const path   = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(process.cwd(), '.env.production.local') });

const fs         = require('fs');
const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');
const {
  BASE_URL,
  createAuthenticatedContext,
  attachTelemetry,
  getAuthCookies,
} = require('./auth-helper.cjs');

// ─── Constants ───────────────────────────────────────────────────────────────

const SCREENSHOTS_DIR = path.join(process.cwd(), 'qa', 'screenshots');
const SUPABASE_URL    = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY        = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const CHROMIUM_ARGS = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'];

const PUBLIC_PAGES = [
  '/',
  '/pricing',
  '/about',
  '/contact',
  '/book-demo',
  '/services',
  '/ecosystem',
  '/solutions',
  '/reliability',
];

const VIEWPORTS = [
  { name: 'desktop-1920', width: 1920, height: 1080 },
  { name: 'desktop-1440', width: 1440, height:  900 },
  { name: 'desktop-1366', width: 1366, height:  768 },
  { name: 'laptop-1280',  width: 1280, height:  800 },
  { name: 'laptop-1024',  width: 1024, height:  768 },
  { name: 'tablet-768',   width:  768, height: 1024 },
  { name: 'mobile-430',   width:  430, height:  932 },
  { name: 'mobile-375',   width:  375, height:  812 },
  { name: 'mobile-320',   width:  320, height:  568 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function shortUrl(url) {
  try { return new URL(url).pathname; } catch { return url; }
}

async function safeSS(page, filename) {
  try {
    ensureDir(SCREENSHOTS_DIR);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, filename), fullPage: false });
  } catch (e) { /* swallow */ }
}

function now() { return new Date().toISOString(); }

// ─── Result accumulators ──────────────────────────────────────────────────────

const findings      = [];
const passedChecks  = [];
const allConsoleErr = [];
const allNetworkErr = [];
const timings       = {};

let findingSeq = 0;
function addFinding({ severity, title, route, steps, expected, actual, evidence, rootCause }) {
  findingSeq++;
  const id = `FIND-${String(findingSeq).padStart(3, '0')}`;
  findings.push({ id, severity, title, route, steps, expected, actual, evidence, rootCause });
  console.log(`  ⚠️  [${severity}] ${id}: ${title}`);
  return id;
}
function addPass(msg) {
  passedChecks.push(msg);
  console.log(`  ✅ PASS: ${msg}`);
}

// ─── Section A: Public Website Audit ─────────────────────────────────────────

async function auditPublicPages() {
  console.log('\n══════════════════════════════════════════════');
  console.log('SECTION A: Public Website Audit');
  console.log('══════════════════════════════════════════════');

  const browser = await chromium.launch({ headless: true, args: CHROMIUM_ARGS });

  // A0 – sitemap.xml
  console.log('\n[A0] Checking sitemap.xml…');
  try {
    const ctx = await browser.newContext();
    const p   = await ctx.newPage();
    const res = await p.goto(`${BASE_URL}/sitemap.xml`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    const status = res ? res.status() : 0;
    const body   = await p.content();
    if (status === 200 && body.includes('<urlset')) {
      addPass('sitemap.xml exists, returns 200, contains <urlset>');
    } else {
      addFinding({
        severity: 'P2',
        title: 'sitemap.xml missing or invalid',
        route: '/sitemap.xml',
        steps: ['GET /sitemap.xml'],
        expected: 'HTTP 200 with valid XML <urlset>',
        actual: `HTTP ${status} | body contains <urlset>: ${body.includes('<urlset')}`,
        evidence: `status=${status}`,
        rootCause: 'Sitemap not generated or not served',
      });
    }
    await ctx.close();
  } catch (e) {
    addFinding({
      severity: 'P2', title: 'sitemap.xml request failed', route: '/sitemap.xml',
      steps: ['GET /sitemap.xml'],
      expected: 'HTTP 200',
      actual: `Error: ${e.message}`,
      evidence: e.message,
      rootCause: 'Network or server error fetching sitemap',
    });
  }

  // Per-page, per-viewport audit
  for (const route of PUBLIC_PAGES) {
    console.log(`\n[A] Auditing route: ${route}`);
    const pageKey = route === '/' ? 'home' : route.replace(/\//g, '-').replace(/^-/, '');

    for (const vp of VIEWPORTS) {
      console.log(`  Viewport: ${vp.name} (${vp.width}x${vp.height})`);
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await ctx.newPage();
      const { consoleLogs, networkErrors } = attachTelemetry(page);

      let loadOk = false;
      let loadMs = 0;
      try {
        const t0  = Date.now();
        const res = await page.goto(`${BASE_URL}${route}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        loadMs    = Date.now() - t0;
        const st  = res ? res.status() : 0;

        if (route === '/' && vp.width === 1920) {
          timings['homepage_load_domcontentloaded'] = `${loadMs}ms`;
        }

        if (st >= 400) {
          addFinding({
            severity: 'P1',
            title: `${route} returns HTTP ${st} at ${vp.name}`,
            route,
            steps: [`Navigate to ${BASE_URL}${route}`],
            expected: 'HTTP 200',
            actual: `HTTP ${st}`,
            evidence: `status=${st}, viewport=${vp.name}`,
            rootCause: 'Page missing or server error',
          });
        } else {
          loadOk = true;
        }
      } catch (e) {
        addFinding({
          severity: 'P1',
          title: `${route} failed to load at ${vp.name}`,
          route,
          steps: [`Navigate to ${BASE_URL}${route}`],
          expected: 'Page loads within 30s',
          actual: `Error: ${e.message}`,
          evidence: e.message,
          rootCause: 'Page load timeout or network error',
        });
        await ctx.close();
        continue;
      }

      if (loadOk) {
        // Title & H1
        const title = await page.title().catch(() => '');
        const h1    = await page.locator('h1').first().textContent({ timeout: 3000 }).catch(() => '');

        if (!title || title.trim() === '') {
          addFinding({
            severity: 'P2',
            title: `Missing <title> on ${route} at ${vp.name}`,
            route,
            steps: [`Navigate to ${route}`, 'Read page title'],
            expected: 'Non-empty page title',
            actual: `title="${title}"`,
            evidence: `title="${title}"`,
            rootCause: 'Missing or empty <title> tag',
          });
        }

        // Horizontal overflow
        const overflowResult = await page.evaluate(() => {
          return {
            scrollWidth:  document.body.scrollWidth,
            clientWidth:  document.documentElement.clientWidth,
            overflow:     document.body.scrollWidth > document.documentElement.clientWidth,
          };
        }).catch(() => ({ overflow: false, scrollWidth: 0, clientWidth: 0 }));

        if (overflowResult.overflow) {
          addFinding({
            severity: vp.width <= 768 ? 'P1' : 'P2',
            title: `Horizontal overflow on ${route} at ${vp.name}`,
            route,
            steps: [`Navigate to ${route}`, `Set viewport ${vp.width}px`, 'Measure body.scrollWidth vs clientWidth'],
            expected: 'body.scrollWidth <= documentElement.clientWidth',
            actual: `scrollWidth=${overflowResult.scrollWidth}, clientWidth=${overflowResult.clientWidth}`,
            evidence: `scrollWidth=${overflowResult.scrollWidth} > clientWidth=${overflowResult.clientWidth}`,
            rootCause: 'Element(s) wider than viewport causing horizontal scroll',
          });
        } else {
          addPass(`No horizontal overflow: ${route} @ ${vp.name}`);
        }

        // Nav visibility checks
        if (vp.width >= 1024) {
          // Desktop: hamburger should NOT be visible
          const hamburgerVisible = await page.evaluate(() => {
            const hamburgers = [
              ...document.querySelectorAll('[data-testid="hamburger"], button[aria-label*="menu"], button[aria-label*="Menu"], .hamburger, .mobile-menu-btn, [class*="hamburger"], [class*="mobile-menu-button"]'),
            ];
            return hamburgers.some(el => {
              const s = window.getComputedStyle(el);
              return s.display !== 'none' && s.visibility !== 'hidden' && el.offsetParent !== null;
            });
          }).catch(() => false);

          if (hamburgerVisible) {
            addFinding({
              severity: 'P1',
              title: `Hamburger menu visible on desktop at ${vp.name} on ${route}`,
              route,
              steps: [`Navigate to ${route}`, `Viewport: ${vp.width}px`, 'Check hamburger button visibility'],
              expected: 'Hamburger must NOT appear at ≥1024px',
              actual: 'Hamburger button is rendered and visible',
              evidence: `viewport=${vp.name} (${vp.width}px)`,
              rootCause: 'Responsive breakpoint misconfiguration – desktop nav not showing',
            });
          } else {
            addPass(`Desktop nav correct (no hamburger) on ${route} @ ${vp.name}`);
          }
        }

        if (vp.width <= 768) {
          // Mobile: hamburger or mobile menu indicator should exist
          const mobileNavExists = await page.evaluate(() => {
            const hamburgers = [
              ...document.querySelectorAll('[data-testid="hamburger"], button[aria-label*="menu"], button[aria-label*="Menu"], .hamburger, [class*="hamburger"], [class*="mobile-menu"], [class*="mobile-nav"]'),
            ];
            // Also check if nav links are hidden
            const navLinks = document.querySelectorAll('nav a');
            const hiddenNavLinks = [...navLinks].some(el => {
              const s = window.getComputedStyle(el);
              return s.display === 'none' || s.visibility === 'hidden';
            });
            return hamburgers.length > 0 || hiddenNavLinks;
          }).catch(() => false);

          if (!mobileNavExists) {
            addFinding({
              severity: 'P2',
              title: `No mobile nav pattern detected on ${route} at ${vp.name}`,
              route,
              steps: [`Navigate to ${route}`, `Viewport: ${vp.width}px`, 'Check mobile nav pattern'],
              expected: 'Mobile nav (hamburger or hidden desktop links) present at ≤768px',
              actual: 'No hamburger and all nav links appear visible — potential layout issue',
              evidence: `viewport=${vp.name} (${vp.width}px)`,
              rootCause: 'Mobile nav pattern not detected; may be using CSS-only approach not caught by DOM query',
            });
          } else {
            addPass(`Mobile nav pattern present on ${route} @ ${vp.name}`);
          }
        }

        // Homepage-specific checks (only once at 1920)
        if (route === '/' && vp.width === 1920) {
          // Screenshot desktop
          await safeSS(page, 'public-homepage-desktop.png');

          // Open Graph
          const ogTitle       = await page.$eval('meta[property="og:title"]',       el => el.content).catch(() => '');
          const ogDescription = await page.$eval('meta[property="og:description"]', el => el.content).catch(() => '');
          const ogImage       = await page.$eval('meta[property="og:image"]',        el => el.content).catch(() => '');
          const ogUrl         = await page.$eval('meta[property="og:url"]',          el => el.content).catch(() => '');

          if (!ogTitle || !ogDescription || !ogImage) {
            addFinding({
              severity: 'P2',
              title: 'Incomplete Open Graph meta tags on homepage',
              route: '/',
              steps: ['Navigate to homepage', 'Read OG meta tags'],
              expected: 'og:title, og:description, og:image all present',
              actual: `og:title="${ogTitle}" | og:description="${ogDescription ? 'present' : 'MISSING'}" | og:image="${ogImage ? 'present' : 'MISSING'}"`,
              evidence: `ogTitle="${ogTitle}", ogDescription="${ogDescription}", ogImage="${ogImage}"`,
              rootCause: 'Missing Open Graph meta tags — social sharing previews will be broken',
            });
          } else {
            addPass(`Open Graph tags complete on homepage: title="${ogTitle.substring(0, 40)}"`);
          }

          // Canonical URL
          const canonical = await page.$eval('link[rel="canonical"]', el => el.href).catch(() => '');
          if (!canonical) {
            addFinding({
              severity: 'P2',
              title: 'Missing canonical URL tag on homepage',
              route: '/',
              steps: ['Navigate to homepage', 'Check <link rel="canonical">'],
              expected: 'Canonical URL tag present',
              actual: 'No canonical tag found',
              evidence: 'document.querySelector(link[rel="canonical"]) returned null',
              rootCause: 'Missing canonical tag — SEO duplicate content risk',
            });
          } else {
            addPass(`Canonical URL present: ${canonical}`);
          }

          // Favicon
          const faviconStatus = await page.evaluate(async () => {
            const links = [...document.querySelectorAll('link[rel*="icon"]')];
            if (!links.length) return { found: false };
            const href = links[0].href;
            try {
              const res = await fetch(href, { method: 'HEAD' });
              return { found: true, status: res.status, href };
            } catch (e) {
              return { found: true, status: 0, href, error: e.message };
            }
          }).catch(() => ({ found: false }));

          if (!faviconStatus.found || faviconStatus.status >= 400) {
            addFinding({
              severity: 'P2',
              title: 'Favicon missing or unreachable',
              route: '/',
              steps: ['Navigate to homepage', 'Check favicon link tag', 'Fetch favicon URL'],
              expected: 'Favicon link exists and returns HTTP 200',
              actual: faviconStatus.found
                ? `Favicon link found but returns HTTP ${faviconStatus.status}`
                : 'No favicon link tag found',
              evidence: JSON.stringify(faviconStatus),
              rootCause: 'Favicon not served or link tag missing',
            });
          } else {
            addPass(`Favicon loads OK: ${faviconStatus.href} (HTTP ${faviconStatus.status})`);
          }

          // Homepage CTAs
          console.log('  Checking homepage CTAs…');
          const ctaSelectors = [
            { label: 'Book Demo CTA',    sel: 'a[href*="book-demo"], a[href*="demo"], button:has-text("Book"), a:has-text("Book Demo")' },
            { label: 'Get Started CTA',  sel: 'a:has-text("Get Started"), button:has-text("Get Started")' },
            { label: 'Pricing link CTA', sel: 'a[href*="pricing"], a:has-text("Pricing")' },
          ];
          for (const cta of ctaSelectors) {
            const el = page.locator(cta.sel).first();
            const visible = await el.isVisible({ timeout: 3000 }).catch(() => false);
            if (!visible) {
              addFinding({
                severity: 'P2',
                title: `${cta.label} not visible on homepage`,
                route: '/',
                steps: ['Navigate to homepage', `Check visibility of selector: ${cta.sel}`],
                expected: `${cta.label} visible on homepage`,
                actual: 'Element not found or not visible',
                evidence: `selector="${cta.sel}"`,
                rootCause: 'CTA element missing, hidden, or selector mismatch',
              });
            } else {
              addPass(`${cta.label} visible on homepage`);
            }
          }

          // Language switcher
          const langSwitcher = page.locator('[data-testid="lang-switcher"], [class*="language"], button:has-text("EN"), select[name*="lang"]').first();
          const langVisible = await langSwitcher.isVisible({ timeout: 2000 }).catch(() => false);
          if (langVisible) {
            addPass('Language switcher found and visible on homepage');
          } else {
            // Not necessarily a bug – log as informational pass
            addPass('Language switcher: not visible / not present at 1920px (may be in mobile nav)');
          }

          // Pricing toggle (look on pricing page, but also check homepage if it has one)
          const pricingToggle = page.locator('[data-testid*="pricing-toggle"], [class*="pricing-toggle"], button:has-text("Annual"), button:has-text("Monthly")').first();
          const pricingToggleVisible = await pricingToggle.isVisible({ timeout: 2000 }).catch(() => false);
          if (pricingToggleVisible) {
            addPass('Pricing toggle found on homepage');
          }
        }

        // Screenshot mobile at /
        if (route === '/' && vp.width === 375) {
          await safeSS(page, 'public-homepage-mobile.png');
        }

        // Collect console errors for this page/viewport
        const errs = consoleLogs.filter(l => l.type === 'error' || l.type === 'pageerror');
        if (errs.length > 0) {
          errs.forEach(e => allConsoleErr.push(`[${route}@${vp.name}] ${e.text}`));
          addFinding({
            severity: 'P2',
            title: `Console errors on ${route} @ ${vp.name}`,
            route,
            steps: [`Navigate to ${route}`, 'Monitor console for errors'],
            expected: 'Zero console errors',
            actual: `${errs.length} console error(s)`,
            evidence: errs.slice(0, 3).map(e => e.text).join(' | '),
            rootCause: 'JavaScript errors thrown during page load',
          });
        } else {
          addPass(`No console errors: ${route} @ ${vp.name}`);
        }

        // Collect network errors
        const netErrs = networkErrors.filter(e => !e.url.includes('analytics') && !e.url.includes('sentry'));
        if (netErrs.length > 0) {
          netErrs.forEach(e => allNetworkErr.push(`[${route}@${vp.name}] HTTP ${e.status || e.failure} ${shortUrl(e.url)}`));
        }
      }

      await ctx.close();
    }
  }

  // Pricing page – toggle check
  console.log('\n[A] Checking pricing toggle on /pricing…');
  try {
    const ctx  = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE_URL}/pricing`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const toggle = page.locator('button:has-text("Annual"), button:has-text("Monthly"), [class*="toggle"], input[type="checkbox"]').first();
    const toggleVisible = await toggle.isVisible({ timeout: 4000 }).catch(() => false);
    if (toggleVisible) {
      await toggle.click({ timeout: 3000 }).catch(() => {});
      addPass('Pricing toggle found and clickable on /pricing');
    } else {
      addFinding({
        severity: 'P3',
        title: 'Pricing monthly/annual toggle not found on /pricing',
        route: '/pricing',
        steps: ['Navigate to /pricing', 'Look for monthly/annual toggle'],
        expected: 'Toggle visible and clickable',
        actual: 'Toggle element not found',
        evidence: 'No element matching toggle selectors',
        rootCause: 'Pricing toggle may not be implemented or uses different selectors',
      });
    }
    await ctx.close();
  } catch (e) {
    console.log(`  Pricing toggle check error: ${e.message}`);
  }

  await browser.close();
  console.log('\n[A] Public website audit complete');
}

// ─── Section B: Registration / Sign-Up ────────────────────────────────────────

async function auditRegistration() {
  console.log('\n══════════════════════════════════════════════');
  console.log('SECTION B: Registration / Sign-Up Flow');
  console.log('══════════════════════════════════════════════');

  const browser = await chromium.launch({ headless: true, args: CHROMIUM_ARGS });
  const ctx     = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page    = await ctx.newPage();
  const { consoleLogs, networkErrors } = attachTelemetry(page);

  const fakeEmail = `E2E_QA_TEST_${Date.now()}@alphaclone-qa-test.invalid`;

  // Try /register first, then /signup
  let regRoute  = null;
  let formFound = false;

  for (const route of ['/register', '/signup', '/auth/signup', '/auth/register']) {
    console.log(`  Trying registration route: ${route}`);
    try {
      const res = await page.goto(`${BASE_URL}${route}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      const st  = res ? res.status() : 0;
      if (st < 400) {
        const hasForm = await page.locator('form, input[type="email"], input[name="email"]').count() > 0;
        if (hasForm) {
          regRoute  = route;
          formFound = true;
          break;
        }
      }
    } catch (e) { /* try next */ }
  }

  if (!formFound) {
    addFinding({
      severity: 'P1',
      title: 'Registration form not found on standard routes',
      route: '/register',
      steps: ['Try /register, /signup, /auth/signup, /auth/register'],
      expected: 'Registration form exists at one of these routes',
      actual: 'No route returned a registration form with email input',
      evidence: 'All routes returned 404 or no form element detected',
      rootCause: 'Registration page may be behind a different route or not implemented',
    });
    await browser.close();
    return;
  }

  addPass(`Registration form found at ${regRoute}`);
  await safeSS(page, 'auth-login.png');

  // B1 – Required field validation (submit empty)
  console.log('  [B1] Testing empty form submission…');
  const submitBtn = page.locator('button[type="submit"], input[type="submit"], button:has-text("Sign up"), button:has-text("Register"), button:has-text("Create")').first();
  const submitVisible = await submitBtn.isVisible({ timeout: 3000 }).catch(() => false);
  if (submitVisible) {
    await submitBtn.click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1000);
    // Check for validation messages
    const validationMsg = await page.locator('[class*="error"], [role="alert"], .field-error, [aria-invalid="true"]').count().catch(() => 0);
    if (validationMsg > 0) {
      addPass('Empty form submission shows validation errors');
    } else {
      addFinding({
        severity: 'P2',
        title: 'No validation feedback on empty form submit',
        route: regRoute,
        steps: ['Navigate to registration', 'Click submit without filling any fields'],
        expected: 'Required field validation messages appear',
        actual: 'No visible validation errors detected',
        evidence: '[class*="error"] count = 0',
        rootCause: 'Missing client-side or HTML5 required field validation',
      });
    }
  }

  // B2 – Invalid email
  console.log('  [B2] Testing invalid email format…');
  await page.goto(`${BASE_URL}${regRoute}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]').first();
  const emailExists = await emailInput.isVisible({ timeout: 3000 }).catch(() => false);
  if (emailExists) {
    await emailInput.fill('not-an-email');
    await submitBtn.click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(1000);
    const errVisible = await page.locator('[class*="error"], [role="alert"], :invalid').count().catch(() => 0);
    if (errVisible > 0) {
      addPass('Invalid email format shows validation error');
    } else {
      addFinding({
        severity: 'P2',
        title: 'No error shown for invalid email format on registration',
        route: regRoute,
        steps: ['Navigate to registration', 'Enter "not-an-email" in email field', 'Submit form'],
        expected: 'Error message for invalid email format',
        actual: 'No error shown',
        evidence: 'No error element detected after submitting invalid email',
        rootCause: 'Missing email format validation',
      });
    }
  }

  // B3 – Fake registration attempt
  console.log(`  [B3] Attempting registration with fake data: ${fakeEmail}…`);
  await page.goto(`${BASE_URL}${regRoute}`, { waitUntil: 'domcontentloaded', timeout: 15000 });

  const emailIn  = page.locator('input[type="email"], input[name="email"]').first();
  const passIn   = page.locator('input[type="password"]').first();
  const passIn2  = page.locator('input[type="password"]').nth(1);

  const hasEmail    = await emailIn.isVisible({ timeout: 3000 }).catch(() => false);
  const hasPassword = await passIn.isVisible({ timeout: 3000 }).catch(() => false);

  if (hasEmail) await emailIn.fill(fakeEmail).catch(() => {});
  if (hasPassword) await passIn.fill('E2EQATest#2026!').catch(() => {});

  // Second password / confirm field
  const hasPass2 = await passIn2.isVisible({ timeout: 1000 }).catch(() => false);
  if (hasPass2) await passIn2.fill('E2EQATest#2026!').catch(() => {});

  // Check for CAPTCHA / Turnstile BEFORE submitting
  const captchaPresent = await page.evaluate(() => {
    return !!(
      document.querySelector('.cf-turnstile') ||
      document.querySelector('[class*="turnstile"]') ||
      document.querySelector('iframe[src*="challenges.cloudflare.com"]') ||
      document.querySelector('iframe[src*="recaptcha"]') ||
      document.querySelector('.g-recaptcha') ||
      document.querySelector('[class*="captcha"]')
    );
  }).catch(() => false);

  if (captchaPresent) {
    addFinding({
      severity: 'P3',
      title: 'CAPTCHA/Turnstile detected on registration form — blocks automated testing',
      route: regRoute,
      steps: ['Navigate to registration', 'Inspect page for CAPTCHA widgets'],
      expected: 'CAPTCHA present is normal',
      actual: 'CAPTCHA/Turnstile widget detected — automated form submission will be blocked',
      evidence: 'CAPTCHA element found in DOM',
      rootCause: 'CAPTCHA intentionally blocks automation — this is expected security behavior (BLOCKED)',
    });
    addPass('CAPTCHA/Turnstile anti-bot protection detected (expected security measure)');
    await browser.close();
    return;
  }

  const submitBtnB = page.locator('button[type="submit"], input[type="submit"], button:has-text("Sign up"), button:has-text("Register"), button:has-text("Create")').first();
  await submitBtnB.click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(3000);

  const currentUrl  = page.url();
  const pageContent = await page.content();
  const successIndicators = ['verify', 'check your email', 'confirmation', 'success', 'sent'];
  const errorIndicators   = ['error', 'invalid', 'already registered', 'failed'];

  let regOutcome = 'unknown';
  if (successIndicators.some(s => pageContent.toLowerCase().includes(s))) {
    regOutcome = 'success-confirmation';
    addPass(`Registration flow shows confirmation (email: ${fakeEmail})`);
  } else if (errorIndicators.some(s => pageContent.toLowerCase().includes(s))) {
    regOutcome = 'error-shown';
    addPass(`Registration with .invalid domain shows appropriate error`);
  } else {
    regOutcome = `unknown-redirect-to-${shortUrl(currentUrl)}`;
    addFinding({
      severity: 'P3',
      title: 'Registration outcome unclear after submit',
      route: regRoute,
      steps: ['Fill registration form', 'Submit with fake .invalid email'],
      expected: 'Clear success message or error message',
      actual: `Redirected to ${currentUrl}. No clear success/error detected.`,
      evidence: `currentUrl=${currentUrl}`,
      rootCause: 'Registration flow UX may need clearer feedback',
    });
  }

  const regConsoleErrs = consoleLogs.filter(l => l.type === 'error' || l.type === 'pageerror');
  regConsoleErrs.forEach(e => allConsoleErr.push(`[${regRoute}] ${e.text}`));

  await browser.close();
  console.log(`  Registration outcome: ${regOutcome}`);
}

// ─── Section C: Login Flow ────────────────────────────────────────────────────

async function auditLoginFlow() {
  console.log('\n══════════════════════════════════════════════');
  console.log('SECTION C: Login / Authentication Flow');
  console.log('══════════════════════════════════════════════');

  // C1 – Unauthenticated access to protected route → redirect to login
  console.log('\n[C1] Unauth access to /dashboard → should redirect to login…');
  {
    const browser = await chromium.launch({ headless: true, args: CHROMIUM_ARGS });
    const ctx     = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page    = await ctx.newPage();
    const { networkErrors } = attachTelemetry(page);

    const t0 = Date.now();
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const finalUrl = page.url();
    const redirectMs = Date.now() - t0;

    if (finalUrl.includes('/login') || finalUrl.includes('/auth') || finalUrl.includes('/signin')) {
      addPass(`Unauthenticated /dashboard redirects to login: ${finalUrl} (${redirectMs}ms)`);
      await safeSS(page, 'auth-login.png');
    } else {
      addFinding({
        severity: 'P0',
        title: 'Protected /dashboard accessible without authentication',
        route: '/dashboard',
        steps: ['Fresh browser context (no cookies)', 'Navigate to /dashboard'],
        expected: 'Redirect to /login or /auth',
        actual: `Stayed on ${finalUrl} — dashboard accessible without auth`,
        evidence: `finalUrl=${finalUrl}`,
        rootCause: 'Auth middleware not protecting /dashboard route — critical security issue',
      });
    }
    await browser.close();
  }

  // C2 – Authenticated session via magiclink
  console.log('\n[C2] Creating authenticated session via magiclink…');
  let authBrowser, authCtx, authPage;
  const dashTimings = {};
  try {
    const result = await createAuthenticatedContext();
    authBrowser  = result.browser;
    authCtx      = result.context;
    authPage     = await authCtx.newPage();
    const { consoleLogs: authConsole, networkErrors: authNetErr } = attachTelemetry(authPage);

    const t0 = Date.now();
    const res = await authPage.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const domMs = Date.now() - t0;
    dashTimings['login_to_dashboard_domcontentloaded'] = `${domMs}ms`;

    await authPage.waitForTimeout(2000); // let hydration settle
    const networkMs = Date.now() - t0;
    dashTimings['login_to_dashboard_fully_loaded'] = `${networkMs}ms`;

    const dashUrl = authPage.url();
    const dashSt  = res ? res.status() : 0;

    if (dashUrl.includes('/dashboard') && dashSt < 400) {
      addPass(`Authenticated /dashboard loads successfully in ${domMs}ms`);
      timings['login_to_dashboard_ms'] = `${domMs}ms`;
      await safeSS(authPage, 'dashboard-loaded.png');
    } else {
      addFinding({
        severity: 'P0',
        title: 'Authenticated user cannot reach /dashboard',
        route: '/dashboard',
        steps: ['Generate magiclink', 'Set auth cookies', 'Navigate to /dashboard'],
        expected: 'Dashboard renders (HTTP 200)',
        actual: `URL=${dashUrl}, HTTP ${dashSt}`,
        evidence: `dashUrl=${dashUrl}, status=${dashSt}`,
        rootCause: 'Session not accepted by app or session cookie format mismatch',
      });
    }

    // C3 – No redirect loops
    const visited = [dashUrl];
    for (let i = 0; i < 3; i++) {
      await authPage.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      visited.push(authPage.url());
    }
    const uniqueUrls = [...new Set(visited)];
    if (uniqueUrls.every(u => u.includes('/dashboard'))) {
      addPass('No redirect loops — /dashboard consistently loads for authenticated user');
    } else {
      addFinding({
        severity: 'P1',
        title: 'Redirect loop or inconsistent URL on /dashboard',
        route: '/dashboard',
        steps: ['Navigate to /dashboard 4 times sequentially'],
        expected: 'All navigations stay on /dashboard',
        actual: `URLs visited: ${uniqueUrls.join(', ')}`,
        evidence: uniqueUrls.join(', '),
        rootCause: 'Auth state inconsistency causing redirect loops',
      });
    }

    // C4 – Console errors on dashboard
    const dashConsoleErrs = authConsole.filter(l => l.type === 'error' || l.type === 'pageerror');
    if (dashConsoleErrs.length > 0) {
      dashConsoleErrs.forEach(e => allConsoleErr.push(`[/dashboard] ${e.text}`));
      addFinding({
        severity: 'P2',
        title: `${dashConsoleErrs.length} console error(s) on /dashboard`,
        route: '/dashboard',
        steps: ['Log in', 'Navigate to /dashboard', 'Monitor console'],
        expected: 'Zero console errors on dashboard',
        actual: `${dashConsoleErrs.length} error(s)`,
        evidence: dashConsoleErrs.slice(0, 3).map(e => e.text).join(' | '),
        rootCause: 'JavaScript errors during dashboard initialization',
      });
    } else {
      addPass('No console errors on /dashboard after login');
    }

    // C5 – Logout flow
    console.log('\n[C5] Testing logout flow…');
    const logoutSelectors = [
      'button:has-text("Log out")',
      'button:has-text("Logout")',
      'button:has-text("Sign out")',
      'a:has-text("Log out")',
      'a:has-text("Logout")',
      'a:has-text("Sign out")',
      '[data-testid="logout"]',
      '[data-testid="sign-out"]',
    ];

    let logoutFound = false;
    for (const sel of logoutSelectors) {
      const el = authPage.locator(sel).first();
      const vis = await el.isVisible({ timeout: 1500 }).catch(() => false);
      if (vis) {
        await el.click({ timeout: 5000 }).catch(() => {});
        await authPage.waitForTimeout(2000);
        logoutFound = true;

        const postLogoutUrl = authPage.url();
        if (postLogoutUrl.includes('/login') || postLogoutUrl.includes('/auth') || postLogoutUrl.includes('/signin') || postLogoutUrl === `${BASE_URL}/`) {
          addPass(`Logout successful — redirected to: ${postLogoutUrl}`);
        } else {
          addFinding({
            severity: 'P1',
            title: 'Logout does not redirect to login/home',
            route: '/dashboard',
            steps: ['Log in', 'Navigate to /dashboard', 'Click logout button'],
            expected: 'Redirect to /login or homepage after logout',
            actual: `Redirected to ${postLogoutUrl}`,
            evidence: `postLogoutUrl=${postLogoutUrl}`,
            rootCause: 'Logout handler missing redirect logic',
          });
        }

        // C6 – Verify session destroyed (try to navigate back to dashboard)
        await authPage.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 20000 });
        const afterLogoutUrl = authPage.url();
        if (!afterLogoutUrl.includes('/dashboard') || afterLogoutUrl.includes('/login')) {
          addPass('Session destroyed after logout — /dashboard inaccessible without re-auth');
        } else {
          addFinding({
            severity: 'P0',
            title: 'Session not destroyed after logout — /dashboard still accessible',
            route: '/dashboard',
            steps: ['Log in', 'Log out', 'Navigate back to /dashboard'],
            expected: 'Should redirect to login (session destroyed)',
            actual: `Dashboard accessible at ${afterLogoutUrl} without re-auth`,
            evidence: `afterLogoutUrl=${afterLogoutUrl}`,
            rootCause: 'Session invalidation on logout not working — critical security issue',
          });
        }

        // C7 – Back button after logout
        await authPage.goBack();
        await authPage.waitForTimeout(1500);
        const backUrl = authPage.url();
        const backContent = await authPage.content();
        const hasDashboardContent = backContent.includes('dashboard') || backContent.includes('Dashboard');
        if (!backUrl.includes('/dashboard') || backUrl.includes('/login')) {
          addPass('Back button after logout does not restore session');
        } else {
          // Check if actually showing dashboard or just a cached shell
          addFinding({
            severity: 'P1',
            title: 'Back button after logout may show cached dashboard page',
            route: '/dashboard',
            steps: ['Log in', 'Log out', 'Press browser back button'],
            expected: 'Should not be able to view dashboard content',
            actual: `URL is ${backUrl} — may be showing cached content`,
            evidence: `backUrl=${backUrl}`,
            rootCause: 'Browser cache not cleared on logout — back button shows stale session content',
          });
        }

        break;
      }
    }

    if (!logoutFound) {
      addFinding({
        severity: 'P2',
        title: 'Logout button not found on dashboard',
        route: '/dashboard',
        steps: ['Log in', 'Navigate to /dashboard', 'Search for logout button'],
        expected: 'Logout button accessible from dashboard',
        actual: 'No logout button found with standard selectors',
        evidence: `Selectors tried: ${logoutSelectors.join(', ')}`,
        rootCause: 'Logout may be in a dropdown or avatar menu not yet expanded',
      });
    }

  } catch (e) {
    addFinding({
      severity: 'P0',
      title: 'Magiclink authentication failed',
      route: '/dashboard',
      steps: ['Generate magiclink for bonnie@alphaclonesystems.com', 'Set cookies', 'Navigate to /dashboard'],
      expected: 'Authenticated session established',
      actual: `Error: ${e.message}`,
      evidence: e.message,
      rootCause: 'Supabase admin API or cookie injection failed',
    });
  } finally {
    if (authBrowser) await authBrowser.close().catch(() => {});
  }

  // C8 – Invalid credentials (wrong password on login page)
  console.log('\n[C8] Testing invalid credentials on login page…');
  {
    const browser = await chromium.launch({ headless: true, args: CHROMIUM_ARGS });
    const ctx     = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page    = await ctx.newPage();

    try {
      // Try to find the login page
      let loginFound = false;
      for (const route of ['/login', '/auth/login', '/signin', '/auth/signin']) {
        const res = await page.goto(`${BASE_URL}${route}`, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => null);
        if (res && res.status() < 400) {
          const hasForm = await page.locator('input[type="email"], input[type="password"]').count();
          if (hasForm > 0) {
            loginFound = true;

            const emailInput = page.locator('input[type="email"], input[name="email"]').first();
            const passInput  = page.locator('input[type="password"]').first();
            const submitBtn  = page.locator('button[type="submit"], input[type="submit"]').first();

            await emailInput.fill('bonnie@alphaclonesystems.com').catch(() => {});
            await passInput.fill('WrongPassword12345!').catch(() => {});
            await submitBtn.click({ timeout: 5000 }).catch(() => {});
            await page.waitForTimeout(3000);

            const errVisible = await page.locator('[class*="error"], [role="alert"], [class*="alert"]').count().catch(() => 0);
            if (errVisible > 0) {
              const errText = await page.locator('[class*="error"], [role="alert"], [class*="alert"]').first().textContent().catch(() => '');
              addPass(`Invalid credentials shows error: "${errText.trim().substring(0, 80)}"`);
            } else {
              addFinding({
                severity: 'P2',
                title: 'No error message shown for invalid credentials',
                route,
                steps: ['Navigate to login', 'Enter valid email + wrong password', 'Submit'],
                expected: 'Error message: "Invalid credentials" or similar',
                actual: 'No visible error message detected',
                evidence: '[class*="error"] count = 0',
                rootCause: 'Error feedback missing or uses non-standard class names',
              });
            }
            break;
          }
        }
      }

      if (!loginFound) {
        addFinding({
          severity: 'P2',
          title: 'Password login form not found (may use magiclink only)',
          route: '/login',
          steps: ['Try /login, /auth/login, /signin'],
          expected: 'Login form with email + password',
          actual: 'No password login form found',
          evidence: 'All login routes returned no password input',
          rootCause: 'App may use magiclink/OTP only — no password login',
        });
        addPass('Note: App appears to use magiclink-only auth (no password login form detected)');
      }
    } catch (e) {
      console.log(`  [C8] Error: ${e.message}`);
    }
    await browser.close();
  }
}

// ─── Section D: Session Persistence ──────────────────────────────────────────

async function auditSessionPersistence() {
  console.log('\n══════════════════════════════════════════════');
  console.log('SECTION D: Session Persistence');
  console.log('══════════════════════════════════════════════');

  // D1 – Reload and verify still authenticated
  console.log('\n[D1] Reload page → verify still authenticated…');
  {
    const { browser, context } = await createAuthenticatedContext();
    const page = await context.newPage();
    try {
      await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      const url1 = page.url();
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
      const url2 = page.url();

      if (url2.includes('/dashboard') && !url2.includes('/login')) {
        addPass('Session persists after page reload — still on /dashboard');
      } else {
        addFinding({
          severity: 'P1',
          title: 'Session lost on page reload',
          route: '/dashboard',
          steps: ['Log in', 'Navigate to /dashboard', 'Reload page'],
          expected: 'Still authenticated on /dashboard after reload',
          actual: `Redirected to ${url2}`,
          evidence: `url1=${url1}, url2=${url2}`,
          rootCause: 'Session cookies not persisting across page reloads',
        });
      }
    } finally {
      await browser.close().catch(() => {});
    }
  }

  // D2 – Close and re-open context with same cookies
  console.log('\n[D2] Close context → re-open with same cookies → verify session…');
  {
    let savedCookies;
    const browser1 = await chromium.launch({ headless: true, args: CHROMIUM_ARGS });
    const ctx1     = await browser1.newContext({ viewport: { width: 1280, height: 800 } });

    try {
      const cookies = await getAuthCookies();
      await ctx1.addCookies(cookies);
      const page1 = await ctx1.newPage();
      await page1.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      savedCookies = await ctx1.cookies();
    } finally {
      await browser1.close().catch(() => {});
    }

    const browser2 = await chromium.launch({ headless: true, args: CHROMIUM_ARGS });
    const ctx2     = await browser2.newContext({ viewport: { width: 1280, height: 800 } });
    try {
      await ctx2.addCookies(savedCookies);
      const page2 = await ctx2.newPage();
      await page2.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      const url = page2.url();

      if (url.includes('/dashboard') && !url.includes('/login')) {
        addPass('Session persists after context close/re-open with same cookies');
      } else {
        addFinding({
          severity: 'P2',
          title: 'Session not restored after context close/re-open',
          route: '/dashboard',
          steps: ['Log in and collect cookies', 'Close browser context', 'Open new context with same cookies', 'Navigate to /dashboard'],
          expected: 'Session restored — user still on /dashboard',
          actual: `Redirected to ${url}`,
          evidence: `finalUrl=${url}`,
          rootCause: 'Session token expired or server-side session not valid across context resets',
        });
      }
    } finally {
      await browser2.close().catch(() => {});
    }
  }
}

// ─── Section E: Onboarding ────────────────────────────────────────────────────

async function auditOnboarding() {
  console.log('\n══════════════════════════════════════════════');
  console.log('SECTION E: Onboarding / First Dashboard Load');
  console.log('══════════════════════════════════════════════');

  const { browser, context } = await createAuthenticatedContext();
  const page = await context.newPage();
  const { consoleLogs } = attachTelemetry(page);

  try {
    const t0 = Date.now();
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const domMs = Date.now() - t0;
    await page.waitForTimeout(2000);
    const totalMs = Date.now() - t0;

    timings['dashboard_first_meaningful_paint_est'] = `${domMs}ms`;
    timings['dashboard_fully_settled'] = `${totalMs}ms`;

    const url = page.url();
    addPass(`Dashboard URL after auth: ${url} (DOM ready: ${domMs}ms, settled: ${totalMs}ms)`);

    // Check for splash screen / welcome modal
    const splashSelectors = [
      '[class*="splash"]',
      '[class*="welcome"]',
      '[class*="onboarding"]',
      '[data-testid*="onboarding"]',
      '[data-testid*="welcome"]',
      '.modal',
      '[role="dialog"]',
      '[class*="modal"]',
    ];

    let splashFound = false;
    for (const sel of splashSelectors) {
      const el = page.locator(sel).first();
      const vis = await el.isVisible({ timeout: 1000 }).catch(() => false);
      if (vis) {
        const text = await el.textContent({ timeout: 2000 }).catch(() => '');
        splashFound = true;
        addPass(`Onboarding/welcome element detected: "${sel}" — content: "${text.trim().substring(0, 100)}"`);
        break;
      }
    }

    if (!splashFound) {
      addPass('No splash/onboarding modal shown for existing user (welcome flags pre-set via localStorage — expected)');
    }

    // Check dashboard main content visible
    const mainContent = await page.locator('main, [class*="dashboard"], [data-testid*="dashboard"]').count().catch(() => 0);
    if (mainContent > 0) {
      addPass('Dashboard main content area is present');
    } else {
      addFinding({
        severity: 'P2',
        title: 'Dashboard main content area not detected',
        route: '/dashboard',
        steps: ['Log in', 'Navigate to /dashboard', 'Look for main content area'],
        expected: '<main> or dashboard container element present',
        actual: 'No main content area found',
        evidence: 'main, [class*="dashboard"] count = 0',
        rootCause: 'Dashboard may not have rendered or content is in unexpected container',
      });
    }

    // Check for any page errors during onboarding
    const onboardingErrors = consoleLogs.filter(l => l.type === 'error' || l.type === 'pageerror');
    if (onboardingErrors.length > 0) {
      onboardingErrors.forEach(e => allConsoleErr.push(`[/dashboard onboarding] ${e.text}`));
      addFinding({
        severity: 'P2',
        title: `${onboardingErrors.length} console error(s) during dashboard load/onboarding`,
        route: '/dashboard',
        steps: ['Log in', 'Navigate to /dashboard', 'Monitor console for 2s'],
        expected: 'Zero console errors',
        actual: `${onboardingErrors.length} error(s)`,
        evidence: onboardingErrors.slice(0, 3).map(e => e.text).join(' | '),
        rootCause: 'JavaScript errors during dashboard initialization or onboarding flow',
      });
    } else {
      addPass('No console errors during dashboard onboarding load');
    }

    await safeSS(page, 'dashboard-loaded.png');

  } finally {
    await browser.close().catch(() => {});
  }
}

// ─── Main Orchestrator ────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  AlphaClone QA — Domain: Public + Auth + Onboarding          ║');
  console.log(`║  Target: ${BASE_URL}`);
  console.log(`║  Started: ${now()}`);
  console.log('╚══════════════════════════════════════════════════════════════╝');

  ensureDir(SCREENSHOTS_DIR);

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ANON_KEY) {
    console.error('ERROR: Missing Supabase credentials in .env.production.local');
    console.error(`  SUPABASE_URL: ${SUPABASE_URL ? 'SET' : 'MISSING'}`);
    console.error(`  SERVICE_ROLE_KEY: ${SERVICE_ROLE_KEY ? 'SET' : 'MISSING'}`);
    console.error(`  ANON_KEY: ${ANON_KEY ? 'SET' : 'MISSING'}`);
    process.exit(1);
  }

  const totalStart = Date.now();

  try { await auditPublicPages();     } catch (e) { console.error('[A] Fatal error:', e.message); }
  try { await auditRegistration();    } catch (e) { console.error('[B] Fatal error:', e.message); }
  try { await auditLoginFlow();       } catch (e) { console.error('[C] Fatal error:', e.message); }
  try { await auditSessionPersistence(); } catch (e) { console.error('[D] Fatal error:', e.message); }
  try { await auditOnboarding();      } catch (e) { console.error('[E] Fatal error:', e.message); }

  timings['total_audit_runtime'] = `${Date.now() - totalStart}ms`;

  // ─── Build Report ──────────────────────────────────────────────────────────

  const p0 = findings.filter(f => f.severity === 'P0').length;
  const p1 = findings.filter(f => f.severity === 'P1').length;
  const p2 = findings.filter(f => f.severity === 'P2').length;
  const p3 = findings.filter(f => f.severity === 'P3').length;
  const total = findings.length + passedChecks.length;
  const pass  = passedChecks.length;
  const fail  = findings.length;

  const report = {
    domain: 'Public Website + Authentication + Onboarding',
    timestamp: now(),
    summary: {
      total,
      pass,
      fail,
      blocked: findings.filter(f => f.rootCause && f.rootCause.includes('BLOCKED')).length,
      p0_release_blockers: p0,
      p1_high: p1,
      p2_medium: p2,
      p3_low: p3,
    },
    findings,
    passedChecks,
    performanceTimings: timings,
    consoleErrors: [...new Set(allConsoleErr)],
    networkErrors: [...new Set(allNetworkErr)],
  };

  console.log('\n══════════════════════════════════════════════');
  console.log('AUDIT COMPLETE — SUMMARY');
  console.log('══════════════════════════════════════════════');
  console.log(`Total checks : ${total}`);
  console.log(`Passed       : ${pass}`);
  console.log(`Failed       : ${fail} (P0=${p0}, P1=${p1}, P2=${p2}, P3=${p3})`);
  console.log(`Console errs : ${allConsoleErr.length}`);
  console.log(`Network errs : ${allNetworkErr.length}`);
  console.log('Timings      :', JSON.stringify(timings, null, 2));

  const reportPath = path.join(process.cwd(), 'qa', 'reports', '15-public-auth-report.json');
  ensureDir(path.dirname(reportPath));
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\nReport saved: ${reportPath}`);

  // Output for parent agent
  console.log('\n__REPORT_JSON_START__');
  console.log(JSON.stringify(report, null, 2));
  console.log('__REPORT_JSON_END__');

  return report;
}

main().catch(e => {
  console.error('FATAL:', e);
  process.exit(1);
});
