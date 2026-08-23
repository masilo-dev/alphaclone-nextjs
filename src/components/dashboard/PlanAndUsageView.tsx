'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PUBLIC_PRICING_PLANS } from '@/config/pricingPlans';
import { quotaService, type DetailedUsageSummary, type QuotaResourceType } from '@/services/quotaService';

interface PlanAndUsageViewProps {
  tenantId: string;
  userId: string;
  currentPlan?: string;
  subscriptionStatus?: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
}

const METRIC_LABELS: Record<QuotaResourceType, { label: string; icon: string }> = {
  leads: { label: 'Lead Creations', icon: '👥' },
  outreach_actions: { label: 'Outreach Actions', icon: '⚡' },
  linkedin_posts: { label: 'LinkedIn Posts', icon: '💼' },
  facebook_posts: { label: 'Facebook Posts', icon: '🌐' },
  instagram_posts: { label: 'Instagram Posts', icon: '📸' },
  email_actions: { label: 'Email Actions', icon: '✉️' },
  mcp_executions: { label: 'MCP / AI Executions', icon: '🤖' },
  contracts: { label: 'Contract Generation', icon: '📄' },
  invoices: { label: 'Invoice Issuance', icon: '🧾' },
  receipts: { label: 'Receipt Processing', icon: '💳' },
};

export default function PlanAndUsageView({
  tenantId,
  userId,
  currentPlan = 'free',
  subscriptionStatus = 'free',
  currentPeriodEnd,
  cancelAtPeriodEnd = false,
}: PlanAndUsageViewProps) {
  const [usageSummary, setUsageSummary] = useState<DetailedUsageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

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
    if (tenantId && userId) {
      fetchUsage();
    }
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
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || 'Failed to open billing portal');
      }
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
      const res = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, tenantId }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || 'Failed to initiate checkout');
      }
    } catch (err) {
      console.error('Checkout error:', err);
    } finally {
      setCheckoutLoading(null);
    }
  };

  const formattedPlanName = currentPlan.toUpperCase();
  const isPaid = currentPlan !== 'free';

  return (
    <div className="space-y-8 max-w-6xl mx-auto p-4 sm:p-6">
      {/* 1. Subscription Header & Plan Summary */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl text-white">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-6">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold">{formattedPlanName} PLAN</h2>
              <span
                className={`px-3 py-1 text-xs font-semibold rounded-full uppercase tracking-wider ${
                  subscriptionStatus === 'active'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : subscriptionStatus === 'past_due'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {subscriptionStatus}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-400">
              Workspace Execution Plan & Atomic Daily Limits
            </p>
          </div>

          <div className="flex items-center gap-3">
            {isPaid && (
              <button
                onClick={handleOpenPortal}
                disabled={portalLoading}
                className="px-4 py-2 text-sm font-medium bg-slate-800 hover:bg-slate-700 text-white rounded-xl border border-slate-700 transition-all disabled:opacity-50"
              >
                {portalLoading ? 'Opening Portal...' : 'Manage Billing & Invoices'}
              </button>
            )}
            <Link
              href="/pricing"
              className="px-4 py-2 text-sm font-medium bg-teal-600 hover:bg-teal-500 text-white rounded-xl shadow-lg transition-all"
            >
              Compare All Plans
            </Link>
          </div>
        </div>

        {currentPeriodEnd && (
          <div className="mt-4 text-xs text-slate-400 flex items-center justify-between">
            <span>
              {cancelAtPeriodEnd ? 'Cancels on:' : 'Renews on:'}{' '}
              {new Date(currentPeriodEnd).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
            <span>Resets daily at 00:00 UTC</span>
          </div>
        )}
      </div>

      {/* 2. Daily Quotas Breakdown */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-xl font-bold text-white">Daily Quota Usage</h3>
            <p className="text-sm text-slate-400 mt-0.5">
              Live consumption against UTC daily reset windows
            </p>
          </div>
          <span className="text-xs px-3 py-1 bg-slate-800 text-slate-300 rounded-lg border border-slate-700">
            Resets at 00:00 UTC
          </span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-500 text-sm">
            Loading real-time usage metrics...
          </div>
        ) : usageSummary ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {(Object.keys(METRIC_LABELS) as QuotaResourceType[]).map((key) => {
              const metric = usageSummary.metrics[key];
              if (!metric) return null;

              const isUnlimited = metric.limit < 0;
              const percent = isUnlimited
                ? 0
                : Math.min(100, Math.round((metric.current / Math.max(1, metric.limit)) * 100));

              const isNearLimit = !isUnlimited && percent >= 80;
              const isMaxed = !isUnlimited && percent >= 100;

              return (
                <div
                  key={key}
                  className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                        <span>{METRIC_LABELS[key].icon}</span>
                        <span>{METRIC_LABELS[key].label}</span>
                      </span>
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded ${
                          isMaxed
                            ? 'bg-rose-500/20 text-rose-400'
                            : isNearLimit
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {isUnlimited ? 'Unlimited' : `${metric.current} / ${metric.limit}`}
                      </span>
                    </div>

                    {!isUnlimited && (
                      <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden mt-3">
                        <div
                          className={`h-full transition-all duration-300 ${
                            isMaxed
                              ? 'bg-rose-500'
                              : isNearLimit
                              ? 'bg-amber-500'
                              : 'bg-teal-500'
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800/80 flex justify-between text-xs text-slate-500">
                    <span>
                      {isUnlimited
                        ? 'Unthrottled capacity'
                        : `${metric.remaining} remaining today`}
                    </span>
                    {isNearLimit && !isUnlimited && (
                      <span className="text-amber-400 font-medium">Near Limit</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-8 text-center text-slate-500 text-sm">
            Failed to load usage data.
          </div>
        )}
      </div>

      {/* 3. Embedded Quick Upgrade Cards */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <h3 className="text-xl font-bold text-white mb-2">Available Execution Tiers</h3>
        <p className="text-sm text-slate-400 mb-6">
          Instantly expand daily lead, outreach, publishing, and MCP capacity
        </p>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {PUBLIC_PRICING_PLANS.map((plan) => {
            const isCurrent = currentPlan.toLowerCase() === plan.id;

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
                    ${plan.price}
                    <span className="text-xs font-normal text-slate-400">/mo</span>
                  </p>
                  <p className="text-xs text-slate-400 mt-2 line-clamp-2">{plan.tagline}</p>
                </div>

                <div className="mt-6">
                  {isCurrent ? (
                    <button
                      disabled
                      className="w-full py-2 text-xs font-semibold bg-slate-800 text-slate-400 rounded-lg cursor-not-allowed"
                    >
                      Active Plan
                    </button>
                  ) : plan.id === 'free' ? (
                    <button
                      disabled
                      className="w-full py-2 text-xs font-semibold bg-slate-800 text-slate-400 rounded-lg cursor-not-allowed"
                    >
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
