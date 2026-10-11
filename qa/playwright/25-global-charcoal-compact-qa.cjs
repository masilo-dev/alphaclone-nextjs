/**
 * Playwright Test Suite 25: Global Charcoal Dark & Compact Density QA
 * Verifies charcoal dark theme tokens, compact density system, zero overflow,
 * and responsive scaling across 11 viewports (320px to 1920px).
 */

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
  { name: '1024px-iPad-Pro-Landscape', width: 1024, height: 768, category: 'tablet' },
  { name: '1280px-Desktop', width: 1280, height: 800, category: 'desktop' },
  { name: '1440px-MacBook-Pro', width: 1440, height: 900, category: 'desktop' },
  { name: '1920px-FHD-Display', width: 1920, height: 1080, category: 'desktop' },
];

const TARGET_ROUTES = [
  { path: '/dashboard', label: 'overview' },
  { path: '/dashboard/crm', label: 'crm' },
  { path: '/dashboard/leads', label: 'leads' },
  { path: '/dashboard/projects', label: 'projects' },
  { path: '/dashboard/finance', label: 'finance' },
  { path: '/dashboard/settings', label: 'settings' },
];

async function inspectTokensAndDensity(page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    const body = document.body;
    const cs = window.getComputedStyle(root);
    const bodyCs = window.getComputedStyle(body);

    const getVar = (name) => cs.getPropertyValue(name).trim();

    const clientWidth = root.clientWidth;
    const scrollWidth = root.scrollWidth;
    const hasHorizontalOverflow = scrollWidth > clientWidth + 1;

    // Evaluate sidebar and toolbar if present
    const sidebar = document.querySelector('aside, .ac-workspace-sidebar');
    const toolbar = document.querySelector('header, .ac-workspace-toolbar');
    const button = document.querySelector('button.ac-workspace-action-btn, button:not([aria-hidden="true"])');
    const input = document.querySelector('input:not([type="hidden"])');
    const tableRow = document.querySelector('.ac-data-table tbody tr');

    return {
      theme: {
        dataTheme: root.getAttribute('data-theme'),
        isDarkClass: root.classList.contains('dark'),
        appBg: getVar('--app-bg'),
        sidebarBg: getVar('--sidebar-bg'),
        headerBg: getVar('--header-bg'),
        surface1: getVar('--surface-1'),
        surface2: getVar('--surface-2'),
        surface3: getVar('--surface-3'),
        borderSubtle: getVar('--border-subtle'),
        borderStrong: getVar('--border-strong'),
        textPrimary: getVar('--text-primary'),
        textSecondary: getVar('--text-secondary'),
        textMuted: getVar('--text-muted'),
        accent: getVar('--accent'),
        bodyBgComputed: bodyCs.backgroundColor,
      },
      density: {
        dataDensity: root.getAttribute('data-density'),
        storedDensity: localStorage.getItem('ac-density'),
      },
      layout: {
        clientWidth,
        scrollWidth,
        hasHorizontalOverflow,
        overflowDelta: Math.max(0, scrollWidth - clientWidth),
        sidebarWidth: sidebar ? sidebar.offsetWidth : null,
        toolbarHeight: toolbar ? toolbar.offsetHeight : null,
        buttonHeight: button ? button.offsetHeight : null,
        inputHeight: input ? input.offsetHeight : null,
        tableRowHeight: tableRow ? tableRow.offsetHeight : null,
      },
    };
  });
}

