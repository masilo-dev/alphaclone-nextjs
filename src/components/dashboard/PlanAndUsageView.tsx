'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PUBLIC_PRICING_PLANS } from '@/config/pricingPlans';
import { quotaService, type DetailedUsageSummary, type QuotaResourceType } from '@/services/quotaService';
import { PRIMARY_USAGE_METRICS, ACTION_CATEGORY_LABELS } from '@/lib/entitlements/actionCategoryLabels';
import { getPublicPlanDisplayName, isUnlimitedPlan } from '@/lib/entitlements/planEntitlements';

interface PlanAndUsageViewProps {
  tenantId: string;
  userId: string;
  currentPlan?: string;
  subscriptionStatus?: string;
  trialEndsAt?: string | Date | null;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
}

export default function PlanAndUsageView({
  tenantId,
  userId,
  currentPlan = 'free',
  subscriptionStatus = 'free',
  trialEndsAt,
  currentPeriodEnd,
  cancelAtPeriodEnd = false,
}: PlanAndUsageViewProps) {
  const [usageSummary, setUsageSummary] = useState<DetailedUsageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  const unlimited = isUnlimitedPlan(currentPlan);

  useEffect(() => {
    async function fetchUsage() {
      try {
        setLoading(true);
        const data = await quotaService.getTenantUsageSummary(tenantId, userId);
        setUsageSummary(data);
      } catch (err) {
        console.error('Failed to load quota summary:', err);
      } finally {
        setLoading(false);
      }
    }
    if (tenantId && userId) fetchUsage();
  }, [tenantId, userId]);

  const handleOpenPortal = async () => {
    try {
      setPortalLoading(true);
      const res = await fetch('/api/stripe/create-portal-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else alert(data.error || 'Failed to open billing portal');
    } catch (err) {
      console.error('Billing portal error:', err);
    } finally {
      setPortalLoading(false);
    }
  };

  const handleUpgrade = async (planId: string) => {
    if (planId === 'free') return;
    try {
      setCheckoutLoading(planId);
      const checkoutPlan = planId === 'premium' ? 'enterprise' : planId;
      const res = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: checkoutPlan, tenantId }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else alert(data.error || 'Failed to initiate checkout');
    } catch (err) {
      console.error('Checkout error:', err);
    } finally {
      setCheckoutLoading(null);
    }
  };

  const formattedPlanName = getPublicPlanDisplayName(currentPlan);
  const isPaid = currentPlan !== 'free';
  const isOnTrial = subscriptionStatus === 'trial' && trialEndsAt;
  const trialEndDate = trialEndsAt ? new Date(trialEndsAt) : null;
  const trialDaysLeft = trialEndDate
    ? Math.ceil((trialEndDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;
  const trialExpired = trialDaysLeft !== null && trialDaysLeft <= 0;

  const metricsToShow = PRIMARY_USAGE_METRICS.filter((key) => usageSummary?.metrics[key]);

  return (
    <div className="space-y-8 max-w-6xl mx-auto p-4 sm:p-6">
      {isOnTrial && trialEndDate && (
        <div
          className={`rounded-2xl border p-5 ${
            trialExpired
              ? 'border-red-500/30 bg-red-500/10'
              : trialDaysLeft !== null && trialDaysLeft <= 3
              ? 'border-amber-500/30 bg-amber-500/10'
              : 'border-teal-500/30 bg-teal-500/10'
          }`}
        >
          <h3 className="text-lg font-bold text-white">
            {trialExpired ? 'Free trial ended' : '14-day Premium trial active'}
          </h3>
          <p className="mt-1 text-sm text-slate-300">
            {trialExpired
              ? 'Add a subscription to restore full workspace access.'
              : `${trialDaysLeft} day${trialDaysLeft === 1 ? '' : 's'} remaining · full Premium access · no daily limits · ends ${trialEndDate.toLocaleDateString()}`}
          </p>
        </div>
      )}

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl text-white">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-6">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold">{formattedPlanName} Plan</h2>
              {unlimited && (
                <span className="px-3 py-1 text-xs font-semibold rounded-full uppercase tracking-wider bg-violet-500/20 text-violet-300 border border-violet-500/30">
                  Unlimited
                </span>
              )}
              <span
                className={`px-3 py-1 text-xs font-semibold rounded-full uppercase tracking-wider ${
                  subscriptionStatus === 'active'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : subscriptionStatus === 'trial'
                    ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {subscriptionStatus}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-400">
              {unlimited
                ? 'Unlimited plan — usage is tracked for analytics only, never capped by AlphaClone.'
                : 'Daily limits reset at 00:00 UTC · Free = 50/day · Pro = 300/day per category'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {isPaid && (
              <button
                onClick={handleOpenPortal}
                disabled={portalLoading}
                className="px-4 py-2 text-sm font-medium bg-slate-800 hover:bg-slate-700 text-white rounded-xl border border-slate-700 transition-all disabled:opacity-50"
              >
                {portalLoading ? 'Opening Portal...' : 'Manage Billing'}
              </button>
            )}
            <Link href="/pricing" className="px-4 py-2 text-sm font-medium bg-teal-600 hover:bg-teal-500 text-white rounded-xl shadow-lg transition-all">
              Compare Plans
            </Link>
          </div>
        </div>
        {currentPeriodEnd && (
          <div className="mt-4 text-xs text-slate-400 flex items-center justify-between">
            <span>
              {cancelAtPeriodEnd ? 'Cancels on:' : 'Renews on:'}{' '}
              {new Date(currentPeriodEnd).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
            <span>Resets daily at 00:00 UTC</span>
          </div>
        )}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-xl font-bold text-white">Daily Usage</h3>
            <p className="text-sm text-slate-400 mt-0.5">
              {unlimited ? 'Analytics only — no subscription ceiling' : 'Per action category · UTC daily window'}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-500 text-sm">Loading usage metrics...</div>
        ) : usageSummary ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {metricsToShow.map((key) => {
              const metric = usageSummary.metrics[key as QuotaResourceType];
              if (!metric) return null;
              const meta = ACTION_CATEGORY_LABELS[key as QuotaResourceType];
              const isMetricUnlimited = metric.unlimited || unlimited;
              const percent = isMetricUnlimited
                ? 0
                : Math.min(100, Math.round((metric.current / Math.max(1, metric.limit)) * 100));
              const isNearLimit = !isMetricUnlimited && percent >= 80;
              const isMaxed = !isMetricUnlimited && percent >= 100;

              return (
                <div key={key} className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                      <span>{meta.icon}</span>
                      <span>{meta.label}</span>
                    </span>
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded ${
                        isMetricUnlimited
                          ? 'bg-violet-500/20 text-violet-300'
                          : isMaxed
                          ? 'bg-rose-500/20 text-rose-400'
                          : isNearLimit
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {isMetricUnlimited ? 'Unlimited' : `${metric.current} / ${metric.limit}`}
                    </span>
                  </div>
                  {!isMetricUnlimited && (
                    <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden mt-3">
                      <div
                        className={`h-full transition-all duration-300 ${
                          isMaxed ? 'bg-rose-500' : isNearLimit ? 'bg-amber-500' : 'bg-teal-500'
                        }`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  )}
                  <div className="mt-4 pt-3 border-t border-slate-800/80 text-xs text-slate-500">
                    {isMetricUnlimited
                      ? `${metric.current.toLocaleString()} used today (analytics only)`
                      : `${metric.remaining} remaining today`}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-8 text-center text-slate-500 text-sm">Failed to load usage data.</div>
        )}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <h3 className="text-xl font-bold text-white mb-6">Available Plans</h3>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {PUBLIC_PRICING_PLANS.map((plan) => {
            const isCurrent =
              (plan.id === 'premium' && unlimited) ||
              (plan.id === 'pro' && !unlimited && ['pro', 'starter'].includes(currentPlan.toLowerCase())) ||
              (plan.id === 'free' && currentPlan.toLowerCase() === 'free');

            return (
              <div
                key={plan.id}
                className={`bg-slate-950 border rounded-xl p-5 flex flex-col justify-between ${
                  isCurrent ? 'border-teal-500 ring-1 ring-teal-500/50' : 'border-slate-800'
                }`}
              >
                <div>
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-lg text-white">{plan.name}</h4>
                    {isCurrent && (
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-teal-500/20 text-teal-400 rounded-full border border-teal-500/30">
                        CURRENT
                      </span>
                    )}
                  </div>
                  <p className="text-2xl font-extrabold text-white mt-2">
                    {plan.id === 'premium' ? (
                      <>Unlimited</>
                    ) : (
                      <>
                        ${plan.price}
                        <span className="text-xs font-normal text-slate-400">/mo</span>
                      </>
                    )}
                  </p>
                  <p className="text-xs text-slate-400 mt-2 line-clamp-3">{plan.tagline}</p>
                </div>
                <div className="mt-6">
                  {isCurrent ? (
                    <button disabled className="w-full py-2 text-xs font-semibold bg-slate-800 text-slate-400 rounded-lg cursor-not-allowed">
                      Active Plan
                    </button>
                  ) : plan.id === 'free' ? (
                    <button disabled className="w-full py-2 text-xs font-semibold bg-slate-800 text-slate-400 rounded-lg cursor-not-allowed">
                      Free Tier
                    </button>
                  ) : (
                    <button
                      onClick={() => handleUpgrade(plan.id)}
                      disabled={checkoutLoading === plan.id}
                      className="w-full py-2 text-xs font-semibold bg-teal-600 hover:bg-teal-500 text-white rounded-lg transition-all shadow-md disabled:opacity-50"
                    >
                      {checkoutLoading === plan.id ? 'Loading...' : `Upgrade to ${plan.name}`}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
