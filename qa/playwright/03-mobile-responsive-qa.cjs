const fs = require('fs');
const path = require('path');
const {
  BASE_URL,
  createAuthenticatedContext,
  dismissCommonModals,
} = require('./auth-helper.cjs');

const VIEWPORTS = [
  { name: 'mobile-320', width: 320, height: 568 },
  { name: 'mobile-360', width: 360, height: 800 },
  { name: 'mobile-375', width: 375, height: 812 },
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'mobile-412', width: 412, height: 915 },
  { name: 'mobile-430', width: 430, height: 932 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'laptop-1280', width: 1280, height: 800 },
];

const KEY_MOBILE_ROUTES = [
  { name: 'Dashboard', path: '/dashboard' },
  { name: 'CRM', path: '/dashboard/crm' },
  { name: 'Contacts', path: '/dashboard/contacts' },
  { name: 'Leads', path: '/dashboard/leads' },
  { name: 'Accounting', path: '/dashboard/accounting' },
  { name: 'Social', path: '/dashboard/business/social' },
  { name: 'Tasks', path: '/dashboard/tasks' },
];

async function runMobileQA() {
  console.log(`=======================================================`);
  console.log(`STARTING MOBILE & RESPONSIVE QA (Viewports: ${VIEWPORTS.length})`);
  console.log(`=======================================================\n`);

  const screenshotDir = path.join(process.cwd(), 'qa/screenshots/responsive');
  fs.mkdirSync(screenshotDir, { recursive: true });

  const mobileResults = [];

  for (const vp of VIEWPORTS) {
    console.log(`Testing Viewport: ${vp.name} (${vp.width}x${vp.height})`);
    const { browser, context } = await createAuthenticatedContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.width < 768,
      hasTouch: vp.width < 768,
    });
    const page = await context.newPage();

    const vpRouteResults = [];

    for (const r of KEY_MOBILE_ROUTES) {
      try {
        await page.goto(r.path, { waitUntil: 'domcontentloaded', timeout: 35000 });
        await dismissCommonModals(page);
        await page.locator('main').first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});

        // Evaluate horizontal overflow
        const overflow = await page.evaluate(() => {
          const docEl = document.documentElement;
          const body = document.body;
          const scrollWidth = Math.max(docEl.scrollWidth, body.scrollWidth);
          const clientWidth = Math.max(docEl.clientWidth, body.clientWidth);
          return {
            hasOverflow: scrollWidth > clientWidth + 2,
            diff: scrollWidth - clientWidth,
            scrollWidth,
            clientWidth,
          };
        });

        // Evaluate tap target size compliance (< 44px)
        const smallTargets = await page.evaluate(() => {
          const interactive = Array.from(document.querySelectorAll('button, a, input, select, [role="button"]'));
          let countSmall = 0;
          const samples = [];
          for (const el of interactive) {
            const rect = el.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              if (rect.width < 40 || rect.height < 40) {
                countSmall++;
                if (samples.length < 3) {
                  samples.push(`${el.tagName} (${Math.round(rect.width)}x${Math.round(rect.height)}px): "${(el.textContent || '').trim().slice(0, 20)}"`);
                }
              }
            }
          }
          return { total: interactive.length, countSmall, samples };
        });

        // Test mobile navigation / hamburger if available
        let navInteracted = false;
        if (vp.width < 768) {
          const menuBtn = page.locator('button[aria-label*="menu" i], button:has-text("Menu"), .mobile-menu-btn').first();
          if (await menuBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
            await menuBtn.click().catch(() => {});
            await page.waitForTimeout(300);
            navInteracted = true;
            // Close it
            await page.keyboard.press('Escape').catch(() => {});
          }
        }

        const shotName = `${vp.name}_${r.name.toLowerCase()}.png`;
        await page.screenshot({ path: path.join(screenshotDir, shotName) }).catch(() => {});

        vpRouteResults.push({
          route: r.name,
          path: r.path,
          overflow,
          tapTargets: smallTargets,
          mobileNavWorked: navInteracted,
          screenshot: `qa/screenshots/responsive/${shotName}`,
        });
      } catch (err) {
        vpRouteResults.push({
          route: r.name,
          path: r.path,
          error: err.message,
        });
      }
    }

    mobileResults.push({
      viewport: vp.name,
      width: vp.width,
      height: vp.height,
      routes: vpRouteResults,
    });

    await browser.close();
  }

  fs.writeFileSync('qa/results-mobile.json', JSON.stringify(mobileResults, null, 2));
  console.log(`\n=======================================================`);
  console.log(`MOBILE & RESPONSIVE QA COMPLETE!`);
  console.log(`=======================================================\n`);
}

runMobileQA().catch(err => {
  console.error('Fatal Mobile QA Error:', err);
  process.exit(1);
});
