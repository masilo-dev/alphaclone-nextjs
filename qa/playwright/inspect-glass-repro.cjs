const { createAuthenticatedContext, dismissCommonModals } = require('./auth-helper.cjs');
const path = require('path');
const fs = require('fs');

async function testRepro() {
  console.log('Starting Lead Kanban & Modal Glass Inspection...');
  const { browser, context } = await createAuthenticatedContext({
    viewport: { width: 1440, height: 900 }
  });
  await context.addInitScript(() => {
    localStorage.setItem('currentTenantId', '066eb88e-3fb0-45c9-b4d1-c3c2063ea0d4');
    localStorage.setItem('current_tenant_id', '066eb88e-3fb0-45c9-b4d1-c3c2063ea0d4');
    sessionStorage.setItem('current_tenant_id', '066eb88e-3fb0-45c9-b4d1-c3c2063ea0d4');
  });
  const page = await context.newPage();

  page.on('console', msg => console.log('[BROWSER CONSOLE]', msg.type(), msg.text()));
  page.on('pageerror', err => console.error('[BROWSER ERROR]', err.message));

  try {
    console.log('Navigating to /dashboard/leads...');
    await page.goto('/dashboard/leads', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await dismissCommonModals(page);
    await page.waitForTimeout(6000);

    // Take screenshot of Kanban board
    const ssDir = path.join(__dirname, '..', 'screenshots', 'glass-audit');
    fs.mkdirSync(ssDir, { recursive: true });
    await page.screenshot({ path: path.join(ssDir, '01-kanban-board.png') });
    console.log('Captured 01-kanban-board.png');

    // Click on the lead title to open detail drawer
    const leadCard = page.locator('h4').first();
    const count = await leadCard.count();
    console.log(`Found ${count} clickable lead cards`);

    if (count > 0) {
      const leadName = await leadCard.textContent();
      console.log(`Clicking lead: ${leadName}...`);
      await leadCard.click();
      await page.waitForTimeout(3000);
      await page.screenshot({ path: path.join(ssDir, '02-lead-detail-drawer.png') });
      console.log('Captured 02-lead-detail-drawer.png');

      // 1. First test Email action chip
      console.log('Looking for Email chip...');
      const emailChip = page.locator('button:has-text("Email")').first();
      const emailCount = await emailChip.count();
      console.log(`Found ${emailCount} Email button`);
      if (emailCount > 0) {
        console.log('Clicking Email chip...');
        await emailChip.click();
        await page.waitForTimeout(2500);
        await page.screenshot({ path: path.join(ssDir, '04-email-modal-open.png') });
        console.log('Captured 04-email-modal-open.png');

        // Check computed styles in email modal
        const emailModal = page.locator('.ac-layer-modal').first();
        if (await emailModal.count() > 0) {
          const modalStyles = await emailModal.evaluate((el) => {
            const cs = window.getComputedStyle(el);
            const dialog = el.querySelector('.relative.w-full') || el;
            const dialogCs = dialog ? window.getComputedStyle(dialog) : null;
            const editor = el.querySelector('.ql-editor');
            const editorCs = editor ? window.getComputedStyle(editor) : null;
            const toolbar = el.querySelector('.ql-toolbar');
            const toolbarCs = toolbar ? window.getComputedStyle(toolbar) : null;
            const inputs = Array.from(el.querySelectorAll('input')).map(inp => ({
              placeholder: inp.placeholder,
              bg: window.getComputedStyle(inp).backgroundColor,
              color: window.getComputedStyle(inp).color,
              border: window.getComputedStyle(inp).borderColor,
            }));
            return {
              modalZIndex: cs.zIndex,
              dialogBg: dialogCs?.backgroundColor,
              dialogBackdrop: dialogCs?.backdropFilter,
              dialogBorder: dialogCs?.borderColor,
              editorBg: editorCs?.backgroundColor,
              editorColor: editorCs?.color,
              toolbarBg: toolbarCs?.backgroundColor,
              inputs,
              wsCanvasVar: dialogCs?.getPropertyValue('--ws-canvas'),
              wsPanelVar: dialogCs?.getPropertyValue('--ws-panel'),
              wsBorderVar: dialogCs?.getPropertyValue('--ws-border'),
            };
          });
          console.log('Email Modal Computed Styles:', JSON.stringify(modalStyles, null, 2));
        }

        // Close email modal via X button
        const closeBtn = page.locator('.ac-layer-modal button:has(svg)').first();
        if (await closeBtn.count() > 0) {
          await closeBtn.click();
          await page.waitForTimeout(1000);
        }
      }

      // 2. Now test 3 dots menu
      const moreBtn = page.locator('button[aria-label^="More actions"]').first();
      const moreCount = await moreBtn.count();
      console.log(`Found ${moreCount} 3-dots button`);
      if (moreCount > 0) {
        await moreBtn.click();
        await page.waitForTimeout(1000);
        await page.screenshot({ path: path.join(ssDir, '03-3dots-dropdown-open.png') });
        console.log('Captured 03-3dots-dropdown-open.png');
      }
    } else {
      console.log('No lead cards found on Kanban board.');
    }
  } catch (err) {
    console.error('Inspection error:', err);
  } finally {
    await browser.close();
  }
}

testRepro();
