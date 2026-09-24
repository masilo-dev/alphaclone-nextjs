const fs = require('fs');
const path = require('path');
const {
  BASE_URL,
  createAuthenticatedContext,
  dismissCommonModals,
} = require('./auth-helper.cjs');

const STRESS_SEQUENCE = [
  '/dashboard',
  '/dashboard/crm',
  '/dashboard/contacts',
  '/dashboard/leads',
  '/dashboard/deals',
  '/dashboard',
  '/dashboard/accounting',
  '/dashboard/business/cash-flow',
  '/dashboard/business/social',
  '/dashboard/business/facebook',
  '/dashboard',
];

async function runStressQA() {
  console.log(`=======================================================`);
  console.log(`STARTING NAVIGATION STRESS & NETWORK WATERFALL QA`);
  console.log(`=======================================================\n`);

  const { browser, context } = await createAuthenticatedContext();
  const page = await context.newPage();

  const networkRequests = [];
  page.on('request', (req) => {
    networkRequests.push({
      url: req.url(),
      method: req.method(),
      time: Date.now(),
    });
  });

  const rounds = 3;
  const cycleMetrics = [];

  for (let round = 1; round <= rounds; round++) {
    console.log(`--- Running Stress Cycle Round ${round}/${rounds} ---`);
    const roundStart = Date.now();
    const stepTimes = [];

    for (const route of STRESS_SEQUENCE) {
      const stepStart = Date.now();
      await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 35000 });
      await dismissCommonModals(page);
      await page.locator('main').first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
      const duration = Date.now() - stepStart;
      stepTimes.push({ route, durationMs: duration });
    }

    // Measure JS heap memory if available via performance.memory
    const memory = await page.evaluate(() => {
      if (window.performance && window.performance.memory) {
        return {
          usedJSHeapSize: Math.round(window.performance.memory.usedJSHeapSize / (1024 * 1024)),
          totalJSHeapSize: Math.round(window.performance.memory.totalJSHeapSize / (1024 * 1024)),
        };
      }
      return null;
    });

    const totalRoundTime = Date.now() - roundStart;
    cycleMetrics.push({
      round,
      totalDurationMs: totalRoundTime,
      avgStepMs: Math.round(totalRoundTime / STRESS_SEQUENCE.length),
      memoryMB: memory,
      steps: stepTimes,
    });
  }

  // Analyze network requests for duplicates / N+1 patterns
  const urlCounts = {};
  for (const req of networkRequests) {
    if (req.url.includes('/api/') || req.url.includes('supabase.co')) {
      const cleanUrl = req.url.split('?')[0];
      urlCounts[cleanUrl] = (urlCounts[cleanUrl] || 0) + 1;
    }
  }

  const frequentRequests = Object.entries(urlCounts)
    .filter(([_, count]) => count > 5)
    .map(([url, count]) => ({ url, count }));

  await browser.close();

  const stressReport = {
    totalRequestsLogged: networkRequests.length,
    frequentRequests,
    cycleMetrics,
    memoryGrowthDetected: cycleMetrics.length > 1 && cycleMetrics[cycleMetrics.length - 1].memoryMB?.usedJSHeapSize > (cycleMetrics[0].memoryMB?.usedJSHeapSize || 0) + 100,
    latencyDegradationDetected: cycleMetrics.length > 1 && cycleMetrics[cycleMetrics.length - 1].totalDurationMs > cycleMetrics[0].totalDurationMs * 1.5,
  };

  fs.writeFileSync('qa/results-stress.json', JSON.stringify(stressReport, null, 2));
  console.log(`\n=======================================================`);
  console.log(`NAVIGATION STRESS QA COMPLETE!`);
  console.log(`Round 1 Duration: ${cycleMetrics[0]?.totalDurationMs}ms | Round ${rounds} Duration: ${cycleMetrics[rounds - 1]?.totalDurationMs}ms`);
  console.log(`=======================================================\n`);
}

runStressQA().catch(console.error);
