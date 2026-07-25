'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import MarketingFaqAccordion from '@/components/marketing/MarketingFaqAccordion';
import MarketingPricingToggle, { type BillingPeriod } from '@/components/marketing/MarketingPricingToggle';
import { PUBLIC_PRICING_PLANS, PRICING_FROM } from '@/config/pricingPlans';
import { ConversionBanner } from './ConversionBanner';
import { MarketingContainer, MarketingSection, SectionHeading } from './LayoutPrimitives';

const pricingFaqs = [
  {
    question: 'Is there a free trial?',
    answer:
      'Yes. New business workspaces can start a 14-day trial before choosing a paid plan.',
  },
  {
    question: 'Do I need a credit card to start?',
    answer:
      'No. You can begin the trial without entering card details.',
  },
  {
    question: 'What is included in every plan?',
    answer:
      'Every plan includes the connected operating workspace: CRM, projects, contracts, billing context, meetings, storage, and core workflow automation.',
  },
  {
    question: 'Can I change plans later?',
    answer:
      'Yes. You can change plans from billing as your team size, storage needs, or support requirements change.',
  },
  {
    question: 'What happens if I cancel?',
    answer:
      'You can cancel from account billing controls. Access and retention follow the current plan and published policy terms.',
  },
];

const comparisonRows = [
  { capability: 'CRM and deal pipeline', starter: true, pro: true, enterprise: true },
  { capability: 'Projects and delivery tasks', starter: true, pro: true, enterprise: true },
  { capability: 'Contracts, billing context, and documents', starter: true, pro: true, enterprise: true },
  { capability: 'Native video meetings', starter: true, pro: true, enterprise: true },
  { capability: 'Bonnie AI sales assistant', starter: false, pro: true, enterprise: true },
  { capability: 'API access and custom domain', starter: false, pro: true, enterprise: true },
  { capability: 'Dedicated onboarding', starter: false, pro: false, enterprise: true },
];

function CheckMark({ enabled }: { enabled: boolean }) {
  return enabled ? (
    <CheckCircle2 className="mx-auto h-5 w-5 text-[var(--marketing-accent-hover)]" aria-label="Included" />
  ) : (
    <span className="text-[var(--marketing-text-muted)]" aria-label="Not included">
      -
    </span>
  );
}

