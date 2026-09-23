'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { analyticsService } from '@/services/analyticsService';
import { AlphaIcon } from '@/components/marketing/icons';
import MarketingFaqAccordion from '@/components/marketing/MarketingFaqAccordion';
import MarketingPricingToggle, { type BillingPeriod } from '@/components/marketing/MarketingPricingToggle';
import { PUBLIC_PRICING_PLANS } from '@/config/pricingPlans';
import { PRO_DAILY_LIMIT } from '@/lib/entitlements/planEntitlements';
import { ConversionBanner } from './ConversionBanner';
import { MarketingContainer, MarketingSection, SectionHeading } from './LayoutPrimitives';

const PRO_DAILY = `${PRO_DAILY_LIMIT} / day`;
const UNLIMITED = 'Unlimited*';

const pricingFaqs = [
  {
    question: 'How do daily action resets work?',
    answer:
      'Daily execution counters (leads, outreach, social posts, emails, MCP executions, documents) reset every day at 00:00 UTC. Read-only actions like viewing CRM records or checking status never consume quota.',
  },
  {
    question: 'Which plan should I choose?',
    answer:
      'Starter is the entry plan for getting core workflows connected. Pro is designed for active founders and teams. Enterprise provides the highest execution capacity and support.',
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
    question: 'What does Enterprise capacity mean?',
    answer:
      'Enterprise provides the highest AlphaClone execution capacity and support. External provider API limits, anti-spam safeguards, and platform safety rules still apply.',
  },
];

interface ComparisonCategory {
  category: string;
  rows: {
    feature: string;
    starter: string | boolean;
    pro: string | boolean;
    enterprise: string | boolean;
  }[];
}

const detailedComparison: ComparisonCategory[] = [
  {
    category: 'Daily Execution Limits (per action category)',
    rows: [
      { feature: 'Emails Sent', starter: PRO_DAILY, pro: PRO_DAILY, enterprise: UNLIMITED },
      { feature: 'Leads Added', starter: PRO_DAILY, pro: PRO_DAILY, enterprise: UNLIMITED },
      { feature: 'CRM Create / Update Actions', starter: PRO_DAILY, pro: PRO_DAILY, enterprise: UNLIMITED },
      { feature: 'Outreach Actions', starter: PRO_DAILY, pro: PRO_DAILY, enterprise: UNLIMITED },
      { feature: 'Social Publishing Actions', starter: PRO_DAILY, pro: PRO_DAILY, enterprise: UNLIMITED },
      { feature: 'Documents / Contracts / Proposals / Invoices', starter: PRO_DAILY, pro: PRO_DAILY, enterprise: UNLIMITED },
      { feature: 'Automation Executions', starter: PRO_DAILY, pro: PRO_DAILY, enterprise: UNLIMITED },
      { feature: 'MCP Write / Execution Actions', starter: PRO_DAILY, pro: PRO_DAILY, enterprise: UNLIMITED },
      { feature: 'Bulk Lead Import Maximum', starter: PRO_DAILY, pro: PRO_DAILY, enterprise: UNLIMITED },
    ],
  },
  {
    category: 'Platform Access',
    rows: [
      { feature: 'CRM & Lead Management', starter: true, pro: true, enterprise: true },
      { feature: 'Contracts & E-Signatures', starter: true, pro: true, enterprise: true },
      { feature: 'Invoices & Quotations', starter: true, pro: true, enterprise: true },
      { feature: 'Projects & Delivery Tasks', starter: true, pro: true, enterprise: true },
      { feature: 'Native Calendar & Booking', starter: true, pro: true, enterprise: true },
      { feature: 'Model Context Protocol (MCP) Access', starter: true, pro: true, enterprise: true },
      { feature: 'Bonnie AI Assistant', starter: true, pro: true, enterprise: true },
      { feature: 'Read-Only Views (CRM, reports, inbox)', starter: 'Unlimited', pro: 'Unlimited', enterprise: 'Unlimited' },
    ],
  },
  {
    category: 'Support & Infrastructure',
    rows: [
      { feature: 'Priority Processing & Support', starter: false, pro: true, enterprise: 'Dedicated + SLA' },
      { feature: 'Connected Integrations', starter: true, pro: true, enterprise: true },
    ],
  },
];

