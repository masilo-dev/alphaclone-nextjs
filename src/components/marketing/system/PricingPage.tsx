'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { analyticsService } from '@/services/analyticsService';
import { AlphaIcon } from '@/components/marketing/icons';
import MarketingFaqAccordion from '@/components/marketing/MarketingFaqAccordion';
import MarketingPricingToggle, { type BillingPeriod } from '@/components/marketing/MarketingPricingToggle';
import { PUBLIC_PRICING_PLANS } from '@/config/pricingPlans';
import { ConversionBanner } from './ConversionBanner';
import { MarketingContainer, MarketingSection, SectionHeading } from './LayoutPrimitives';

const pricingFaqs = [
  {
    question: 'How do daily action resets work?',
    answer:
      'Daily execution counters (leads, outreach, social posts, email actions, MCP executions) automatically reset every day at 00:00 UTC.',
  },
  {
    question: 'Do I need a credit card to start on the Free plan?',
    answer:
      'No credit card is required for the Free plan. You can sign up and start executing work right away.',
  },
  {
    question: 'What is included in every AlphaClone plan?',
    answer:
      'Every plan gives you full access to the AlphaClone workspace platform and MCP tools — CRM, projects, contracts, documents, calendar, and AI agents. You simply pick the daily execution power your business requires.',
  },
  {
    question: 'Can I upgrade or downgrade anytime?',
    answer:
      'Yes. Upgrades apply immediately with prorated billing via Stripe. Downgrades take effect at the end of your current billing period.',
  },
  {
    question: 'What does "Unlimited*" mean on Enterprise?',
    answer:
      'Enterprise provides unthrottled headroom for high-volume workflows. Actions remain subject to platform fair-use safeguards, provider API limits, and email deliverability safeguards.',
  },
];

interface ComparisonCategory {
  category: string;
  rows: {
    feature: string;
    free: string | boolean;
    starter: string | boolean;
    pro: string | boolean;
    enterprise: string | boolean;
  }[];
}

