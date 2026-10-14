// Run with: DOCUMENT_CHROMIUM_PATH=/path/to/chromium node --import tsx tests/document-rendering.browser.mjs
// Offline fixtures only: no customer email, signing, or production writes.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { buildContractDocumentInput } from '../src/lib/documents/documentBuilders.ts';
import { renderDocumentHtml } from '../src/lib/documents/renderDocument.ts';

const output = process.env.DOCUMENT_TEST_OUTPUT || '/tmp/contract-rendering-verification';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.DOCUMENT_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
const results = [];
try {
  const page = await browser.newPage();
  await page.route('**/*', route => route.abort());
  const clauses = Array.from({ length: 12 }, (_, i) => `<p style="text-align:justify;word-spacing:40px;margin:90px">Clause ${i + 1}: The provider delivers the agreed services. USD 1 and USD 0.50 remain unchanged.</p>`).join('');
  const contract = { title: 'Website agreement', status: 'sent', content: `<h1>Master Services Agreement</h1></p><p><h2>1. Terms</h2></p>${clauses}<h2>Signatures</h2><p>Existing signature evidence</p><h2>Schedule A</h2><p>Final binding clause</p>`, admin_signature: 'typed:Authorized Owner', admin_signed_at: '2026-10-01T12:00:00Z', client_email: `${'long'.repeat(40)}@example.test` };
  const input = buildContractDocumentInput(contract, { name: 'Fixture Company', business_settings: { business_name: 'Fixture Company LLC' } });
  const html = renderDocumentHtml(input);
  for (const width of [320, 360, 375, 390, 412, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.setContent(html);
    const metrics = await page.evaluate(() => ({
      viewport: innerWidth, width: document.documentElement.scrollWidth,
      align: getComputedStyle(document.querySelector('.document-body p')).textAlign,
      spacing: getComputedStyle(document.querySelector('.document-body p')).wordSpacing,
      nested: document.querySelectorAll('p h1, p h2').length,
      text: document.body.textContent,
    }));
    assert.ok(metrics.width <= width, `Overflow at ${width}: ${metrics.width}`);
    assert.equal(metrics.align, 'left');
    assert.equal(metrics.spacing, '0px');
    assert.equal(metrics.nested, 0);
    assert.match(metrics.text, /Final binding clause/);
    assert.match(metrics.text, /USD 1 and USD 0.50/);
    await page.screenshot({ path: `${output}/contract-${width}.png`, fullPage: true });
    results.push({ width, status: 'PASS', scrollWidth: metrics.width });
  }
  for (const type of ['invoice', 'quote', 'proposal']) {
    await page.setViewportSize({ width: 320, height: 900 });
    await page.setContent(renderDocumentHtml({ type, title: type, branding: { name: 'Fixture Company' }, clientName: 'Fixture Client', lineItems: [{ description: 'long-description-'.repeat(12), quantity: 1, rate: 100, amount: 100 }], total: 100 }));
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${type} overflow`);
    results.push({ type, width: 320, status: 'PASS' });
  }
  await page.setContent(html);
  await page.emulateMedia({ media: 'print' });
  const pdf = await page.pdf({ format: 'A4', preferCSSPageSize: true, printBackground: true });
  await writeFile(`${output}/contract.pdf`, pdf);
  assert.ok(pdf.length > 1000);
  await writeFile(`${output}/results.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify({ results, pdfBytes: pdf.length, output }, null, 2));
} finally { await browser.close(); }
