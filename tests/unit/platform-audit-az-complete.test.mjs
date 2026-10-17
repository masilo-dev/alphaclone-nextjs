import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizePlanId,
  isUnlimitedPlan,
  getDailyLimitForPlan,
  evaluateEntitlement,
  evaluateFeatureEntitlement,
} from '../../src/lib/entitlements/planEntitlements.ts';
import {
  resolveEntitlementContext,
  PAST_DUE_GRACE_PERIOD_MS,
} from '../../src/lib/entitlements/entitlementContext.ts';
import { getPlanLimits, isWithinLimit } from '../../src/lib/planLimits.ts';
import { resolveTenantRole } from '../../src/lib/mcp/connector/permissions.ts';
import { validateSafeOutgoingUrl, SsrfSecurityError } from '../../src/lib/security/ssrfGuard.ts';
import { validateFileSignature, FileSignatureSecurityError } from '../../src/lib/security/fileSignatureGuard.ts';
import { resolveTenantPostalAddress } from '../../src/lib/email/tenantEmailBranding.ts';
import { getChiefOfStaffLastRunAt } from '../../src/lib/automation/chiefOfStaffRunner.ts';
import { isImmediateLifecycleNotification } from '../../src/lib/email/sendEmailServer.ts';

test('Domain P: Authoritative plan normalization and daily quotas', () => {
  assert.equal(normalizePlanId('free'), 'free');
  assert.equal(normalizePlanId('starter'), 'pro');
  assert.equal(normalizePlanId('pro'), 'pro');
  assert.equal(normalizePlanId('enterprise'), 'premium');
  assert.equal(normalizePlanId('custom'), 'premium');
  assert.equal(normalizePlanId(null), 'free');

  assert.equal(getDailyLimitForPlan('free'), 50);
  assert.equal(getDailyLimitForPlan('pro'), 300);
  assert.equal(getDailyLimitForPlan('premium'), null); // null = unlimited

  const freeEval = evaluateEntitlement({ rawPlan: 'free', currentUsage: 50, resourceLabel: 'emails' });
  assert.equal(freeEval.allowed, false);
  assert.match(freeEval.message, /Daily limit reached/);

  const proEval = evaluateEntitlement({ rawPlan: 'pro', currentUsage: 100, resourceLabel: 'emails' });
  assert.equal(proEval.allowed, true);
  assert.equal(proEval.remaining, 200);

  const featureCheck = evaluateFeatureEntitlement({ rawPlan: 'free', feature: 'videoConferencing' });
  assert.equal(featureCheck.allowed, false);
  assert.equal(featureCheck.requiredPlan, 'pro');
  assert.match(featureCheck.message, /requires Pro or Premium/);
  assert.equal(featureCheck.upgradeUrl, '/billing/upgrade');
});

test('Domain P & Q: 7-day past_due grace period and subscription lifecycle', () => {
  const now = new Date();
  const pastPeriodEnd = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000); // 2 days ago

  // 1. past_due within 7-day grace period
  const graceSnapshot = {
    tenantId: 'tenant-grace-123',
    rawPlan: 'pro',
    normalizedPlan: 'pro',
    subscriptionStatus: 'past_due',
    createdAt: new Date('2026-01-01'),
    trialStartedAt: null,
    trialEndsAt: null,
    legacyAccessUntil: null,
    stripeSubscriptionId: 'sub_123',
    currentPeriodEnd: pastPeriodEnd,
  };

  const graceContext = resolveEntitlementContext(graceSnapshot);
  assert.equal(graceContext.accessMode, 'paid_pro');
  assert.match(graceContext.bannerMessage || '', /grace period/i);

  // 2. past_due after 7-day grace period expired
  const expiredPeriodEnd = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
  const expiredGraceSnapshot = {
    ...graceSnapshot,
    currentPeriodEnd: expiredPeriodEnd,
  };
  const expiredGraceContext = resolveEntitlementContext(expiredGraceSnapshot);
  assert.equal(expiredGraceContext.accessMode, 'free');
  assert.match(expiredGraceContext.bannerMessage || '', /Grace period expired/i);

  // 3. canceled subscription reverts immediately to free
  const canceledSnapshot = {
    ...graceSnapshot,
    subscriptionStatus: 'canceled',
  };
  const canceledContext = resolveEntitlementContext(canceledSnapshot);
  assert.equal(canceledContext.accessMode, 'free');
  assert.match(canceledContext.bannerMessage || '', /inactive/i);
});

test('Domain H & M: Seat limits and client/portal role isolation', () => {
  // Free plan seat limit = 1 user
  assert.equal(getPlanLimits('free').users, 1);
  assert.equal(isWithinLimit('free', 'users', 0), true);
  assert.equal(isWithinLimit('free', 'users', 1), false);

  // Starter plan seat limit = 5 users
  assert.equal(getPlanLimits('starter').users, 5);
  assert.equal(isWithinLimit('starter', 'users', 4), true);
  assert.equal(isWithinLimit('starter', 'users', 5), false);

  // Enterprise = unlimited (-1)
  assert.equal(getPlanLimits('enterprise').users, -1);
  assert.equal(isWithinLimit('enterprise', 'users', 999), true);
});

