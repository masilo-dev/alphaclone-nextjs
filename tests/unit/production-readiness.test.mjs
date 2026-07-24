/**
 * Production readiness hardening — unit/source contract tests.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';

const { denyIfCronUnauthorized } = await import('../../src/lib/cronAuth.ts');

test('cron auth rejects spoofed x-railway-cron in production without Bearer', () => {
  const prev = process.env.NODE_ENV;
  const prevSecret = process.env.CRON_SECRET;
  process.env.NODE_ENV = 'production';
  process.env.CRON_SECRET = 'test-cron-secret-value';
  try {
    const spoofed = new NextRequest('https://example.com/api/cron/daily', {
      headers: { 'x-railway-cron': '1' },
    });
    const denied = denyIfCronUnauthorized(spoofed);
    assert.ok(denied);
    assert.equal(denied.status, 401);

    const ok = new NextRequest('https://example.com/api/cron/daily', {
      headers: {
        'x-railway-cron': '1',
        authorization: 'Bearer test-cron-secret-value',
      },
    });
    assert.equal(denyIfCronUnauthorized(ok), null);
  } finally {
    process.env.NODE_ENV = prev;
    if (prevSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = prevSecret;
  }
});

test('readiness fails closed without soft mode (source)', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(
    new URL('../../src/app/api/readiness/route.ts', import.meta.url),
    'utf8'
  );
  assert.match(src, /status = soft \|\| healthy \? 200 : 503/);
  assert.match(src, /READINESS_ALWAYS_200/);
});

test('Zernio webhook requires secret and ignores body.tenantId (source)', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(
    new URL('../../src/app/api/webhooks/zernio/whatsapp/route.ts', import.meta.url),
    'utf8'
  );
  assert.match(src, /ZERNIO_WEBHOOK_SECRET/);
  assert.match(src, /resolveTrustedTenant/);
  assert.equal(/body\?\.tenantId/.test(src), false);
  assert.match(src, /\.eq\('tenant_id',\s*tenantId\)/);
});

test('social cron disables legacy dual-path by default (source)', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(
    new URL('../../src/app/api/cron/social-publish/route.ts', import.meta.url),
    'utf8'
  );
  assert.match(src, /SOCIAL_LEGACY_SCHEDULED_POSTS/);
  assert.match(src, /publishDueSocialPosts/);
});

test('form webhooks require secret in production (source)', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(
    new URL('../../src/lib/forms/externalWebhookIntake.ts', import.meta.url),
    'utf8'
  );
  assert.match(src, /Webhook secret not configured for this form/);
});

test('invoice lifecycle has non-MCP dashboard API (source)', async () => {
  const fs = await import('node:fs');
  const api = fs.readFileSync(
    new URL('../../src/app/api/invoices/lifecycle/route.ts', import.meta.url),
    'utf8'
  );
  const modal = fs.readFileSync(
    new URL('../../src/components/dashboard/EnhancedInvoiceModal.tsx', import.meta.url),
    'utf8'
  );
  assert.match(api, /invoiceLifecycleWorkflow/);
  assert.match(modal, /startInvoiceLifecycleFromDashboard/);
  assert.equal(modal.includes("callMcpTool('start_invoice_lifecycle'"), false);
});

test('production Redis is required by default (source)', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(
    new URL('../../scripts/production-env.mjs', import.meta.url),
    'utf8'
  );
  assert.match(src, /env\.NODE_ENV === 'production'/);
  assert.match(src, /REDIS_REQUIRED=false/);
});
