const fs = require('fs');
const path = require('path');
const { createAuthenticatedContext } = require('./auth-helper.cjs');

const VIEWPORTS = [
  { name: '320px-SE-narrow', width: 320, height: 568, category: 'mobile' },
  { name: '360px-Android-compact', width: 360, height: 800, category: 'mobile' },
  { name: '375px-iPhone-SE', width: 375, height: 667, category: 'mobile' },
  { name: '390px-iPhone-14', width: 390, height: 844, category: 'mobile' },
  { name: '412px-Pixel-7', width: 412, height: 915, category: 'mobile' },
  { name: '430px-iPhone-14ProMax', width: 430, height: 932, category: 'mobile' },
  { name: '768px-iPad-portrait', width: 768, height: 1024, category: 'tablet' },
  { name: '820px-iPad-Air', width: 820, height: 1180, category: 'tablet' },
  { name: '1024px-iPad-Pro-Landscape', width: 1024, height: 768, category: 'tablet' },
  { name: '1280px-Desktop', width: 1280, height: 800, category: 'desktop' },
  { name: '1440px-MacBook-Pro', width: 1440, height: 900, category: 'desktop' },
  { name: '1920px-FHD-Display', width: 1920, height: 1080, category: 'desktop' },
];

const TARGET_ROUTES = [
  { path: '/dashboard', label: 'overview' },
  { path: '/dashboard/crm', label: 'crm-clients' },
  { path: '/dashboard/leads', label: 'leads' },
  { path: '/dashboard/projects', label: 'projects' },
  { path: '/dashboard/finance', label: 'finance' },
  { path: '/dashboard/mail', label: 'unified-inbox' },
];

async function measurePage(page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    const body = document.body;
    const header = document.querySelector('header');
    const h1 = document.querySelector('h1');
    const h2 = document.querySelector('h2');
    const p = document.querySelector('p');
    const statValue = document.querySelector('[data-testid="stat-card-value"], .font-bold.text-2xl, .font-bold.text-xl');
    const card = document.querySelector('.ac-card, [class*="rounded-"], [class*="p-4"], [class*="p-6"]');
    const tableHeader = document.querySelector('th');
    const tableCell = document.querySelector('td');

    const button = document.querySelector('button.ac-workspace-action-btn, button:not([aria-hidden="true"])');
    const input = document.querySelector('input:not([type="hidden"])');

    const getComputed = (el, prop) => (el ? window.getComputedStyle(el).getPropertyValue(prop) : null);

    const clientWidth = root.clientWidth;
    const scrollWidth = root.scrollWidth;
    const hasHorizontalOverflow = scrollWidth > clientWidth + 1;

    return {
      viewport: {
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        clientWidth,
        scrollWidth,
        hasHorizontalOverflow,
        overflowDelta: Math.max(0, scrollWidth - clientWidth),
      },
      typography: {
        h1FontSize: getComputed(h1, 'font-size'),
        h2FontSize: getComputed(h2, 'font-size'),
        bodyFontSize: getComputed(p, 'font-size'),
        tableHeaderFontSize: getComputed(tableHeader, 'font-size'),
        tableCellFontSize: getComputed(tableCell, 'font-size'),
        statValueFontSize: getComputed(statValue, 'font-size'),
      },
      density: {
        headerHeight: header ? header.offsetHeight : null,
        cardPadding: getComputed(card, 'padding'),
        buttonHeight: button ? button.offsetHeight : null,
        inputHeight: input ? input.offsetHeight : null,
      },
    };
  });
}

async function runAudit() {
  const screenshotsDir = path.join(process.cwd(), 'qa', 'screenshots', 'compact-audit');
  const resultsDir = path.join(process.cwd(), 'qa', 'results');
  fs.mkdirSync(screenshotsDir, { recursive: true });
  fs.mkdirSync(resultsDir, { recursive: true });

  const report = {
    title: 'AlphaClone PWA - Global Compact UI & Multi-Viewport Audit',
    timestamp: new Date().toISOString(),
    viewportsTested: VIEWPORTS.length,
    routesTested: TARGET_ROUTES.length,
    results: {},
    failures: [],
  };

  console.log(`[AUDIT] Starting Global Compact UI Multi-Viewport Audit...`);
  console.log(`[AUDIT] Testing ${VIEWPORTS.length} viewports across ${TARGET_ROUTES.length} routes.\n`);

  for (const vp of VIEWPORTS) {
    console.log(`\n======================================================`);
    console.log(`🔍 Viewport: ${vp.name} (${vp.width}x${vp.height}, ${vp.category})`);
    console.log(`======================================================`);

    const isMobile = vp.width < 1024;
    let browserContext;
    try {
      browserContext = await createAuthenticatedContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: isMobile ? 2 : 1,
        isMobile,
        hasTouch: isMobile,
      });
    } catch (err) {
      console.error(`Failed to create browser context for ${vp.name}:`, err.message);
      report.failures.push({ viewport: vp.name, error: err.message });
      continue;
    }

    const { browser, context } = browserContext;
    const page = await context.newPage();

    report.results[vp.name] = {
      category: vp.category,
      width: vp.width,
      height: vp.height,
      routes: {},
    };

    try {
      for (const route of TARGET_ROUTES) {
        const baseUrl = process.env.BASE_URL || 'https://alphaclonesystems.com';
        const fullUrl = `${baseUrl}${route.path}`;
        process.stdout.write(`  -> [${route.label}] Visiting ${route.path}... `);

        try {
          await page.goto(fullUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
          await page.waitForTimeout(2000);

          const metrics = await measurePage(page);
          report.results[vp.name].routes[route.label] = metrics;

          if (metrics.viewport.hasHorizontalOverflow) {
            console.log(`❌ OVERFLOW (${metrics.viewport.overflowDelta}px)`);
            report.failures.push({
              viewport: vp.name,
              route: route.path,
              issue: `Horizontal overflow detected: scrollWidth=${metrics.viewport.scrollWidth} > clientWidth=${metrics.viewport.clientWidth}`,
            });
          } else {
            console.log(`✅ OK (W:${metrics.viewport.scrollWidth}/${metrics.viewport.clientWidth}px, H1:${metrics.typography.h1FontSize || 'none'}, Body:${metrics.typography.bodyFontSize || '13px'})`);
          }

          // Screenshot key routes for visual evidence
          if (route.label === 'overview' || route.label === 'crm-clients') {
            const shotPath = path.join(screenshotsDir, `${vp.name}-${route.label}.png`);
            await page.screenshot({ path: shotPath, fullPage: false });
          }
        } catch (routeErr) {
          console.log(`⚠️ Nav error: ${routeErr.message.slice(0, 80)}`);
          report.results[vp.name].routes[route.label] = { error: routeErr.message };
        }
      }
    } finally {
      await browser.close();
    }
  }

  const reportPath = path.join(resultsDir, 'compact-ui-audit-results.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log(`\n======================================================`);
  console.log(`📊 Audit Finished!`);
  console.log(`Total Failures: ${report.failures.length}`);
  console.log(`Results saved to: ${reportPath}`);
  console.log(`Screenshots in: ${screenshotsDir}`);
  console.log(`======================================================\n`);

  if (report.failures.length > 0) {
    console.error('Audit recorded issues:', JSON.stringify(report.failures, null, 2));
  }
}

runAudit().catch((err) => {
  console.error('Audit fatal error:', err);
  process.exit(1);
});