const detailedComparison: ComparisonCategory[] = [
  {
    category: 'Business Operations',
    rows: [
      { feature: 'CRM & Lead Management', free: '500 contacts', starter: '5,000 contacts', pro: '25,000 contacts', enterprise: 'Unlimited' },
      { feature: 'Contracts & E-Signatures', free: true, starter: true, pro: true, enterprise: true },
      { feature: 'Invoices & Quotations', free: true, starter: true, pro: true, enterprise: true },
      { feature: 'Projects & Delivery Tasks', free: true, starter: true, pro: true, enterprise: true },
      { feature: 'Native Calendar & Booking', free: true, starter: true, pro: true, enterprise: true },
      { feature: 'Reporting & Analytics', free: 'Basic', starter: 'Standard', pro: 'Advanced', enterprise: 'Advanced + SLA' },
    ],
  },
  {
    category: 'AI & MCP Execution Engine',
    rows: [
      { feature: 'Model Context Protocol (MCP) Access', free: true, starter: true, pro: true, enterprise: true },
      { feature: 'Bonnie AI Assistant', free: true, starter: true, pro: true, enterprise: true },
      { feature: 'Daily MCP / AI Executions', free: '50 / day', starter: '250 / day', pro: '1,500 / day', enterprise: 'Unlimited*' },
      { feature: 'Lead Generation & Scraping', free: '50 / day', starter: '100 / day', pro: '500 / day', enterprise: 'Unlimited*' },
      { feature: 'Automated Workflows & Automations', free: '3 active', starter: '15 active', pro: '50 active', enterprise: 'Unlimited' },
      { feature: 'Autonomous Agent Execution', free: true, starter: true, pro: true, enterprise: true },
    ],
  },
  {
    category: 'Sales & Outreach Engine',
    rows: [
      { feature: 'Daily Lead Additions', free: '50 / day', starter: '100 / day', pro: '500 / day', enterprise: 'Unlimited*' },
      { feature: 'Outreach Actions', free: '20 / day', starter: '100 / day', pro: '500 / day', enterprise: 'Unlimited*' },
      { feature: 'Email Actions', free: '25 / day', starter: '150 / day', pro: '750 / day', enterprise: 'Unlimited*' },
      { feature: 'Automated Multi-Step Follow-ups', free: true, starter: true, pro: true, enterprise: true },
    ],
  },
  {
    category: 'Social Publishing Engine',
    rows: [
      { feature: 'LinkedIn Posts', free: '1 / day', starter: '3 / day', pro: '10 / day', enterprise: 'Unlimited*' },
      { feature: 'Facebook Posts', free: '1 / day', starter: '3 / day', pro: '10 / day', enterprise: 'Unlimited*' },
      { feature: 'Instagram Posts', free: '1 / day', starter: '3 / day', pro: '10 / day', enterprise: 'Unlimited*' },
    ],
  },
  {
    category: 'Integrations & Infrastructure',
    rows: [
      { feature: 'Connected Integrations', free: '3 connected', starter: '10 connected', pro: '25 connected', enterprise: 'Unlimited' },
      { feature: 'Email Accounts (SMTP/Gmail/Outlook)', free: '1 account', starter: '3 accounts', pro: '10 accounts', enterprise: 'Unlimited' },
      { feature: 'Priority Infrastructure & Support', free: false, starter: false, pro: true, enterprise: 'Dedicated + SLA' },
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
      {/* Hero Header */}
      <MarketingSection className="relative overflow-hidden pt-16 sm:pt-20">
        <div className="marketing-glow-hero" aria-hidden="true" />
        <MarketingContainer className="relative z-10">
          <div className="mx-auto max-w-4xl text-center">
            <p className="mkt-eyebrow mb-4">Same platform. Different execution power.</p>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl text-[var(--marketing-text-primary)]">
              One system. Choose your execution power.
            </h1>
            <p className="mx-auto mt-5 max-w-3xl text-base sm:text-lg text-[var(--marketing-text-secondary)] leading-relaxed">
              Every AlphaClone plan includes a <strong className="text-[var(--marketing-text-primary)]">14-day free trial</strong> with no credit card required.
              Upgrade when your business needs more execution capacity.
            </p>
            <div className="mt-8 flex justify-center">
              <MarketingPricingToggle value={billingPeriod} onChange={setBillingPeriod} />
            </div>
          </div>
        </MarketingContainer>
      </MarketingSection>

      {/* 4 Plan Cards */}
      <MarketingSection tone="muted" className="pt-2">
        <MarketingContainer>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 items-stretch">
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
                        <span className="text-4xl font-extrabold text-[var(--marketing-text-primary)]">
                          ${displayPrice}
                        </span>
                        <span className="ml-1 text-sm font-medium text-[var(--marketing-text-muted)]">
                          {priceSuffix}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-[var(--marketing-text-muted)]">
                        {plan.price === 0
                          ? 'No credit card required'
                          : billingPeriod === 'annual'
                          ? `$${Math.round(plan.yearly / 12)}/mo billed annually · 14-day free trial`
                          : '14-day free trial · no card required'}
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
            *Unlimited plans remain subject to fair-use policies, provider API restrictions, infrastructure safeguards, anti-spam rules and third-party platform limits.
          </p>
        </MarketingContainer>
      </MarketingSection>

      {/* Comparison Section */}
      <MarketingSection>
        <MarketingContainer>
          <SectionHeading
            eyebrow="Detailed Breakdown"
            title="Compare Execution Power Across Plans"
            description="Same core platform. Select the capacity that matches your daily automation needs."
          />

          <div className="mt-8 overflow-x-auto rounded-2xl border border-[var(--marketing-border)] shadow-sm">
            <table className="w-full min-w-[800px] bg-[var(--marketing-surface)] text-sm">
              <thead>
                <tr className="border-b border-[var(--marketing-border)] bg-[var(--marketing-surface-elevated)]">
                  <th className="p-4 text-left font-bold text-[var(--marketing-text-primary)] w-1/3">Execution Capability</th>
                  <th className="p-4 text-center font-bold text-[var(--marketing-text-primary)]">Free</th>
                  <th className="p-4 text-center font-bold text-[var(--marketing-text-primary)]">Starter ($29)</th>
                  <th className="p-4 text-center font-bold text-[var(--marketing-accent-hover)] bg-[var(--marketing-accent-soft)]">Pro ($59)</th>
                  <th className="p-4 text-center font-bold text-[var(--marketing-text-primary)]">Enterprise ($149)</th>
                </tr>
              </thead>
              <tbody>
                {detailedComparison.map((cat) => (
                  <tr key={cat.category} className="border-b border-[var(--marketing-border)]">
                    <td colSpan={5} className="p-0">
                      <div className="bg-[var(--marketing-surface-muted)] px-4 py-2 text-xs font-bold uppercase tracking-wider text-[var(--marketing-text-muted)] border-y border-[var(--marketing-border)]">
                        {cat.category}
                      </div>
                      <table className="w-full">
                        <tbody>
                          {cat.rows.map((row) => (
                            <tr key={row.feature} className="border-b border-[var(--marketing-border)] last:border-0 hover:bg-[var(--marketing-surface-hover)]">
                              <td className="p-4 text-left font-medium text-[var(--marketing-text-secondary)] w-1/3">{row.feature}</td>
                              <td className="p-4 text-center w-1/6"><RenderCell val={row.free} /></td>
                              <td className="p-4 text-center w-1/6"><RenderCell val={row.starter} /></td>
                              <td className="p-4 text-center w-1/6 bg-[rgba(20,184,166,0.03)]"><RenderCell val={row.pro} /></td>
                              <td className="p-4 text-center w-1/6"><RenderCell val={row.enterprise} /></td>
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

      {/* FAQ Section */}
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

      {/* Final CTA Banner */}
      <MarketingSection tone="accent">
        <MarketingContainer>
          <ConversionBanner
            title="Find leads. Run outreach. Manage clients. Publish content. Execute work."
            description="Start free in less than 60 seconds or upgrade to Pro for high-volume automated execution."
          />
        </MarketingContainer>
      </MarketingSection>
    </main>
  );
}