export default function PricingPage() {
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly');

  return (
    <main className="bg-[var(--marketing-bg-primary)]">
      <MarketingSection className="relative overflow-hidden pt-16 sm:pt-20">
        <div className="marketing-glow-hero" aria-hidden="true" />
        <MarketingContainer className="relative z-10">
          <div className="mx-auto max-w-4xl text-center">
            <p className="mkt-label mb-5">Transparent pricing</p>
            <h1>Run your client business from one workspace</h1>
            <p className="mx-auto mt-5 max-w-3xl text-lg sm:text-xl text-[var(--marketing-text-secondary)]">
              Plans start at ${PRICING_FROM}/month. Try AlphaClone for 14 days, then choose the
              workspace tier that matches your team and storage needs.
            </p>
            <div className="mt-8 flex justify-center">
              <MarketingPricingToggle value={billingPeriod} onChange={setBillingPeriod} />
            </div>
          </div>
        </MarketingContainer>
      </MarketingSection>

      <MarketingSection tone="muted" className="pt-0">
        <MarketingContainer>
          <div className="grid gap-5 lg:grid-cols-3">
            {PUBLIC_PRICING_PLANS.map((plan) => {
              const displayPrice = billingPeriod === 'monthly' ? plan.price : plan.yearly;
              const priceSuffix = billingPeriod === 'monthly' ? '/month' : '/year';
              const annualSavings = Math.round((1 - plan.yearly / (plan.price * 12)) * 100);

              return (
                <article
                  key={plan.id}
                  className={`mkt-surface-elevated flex h-full flex-col p-6 ${
                    plan.highlight ? 'border-[rgba(20,184,166,0.42)] shadow-[var(--marketing-shadow-hero)]' : ''
                  }`}
                >
                  {plan.badge ? (
                    <p className="mb-4 w-fit rounded-full bg-[var(--marketing-accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--marketing-accent-hover)]">
                      {plan.badge}
                    </p>
                  ) : null}
                  <h2 className="text-2xl font-semibold text-[var(--marketing-text-primary)]">{plan.name}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--marketing-text-secondary)]">
                    {plan.tagline}
                  </p>

                  <div className="mt-6">
                    <span className="text-4xl font-bold text-[var(--marketing-text-primary)]">
                      ${displayPrice}
                    </span>
                    <span className="ml-2 text-sm font-medium text-[var(--marketing-text-muted)]">
                      {priceSuffix}
                    </span>
                    {billingPeriod === 'annual' ? (
                      <p className="mt-2 text-sm text-[var(--marketing-accent-hover)]">
                        About ${Math.round(plan.yearly / 12)}/month equivalent.
                      </p>
                    ) : (
                      <p className="mt-2 text-sm text-[var(--marketing-text-muted)]">
                        Annual billing saves {annualSavings}%.
                      </p>
                    )}
                  </div>

                  <ul className="mt-6 flex-1 space-y-3">
                    {plan.features.map((feature) => {
                      const isGroupLabel = feature.endsWith('plus:');
                      return (
                        <li
                          key={feature}
                          className={`flex gap-3 text-sm leading-relaxed ${
                            isGroupLabel
                              ? 'font-semibold text-[var(--marketing-text-primary)]'
                              : 'text-[var(--marketing-text-secondary)]'
                          }`}
                        >
                          {isGroupLabel ? null : (
                            <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--marketing-accent-hover)]" aria-hidden="true" />
                          )}
                          <span>{feature}</span>
                        </li>
                      );
                    })}
                  </ul>

                  <Link
                    href={plan.ctaLink}
                    className={`mkt-btn mt-8 w-full ${
                      plan.highlight ? 'mkt-btn-primary' : 'mkt-btn-secondary'
                    }`}
                  >
                    {plan.cta}
                  </Link>
                </article>
              );
            })}
          </div>
        </MarketingContainer>
      </MarketingSection>

      <MarketingSection>
        <MarketingContainer>
          <SectionHeading
            eyebrow="Compare plans"
            title="A simplified feature comparison"
            description="The main difference is team scale, automation depth, support level, and storage headroom."
          />
          <div className="overflow-x-auto rounded-[var(--marketing-radius-lg)] border border-[var(--marketing-border)]">
            <table className="w-full min-w-[720px] bg-[var(--marketing-surface)] text-sm">
              <thead>
                <tr className="border-b border-[var(--marketing-border)]">
                  <th className="p-4 text-left font-semibold text-[var(--marketing-text-primary)]">Capability</th>
                  <th className="p-4 text-center font-semibold text-[var(--marketing-text-primary)]">Starter</th>
                  <th className="p-4 text-center font-semibold text-[var(--marketing-text-primary)]">Pro</th>
                  <th className="p-4 text-center font-semibold text-[var(--marketing-text-primary)]">Enterprise</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row) => (
                  <tr key={row.capability} className="border-b border-[var(--marketing-border)] last:border-0">
                    <td className="p-4 text-[var(--marketing-text-secondary)]">{row.capability}</td>
                    <td className="p-4 text-center"><CheckMark enabled={row.starter} /></td>
                    <td className="p-4 text-center"><CheckMark enabled={row.pro} /></td>
                    <td className="p-4 text-center"><CheckMark enabled={row.enterprise} /></td>
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
            title="Pricing questions"
            description="Plain answers before you start a workspace."
          />
          <div className="mx-auto max-w-3xl">
            <MarketingFaqAccordion items={pricingFaqs} />
          </div>
        </MarketingContainer>
      </MarketingSection>

      <MarketingSection tone="accent">
        <MarketingContainer>
          <ConversionBanner
            title="Ready to test AlphaClone with a real workflow?"
            description="Start a 14-day trial without a credit card, or book a live walkthrough before you decide."
          />
        </MarketingContainer>
      </MarketingSection>
    </main>
  );
}