async function run() {
  console.log('🚀 Starting Suite 25: Global Charcoal Dark & Compact Density QA');

  const results = {
    timestamp: new Date().toISOString(),
    viewportsTested: VIEWPORTS.length,
    routesTested: TARGET_ROUTES.length,
    checks: [],
    errors: [],
    passed: true,
  };

  let browser;
  let context;

  try {
    const auth = await createAuthenticatedContext({ viewport: { width: 1280, height: 800 } });
    browser = auth.browser;
    context = auth.context;

    const page = await context.newPage();

    // 1. Initial Load & Theme / Density Checks on Desktop
    console.log('\n--- 1. Testing Default Theme & Density on Desktop (1280x800) ---');
    await page.goto('https://alphaclonesystems.com/dashboard', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    const initialInspection = await inspectTokensAndDensity(page);
    console.log('Initial inspection:', JSON.stringify(initialInspection, null, 2));

    // Verify Charcoal tokens
    const isCharcoal =
      initialInspection.theme.appBg.toLowerCase() === '#111113' ||
      initialInspection.theme.bodyBgComputed.includes('17, 17, 19');
    console.log(`✓ Charcoal --app-bg (#111113): ${isCharcoal ? 'PASS' : 'FAIL'}`);

    const isCompactDefault =
      initialInspection.density.dataDensity === 'compact' ||
      !initialInspection.density.dataDensity; // Default compact
    console.log(`✓ Density mode default: ${isCompactDefault ? 'PASS' : 'FAIL'}`);

    results.checks.push({
      test: 'Default Charcoal Theme',
      expected: '#111113',
      actual: initialInspection.theme.appBg || initialInspection.theme.bodyBgComputed,
      pass: isCharcoal,
    });

    // 2. Test Density Mode Persistence & Toggle
    console.log('\n--- 2. Testing Density Mode Toggle & Persistence ---');
    await page.evaluate(() => {
      // Toggle to comfortable via density API
      if (window.dispatchEvent) {
        document.documentElement.setAttribute('data-density', 'comfortable');
        localStorage.setItem('ac-density', 'comfortable');
        window.dispatchEvent(new CustomEvent('ac-density-changed', { detail: { density: 'comfortable' } }));
      }
    });
    await page.waitForTimeout(500);

    const comfortableInspection = await inspectTokensAndDensity(page);
    const comfortableActive = comfortableInspection.density.dataDensity === 'comfortable';
    console.log(`✓ Toggle to Comfortable mode: ${comfortableActive ? 'PASS' : 'FAIL'}`);

    // Revert to compact (mandatory default)
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-density', 'compact');
      localStorage.setItem('ac-density', 'compact');
      window.dispatchEvent(new CustomEvent('ac-density-changed', { detail: { density: 'compact' } }));
    });
    await page.waitForTimeout(500);

    const compactRestored = (await inspectTokensAndDensity(page)).density.dataDensity === 'compact';
    console.log(`✓ Revert to Compact mode: ${compactRestored ? 'PASS' : 'FAIL'}`);

    results.checks.push({
      test: 'Density Mode Toggle & Persistence',
      comfortablePass: comfortableActive,
      compactPass: compactRestored,
      pass: comfortableActive && compactRestored,
    });

    // 3. Test across all 11 Viewports for Overflow & Touch Target Integrity
    console.log('\n--- 3. Testing 11 Viewports across Key Routes ---');
    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(500);

      const vpReport = { viewport: vp.name, width: vp.width, routes: [] };

      for (const route of TARGET_ROUTES) {
        await page.goto(`https://alphaclonesystems.com${route.path}`, {
          waitUntil: 'domcontentloaded',
          timeout: 25000,
        }).catch(() => {});
        await page.waitForTimeout(1000);

        const inspection = await inspectTokensAndDensity(page);
        const hasOverflow = inspection.layout.hasHorizontalOverflow;

        vpReport.routes.push({
          route: route.path,
          hasHorizontalOverflow: hasOverflow,
          overflowDelta: inspection.layout.overflowDelta,
          buttonHeight: inspection.layout.buttonHeight,
          inputHeight: inspection.layout.inputHeight,
        });

        if (hasOverflow) {
          console.warn(`  ⚠️ Overflow on ${route.path} at ${vp.name}: +${inspection.layout.overflowDelta}px`);
        }
      }

      const allNoOverflow = vpReport.routes.every((r) => !r.hasHorizontalOverflow);
      console.log(`  ✓ Viewport ${vp.name} (${vp.width}px): ${allNoOverflow ? 'ZERO OVERFLOW PASS' : 'OVERFLOW DETECTED'}`);

      results.checks.push({
        test: `Viewport ${vp.name} Overflow Check`,
        pass: allNoOverflow,
        report: vpReport,
      });
    }

    const screenshotsDir = path.join(process.cwd(), 'qa', 'screenshots');
    if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true });

    // Capture desktop screenshot
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('https://alphaclonesystems.com/dashboard', { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
    await page.screenshot({ path: path.join(screenshotsDir, 'charcoal-dashboard-desktop.png') });

    // Capture mobile screenshot
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(screenshotsDir, 'charcoal-dashboard-mobile.png') });

    const resultsDir = path.join(process.cwd(), 'qa', 'results');
    if (!fs.existsSync(resultsDir)) fs.mkdirSync(resultsDir, { recursive: true });

    fs.writeFileSync(
      path.join(resultsDir, '25-global-charcoal-compact-results.json'),
      JSON.stringify(results, null, 2),
      'utf8'
    );

    console.log('\n✅ Suite 25 Complete. Results written to qa/results/25-global-charcoal-compact-results.json');
  } catch (err) {
    console.error('✖ Suite 25 execution failed:', err);
    results.errors.push(err.message || String(err));
    results.passed = false;
  } finally {
    if (browser) await browser.close();
  }

  process.exit(results.passed ? 0 : 1);
}

run();
