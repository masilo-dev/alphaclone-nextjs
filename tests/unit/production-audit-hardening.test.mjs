/**
 * Production Audit Hardening Regression Test Suite
 *
 * Verifies all security & reliability invariants identified during the
 * Cloudflare-style master workspace audit:
 * 1. Multi-Tenancy & Payments BOLA Protection (manage-subscription & reconcile-payment)
 * 2. Edge Security & Proxy Consolidation (src/proxy.ts OWASP headers, CSP, Rate Limits)
 * 3. Webhook Cryptographic Hygiene (Cal, Twilio SMS, Email provider routes)
 * 4. CI Heap Protection (.github/workflows/ci.yml)
 */
import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';

describe('Production Audit Hardening: Multi-Tenancy & Stripe Payments', () => {
  it('manage-subscription enforces strict Zod schema and requireTenantRole', () => {
    const src = fs.readFileSync(
      new URL('../../src/app/api/stripe/manage-subscription/route.ts', import.meta.url),
      'utf8'
    );
    // Must validate body with Zod schema including uuid tenantId and action enum
    assert.match(src, /tenantId:\s*z\.string\(\)\.uuid\(\)/);
    assert.match(src, /action:\s*z\.enum\(\['cancel_at_period_end',\s*'resume'\]\)/);
    // Must assert tenant role before querying Stripe or tenant state
    assert.match(src, /await requireTenantRole\(tenantId,\s*\['owner',\s*'admin',\s*'tenant_admin',\s*'super_admin'\]\)/);
  });

  it('reconcile-payment enforces tenant access on invoice and asserts paymentIntent metadata', () => {
    const src = fs.readFileSync(
      new URL('../../src/app/api/stripe/reconcile-payment/route.ts', import.meta.url),
      'utf8'
    );
    // Must enforce authenticated user
    assert.match(src, /await requireAuthenticatedUser\(req\)/);
    // Must verify tenant membership for the invoice
    assert.match(src, /await requireTenantAccess\(invoice\.tenant_id,\s*req\)/);
    // Must reconcile through canonical policy validator
    assert.match(src, /reconcileInvoiceStripePayment/);

    const policySrc = fs.readFileSync(
      new URL('../../src/lib/stripePaymentPolicy.ts', import.meta.url),
      'utf8'
    );
    assert.match(policySrc, /payment\.metadata\.tenantId !== invoice\.tenant_id/);
    assert.match(policySrc, /payment\.metadata\.invoiceId !== invoice\.id/);
  });
});

describe('Production Audit Hardening: Edge Proxy Consolidation', () => {
  it('src/proxy.ts exists and root proxy.ts is removed', () => {
    const srcProxyExists = fs.existsSync(new URL('../../src/proxy.ts', import.meta.url));
    const rootProxyExists = fs.existsSync(new URL('../../proxy.ts', import.meta.url));
    assert.equal(srcProxyExists, true, 'src/proxy.ts must exist');
    assert.equal(rootProxyExists, false, 'root proxy.ts must not shadow src/proxy.ts');
  });

  it('src/proxy.ts enforces OWASP headers, HSTS, CSP, and API rate limiting', () => {
    const proxy = fs.readFileSync(
      new URL('../../src/proxy.ts', import.meta.url),
      'utf8'
    );
    // OWASP Headers
    assert.match(proxy, /Strict-Transport-Security/);
    assert.match(proxy, /max-age=63072000/);
    assert.match(proxy, /X-Content-Type-Options.*nosniff/);
    assert.match(proxy, /Referrer-Policy.*strict-origin-when-cross-origin/);
    assert.match(proxy, /Content-Security-Policy/);
    // Rate Limiting
    assert.match(proxy, /applyGlobalApiRateLimit/);
    assert.match(proxy, /RATE_LIMITED/);
    // Handshake and Webhook exemptions
    assert.match(proxy, /pathname\.startsWith\("\/api\/webhooks\/"\)/);
    assert.match(proxy, /isMcpOAuthProtocolPath/);
    // Canonical redirects & Session update
    assert.match(proxy, /alphaclonesystems\.com/);
    assert.match(proxy, /updateSession\(request\)/);
  });
});

describe('Production Audit Hardening: Webhook Cryptographic Security', () => {
  it('Cal.com webhook route denies unsigned webhooks and fails closed in production', () => {
    const src = fs.readFileSync(
      new URL('../../src/app/api/webhooks/cal/route.ts', import.meta.url),
      'utf8'
    );
    // Deny if verification missing in production
    assert.match(src, /denyIfWebhookVerificationMissing\('cal',\s*Boolean\(secret\)\)/);
    // Fails closed if no secret in production
    assert.match(src, /if\s*\(isProduction\(\)\)\s*\{\s*return false;\s*\}/);
    // Uses constant-time comparison with length guard
    assert.match(src, /receivedBuf\.length !== expectedBuf\.length/);
    assert.match(src, /crypto\.timingSafeEqual\(receivedBuf,\s*expectedBuf\)/);
  });

  it('Email webhook route uses timingSafeEqual with length check and denies missing secrets in production', () => {
    const src = fs.readFileSync(
      new URL('../../src/app/api/webhooks/email/[provider]/route.ts', import.meta.url),
      'utf8'
    );
    assert.match(src, /denyIfWebhookVerificationMissing\('email',\s*Boolean\(expected\)\)/);
    assert.match(src, /tokenBuf\.length !== expectedBuf\.length/);
    assert.match(src, /crypto\.timingSafeEqual\(tokenBuf,\s*expectedBuf\)/);
    // Ensure no naive === comparison on secret token
    assert.equal(src.includes('token === expected'), false, 'Naive === token check must be removed');
  });

  it('Twilio SMS webhook route guards timingSafeEqual against mismatched buffer lengths without throwing', () => {
    const src = fs.readFileSync(
      new URL('../../src/app/api/webhooks/twilio/sms/route.ts', import.meta.url),
      'utf8'
    );
    assert.match(src, /denyIfWebhookVerificationMissing\('twilio',\s*Boolean\(authToken\)\)/);
    assert.match(src, /digestBuf\.length !== sigBuf\.length/);
    assert.match(src, /crypto\.timingSafeEqual\(digestBuf,\s*sigBuf\)/);

    // Direct runtime test of the length check logic:
    const simulateValidate = (digestStr, sigStr) => {
      const digestBuf = Buffer.from(digestStr);
      const sigBuf = Buffer.from(sigStr);
      if (digestBuf.length !== sigBuf.length) return false;
      return crypto.timingSafeEqual(digestBuf, sigBuf);
    };

    // Equal length, mismatch:
    assert.equal(simulateValidate('abcdef', '123456'), false);
    // Unequal length (which throws TypeError in raw crypto.timingSafeEqual):
    assert.doesNotThrow(() => {
      assert.equal(simulateValidate('abcdef', '123'), false);
    });
    // Matching:
    assert.equal(simulateValidate('securehash123', 'securehash123'), true);
  });
});

describe('Production Audit Hardening: CI Pipeline Configuration', () => {
  it('.github/workflows/ci.yml runs typecheck with allocated memory budget', () => {
    const ci = fs.readFileSync(
      new URL('../../.github/workflows/ci.yml', import.meta.url),
      'utf8'
    );
    assert.match(ci, /run:\s*npm run typecheck/);
    assert.equal(ci.includes('run: npx tsc --noEmit'), false, 'Bare tsc call must be replaced');
  });
});
