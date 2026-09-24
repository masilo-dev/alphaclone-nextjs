const fs = require('fs');
const path = require('path');
const {
  BASE_URL,
  createAuthenticatedContext,
  dismissCommonModals,
} = require('./auth-helper.cjs');

const SAMPLE_A11Y_ROUTES = [
  { name: 'Dashboard', path: '/dashboard' },
  { name: 'CRM', path: '/dashboard/crm' },
  { name: 'Contacts', path: '/dashboard/contacts' },
  { name: 'Leads', path: '/dashboard/leads' },
  { name: 'Accounting', path: '/dashboard/accounting' },
  { name: 'Settings', path: '/dashboard/business/settings' },
  { name: 'Pricing', path: '/pricing' },
  { name: 'Contact Us', path: '/contact' },
];

async function runA11yQA() {
  console.log(`=======================================================`);
  console.log(`STARTING ACCESSIBILITY & KEYBOARD QA`);
  console.log(`=======================================================\n`);

  const { browser, context } = await createAuthenticatedContext();
  const page = await context.newPage();

  const a11yReports = [];

  for (const r of SAMPLE_A11Y_ROUTES) {
    console.log(`Testing A11y on: ${r.name} (${r.path})`);
    try {
      await page.goto(r.path, { waitUntil: 'domcontentloaded', timeout: 35000 });
      await dismissCommonModals(page);
      await page.waitForTimeout(500);

      // 1. Keyboard tab order test
      let tabFocusCount = 0;
      const focusedElements = [];
      for (let t = 0; t < 15; t++) {
        await page.keyboard.press('Tab');
        const activeTag = await page.evaluate(() => {
          const el = document.activeElement;
          return el ? `${el.tagName}[${el.getAttribute('role') || el.type || ''}]: ${(el.textContent || el.getAttribute('aria-label') || '').slice(0, 20).trim()}` : null;
        });
        if (activeTag) {
          tabFocusCount++;
          focusedElements.push(activeTag);
        }
      }

      // 2. Automated DOM audit for accessibility markers
      const domAudit = await page.evaluate(() => {
        // Buttons without accessible names
        const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
        const namelessButtons = buttons.filter(b => {
          const name = (b.innerText || b.getAttribute('aria-label') || b.getAttribute('title') || '').trim();
          return name.length === 0;
        });

        // Inputs without labels
        const inputs = Array.from(document.querySelectorAll('input:not([type="hidden"]), select, textarea'));
        const unlabelledInputs = inputs.filter(inp => {
          const id = inp.id;
          const hasLabel = id && document.querySelector(`label[for="${id}"]`);
          const ariaLabel = inp.getAttribute('aria-label') || inp.getAttribute('aria-labelledby');
          const placeholder = inp.getAttribute('placeholder');
          return !hasLabel && !ariaLabel && !placeholder;
        });

        // Headings structure
        const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).map(h => ({
          tag: h.tagName,
          text: (h.textContent || '').trim().slice(0, 30),
        }));

        return {
          totalButtons: buttons.length,
          namelessButtonsCount: namelessButtons.length,
          totalInputs: inputs.length,
          unlabelledInputsCount: unlabelledInputs.length,
          headingsCount: headings.length,
          headingsHierarchy: headings.slice(0, 6),
        };
      });

      a11yReports.push({
        route: r.name,
        path: r.path,
        tabFocusCount,
        firstFocusedElements: focusedElements.slice(0, 5),
        domAudit,
        status: domAudit.namelessButtonsCount === 0 && domAudit.unlabelledInputsCount === 0 ? 'PASS' : 'WARNING',
      });

    } catch (err) {
      a11yReports.push({
        route: r.name,
        path: r.path,
        error: err.message,
        status: 'FAIL',
      });
    }
  }

  await browser.close();

  fs.writeFileSync('qa/results-a11y.json', JSON.stringify(a11yReports, null, 2));
  console.log(`\n=======================================================`);
  console.log(`ACCESSIBILITY QA COMPLETE!`);
  console.log(`=======================================================\n`);
}

runA11yQA().catch(console.error);
