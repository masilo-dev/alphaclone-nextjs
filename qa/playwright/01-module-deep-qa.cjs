const fs = require('fs');
const path = require('path');
const {
  BASE_URL,
  createAuthenticatedContext,
  attachTelemetry,
  measureAction,
  dismissCommonModals,
  classifyLatency,
} = require('./auth-helper.cjs');
const MODULES = require('../../scripts/tenant-admin-modules.cjs');

// Public and core marketing routes to include in comprehensive QA
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

// Helper to determine if an interactive control is safe to click
function isSafeControl(text, ariaLabel, tagName, type) {
  const combined = `${text} ${ariaLabel || ''} ${type || ''}`.toLowerCase();
  
  // Destructive terms to avoid
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

async function run() {
  console.log(`=======================================================`);
  console.log(`STARTING DEEP MODULE QA (Total modules/routes: ${ALL_TARGETS.length})`);
  console.log(`=======================================================\n`);

  const { browser, context } = await createAuthenticatedContext();
  const page = await context.newPage();
  const telemetry = attachTelemetry(page);

  const results = [];
  const performanceLog = [];
  const networkErrors = [];
  const consoleErrors = [];
  const screenshotDir = path.join(process.cwd(), 'qa/screenshots/modules');
  fs.mkdirSync(screenshotDir, { recursive: true });

  let totalInteractionsAttempted = 0;
  let passedInteractions = 0;
  let failedInteractions = 0;
  let slowInteractions = 0;
  let criticalInteractions = 0;

  for (let i = 0; i < ALL_TARGETS.length; i++) {
    const mod = ALL_TARGETS[i];
    const moduleSlug = mod.path.replace(/\//g, '_').replace(/^_/, '') || 'home';
    console.log(`[${i + 1}/${ALL_TARGETS.length}] Testing: ${mod.hub} > ${mod.label} (${mod.path})`);

    const routeStart = Date.now();
    let initialUsableTime = 0;
    let loadFailed = false;
    let failureReason = null;
    const moduleControls = [];

    try {
      const response = await page.goto(mod.path, {
        waitUntil: 'domcontentloaded',
        timeout: 45000,
      });

      await dismissCommonModals(page);

      // Wait for main content or body visibility
      const mainEl = page.locator('main, #main-content, body').first();
      await mainEl.waitFor({ state: 'visible', timeout: 20000 });

      // Observe loading state
      const skeletonOrSpinner = page.locator('.animate-spin, .animate-pulse, [role="progressbar"]').first();
      const hasInitialSpinner = await skeletonOrSpinner.isVisible({ timeout: 500 }).catch(() => false);
      if (hasInitialSpinner) {
        await skeletonOrSpinner.waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
      }

      initialUsableTime = Date.now() - routeStart;
      const initialRating = classifyLatency(initialUsableTime);

      if (initialRating === 'POOR') slowInteractions++;
      if (initialRating === 'CRITICAL') criticalInteractions++;

      // Check for crash messages
      const bodyText = await page.locator('body').innerText().catch(() => '');
      const hasCrash = /This section could not be loaded|Application error|Minified React error|Internal Server Error|500 Server Error/i.test(bodyText);
      const isBlank = bodyText.replace(/\s+/g, '').length < 15;

      if (hasCrash || isBlank) {
        loadFailed = true;
        failureReason = hasCrash ? 'Application crash/error rendered' : 'Blank screen rendered';
        failedInteractions++;
      } else {
        passedInteractions++;
      }

      // Discover and click safe interactive controls on this screen
      const interactiveLocators = await page.locator('button, [role="button"], [role="tab"], a[href^="/"], input[type="search"], select').all();
      const controlsLimit = Math.min(interactiveLocators.length, 12); // Click up to 12 safe controls per screen

      for (let c = 0; c < controlsLimit; c++) {
        const ctrl = interactiveLocators[c];
        try {
          const isVisible = await ctrl.isVisible().catch(() => false);
          if (!isVisible) continue;

          const text = (await ctrl.innerText().catch(() => '')).trim();
          const ariaLabel = (await ctrl.getAttribute('aria-label').catch(() => '')) || '';
          const role = (await ctrl.getAttribute('role').catch(() => '')) || '';
          const tagName = await ctrl.evaluate(el => el.tagName.toLowerCase()).catch(() => '');
          const type = (await ctrl.getAttribute('type').catch(() => '')) || '';

          if (!isSafeControl(text, ariaLabel, tagName, type)) {
            continue;
          }

          totalInteractionsAttempted++;
          const controlName = text || ariaLabel || `${tagName}[${role || type}]`;
          const clickStart = Date.now();

          // Perform safe interaction
          if (tagName === 'input') {
            await ctrl.fill('test');
            await ctrl.clear();
          } else {
            // Click control
            await ctrl.click({ timeout: 4000 }).catch(async (e) => {
              // Try force click if intercepted
              await ctrl.click({ force: true, timeout: 2000 });
            });
          }

          const actionDuration = Date.now() - clickStart;
          const latencyRating = classifyLatency(actionDuration);

          if (latencyRating === 'POOR') slowInteractions++;
          if (latencyRating === 'CRITICAL') criticalInteractions++;

          moduleControls.push({
            name: controlName,
            role: role || tagName,
            latencyMs: actionDuration,
            rating: latencyRating,
            status: 'PASS',
          });
          passedInteractions++;

          // Small cooldown between interactions
          await page.waitForTimeout(150);
        } catch (ctrlErr) {
          failedInteractions++;
          moduleControls.push({
            name: `Control-${c}`,
            status: 'FAIL',
            error: ctrlErr.message,
          });
        }
      }

      // Take a representative screenshot
      const shotPath = path.join(screenshotDir, `${moduleSlug}.png`);
      await page.screenshot({ path: shotPath, fullPage: false }).catch(() => {});

      performanceLog.push({
        module: mod.label,
        hub: mod.hub,
        path: mod.path,
        loadTimeMs: initialUsableTime,
        rating: initialRating,
        controlsCount: moduleControls.length,
      });

      results.push({
        hub: mod.hub,
        label: mod.label,
        path: mod.path,
        status: loadFailed ? 'FAIL' : 'PASS',
        loadTimeMs: initialUsableTime,
        rating: initialRating,
        failureReason,
        controlsTested: moduleControls,
        screenshot: `qa/screenshots/modules/${moduleSlug}.png`,
      });

    } catch (err) {
      failedInteractions++;
      criticalInteractions++;
      console.error(`  ❌ Failed navigating ${mod.path}: ${err.message}`);
      results.push({
        hub: mod.hub,
        label: mod.label,
        path: mod.path,
        status: 'FAIL',
        error: err.message,
      });
    }
  }

  await browser.close();

  // Save intermediate results
  fs.writeFileSync('qa/results-modules.json', JSON.stringify(results, null, 2));
  fs.writeFileSync('qa/performance-modules.json', JSON.stringify(performanceLog, null, 2));
  fs.writeFileSync('qa/console-errors.json', JSON.stringify(telemetry.consoleLogs.filter(l => l.type === 'error' || l.type === 'pageerror'), null, 2));
  fs.writeFileSync('qa/network-errors.json', JSON.stringify(telemetry.networkErrors, null, 2));

  console.log(`\n=======================================================`);
  console.log(`MODULE QA COMPLETE!`);
  console.log(`Total Interactions: ${totalInteractionsAttempted}`);
  console.log(`Passed: ${passedInteractions} | Failed: ${failedInteractions}`);
  console.log(`Slow (3-5s): ${slowInteractions} | Critical (>5s): ${criticalInteractions}`);
  console.log(`=======================================================\n`);
}

run().catch(err => {
  console.error('Fatal Module QA Error:', err);
  process.exit(1);
});
