'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { analyticsService } from '@/services/analyticsService';
import { AlphaIcon } from '@/components/marketing/icons';
import MarketingFaqAccordion from '@/components/marketing/MarketingFaqAccordion';
import MarketingPricingToggle, { type BillingPeriod } from '@/components/marketing/MarketingPricingToggle';
import { PUBLIC_PRICING_PLANS } from '@/config/pricingPlans';
import { FREE_DAILY_LIMIT, PRO_DAILY_LIMIT } from '@/lib/entitlements/planEntitlements';
import { ConversionBanner } from './ConversionBanner';
import { MarketingContainer, MarketingSection, SectionHeading } from './LayoutPrimitives';

const DAILY = `${FREE_DAILY_LIMIT} / day`;
const PRO_DAILY = `${PRO_DAILY_LIMIT} / day`;
const UNLIMITED = 'Unlimited*';

const pricingFaqs = [
  {
    question: 'How do daily action resets work?',
    answer:
      'Daily execution counters (leads, outreach, social posts, emails, MCP executions, documents) reset every day at 00:00 UTC. Read-only actions like viewing CRM records or checking status never consume quota.',
  },
  {
    question: 'Do I need a credit card to start on the Free plan?',
    answer:
      'No credit card is required for the Free plan. You can sign up and start executing work right away.',
  },
  {
    question: 'What is included in every AlphaClone plan?',
    answer:
      'Every plan gives you full access to the AlphaClone workspace platform and MCP tools — CRM, projects, contracts, documents, calendar, and AI agents. Plans differ only by daily execution capacity per action category.',
  },
  {
    question: 'Can I upgrade or downgrade anytime?',
    answer:
      'Yes. Upgrades apply immediately with prorated billing via Stripe. Downgrades take effect at the end of your current billing period.',
  },
  {
    question: 'What does Premium Unlimited mean?',
    answer:
      'Premium has no AlphaClone subscription usage ceiling. Usage is still tracked for analytics, but actions are never blocked by plan quota. External provider API limits, anti-spam safeguards, and platform safety rules still apply — and those are clearly distinguished from plan limits.',
  },
];

interface ComparisonCategory {
  category: string;
  rows: {
    feature: string;
    free: string | boolean;
    pro: string | boolean;
    premium: string | boolean;
  }[];
}

const detailedComparison: ComparisonCategory[] = [
  {
    category: 'Daily Execution Limits (per action category)',
    rows: [
      { feature: 'Emails Sent', free: DAILY, pro: PRO_DAILY, premium: UNLIMITED },
      { feature: 'Leads Added', free: DAILY, pro: PRO_DAILY, premium: UNLIMITED },
      { feature: 'CRM Create / Update Actions', free: DAILY, pro: PRO_DAILY, premium: UNLIMITED },
      { feature: 'Outreach Actions', free: DAILY, pro: PRO_DAILY, premium: UNLIMITED },
      { feature: 'Social Publishing Actions', free: DAILY, pro: PRO_DAILY, premium: UNLIMITED },
      { feature: 'Documents / Contracts / Proposals / Invoices', free: DAILY, pro: PRO_DAILY, premium: UNLIMITED },
      { feature: 'Automation Executions', free: DAILY, pro: PRO_DAILY, premium: UNLIMITED },
      { feature: 'MCP Write / Execution Actions', free: DAILY, pro: PRO_DAILY, premium: UNLIMITED },
      { feature: 'Bulk Lead Import Maximum', free: DAILY, pro: PRO_DAILY, premium: UNLIMITED },
    ],
  },
  {
    category: 'Platform Access',
    rows: [
      { feature: 'CRM & Lead Management', free: true, pro: true, premium: true },
      { feature: 'Contracts & E-Signatures', free: true, pro: true, premium: true },
      { feature: 'Invoices & Quotations', free: true, pro: true, premium: true },
      { feature: 'Projects & Delivery Tasks', free: true, pro: true, premium: true },
      { feature: 'Native Calendar & Booking', free: true, pro: true, premium: true },
      { feature: 'Model Context Protocol (MCP) Access', free: true, pro: true, premium: true },
      { feature: 'Bonnie AI Assistant', free: true, pro: true, premium: true },
      { feature: 'Read-Only Views (CRM, reports, inbox)', free: 'Unlimited', pro: 'Unlimited', premium: 'Unlimited' },
    ],
  },
  {
    category: 'Support & Infrastructure',
    rows: [
      { feature: 'Priority Processing & Support', free: false, pro: true, premium: 'Dedicated + SLA' },
      { feature: 'Connected Integrations', free: true, pro: true, premium: true },
    ],
  },
];

