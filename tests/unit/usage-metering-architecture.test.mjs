/**
 * Usage metering architecture acceptance tests (pure logic — no DB required).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  LEGACY_ACCESS_DEADLINE_ISO,
  resolveEntitlementContext,
  shouldEnforceDailyQuota,
  USAGE_ROLLOUT_ISO,
} from '../../src/lib/entitlements/entitlementContext.ts';
import {
  determinePrimaryQuotaMetric,
  getBulkProjectedAmount,
  isBulkMeteredTool,
  isReadOnlyMcpTool,
  parseBulkSucceededCount,
  shouldChargeMcpExecution,
} from '../../src/lib/mcp/toolQuotaPolicy.ts';

describe('entitlement context', () => {
  it('legacy pre-rollout accounts are unrestricted until deadline', () => {
    const ctx = resolveEntitlementContext({
      tenantId: 't1',
      rawPlan: 'free',
      subscriptionStatus: 'free',
      createdAt: new Date('2026-01-01'),
      trialStartedAt: null,
      trialEndsAt: null,
      legacyAccessUntil: new Date(LEGACY_ACCESS_DEADLINE_ISO),
      stripeSubscriptionId: null,
    });
    assert.equal(ctx.accessMode, 'legacy_unrestricted');
    assert.equal(ctx.quotaEnforced, false);
    assert.equal(shouldEnforceDailyQuota(ctx), false);
    assert.match(ctx.bannerMessage || '', /Legacy access active/);
  });

  it('14-day trial grants full premium access without free limits', () => {
    const future = new Date(Date.now() + 7 * 86400000);
    const ctx = resolveEntitlementContext({
      tenantId: 't2',
      rawPlan: 'pro',
      subscriptionStatus: 'trial',
      createdAt: new Date(USAGE_ROLLOUT_ISO),
      trialStartedAt: new Date(),
      trialEndsAt: future,
      legacyAccessUntil: null,
      stripeSubscriptionId: null,
    });
    assert.equal(ctx.accessMode, 'trial_premium');
    assert.equal(ctx.unlimited, true);
    assert.equal(shouldEnforceDailyQuota(ctx), false);
  });

  it('new free users after legacy window enforce 50/day limits', () => {
    const ctx = resolveEntitlementContext({
      tenantId: 't3',
      rawPlan: 'free',
      subscriptionStatus: 'free',
      createdAt: new Date('2026-09-01'),
      trialStartedAt: null,
      trialEndsAt: null,
      legacyAccessUntil: null,
      stripeSubscriptionId: null,
    });
    assert.equal(ctx.accessMode, 'free');
    assert.equal(ctx.quotaEnforced, true);
    assert.equal(ctx.dailyLimit, 50);
  });

  it('active paid subscription is not overwritten by trial expiry logic', () => {
    const ctx = resolveEntitlementContext({
      tenantId: 't4',
      rawPlan: 'enterprise',
      subscriptionStatus: 'active',
      createdAt: new Date('2026-01-01'),
      trialStartedAt: null,
      trialEndsAt: new Date('2026-01-15'),
      legacyAccessUntil: null,
      stripeSubscriptionId: 'sub_123',
    });
    assert.equal(ctx.accessMode, 'paid_unlimited');
    assert.equal(ctx.unlimited, true);
  });
});

describe('MCP quota policy', () => {
  it('read actions are free', () => {
    assert.equal(isReadOnlyMcpTool('get_tickets'), true);
    assert.equal(isReadOnlyMcpTool('search_emails'), true);
    assert.equal(isReadOnlyMcpTool('integrations_status'), true);
    assert.equal(isReadOnlyMcpTool('bulk_create_leads'), false);
  });

  it('lead tools charge leads only — not mcp_executions + leads', () => {
    assert.equal(determinePrimaryQuotaMetric('bulk_create_leads'), 'leads');
    assert.equal(shouldChargeMcpExecution('bulk_create_leads'), false);
    assert.equal(determinePrimaryQuotaMetric('create_lead'), 'leads');
    assert.equal(shouldChargeMcpExecution('create_lead'), false);
  });

  it('bulk projected amount equals input array length', () => {
    assert.equal(isBulkMeteredTool('bulk_create_leads'), true);
    assert.equal(getBulkProjectedAmount('bulk_create_leads', { leads: new Array(25) }), 25);
    assert.equal(getBulkProjectedAmount('bulk_create_leads', { leads: [] }), 0);
  });

  it('parses succeeded_count from bulk tool results', () => {
    assert.equal(
      parseBulkSucceededCount(
        'bulk_create_leads',
        JSON.stringify({ succeeded_count: 17, failed_count: 3 }),
      ),
      17,
    );
    assert.equal(parseBulkSucceededCount('bulk_create_leads', JSON.stringify({ error: true })), 0);
  });
});

describe('failure semantics (pure)', () => {
  it('zero successes means zero billable units', () => {
    const amount = parseBulkSucceededCount(
      'bulk_create_leads',
      JSON.stringify({ succeeded_count: 0, failed_count: 20 }),
    );
    assert.equal(amount, 0);
  });

  it('partial bulk success bills only succeeded_count', () => {
    const succeeded = parseBulkSucceededCount(
      'bulk_create_leads',
      JSON.stringify({ succeeded_count: 15, failed_count: 5, total: 20 }),
    );
    assert.equal(succeeded, 15);
    assert.notEqual(succeeded, 20);
  });
});
