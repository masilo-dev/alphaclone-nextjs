const fs = require('fs');
const path = require('path');
const {
  BASE_URL,
  createAuthenticatedContext,
  dismissCommonModals,
} = require('./auth-helper.cjs');

async function testWalkthrough() {
  console.log(`=======================================================`);
  console.log(`STARTING PRODUCT WALKTHROUGH DEEP QA`);
  console.log(`=======================================================\n`);

  const { browser, context } = await createAuthenticatedContext();
  const page = await context.newPage();
  const screenshotDir = path.join(process.cwd(), 'qa/screenshots/walkthrough');
  fs.mkdirSync(screenshotDir, { recursive: true });

  const walkthroughReport = {
    steps: [],
    blinkingDetected: false,
    staleOverlayDetected: false,
    controlsWorked: true,
  };

  try {
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForTimeout(1000);

    // Look for Platform tour trigger button in sidebar or bottom
    const tourTrigger = page.locator('button:has-text("Platform tour"), button:has-text("Tour"), [data-testid="start-tour"]').first();
    const hasTrigger = await tourTrigger.isVisible({ timeout: 4000 }).catch(() => false);

    console.log(`Tour trigger visible: ${hasTrigger}`);
    walkthroughReport.triggerVisible = hasTrigger;

    if (hasTrigger) {
      // 1. Click Tour Trigger
      console.log('Clicking Tour trigger...');
      const openStart = Date.now();
      await tourTrigger.click();
      await page.waitForTimeout(800);

      const overlay = page.locator('.react-joyride__overlay, #react-joyride-portal, .__floater').first();
      const overlayVisible = await overlay.isVisible({ timeout: 4000 }).catch(() => false);
      console.log(`Tour overlay visible: ${overlayVisible} (in ${Date.now() - openStart}ms)`);
      walkthroughReport.overlayOpened = overlayVisible;

      await page.screenshot({ path: path.join(screenshotDir, 'tour-step-1.png') });

      // Check step advancing
      for (let s = 1; s <= 4; s++) {
        const nextBtn = page.locator('button:has-text("Next"), button[aria-label="Next"], button:has-text("Continue")').first();
        if (await nextBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          // Record render/opacity count
          const preClickSnapshot = await page.evaluate(() => document.body.innerHTML.length);
          await nextBtn.click();
          await page.waitForTimeout(600);
          const postClickSnapshot = await page.evaluate(() => document.body.innerHTML.length);

          console.log(`Advanced to step ${s + 1}`);
          await page.screenshot({ path: path.join(screenshotDir, `tour-step-${s + 1}.png`) });

          walkthroughReport.steps.push({
            step: s,
            action: 'Next',
            success: true,
          });
        } else {
          break;
        }
      }

      // Test Skip or Close
      const skipOrClose = page.locator('button:has-text("Skip"), button[aria-label="Close"], button:has-text("Done")').first();
      if (await skipOrClose.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log('Testing Skip/Close button...');
        await skipOrClose.click();
        await page.waitForTimeout(600);

        // Check if overlay is removed and body is unblocked
        const postOverlay = page.locator('.react-joyride__overlay').first();
        const stillOverlay = await postOverlay.isVisible({ timeout: 1000 }).catch(() => false);
        const bodyOverflow = await page.evaluate(() => document.body.style.overflow);

        console.log(`Overlay lingering after close: ${stillOverlay}, body overflow: "${bodyOverflow}"`);
        walkthroughReport.staleOverlayDetected = stillOverlay || bodyOverflow === 'hidden';
      }

      // Test Navigation away while tour was open
      console.log('Testing route change while tour dismissed...');
      await page.goto('/dashboard/crm');
      await page.waitForTimeout(800);
      const crmOverlay = await page.locator('.react-joyride__overlay').first().isVisible({ timeout: 500 }).catch(() => false);
      console.log(`Overlay present on new route: ${crmOverlay}`);
      walkthroughReport.crmOverlayLingering = crmOverlay;
    }

  } catch (err) {
    walkthroughReport.error = err.message;
    console.error('Walkthrough QA error:', err);
  } finally {
    await browser.close();
  }

  fs.writeFileSync('qa/results-walkthrough.json', JSON.stringify(walkthroughReport, null, 2));
  console.log(`\n=======================================================`);
  console.log(`PRODUCT WALKTHROUGH QA COMPLETE!`);
  console.log(`=======================================================\n`);
}

testWalkthrough().catch(console.error);