function RenderCell({ val }: { val: string | boolean }) {
  if (typeof val === 'boolean') {
    return val ? (
      <AlphaIcon name="check" variant="trust" size="md" title="Included" decorative={false} className="mx-auto text-[var(--marketing-accent-hover)]" />
    ) : (
      <span className="text-[var(--marketing-text-muted)] font-mono text-sm" aria-label="Not included">
        —
      </span>
    );
  }
  return <span className="font-medium text-[var(--marketing-text-primary)]">{val}</span>;
}

export default function PricingPage() {
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly');

  useEffect(() => {
    analyticsService.pricingAnalytics.trackEvent('pricing_page_viewed', {
      billing_period: billingPeriod,
    });
  }, []);

  const handlePlanClick = (planId: string, planName: string) => {
    analyticsService.pricingAnalytics.trackEvent('plan_selected', {
      plan_id: planId,
      plan_name: planName,
      billing_period: billingPeriod,
    });
  };

  return (
    <main className="bg-[var(--marketing-bg-primary)]">
      <MarketingSection className="relative overflow-hidden pt-16 sm:pt-20">
        <div className="marketing-glow-hero" aria-hidden="true" />
        <MarketingContainer className="relative z-10">
          <div className="mx-auto max-w-4xl text-center">
            <p className="mkt-eyebrow mb-4">Same platform. Different execution power.</p>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl text-[var(--marketing-text-primary)]">
              One system. Choose your execution power.
            </h1>
            <p className="mx-auto mt-5 max-w-3xl text-base sm:text-lg text-[var(--marketing-text-secondary)] leading-relaxed">
              Free = {FREE_DAILY_LIMIT}/day · Pro = {PRO_DAILY_LIMIT}/day · Premium = truly unlimited per action category.
            </p>
            <div className="mt-8 flex justify-center">
              <MarketingPricingToggle value={billingPeriod} onChange={setBillingPeriod} />
            </div>
          </div>
        </MarketingContainer>
      </MarketingSection>

      <MarketingSection tone="muted" className="pt-2">
        <MarketingContainer>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 items-stretch">
            {PUBLIC_PRICING_PLANS.map((plan) => {
              const displayPrice = billingPeriod === 'monthly' ? plan.price : plan.yearly;
              const priceSuffix = plan.price === 0 ? '' : billingPeriod === 'monthly' ? '/mo' : '/yr';

              return (
                <article
                  key={plan.id}
                  className={`mkt-surface-elevated flex flex-col justify-between p-6 rounded-2xl transition-all duration-200 border ${
                    plan.highlight
                      ? 'border-[var(--marketing-accent)] ring-2 ring-[var(--marketing-accent-soft)] shadow-xl bg-[var(--marketing-surface)] relative -translate-y-1'
                      : 'border-[var(--marketing-border)] bg-[var(--marketing-surface-elevated)]'
                  }`}
                >
                  <div>
                    {plan.badge ? (
                      <div className="mb-3 flex justify-between items-center">
                        <span className="rounded-full bg-[var(--marketing-accent)] px-3 py-1 text-xs font-bold text-white tracking-wide uppercase">
                          {plan.badge}
                        </span>
                      </div>
                    ) : (
                      <div className="h-7 mb-3" />
                    )}

                    <h2 className="text-2xl font-bold text-[var(--marketing-text-primary)]">{plan.name}</h2>
                    <p className="mt-2 text-xs text-[var(--marketing-text-secondary)] leading-relaxed min-h-[40px]">
                      {plan.tagline}
                    </p>

                    <div className="mt-6 border-b border-[var(--marketing-border)] pb-6">
                      <div className="flex items-baseline">
                        {plan.id === 'premium' ? (
                          <span className="text-3xl font-extrabold text-[var(--marketing-text-primary)]">Unlimited</span>
                        ) : (
                          <>
                            <span className="text-4xl font-extrabold text-[var(--marketing-text-primary)]">
                              ${displayPrice}
                            </span>
                            <span className="ml-1 text-sm font-medium text-[var(--marketing-text-muted)]">
                              {priceSuffix}
                            </span>
                          </>
                        )}
                      </div>
                      <p className="mt-2 text-xs text-[var(--marketing-text-muted)]">
                        {plan.price === 0
                          ? 'No credit card required'
                          : plan.id === 'premium'
                          ? `$${displayPrice}${priceSuffix} · no AlphaClone usage ceiling`
                          : billingPeriod === 'annual'
                          ? `$${Math.round(plan.yearly / 12)}/mo billed annually`
                          : 'Billed monthly'}
                      </p>
                    </div>

                    <ul className="mt-6 space-y-3">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex gap-2.5 text-xs text-[var(--marketing-text-secondary)]">
                          <AlphaIcon name="check" variant="trust" size="sm" className="mt-0.5 shrink-0 text-[var(--marketing-accent-hover)]" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-8">
                    <Link
                      href={plan.ctaLink}
                      onClick={() => handlePlanClick(plan.id, plan.name)}
                      className={`mkt-btn w-full text-center text-sm font-semibold py-3 rounded-xl transition-all ${
                        plan.highlight
                          ? 'mkt-btn-primary bg-[var(--marketing-accent)] text-white hover:bg-[var(--marketing-accent-hover)] shadow-md'
                          : 'mkt-btn-secondary border border-[var(--marketing-border)] text-[var(--marketing-text-primary)] hover:bg-[var(--marketing-surface-hover)]'
                      }`}
                    >
                      {plan.cta}
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>

          <p className="mt-6 text-center text-xs text-[var(--marketing-text-muted)] max-w-4xl mx-auto leading-relaxed">
            *Premium is unlimited on AlphaClone. External provider API restrictions, anti-spam rules, and platform safety safeguards still apply.
          </p>
        </MarketingContainer>
      </MarketingSection>

      <MarketingSection>
        <MarketingContainer>
          <SectionHeading
            eyebrow="Detailed Breakdown"
            title="Compare Execution Power Across Plans"
            description="Same core platform. Free and Pro use fixed daily limits per category. Premium has no AlphaClone subscription ceiling."
          />

          <div className="mt-8 overflow-x-auto rounded-2xl border border-[var(--marketing-border)] shadow-sm">
            <table className="w-full min-w-[640px] bg-[var(--marketing-surface)] text-sm">
              <thead>
                <tr className="border-b border-[var(--marketing-border)] bg-[var(--marketing-surface-elevated)]">
                  <th className="p-4 text-left font-bold text-[var(--marketing-text-primary)] w-2/5">Execution Capability</th>
                  <th className="p-4 text-center font-bold text-[var(--marketing-text-primary)]">Free</th>
                  <th className="p-4 text-center font-bold text-[var(--marketing-accent-hover)] bg-[var(--marketing-accent-soft)]">Pro ($45)</th>
                  <th className="p-4 text-center font-bold text-[var(--marketing-text-primary)]">Premium ($80)</th>
                </tr>
              </thead>
              <tbody>
                {detailedComparison.map((cat) => (
                  <tr key={cat.category} className="border-b border-[var(--marketing-border)]">
                    <td colSpan={4} className="p-0">
                      <div className="bg-[var(--marketing-surface-muted)] px-4 py-2 text-xs font-bold uppercase tracking-wider text-[var(--marketing-text-muted)] border-y border-[var(--marketing-border)]">
                        {cat.category}
                      </div>
                      <table className="w-full">
                        <tbody>
                          {cat.rows.map((row) => (
                            <tr key={row.feature} className="border-b border-[var(--marketing-border)] last:border-0 hover:bg-[var(--marketing-surface-hover)]">
                              <td className="p-4 text-left font-medium text-[var(--marketing-text-secondary)] w-2/5">{row.feature}</td>
                              <td className="p-4 text-center w-1/5"><RenderCell val={row.free} /></td>
                              <td className="p-4 text-center w-1/5 bg-[rgba(20,184,166,0.03)]"><RenderCell val={row.pro} /></td>
                              <td className="p-4 text-center w-1/5"><RenderCell val={row.premium} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </MarketingContainer>
      </MarketingSection>

      <MarketingSection tone="muted">
        <MarketingContainer>
          <SectionHeading
            eyebrow="FAQ"
            title="Frequently Asked Questions"
            description="Clear answers about billing cycles, daily limits, and plan upgrades."
          />
          <div className="mx-auto max-w-3xl">
            <MarketingFaqAccordion items={pricingFaqs} />
          </div>
        </MarketingContainer>
      </MarketingSection>

      <MarketingSection tone="accent">
        <MarketingContainer>
          <ConversionBanner
            title="Find leads. Run outreach. Manage clients. Publish content. Execute work."
            description="Start free with 50/day per category, scale to Pro at 300/day, or go Premium for truly unlimited execution."
          />
        </MarketingContainer>
      </MarketingSection>
    </main>
  );
}