function RenderCell({ val }: { val: string | boolean }) {
  if (typeof val === 'boolean') {
    return val ? (
      <AlphaIcon name="check" variant="trust" size="md" title="Included" decorative={false} className="mx-auto text-[var(--marketing-accent-hover)]" />
    ) : (
      <span className="text-[var(--marketing-text-muted)] font-mono type-ui" aria-label="Not included">
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
              Starter $15 · Pro $45 · Enterprise $80. Choose the execution capacity that fits your business.
            </p>
            <div className="mt-8 flex justify-center">
              <MarketingPricingToggle value={billingPeriod} onChange={setBillingPeriod} />
            </div>
          </div>
        </MarketingContainer>
      </MarketingSection>

      <MarketingSection tone="muted" className="pt-2">
        <MarketingContainer>
          <div className="grid gap-6 md:grid-cols-3 items-stretch">
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
                        <span className="rounded-full bg-[var(--marketing-accent)] px-3 py-1 type-caption font-bold text-white tracking-wide uppercase">
                          {plan.badge}
                        </span>
                      </div>
                    ) : (
                      <div className="h-7 mb-3" />
                    )}

                    <h2 className="text-2xl font-bold text-[var(--marketing-text-primary)]">{plan.name}</h2>
                    <p className="mt-2 type-caption text-[var(--marketing-text-secondary)] leading-relaxed min-h-[40px]">
                      {plan.tagline}
                    </p>

                    <div className="mt-6 border-b border-[var(--marketing-border)] pb-6">
                      <div className="flex items-baseline">
                        <>
                            <span className="text-4xl font-extrabold text-[var(--marketing-text-primary)]">
                              ${displayPrice}
                            </span>
                            <span className="ml-1 type-ui font-medium text-[var(--marketing-text-muted)]">
                              {priceSuffix}
                            </span>
                        </>
                      </div>
                      <p className="mt-2 type-card-description text-[var(--marketing-text-muted)]">
                        {plan.id === 'enterprise'
                          ? `$${displayPrice}${priceSuffix} · no AlphaClone usage ceiling`
                          : billingPeriod === 'annual'
                          ? `$${Math.round(plan.yearly / 12)}/mo billed annually`
                          : 'Billed monthly'}
                      </p>
                    </div>

                    <ul className="mt-6 space-y-3">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex gap-2.5 type-caption text-[var(--marketing-text-secondary)]">
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
                      className={`mkt-btn w-full text-center type-ui font-semibold py-3 rounded-xl transition-all ${
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
          <p className="mt-6 text-center type-card-description text-[var(--marketing-text-muted)] max-w-4xl mx-auto leading-relaxed">
            *Enterprise execution remains subject to external provider API restrictions, anti-spam rules, and platform safety safeguards.
          </p>
        </MarketingContainer>
      </MarketingSection>

      <MarketingSection>
        <MarketingContainer>
          <SectionHeading
            eyebrow="Detailed Breakdown"
            title="Compare Execution Power Across Plans"
            description="The same connected platform, with capacity and support that scale from Starter to Enterprise."
          />

          <div className="mt-8 overflow-x-auto rounded-2xl border border-[var(--marketing-border)] shadow-sm" role="region" aria-label="AlphaClone plan comparison" tabIndex={0}>
            <table className="w-full min-w-[640px] bg-[var(--marketing-surface)] type-ui">
              <thead>
                <tr className="border-b border-[var(--marketing-border)] bg-[var(--marketing-surface-elevated)]">
                  <th className="p-4 text-left font-bold text-[var(--marketing-text-primary)] w-2/5">Execution Capability</th>
                  <th className="p-4 text-center font-bold text-[var(--marketing-text-primary)]">Starter ($15)</th>
                  <th className="p-4 text-center font-bold text-[var(--marketing-accent-hover)] bg-[var(--marketing-accent-soft)]">Pro ($45)</th>
                  <th className="p-4 text-center font-bold text-[var(--marketing-text-primary)]">Enterprise ($80)</th>
                </tr>
              </thead>
              <tbody>
                {detailedComparison.map((cat) => (
                  <tr key={cat.category} className="border-b border-[var(--marketing-border)]">
                    <td colSpan={4} className="p-0">
                      <div className="bg-[var(--marketing-surface-muted)] px-4 py-2 type-caption font-bold uppercase tracking-wider text-[var(--marketing-text-muted)] border-y border-[var(--marketing-border)]">
                        {cat.category}
                      </div>
                      <table className="w-full">
                        <tbody>
                          {cat.rows.map((row) => (
                            <tr key={row.feature} className="border-b border-[var(--marketing-border)] last:border-0 hover:bg-[var(--marketing-surface-hover)]">
                              <td className="p-4 text-left font-medium text-[var(--marketing-text-secondary)] w-2/5">{row.feature}</td>
                              <td className="p-4 text-center"><RenderCell val={row.starter} /></td>
                              <td className="p-4 text-center bg-[var(--marketing-accent-soft)]"><RenderCell val={row.pro} /></td>
                              <td className="p-4 text-center"><RenderCell val={row.enterprise} /></td>
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
            description="Get started with Starter at $15, scale to Pro at $45, or choose Enterprise at $80."
          />
        </MarketingContainer>
      </MarketingSection>
    </main>
  );
}
