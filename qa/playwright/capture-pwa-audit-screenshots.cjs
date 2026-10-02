const fs = require('fs');
const path = require('path');
const { createAuthenticatedContext } = require('./auth-helper.cjs');

async function main() {
  const outDir = path.join(process.cwd(), 'qa', 'screenshots', 'pwa-audit');
  fs.mkdirSync(outDir, { recursive: true });

  console.log('[Audit] Launching authenticated mobile context (390x844 iPhone 14)...');
  const { browser, context } = await createAuthenticatedContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();

  const measurements = {};

  try {
    console.log('[Audit] Navigating to /dashboard (Home)...');
    await page.goto('https://alphaclonesystems.com/dashboard', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(outDir, 'before-01-home.png'), fullPage: false });

    // Measure home typography and elements
    measurements.home = await page.evaluate(() => {
      const title = document.querySelector('h2');
      const header = document.querySelector('header');
      const bottomNav = document.querySelector('nav[aria-label="Primary"]');
      const titleStyle = title ? window.getComputedStyle(title) : null;
      const headerStyle = header ? window.getComputedStyle(header) : null;
      const navStyle = bottomNav ? window.getComputedStyle(bottomNav) : null;

      return {
        titleFontSize: titleStyle ? titleStyle.fontSize : null,
        titleLineHeight: titleStyle ? titleStyle.lineHeight : null,
        headerHeight: header ? header.offsetHeight : null,
        bottomNavHeight: bottomNav ? bottomNav.offsetHeight : null,
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      };
    });

    console.log('[Audit] Navigating to /dashboard/projects (Projects)...');
    await page.goto('https://alphaclonesystems.com/dashboard/projects', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(outDir, 'before-02-projects.png'), fullPage: false });

    console.log('[Audit] Navigating to /dashboard/crm (Clients)...');
    await page.goto('https://alphaclonesystems.com/dashboard/crm', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(outDir, 'before-03-clients.png'), fullPage: false });

    console.log('[Audit] Navigating to /dashboard/leads (Leads)...');
    await page.goto('https://alphaclonesystems.com/dashboard/leads', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(outDir, 'before-04-leads.png'), fullPage: false });

    console.log('[Audit] Opening More sheet...');
    await page.goto('https://alphaclonesystems.com/dashboard', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2000);
    const moreBtn = await page.$('button[aria-label="More"], button:has-text("More")');
    if (moreBtn) {
      await moreBtn.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(outDir, 'before-05-more-sheet.png'), fullPage: false });
    }

    console.log('[Audit] Opening Notification Center...');
    const bellBtn = await page.$('button[aria-label*="notification" i], [data-tour="business-notifications"] button');
    if (bellBtn) {
      await bellBtn.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(outDir, 'before-06-notification-center.png'), fullPage: false });
    }

    console.log('[Audit] Navigating to PWA settings...');
    await page.goto('https://alphaclonesystems.com/dashboard/pwa-settings', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(outDir, 'before-07-pwa-settings.png'), fullPage: false });

    fs.writeFileSync(path.join(outDir, 'measurements-before.json'), JSON.stringify(measurements, null, 2));
    console.log('[Audit] Measurements:', measurements);
    console.log('[Audit] Before screenshots successfully captured!');
  } catch (err) {
    console.error('[Audit] Error during audit screenshot capture:', err);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
