import Link from 'next/link';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { PUBLIC_PRICING_PLANS } from '@/config/pricingPlans';
import { trialHrefForPlan } from '@/lib/marketing/cta';
import { HOMEPAGE_FAQ, HOMEPAGE_PLATFORM_FEATURES } from '@/lib/marketing/productFeatures';
import { CtaPair, PrimaryCTA } from './CtaButtons';
import { ConversionBanner } from './ConversionBanner';
import { FeatureCard, TrustStrip, WorkflowStep } from './FeatureBlocks';
import { MarketingContainer, MarketingSection, SectionHeading } from './LayoutPrimitives';
import MarketingShell from './MarketingShell';
import ProductScreenshot from './ProductScreenshot';

const TRUST_ITEMS = [
  'Built for service businesses',
  'Role-based access',
  'Connected workflows',
  'Published security policy',
];

const WORKFLOW_STEPS = [
  {
    title: 'Capture the relationship',
    body: 'Add leads, contacts, notes, and next steps where sales and delivery can both find them.',
  },
  {
    title: 'Run the work',
    body: 'Turn a qualified customer into projects, tasks, meetings, documents, and invoices without re-entering context.',
  },
  {
    title: 'Review and improve',
    body: 'Use reports and AI-assisted summaries to see what moved, what is blocked, and what needs attention.',
  },
];

const CONNECTED_STORY = [
  'Lead',
  'Customer',
  'Project',
  'Invoice',
  'Document',
  'Reports',
];

const OUTCOMES = [
  'Fewer handoffs between sales, delivery, and billing tools.',
  'A clearer client record from first conversation through paid invoice.',
  'Reusable workflows for follow-up, project delivery, and document handling.',
  'Team access controls that support shared work without sharing everything.',
  'AI assistance that stays tied to reviewable workspace activity.',
  'A simpler path from setup to a working operating rhythm.',
];

const REPRESENTATIVE_WORKFLOWS = [
  {
    title: 'New client intake',
    body: 'Capture a lead, qualify fit, create a customer record, and assign the first delivery tasks.',
  },
  {
    title: 'Delivery to billing',
    body: 'Track project progress, keep contract documents nearby, and prepare an invoice from the same customer context.',
  },
  {
    title: 'Follow-up operations',
    body: 'Use forms, campaigns, and AI-assisted summaries to keep relationship work moving.',
  },
];

