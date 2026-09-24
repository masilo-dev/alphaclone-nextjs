const fs = require('fs');
const path = require('path');
const {
  BASE_URL,
  createAuthenticatedContext,
  attachTelemetry,
  measureAction,
  dismissCommonModals,
  classifyLatency,
} = require('./auth-helper.cjs');

async function runJourneys() {
  console.log(`=======================================================`);
  console.log(`STARTING END-TO-END USER JOURNEYS QA`);
  console.log(`=======================================================\n`);

  const { browser, context } = await createAuthenticatedContext();
  const page = await context.newPage();
  const telemetry = attachTelemetry(page);
  const journeyResults = [];
  const screenshotDir = path.join(process.cwd(), 'qa/screenshots/journeys');
  fs.mkdirSync(screenshotDir, { recursive: true });

  // -------------------------------------------------------------------------
  // Journey 1: CRM & Clients Deep Workflow
  // -------------------------------------------------------------------------
  console.log(`--- [Journey 1/7] CRM & Clients ---`);
  const j1Steps = [];
  try {
    // 1. Dashboard
    let step = await measureAction(page, 'Navigate to Dashboard', async () => {
      await page.goto('/dashboard', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await dismissCommonModals(page);
    });
    j1Steps.push(step);

    // 2. Open CRM
    step = await measureAction(page, 'Navigate to CRM Overview', async () => {
      await page.goto('/dashboard/crm', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await dismissCommonModals(page);
      await page.locator('main').first().waitFor({ state: 'visible', timeout: 15000 });
    });
    j1Steps.push(step);

    // 3. Open Clients / Contacts
    step = await measureAction(page, 'Open Contacts / Clients Tab', async () => {
      const contactsLink = page.locator('a[href="/dashboard/contacts"], a:has-text("Contacts"), a:has-text("Clients")').first();
      if (await contactsLink.isVisible({ timeout: 2000 }).catch(() => false)) {
        await contactsLink.click();
      } else {
        await page.goto('/dashboard/contacts', { waitUntil: 'domcontentloaded' });
      }
      await page.waitForTimeout(500);
    });
    j1Steps.push(step);

    // 4. Search Client
    step = await measureAction(page, 'Search Input Interaction', async () => {
      const searchInput = page.locator('input[placeholder*="Search"], input[type="search"]').first();
      if (await searchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await searchInput.fill('Alpha');
        await page.waitForTimeout(300);
        await searchInput.clear();
      }
    });
    j1Steps.push(step);

    // 5. Click a Client/Contact Row if available
    step = await measureAction(page, 'Open Record Detail / Row Interaction', async () => {
      const row = page.locator('tr, [role="row"], .cursor-pointer:has-text("@")').first();
      if (await row.isVisible({ timeout: 2000 }).catch(() => false)) {
        await row.click().catch(() => {});
      }
    });
    j1Steps.push(step);

    // 6. Navigate Back
    step = await measureAction(page, 'Back Navigation to CRM', async () => {
      await page.goBack().catch(async () => {
        await page.goto('/dashboard/crm');
      });
      await page.waitForTimeout(400);
    });
    j1Steps.push(step);

    await page.screenshot({ path: path.join(screenshotDir, 'journey-1-crm.png') });
    journeyResults.push({ name: 'CRM & Clients', status: 'PASS', steps: j1Steps });
  } catch (err) {
    journeyResults.push({ name: 'CRM & Clients', status: 'FAIL', error: err.message, steps: j1Steps });
  }

  // -------------------------------------------------------------------------
  // Journey 2: Leads & Deals Pipeline Workflow
  // -------------------------------------------------------------------------
  console.log(`--- [Journey 2/7] Leads & Deals Pipeline ---`);
  const j2Steps = [];
  try {
    // 1. Leads Board
    let step = await measureAction(page, 'Navigate to Leads Board', async () => {
      await page.goto('/dashboard/leads', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await dismissCommonModals(page);
    });
    j2Steps.push(step);

    // 2. Lead Finder
    step = await measureAction(page, 'Switch to Lead Finder', async () => {
      const finderTab = page.locator('a[href="/dashboard/leads/finder"], button:has-text("Lead Finder"), button:has-text("Finder")').first();
      if (await finderTab.isVisible({ timeout: 2000 }).catch(() => false)) {
        await finderTab.click();
      } else {
        await page.goto('/dashboard/leads/finder', { waitUntil: 'domcontentloaded' });
      }
      await page.waitForTimeout(500);
    });
    j2Steps.push(step);

    // 3. Deals Pipeline
    step = await measureAction(page, 'Navigate to Deals Pipeline', async () => {
      await page.goto('/dashboard/deals', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(500);
    });
    j2Steps.push(step);

    // 4. Test stage drag / stage column view
    step = await measureAction(page, 'Interact with Deals View Controls', async () => {
      const filterBtn = page.locator('button:has-text("Filter"), button:has-text("View"), button:has-text("Pipeline")').first();
      if (await filterBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await filterBtn.click().catch(() => {});
        await page.waitForTimeout(200);
      }
    });
    j2Steps.push(step);

    await page.screenshot({ path: path.join(screenshotDir, 'journey-2-deals.png') });
    journeyResults.push({ name: 'Leads & Deals', status: 'PASS', steps: j2Steps });
  } catch (err) {
    journeyResults.push({ name: 'Leads & Deals', status: 'FAIL', error: err.message, steps: j2Steps });
  }

  // -------------------------------------------------------------------------
  // Journey 3: Accounting, Invoices, Quotes & Cash Flow
  // -------------------------------------------------------------------------
  console.log(`--- [Journey 3/7] Accounting & Money Lifecycle ---`);
  const j3Steps = [];
  try {
    // 1. Accounting Home
    let step = await measureAction(page, 'Navigate to Accounting', async () => {
      await page.goto('/dashboard/accounting', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await dismissCommonModals(page);
    });
    j3Steps.push(step);

    // 2. Invoices
    step = await measureAction(page, 'Open Invoice Manager', async () => {
      await page.goto('/dashboard/business/billing/manage', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(500);
    });
    j3Steps.push(step);

    // 3. Quotes
    step = await measureAction(page, 'Navigate to Quotes & Proposals', async () => {
      await page.goto('/dashboard/business/quotes', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(500);
    });
    j3Steps.push(step);

    // 4. Cash Flow
    step = await measureAction(page, 'Open Cash Flow Forecast', async () => {
      await page.goto('/dashboard/business/cash-flow', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(500);
    });
    j3Steps.push(step);

    await page.screenshot({ path: path.join(screenshotDir, 'journey-3-accounting.png') });
    journeyResults.push({ name: 'Accounting & Cash Flow', status: 'PASS', steps: j3Steps });
  } catch (err) {
    journeyResults.push({ name: 'Accounting & Cash Flow', status: 'FAIL', error: err.message, steps: j3Steps });
  }

  // -------------------------------------------------------------------------
  // Journey 4: Social Channels & Safe Compose
  // -------------------------------------------------------------------------
  console.log(`--- [Journey 4/7] Social Marketing & Compose ---`);
  const j4Steps = [];
  try {
    // 1. Social Overview
    let step = await measureAction(page, 'Navigate to Social Overview', async () => {
      await page.goto('/dashboard/business/social', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await dismissCommonModals(page);
    });
    j4Steps.push(step);

    // 2. LinkedIn Channel
    step = await measureAction(page, 'Navigate to LinkedIn Hub', async () => {
      await page.goto('/dashboard/business/linkedin', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(400);
    });
    j4Steps.push(step);

    // 3. Facebook Channel
    step = await measureAction(page, 'Navigate to Facebook Hub', async () => {
      await page.goto('/dashboard/business/facebook', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(400);
    });
    j4Steps.push(step);

    // 4. Compose Workflow (open, type, do NOT publish)
    step = await measureAction(page, 'Open Compose & Safe Input Test', async () => {
      await page.goto('/dashboard/business/social/compose', { waitUntil: 'domcontentloaded', timeout: 30000 });
      const textarea = page.locator('textarea, [contenteditable="true"]').first();
      if (await textarea.isVisible({ timeout: 3000 }).catch(() => false)) {
        await textarea.fill('Draft QA test content - will not be published');
        await page.waitForTimeout(300);
        await textarea.clear();
      }
    });
    j4Steps.push(step);

    await page.screenshot({ path: path.join(screenshotDir, 'journey-4-social.png') });
    journeyResults.push({ name: 'Social & Marketing', status: 'PASS', steps: j4Steps });
  } catch (err) {
    journeyResults.push({ name: 'Social & Marketing', status: 'FAIL', error: err.message, steps: j4Steps });
  }

  // -------------------------------------------------------------------------
  // Journey 5: Projects & Tasks
  // -------------------------------------------------------------------------
  console.log(`--- [Journey 5/7] Projects & Tasks ---`);
  const j5Steps = [];
  try {
    // 1. Projects Home
    let step = await measureAction(page, 'Navigate to Projects', async () => {
      await page.goto('/dashboard/business/projects', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await dismissCommonModals(page);
    });
    j5Steps.push(step);

    // 2. Production Tasks
    step = await measureAction(page, 'Navigate to Tasks Board', async () => {
      await page.goto('/dashboard/tasks', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(500);
    });
    j5Steps.push(step);

    // 3. Safe Task interaction (filter / view toggle)
    step = await measureAction(page, 'Interact with Task Filter/Tabs', async () => {
      const tab = page.locator('[role="tab"], button:has-text("All"), button:has-text("Active"), button:has-text("Done")').first();
      if (await tab.isVisible({ timeout: 2000 }).catch(() => false)) {
        await tab.click().catch(() => {});
      }
    });
    j5Steps.push(step);

    await page.screenshot({ path: path.join(screenshotDir, 'journey-5-projects.png') });
    journeyResults.push({ name: 'Projects & Tasks', status: 'PASS', steps: j5Steps });
  } catch (err) {
    journeyResults.push({ name: 'Projects & Tasks', status: 'FAIL', error: err.message, steps: j5Steps });
  }

  // -------------------------------------------------------------------------
  // Journey 6: Contracts & E-signature
  // -------------------------------------------------------------------------
  console.log(`--- [Journey 6/7] Contracts & E-Signature ---`);
  const j6Steps = [];
  try {
    // 1. Contracts Overview
    let step = await measureAction(page, 'Navigate to Contracts', async () => {
      await page.goto('/dashboard/business/contracts', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await dismissCommonModals(page);
    });
    j6Steps.push(step);

    // 2. Contract Manager
    step = await measureAction(page, 'Open Contract Manager', async () => {
      await page.goto('/dashboard/business/contracts/manage', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(500);
    });
    j6Steps.push(step);

    await page.screenshot({ path: path.join(screenshotDir, 'journey-6-contracts.png') });
    journeyResults.push({ name: 'Contracts', status: 'PASS', steps: j6Steps });
  } catch (err) {
    journeyResults.push({ name: 'Contracts', status: 'FAIL', error: err.message, steps: j6Steps });
  }

  // -------------------------------------------------------------------------
  // Journey 7: Settings & Integrations
  // -------------------------------------------------------------------------
  console.log(`--- [Journey 7/7] Settings & Integrations ---`);
  const j7Steps = [];
  try {
    // 1. Settings Overview
    let step = await measureAction(page, 'Navigate to Settings', async () => {
      await page.goto('/dashboard/business/settings', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await dismissCommonModals(page);
    });
    j7Steps.push(step);

    // 2. Marketplace / Integrations
    step = await measureAction(page, 'Open Integration Marketplace', async () => {
      await page.goto('/dashboard/marketplace', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(500);
    });
    j7Steps.push(step);

    // 3. Search Integration
    step = await measureAction(page, 'Search Integration in Marketplace', async () => {
      const search = page.locator('input[placeholder*="Search"], input[type="search"]').first();
      if (await search.isVisible({ timeout: 2000 }).catch(() => false)) {
        await search.fill('Stripe');
        await page.waitForTimeout(200);
        await search.clear();
      }
    });
    j7Steps.push(step);

    await page.screenshot({ path: path.join(screenshotDir, 'journey-7-settings.png') });
    journeyResults.push({ name: 'Settings & Integrations', status: 'PASS', steps: j7Steps });
  } catch (err) {
    journeyResults.push({ name: 'Settings & Integrations', status: 'FAIL', error: err.message, steps: j7Steps });
  }

  await browser.close();

  fs.writeFileSync('qa/results-journeys.json', JSON.stringify(journeyResults, null, 2));
  console.log(`\n=======================================================`);
  console.log(`ALL 7 USER JOURNEYS COMPLETED!`);
  console.log(`=======================================================\n`);
}

runJourneys().catch(err => {
  console.error('Fatal User Journeys Error:', err);
  process.exit(1);
});