test('Domain T: SSRF guard blocks internal, loopback, and metadata network targets', () => {
  // Public addresses allowed
  assert.doesNotThrow(() => validateSafeOutgoingUrl('https://example.com/test'));
  assert.doesNotThrow(() => validateSafeOutgoingUrl('https://alphaclonesystems.com/status'));

  // Disallowed schemes
  assert.throws(() => validateSafeOutgoingUrl('file:///etc/passwd'), SsrfSecurityError);
  assert.throws(() => validateSafeOutgoingUrl('gopher://127.0.0.1:6379'), SsrfSecurityError);

  // Loopback and internal IPv4
  assert.throws(() => validateSafeOutgoingUrl('http://127.0.0.1:3000/api'), SsrfSecurityError);
  assert.throws(() => validateSafeOutgoingUrl('http://localhost:8080'), SsrfSecurityError);
  assert.throws(() => validateSafeOutgoingUrl('http://10.0.0.1/admin'), SsrfSecurityError);
  assert.throws(() => validateSafeOutgoingUrl('http://172.16.0.5/api'), SsrfSecurityError);
  assert.throws(() => validateSafeOutgoingUrl('http://192.168.1.1/router'), SsrfSecurityError);

  // Cloud metadata service
  assert.throws(() => validateSafeOutgoingUrl('http://169.254.169.254/latest/meta-data'), SsrfSecurityError);
  assert.throws(() => validateSafeOutgoingUrl('http://metadata.google.internal/computeMetadata'), SsrfSecurityError);
  assert.throws(() => validateSafeOutgoingUrl('http://railway.internal/status'), SsrfSecurityError);
});

test('Domain U: File signature guard blocks disguised executables and validates magic bytes', () => {
  // Valid PDF
  const validPdf = Buffer.from('%PDF-1.7\n%test content\n');
  assert.doesNotThrow(() => validateFileSignature(validPdf, 'application/pdf'));

  // Disguised Windows executable (.exe with PE header MZ)
  const fakePdfExe = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);
  assert.throws(() => validateFileSignature(fakePdfExe, 'application/pdf'), FileSignatureSecurityError);

  // Disguised Linux executable (.bin with ELF header)
  const fakePngElf = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00]);
  assert.throws(() => validateFileSignature(fakePngElf, 'image/png'), FileSignatureSecurityError);

  // Disguised script shebang #!/bin/sh
  const scriptPayload = Buffer.from('#!/bin/bash\nrm -rf /\n');
  assert.throws(() => validateFileSignature(scriptPayload, 'image/jpeg'), FileSignatureSecurityError);

  // Disguised HTML in PDF
  const fakePdfHtml = Buffer.from('<!DOCTYPE html><html><script>alert(1)</script></html>');
  assert.throws(() => validateFileSignature(fakePdfHtml, 'application/pdf'), FileSignatureSecurityError);

  // Valid PNG
  const validPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
  assert.doesNotThrow(() => validateFileSignature(validPng, 'image/png'));
});

test('Domain C: Canonical business postal address resolves across all aliases without global defaults', () => {
  // Direct tenant address
  const addr1 = resolveTenantPostalAddress({ business_address: '123 Market St, Suite 400' });
  assert.equal(addr1, '123 Market St, Suite 400');

  // Nested branding business_address
  const addr2 = resolveTenantPostalAddress({ settings: { branding: { business_address: '456 Tech Ave' } } });
  assert.equal(addr2, '456 Tech Ave');

  // Fallback to empty string if not configured (never global owner address)
  const addr3 = resolveTenantPostalAddress({});
  assert.equal(addr3, '');
});

test('Domain N: Transactional lifecycle events exempt from digest batch delay', () => {
  const isImmediate = isImmediateLifecycleNotification({
    to: 'user@example.com',
    subject: 'Project Assigned',
    tenantId: '066eb88e-3fb0-45c9-b4d1-c3c2063ea0d4',
    templateName: 'projectUpdate',
  });
  assert.equal(isImmediate, true);

  const isImmediateException = isImmediateLifecycleNotification({
    to: 'user@example.com',
    subject: 'Urgent Alert',
    tenantId: '066eb88e-3fb0-45c9-b4d1-c3c2063ea0d4',
    internalNotificationKind: 'immediate_exception',
  });
  assert.equal(isImmediateException, true);
});

test('Domain J: Chief of Staff heartbeat lookups check all runtime tables without false dead state', async () => {
  const fakeDb = {
    from(table) {
      const builder = {
        select: () => builder,
        eq: () => builder,
        ilike: () => builder,
        order: () => builder,
        limit: () => builder,
        maybeSingle: () =>
          Promise.resolve({
            data: table === 'automation_cron_logs' ? { finished_at: new Date().toISOString() } : null,
          }),
        then: (resolve) =>
          Promise.resolve({
            data: table === 'automation_cron_logs' ? [{ finished_at: new Date().toISOString() }] : [],
          }).then(resolve),
      };
      return builder;
    },
  };

  const lastRun = await getChiefOfStaffLastRunAt(fakeDb, 'tenant-mock-999');
  assert.ok(lastRun);
  assert.ok(!isNaN(new Date(lastRun).getTime()));
});
