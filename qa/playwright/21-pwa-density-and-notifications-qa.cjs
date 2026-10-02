const fs = require('fs');
const path = require('path');
const { createAuthenticatedContext } = require('./auth-helper.cjs');

const VIEWPORTS = [
  { name: '320px-SE-narrow', width: 320, height: 568 },
  { name: '360px-Android-compact', width: 360, height: 800 },
  { name: '375px-iPhone-SE', width: 375, height: 667 },
  { name: '390px-iPhone-14', width: 390, height: 844 },
  { name: '412px-Pixel-7', width: 412, height: 915 },
  { name: '430px-iPhone-14ProMax', width: 430, height: 932 },
  { name: '768px-iPad-portrait', width: 768, height: 1024 },
  { name: '1280px-Desktop', width: 1280, height: 800 },
];

async function main() {
  const outDir = path.join(process.cwd(), 'qa', 'screenshots', 'pwa-audit');
  fs.mkdirSync(outDir, { recursive: true });

  const results = {
    viewports: {},
    measurements: {},
    timestamp: new Date().toISOString(),
  };

  for (const vp of VIEWPORTS) {
    console.log(`\n[QA] Testing Viewport: ${vp.name} (${vp.width}x${vp.height})...`);
    const isMobile = vp.width < 1024;
    const { browser, context } = await createAuthenticatedContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: isMobile ? 2 : 1,
      isMobile,
      hasTouch: isMobile,
    });

    const page = await context.newPage();

    try {
      // 1. Home
      console.log(`  -> Navigating to /dashboard...`);
      await page.goto('https://alphaclonesystems.com/dashboard', { waitUntil: 'domcontentloaded', timeout: 25000 });
      await page.waitForTimeout(3000);

      const homeMetrics = await page.evaluate(() => {
        const title = document.querySelector('h2');
        const header = document.querySelector('header');
        const bottomNav = document.querySelector('nav[aria-label="Primary"]');
        const rootDoc = document.documentElement;
        return {
          scrollWidth: rootDoc.scrollWidth,
          clientWidth: rootDoc.clientWidth,
          hasHorizontalOverflow: rootDoc.scrollWidth > rootDoc.clientWidth,
          headerHeight: header ? header.offsetHeight : null,
          bottomNavHeight: bottomNav ? bottomNav.offsetHeight : null,
          titleFontSize: title ? window.getComputedStyle(title).fontSize : null,
        };
      });

      console.log(`     Metrics:`, homeMetrics);
      results.viewports[vp.name] = { home: homeMetrics };

      if (vp.name === '390px-iPhone-14') {
        results.measurements.after = homeMetrics;
      }

      await page.screenshot({ path: path.join(outDir, `after-01-home-${vp.name}.png`) });

      // 2. Projects
      console.log(`  -> Navigating to /dashboard/projects...`);
      await page.goto('https://alphaclonesystems.com/dashboard/projects', { waitUntil: 'domcontentloaded', timeout: 25000 });
      await page.waitForTimeout(3000);
      await page.screenshot({ path: path.join(outDir, `after-02-projects-${vp.name}.png`) });

      // 3. Clients
      console.log(`  -> Navigating to /dashboard/crm...`);
      await page.goto('https://alphaclonesystems.com/dashboard/crm', { waitUntil: 'domcontentloaded', timeout: 25000 });
      await page.waitForTimeout(3000);
      await page.screenshot({ path: path.join(outDir, `after-03-clients-${vp.name}.png`) });

      // 4. Leads
      console.log(`  -> Navigating to /dashboard/leads...`);
      await page.goto('https://alphaclonesystems.com/dashboard/leads', { waitUntil: 'domcontentloaded', timeout: 25000 });
      await page.waitForTimeout(3000);
      await page.screenshot({ path: path.join(outDir, `after-04-leads-${vp.name}.png`) });

    } catch (e) {
      console.error(`  [!] Error testing ${vp.name}:`, e.message);
    } finally {
      await browser.close();
    }
  }

  // Final summary file
  fs.writeFileSync(path.join(outDir, 'measurements-after.json'), JSON.stringify(results, null, 2));
  console.log('\n[QA] Multi-viewport audit and screenshot capture complete!');
}

main().catch(console.error);
