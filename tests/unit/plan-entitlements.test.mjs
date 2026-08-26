/**
 * Unified plan entitlement tests — Free=50, Pro=300, Premium=unlimited (-1)
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  FREE_DAILY_LIMIT,
  PRO_DAILY_LIMIT,
  buildResourceLimitsForPlan,
  evaluateEntitlement,
  formatUsageDisplay,
  getDailyLimitForPlan,
  getDailyLimitRpc,
  isUnlimitedPlan,
  normalizePlanId,
  resolveResourceLimits,
} from '../../src/lib/entitlements/planEntitlements.ts';

describe('plan entitlements resolver', () => {
  it('normalizes legacy plan ids', () => {
    assert.equal(normalizePlanId('free'), 'free');
    assert.equal(normalizePlanId('starter'), 'pro');
    assert.equal(normalizePlanId('pro'), 'pro');
    assert.equal(normalizePlanId('enterprise'), 'premium');
    assert.equal(normalizePlanId('premium'), 'premium');
    assert.equal(normalizePlanId('custom'), 'premium');
  });

  it('returns 50/day for free and 300/day for pro across all metered resources', () => {
    assert.equal(getDailyLimitForPlan('free'), FREE_DAILY_LIMIT);
    assert.equal(getDailyLimitForPlan('pro'), PRO_DAILY_LIMIT);
    assert.equal(getDailyLimitForPlan('starter'), PRO_DAILY_LIMIT);

    const freeLimits = resolveResourceLimits('free');
    const proLimits = resolveResourceLimits('pro');

    for (const resource of Object.keys(freeLimits)) {
      assert.equal(freeLimits[resource], 50, `${resource} free limit`);
      assert.equal(proLimits[resource], 300, `${resource} pro limit`);
    }
  });

  it('represents premium as unlimited (null TS, -1 RPC) — never fake large numbers', () => {
    assert.equal(getDailyLimitForPlan('enterprise'), null);
    assert.equal(getDailyLimitForPlan('premium'), null);
    assert.equal(getDailyLimitRpc('premium'), -1);

    const premiumLimits = buildResourceLimitsForPlan('premium');
    for (const limit of Object.values(premiumLimits)) {
      assert.equal(limit, -1);
      assert.notEqual(limit, 9999);
      assert.notEqual(limit, 1000);
    }
  });

  it('evaluateEntitlement always allows premium without decrementing allowance', () => {
    const result = evaluateEntitlement({ rawPlan: 'enterprise', currentUsage: 18493 });
    assert.equal(result.allowed, true);
    assert.equal(result.unlimited, true);
    assert.equal(result.limit, null);
    assert.equal(result.remaining, null);
  });

  it('evaluateEntitlement blocks at category limit for free and pro', () => {
    const freeBlocked = evaluateEntitlement({ rawPlan: 'free', currentUsage: 50, resourceLabel: 'leads' });
    assert.equal(freeBlocked.allowed, false);
    assert.equal(freeBlocked.limit, 50);

    const proAllowed = evaluateEntitlement({ rawPlan: 'pro', currentUsage: 299, resourceLabel: 'emails sent' });
    assert.equal(proAllowed.allowed, true);
    assert.equal(proAllowed.remaining, 1);

    const proBlocked = evaluateEntitlement({ rawPlan: 'pro', currentUsage: 300, resourceLabel: 'emails sent' });
    assert.equal(proBlocked.allowed, false);
    assert.equal(proBlocked.limit, 300);
  });

  it('formatUsageDisplay shows Unlimited for premium, never X/1000', () => {
    assert.equal(formatUsageDisplay(812, 'enterprise'), 'Unlimited');
    assert.equal(formatUsageDisplay(32, 'free', 'today'), '32 / 50 today');
    assert.equal(formatUsageDisplay(184, 'pro', 'today'), '184 / 300 today');
    assert.doesNotMatch(formatUsageDisplay(812, 'enterprise'), /1000/);
  });

  it('isUnlimitedPlan covers enterprise/custom aliases', () => {
    assert.equal(isUnlimitedPlan('free'), false);
    assert.equal(isUnlimitedPlan('pro'), false);
    assert.equal(isUnlimitedPlan('enterprise'), true);
    assert.equal(isUnlimitedPlan('custom'), true);
  });
});
