import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

// Run against an already-built app. All business APIs and policy data are offline fixtures.
const output = process.env.DOCUMENT_TEST_OUTPUT || '/tmp/contract-rendering-verification';
await mkdir(output, { recursive: true });
const policy = createServer((_req, res) => { res.setHeader('Content-Type', 'application/json'); res.end('[]'); });
await new Promise(resolve => policy.listen(3019, '127.0.0.1', resolve));
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', ...(process.env.DOCUMENT_TEST_DEV ? ['dev', '--webpack'] : ['start']), '-H', '127.0.0.1', '-p', '3018'], {
  env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:3019', SUPABASE_SERVICE_ROLE_KEY: 'offline-policy-fixture' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let browser;
try {
  await new Promise((resolve, reject) => {
    server.stdout.on('data', data => { if (data.toString().includes('Ready')) resolve(); });
    server.on('exit', code => reject(new Error(`Server exited: ${code}`)));
    setTimeout(() => reject(new Error('Server startup timed out')), 15000).unref();
  });
  browser = await chromium.launch({ executablePath: process.env.DOCUMENT_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage();
  const fixture = { id: 'fixture', title: 'Fixture agreement', status: 'sent', content: '<h1>Master Services Agreement</h1></p><p><h2>Terms</h2></p><p style="text-align:justify">This is an offline test agreement. USD 1 and USD 0.50 remain unchanged.</p>', tenant: { name: 'Fixture Company', logo_url: '/missing-fixture-logo.png' }, metadata: { client_name: 'Fixture Client' } };
  let submitted = 0;
  await page.route('**/api/contracts/sign**', async route => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON();
      assert.equal(body.consentGiven, true);
      assert.equal(body.signerEmail, 'client@example.test');
      assert.match(body.signatureDataUrl, /^data:image\/png;base64,/);
      submitted++;
      return route.fulfill({ json: { success: true, contract: { ...fixture, status: 'client_signed', client_signature: body.signatureDataUrl, client_signed_at: '2026-10-14T12:00:00Z' } } });
    }
    const token = new URL(route.request().url()).searchParams.get('token');
    if (token !== 'fixture') return route.fulfill({ status: token === 'invalid' ? 404 : 410, json: { error: token === 'invalid' ? 'Invalid signing link' : `This signing link has ${token === 'expired' ? 'expired' : 'already been used'}` } });
    return route.fulfill({ json: { success: true, signer: { email: 'client@example.test' }, contract: fixture } });
  });
  for (const width of [320, 360, 375, 390, 412, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('http://127.0.0.1:3018/contract/fixture', { waitUntil: 'domcontentloaded', timeout: 120000 });
    const privacy = page.getByRole('button', { name: 'Essential only', exact: true });
    await privacy.click({ timeout: 1500 }).catch(() => {});
    await page.locator('iframe').waitFor();
    await page.waitForFunction(() => document.querySelector('iframe')?.getBoundingClientRect().height > 100);
    const frame = page.frameLocator('iframe');
    await frame.locator('.document-body').waitFor();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Public page overflow at ${width}`);
    assert.ok(await frame.locator('body').evaluate(body => body.scrollWidth <= innerWidth), `Document overflow at ${width}`);
    await page.screenshot({ path: `${output}/public-${width}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://127.0.0.1:3018/contract/fixture', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Click to Sign Document' }).click();
  await page.getByPlaceholder('Type your official legal name').fill('Fixture Client');
  const bounds = await page.locator('canvas').boundingBox();
  assert.ok(bounds);
  await page.mouse.move(bounds.x + 20, bounds.y + 30);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 100, bounds.y + 80, { steps: 10 });
  await page.mouse.up();
  await page.getByRole('button', { name: 'Adopt & Sign', exact: true }).click();
  await page.getByRole('button', { name: 'Sign Contract', exact: true }).click();
  await page.getByRole('heading', { name: 'Your signature is recorded' }).waitFor();
  assert.equal(submitted, 1);
  for (const token of ['invalid', 'expired', 'used']) {
    await page.goto(`http://127.0.0.1:3018/contract/${token}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.getByRole('heading', { name: 'Contract Not Found' }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Sign Contract', exact: true }).count(), 0);
  }
  console.log('PASS: 9 public-page viewports, disclosure and signature submission, invalid/expired/used link UI. APIs mocked; no real sends or signatures.');
} finally {
  await browser?.close();
  server.kill();
  await new Promise(resolve => policy.close(resolve));
}
