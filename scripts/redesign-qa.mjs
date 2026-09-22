import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseURL = process.env.QA_BASE_URL || 'http://127.0.0.1:3100';
const outputDir = path.resolve('artifacts/redesign-qa');
const axePath = path.resolve('node_modules/axe-core/axe.min.js');
const results = {
  baseURL,
  startedAt: new Date().toISOString(),
  routes: [],
  visual: {},
  interactions: {},
  accessibility: {},
  consoleErrors: [],
  failures: [],
};

await fs.mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });

async function auditPage(page, route, label) {
  const errors = [];
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', error => errors.push(error.message));
  let response = await page.goto(`${baseURL}${route}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  if ((response?.status() ?? 500) >= 500) {
    await page.waitForTimeout(1500);
    response = await page.reload({ waitUntil: 'domcontentloaded', timeout: 30_000 });
  }
  await page.waitForTimeout(1200);
  const facts = await page.evaluate(() => ({
    title: document.title,
    h1Count: document.querySelectorAll('h1').length,
    canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href') || null,
    horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    bodyText: document.body.innerText.slice(0, 500),
  }));
  results.routes.push({ route, label, status: response?.status() ?? null, ...facts });
  results.consoleErrors.push(...errors.map(error => ({ route, error })));
  if (!response || response.status() >= 400) results.failures.push(`${route}: HTTP ${response?.status() ?? 'no response'}`);
  if (facts.h1Count !== 1) results.failures.push(`${route}: expected one H1, found ${facts.h1Count}`);
  if (facts.horizontalOverflow > 2) results.failures.push(`${route}: horizontal overflow ${facts.horizontalOverflow}px`);
  if (/application error|internal server error/i.test(facts.bodyText)) results.failures.push(`${route}: application error text rendered`);
  return facts;
}

try {
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  await auditPage(desktop, '/', 'desktop-home');
  const desktopFacts = await desktop.evaluate(() => ({
    sectionCount: document.querySelectorAll('main section').length,
    primaryHref: document.querySelector('main a[href="/book-demo"]')?.getAttribute('href') || null,
    workflowHref: document.querySelector('main a[href="#workflow"]')?.getAttribute('href') || null,
    navLabels: Array.from(document.querySelectorAll('header nav a, header nav button')).map(node => node.textContent?.trim()).filter(Boolean),
  }));
  results.visual.desktop = desktopFacts;
  if (desktopFacts.sectionCount < 7) results.failures.push(`desktop home: expected at least 7 sections, found ${desktopFacts.sectionCount}`);
  if (desktopFacts.primaryHref !== '/book-demo') results.failures.push('desktop home: primary demo CTA is missing or incorrect');
  if (desktopFacts.workflowHref !== '#workflow') results.failures.push('desktop home: workflow CTA is missing or incorrect');
  await desktop.screenshot({ path: path.join(outputDir, 'home-desktop.png'), fullPage: true });

  await desktop.addScriptTag({ path: axePath });
  const desktopAxe = await desktop.evaluate(async () => {
    const outcome = await globalThis.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } });
    return outcome.violations.map(violation => ({
      id: violation.id,
      impact: violation.impact,
      description: violation.description,
      nodes: violation.nodes.map(node => ({ target: node.target, html: node.html, failureSummary: node.failureSummary })),
    }));
  });
  results.accessibility.desktopHome = desktopAxe;
  await desktop.close();

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  await auditPage(mobile, '/', 'mobile-home');
  await mobile.screenshot({ path: path.join(outputDir, 'home-mobile.png'), fullPage: true });
  const menuButton = mobile.getByRole('button', { name: 'Open navigation menu' });
  await menuButton.click();
  const mobileSheet = mobile.locator('#mkt-mobile-sheet');
  const sheetVisible = await mobileSheet.isVisible();
  const bodyOverflowWhileOpen = await mobile.evaluate(() => getComputedStyle(document.body).overflow);
  await mobile.keyboard.press('Escape');
  await mobile.waitForTimeout(250);
  const sheetHiddenAfterEscape = !(await mobileSheet.isVisible());
  results.interactions.mobileMenu = { sheetVisible, bodyOverflowWhileOpen, sheetHiddenAfterEscape };
  if (!sheetVisible) results.failures.push('mobile menu: sheet did not open');
  if (!sheetHiddenAfterEscape) results.failures.push('mobile menu: Escape did not close the sheet');
  await mobile.addScriptTag({ path: axePath });
  const mobileAxe = await mobile.evaluate(async () => {
    const outcome = await globalThis.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } });
    return outcome.violations.map(violation => ({
      id: violation.id,
      impact: violation.impact,
      description: violation.description,
      nodes: violation.nodes.map(node => ({ target: node.target, html: node.html, failureSummary: node.failureSummary })),
    }));
  });
  results.accessibility.mobileHome = mobileAxe;
  await mobile.close();

  const routePage = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  const checks = [
    ['/pricing', 'pricing'],
    ['/book-demo', 'book-demo'],
    ['/blog/ai-integration-business-applications-2025', 'blog-fallback'],
    ['/ecosystem/linkedin', 'integration-detail'],
  ];
  for (const [route, label] of checks) {
    const facts = await auditPage(routePage, route, label);
    if (route === '/ecosystem/linkedin' && facts.canonical !== 'https://alphaclonesystems.com/ecosystem/linkedin') {
      results.failures.push(`integration canonical incorrect: ${facts.canonical}`);
    }
  }
  await routePage.screenshot({ path: path.join(outputDir, 'integration-detail.png'), fullPage: true });
  await routePage.goto(`${baseURL}/pricing`, { waitUntil: 'domcontentloaded' });
  await routePage.waitForTimeout(800);
  await routePage.screenshot({ path: path.join(outputDir, 'pricing-desktop.png'), fullPage: true });

  const serious = Object.values(results.accessibility).flat().filter(item => item.impact === 'serious' || item.impact === 'critical');
  if (serious.length) results.failures.push(`axe: ${serious.length} serious/critical violations`);
} finally {
  results.finishedAt = new Date().toISOString();
  await fs.writeFile(path.join(outputDir, 'report.json'), `${JSON.stringify(results, null, 2)}\n`);
  await browser.close();
}

if (results.failures.length) {
  console.error(JSON.stringify({ failures: results.failures, accessibility: results.accessibility, consoleErrors: results.consoleErrors }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ status: 'passed', routes: results.routes, accessibility: results.accessibility, interactions: results.interactions }, null, 2));
