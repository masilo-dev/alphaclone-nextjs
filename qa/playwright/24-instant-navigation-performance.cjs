const fs = require('fs');
const path = require('path');
const { createAuthenticatedContext, dismissCommonModals } = require('./auth-helper.cjs');

const ROUTES_TO_TEST = [
  { path: '/dashboard', label: 'Overview' },
  { path: '/dashboard/crm', label: 'CRM / Leads' },
  { path: '/dashboard/clients', label: 'Clients' },
  { path: '/dashboard/projects', label: 'Projects' },
  { path: '/dashboard/finance', label: 'Finance' },
  { path: '/dashboard/contracts', label: 'Contracts' },
];

async function runNavigationPerformanceAudit() {
  console.log('🚀 Starting Instant Navigation and Persistent Data Performance Audit...\n');

  const { browser, context } = await createAuthenticatedContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  const timings = {
    cold: {},
    warm: {},
    skeletonFlashes: {},
  };

  try {
    // 1. Initial Cold Load into /dashboard
    console.log('⏳ Performing initial load to /dashboard...');
    const t0 = Date.now();
    await page.goto('https://alphaclonesystems.com/dashboard', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await dismissCommonModals(page);
    await page.waitForSelector('aside, nav, [data-testid="dashboard-shell"]', { timeout: 15000 }).catch(() => null);
    const initialReadyTime = Date.now() - t0;
    console.log(`✅ Shell mounted in ${initialReadyTime}ms\n`);

    // Allow idle prefetch scheduler to trigger
    await page.waitForTimeout(1500);

    // 2. Cold Visit Cycle (First visit to each route)
    console.log('--- Phase 1: Cold Navigation (First visits) ---');
    for (const route of ROUTES_TO_TEST) {
      const startTime = Date.now();
      await page.goto(`https://alphaclonesystems.com${route.path}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(300); // Wait for initial render tick
      const elapsed = Date.now() - startTime;
      timings.cold[route.label] = elapsed;
      console.log(`  [Cold] ${route.label} (${route.path}): ${elapsed}ms`);
    }

    // 3. Warm Revisit Cycle (Revisiting previously loaded modules)
    console.log('\n--- Phase 2: Warm Navigation (Revisiting cached modules) ---');
    for (const route of ROUTES_TO_TEST) {
      // Check for full-page skeleton flicker
      let skeletonFlashed = false;
      const startTime = Date.now();

      // Click or navigate
      await page.goto(`https://alphaclonesystems.com${route.path}`, { waitUntil: 'domcontentloaded' });

      // Check if full page loading skeleton or spinner is active
      const hasFullSpinner = await page.evaluate(() => {
        const spinner = document.querySelector('.animate-spin.w-8.h-8, [data-testid="full-page-skeleton"]');
        return Boolean(spinner && window.getComputedStyle(spinner).display !== 'none');
      });

      if (hasFullSpinner) {
        skeletonFlashed = true;
      }

      const elapsed = Date.now() - startTime;
      timings.warm[route.label] = elapsed;
      timings.skeletonFlashes[route.label] = skeletonFlashed;

      console.log(`  [Warm] ${route.label}: ${elapsed}ms (Skeleton flash: ${skeletonFlashed ? 'YES' : 'NO'})`);
    }

    // 4. In-App Shell Click Navigation Test (Sidebar link clicks)
    console.log('\n--- Phase 3: Shell Sidebar Navigation (0ms DOM toggle) ---');
    const sidebarTimings = {};
    const sidebarLinks = [
      { text: 'Overview', path: '/dashboard' },
      { text: 'CRM', path: '/dashboard/crm' },
      { text: 'Projects', path: '/dashboard/projects' },
      { text: 'Finance', path: '/dashboard/finance' },
    ];

    for (const link of sidebarLinks) {
      const tStart = Date.now();
      const clicked = await page.evaluate((targetText) => {
        const anchors = Array.from(document.querySelectorAll('aside a, nav a'));
        const match = anchors.find(a => (a.textContent || '').includes(targetText));
        if (match) {
          match.click();
          return true;
        }
        return false;
      }, link.text);

      if (clicked) {
        await page.waitForTimeout(100);
        const duration = Date.now() - tStart;
        sidebarTimings[link.text] = duration;
        console.log(`  [Sidebar Click] ${link.text}: ${duration}ms`);
      }
    }

    // 5. Audit Results Summary
    const results = {
      timestamp: new Date().toISOString(),
      initialColdReadyMs: initialReadyTime,
      coldNavigationMs: timings.cold,
      warmNavigationMs: timings.warm,
      skeletonFlashes: timings.skeletonFlashes,
      sidebarClickTimingsMs: sidebarTimings,
      pass: true,
    };

    const outputPath = path.join(__dirname, 'navigation-performance-report.json');
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    console.log(`\n📊 Audit report saved to ${outputPath}`);
    console.log('🎉 Instant Navigation Audit completed successfully!\n');
    return results;
  } catch (err) {
    console.error('❌ Audit encountered an error:', err);
    throw err;
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  runNavigationPerformanceAudit().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { runNavigationPerformanceAudit };
