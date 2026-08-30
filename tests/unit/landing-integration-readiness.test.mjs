import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('landing integration strip uses the approved current connector set', async () => {
  const strip = await read('src/components/marketing/system/VerifiedIntegrationsStrip.tsx');
  for (const id of ['facebook', 'linkedin', 'linkedin-organization', 'calendly', 'zoho', 'brevo', 'resend', 'stripe', 'microsoft']) {
    assert.match(strip, new RegExp(`'${id}'`));
  }
  assert.doesNotMatch(strip, /'google'|'github'|'gmail'|'whatsapp'/);
});

test('Gmail, GitHub, and Cal.com are optional and do not reduce platform readiness', async () => {
  const audit = await read('src/lib/mcp/audit/platformAuditEngine.ts');
  const policy = await read('src/lib/mcp/integrationHealthPolicy.ts');
  const requiredBlock = audit.match(/const REQUIRED_INTEGRATIONS = \[([\s\S]*?)\] as const;/)?.[1] || '';
  assert.doesNotMatch(requiredBlock, /'gmail'|'github'|'calcom'|'calendly'|'google_calendar'/);
  assert.match(policy, /OPTIONAL_INTEGRATIONS_FOR_HEALTH/);
  assert.match(policy, /'gmail'/);
  assert.match(policy, /'github'/);
  assert.match(policy, /'calcom'/);
});

test('demo CTA is explicit and Calendly bookings notify the host', async () => {
  const home = await read('src/components/marketing/system/MarketingHomePage.tsx');
  const calendly = await read('src/lib/calendly/syncToNative.ts');
  assert.equal((home.match(/Book a demo/g) || []).length, 2);
  for (const client of ['ChatGPT', 'Claude', 'Manus', 'WhatsApp', 'Stripe', 'Calendly', 'Brevo']) {
    assert.match(home, new RegExp(client.replace('.', '\\.')));
  }
  assert.match(calendly, /calendlyHostNotification/);
  assert.match(calendly, /isPlatformNotification: true/);
});

test('Railway Redis is supported as the preferred shared backend', async () => {
  const cache = await read('src/lib/cache/redis.ts');
  const limiter = await read('src/lib/rateLimit.ts');
  assert.match(cache, /process\.env\.REDIS_URL/);
  assert.match(cache, /railwayRedis \? 'railway'/);
  assert.match(limiter, /redisBackend === 'railway'/);
});