export default function MarketingHomePage() {
  return (
    <MarketingShell>
      <MarketingSection className="relative overflow-hidden pb-10 pt-16 sm:pt-20 lg:pt-24">
        <MarketingContainer className="text-center">
          <div className="mx-auto max-w-4xl">
            <p className="mkt-label mb-5">
              The connected business platform for service businesses
            </p>
            <h1 className="font-marketing-heading text-[var(--marketing-text-primary)]">
              Run your entire business on one intelligent platform.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-[var(--marketing-text-secondary)]">
              AlphaClone brings customers, projects, invoices, documents, and AI assistance into a
              single workspace so service teams can manage the full client journey with less tool
              switching.
            </p>
            <CtaPair className="mt-8 justify-center" />
            <p className="mt-5 text-sm text-[var(--marketing-text-muted)]">
              No credit card required &middot; Set up quickly &middot; Cancel anytime
            </p>
          </div>
        </MarketingContainer>
      </MarketingSection>

      <MarketingSection className="pt-0">
        <MarketingContainer>
          <ProductScreenshot
            src="/screenshots/deals-dashboard.png"
            alt="AlphaClone deals dashboard with pipeline stages and demonstration data"
            caption="A connected AlphaClone workspace shown with demonstration data."
            priority
          />
        </MarketingContainer>
      </MarketingSection>

      <MarketingSection className="py-8" tone="muted">
        <MarketingContainer>
          <TrustStrip items={TRUST_ITEMS} />
        </MarketingContainer>
      </MarketingSection>

      <MarketingSection id="platform">
        <MarketingContainer>
          <SectionHeading
            eyebrow="Platform overview"
            title="One workspace for the jobs that keep service businesses moving."
            description="Start with CRM and connect the downstream work: projects, invoices, documents, marketing workflows, and AI assistance."
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {HOMEPAGE_PLATFORM_FEATURES.map((feature) => (
              <FeatureCard key={feature.href} {...feature} />
            ))}
          </div>
        </MarketingContainer>
      </MarketingSection>

      <MarketingSection id="how-it-works" tone="muted">
        <MarketingContainer>
          <SectionHeading
            eyebrow="How it works"
            title="A practical operating flow from first lead to ongoing account work."
            description="AlphaClone is organized around the way service businesses already move work through the company."
          />
          <div className="grid gap-4 md:grid-cols-3">
            {WORKFLOW_STEPS.map((step, index) => (
              <WorkflowStep key={step.title} step={index + 1} title={step.title} body={step.body} />
            ))}
          </div>
        </MarketingContainer>
      </MarketingSection>

      <MarketingSection>
        <MarketingContainer>
          <div className="mkt-surface-elevated p-6 sm:p-8 lg:p-10">
            <SectionHeading
              eyebrow="Connected workflow story"
              title="The client record stays with the work."
              description="A lead can become a customer, open a project, produce an invoice, collect documents, and feed reports without becoming a copy-paste trail across disconnected systems."
              align="left"
            />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
              {CONNECTED_STORY.map((item, index) => (
                <div key={item} className="flex items-center gap-3">
                  <div className="mkt-surface flex min-h-16 flex-1 items-center justify-center px-3 text-center text-sm font-semibold text-[var(--marketing-text-primary)]">
                    {item}
                  </div>
                  {index < CONNECTED_STORY.length - 1 ? (
                    <ArrowRight
                      className="hidden h-4 w-4 shrink-0 text-[var(--marketing-accent-hover)] lg:block"
                      aria-hidden="true"
                    />
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </MarketingContainer>
      </MarketingSection>

      <MarketingSection tone="muted">
        <MarketingContainer>
          <SectionHeading
            eyebrow="Outcomes"
            title="Useful operating improvements without inflated promises."
            description="The goal is simple: make common service business work easier to see, assign, complete, and review."
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {OUTCOMES.map((outcome) => (
              <div key={outcome} className="mkt-surface flex gap-3 p-5">
                <CheckCircle2
                  className="mt-1 h-5 w-5 shrink-0 text-[var(--marketing-accent-hover)]"
                  aria-hidden="true"
                />
                <p className="text-sm leading-6 text-[var(--marketing-text-secondary)]">{outcome}</p>
              </div>
            ))}
          </div>
        </MarketingContainer>
      </MarketingSection>

      <MarketingSection>
        <MarketingContainer>
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
            <SectionHeading
              eyebrow="Evidence"
              title="Representative workflows, not invented testimonials."
              description="These examples show the kinds of connected work AlphaClone is built to support. Explore the results page for more workflow structure."
              align="left"
            />
            <div className="grid gap-4">
              {REPRESENTATIVE_WORKFLOWS.map((workflow) => (
                <article key={workflow.title} className="mkt-surface p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--marketing-accent-hover)]">
                    Representative workflow
                  </p>
                  <h3 className="mt-2 text-lg font-semibold text-[var(--marketing-text-primary)]">
                    {workflow.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-[var(--marketing-text-secondary)]">
                    {workflow.body}
                  </p>
                </article>
              ))}
              <Link
                href="/results"
                className="mkt-btn mkt-btn-secondary justify-self-start"
              >
                View workflow examples
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </MarketingContainer>
      </MarketingSection>

      <MarketingSection tone="accent">
        <MarketingContainer>
          <ConversionBanner />
        </MarketingContainer>
      </MarketingSection>

      <MarketingSection id="pricing">
        <MarketingContainer>
          <SectionHeading
            eyebrow="Pricing preview"
            title="Start with a monthly plan that matches your workspace."
            description="Public pricing is shown monthly. Visit pricing for plan limits, annual options, and full details."
          />
          <div className="grid gap-4 lg:grid-cols-3">
            {PUBLIC_PRICING_PLANS.map((plan) => (
              <article
                key={plan.id}
                className={`mkt-surface flex flex-col p-6 ${
                  plan.highlight ? 'border-[rgba(20,184,166,0.5)]' : ''
                }`}
              >
                {plan.badge ? (
                  <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--marketing-accent-hover)]">
                    {plan.badge}
                  </p>
                ) : null}
                <h3 className="text-xl font-semibold text-[var(--marketing-text-primary)]">
                  {plan.name}
                </h3>
                <p className="mt-2 text-sm leading-6 text-[var(--marketing-text-secondary)]">
                  {plan.tagline}
                </p>
                <p className="mt-5 text-[var(--marketing-text-primary)]">
                  <span className="font-marketing-heading text-4xl font-bold">${plan.price}</span>
                  <span className="text-sm text-[var(--marketing-text-muted)]"> / month</span>
                </p>
                <ul className="mt-5 flex-1 space-y-3">
                  {plan.features.slice(0, 4).map((feature) => (
                    <li key={feature} className="flex gap-3 text-sm text-[var(--marketing-text-secondary)]">
                      <CheckCircle2
                        className="mt-0.5 h-4 w-4 shrink-0 text-[var(--marketing-accent-hover)]"
                        aria-hidden="true"
                      />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <PrimaryCTA href={trialHrefForPlan(plan.id)} className="mt-6 w-full">
                  Start {plan.name} trial
                </PrimaryCTA>
              </article>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link href="/pricing" className="mkt-btn mkt-btn-secondary">
              See full pricing details
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </MarketingContainer>
      </MarketingSection>

      <MarketingSection id="faq" tone="muted">
        <MarketingContainer>
          <SectionHeading
            eyebrow="FAQ"
            title="Common questions before starting."
            description="A short preview of the questions teams ask while evaluating AlphaClone."
          />
          <div className="mx-auto grid max-w-3xl gap-3">
            {HOMEPAGE_FAQ.map((item) => (
              <details key={item.question} className="mkt-surface p-5">
                <summary className="cursor-pointer text-base font-semibold text-[var(--marketing-text-primary)]">
                  {item.question}
                </summary>
                <p className="mt-3 text-sm leading-6 text-[var(--marketing-text-secondary)]">
                  {item.answer}
                </p>
              </details>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link href="/faq" className="mkt-btn mkt-btn-secondary">
              Read the full FAQ
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </MarketingContainer>
      </MarketingSection>
    </MarketingShell>
  );
}
