import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, ShieldCheck } from 'lucide-react';
import {
  BEFORE_AFTER_WORKFLOWS,
  OUTCOME_CASE_STUDIES,
  OUTCOME_HERO_BULLETS,
  OUTCOME_PROMISE,
  OUTCOME_PROOF_STATS,
  OUTCOME_TRUST_POINTS,
} from '@/config/marketingOutcomes';
import { PUBLIC_PRICING_PLANS, PRICING_FROM } from '@/config/pricingPlans';
import { MARKETING_TESTIMONIALS } from '@/config/marketingTestimonials';
import { trialHrefForPlan } from '@/lib/marketing/cta';
import { HOMEPAGE_FAQ, HOMEPAGE_PLATFORM_FEATURES } from '@/lib/marketing/productFeatures';
import { CtaPair, PrimaryCTA } from './CtaButtons';
import { ConversionBanner } from './ConversionBanner';
import { MarketingContainer, MarketingSection } from './LayoutPrimitives';
import MarketingShell from './MarketingShell';
import ProductScreenshot from './ProductScreenshot';

const HOW_IT_WORKS = [
  {
    step: '1',
    title: 'Connect the relationship',
    body: 'Capture the lead, notes, and next step on one client record — not across inbox, sheet, and CRM.',
  },
  {
    step: '2',
    title: 'Run the client work',
    body: 'Projects, tasks, meetings, and documents inherit the deal context so delivery never starts blank.',
  },
  {
    step: '3',
    title: 'Get paid without chasing',
    body: 'Quotes, contracts, and invoices stay attached to the same record that sold the work.',
  },
] as const;

const TRUST_LINKS = [
  { label: 'Security policy', href: '/security-policy' },
  { label: 'Privacy policy', href: '/privacy-policy' },
  { label: 'Data deletion', href: '/data-deletion' },
  { label: 'Service SLA', href: '/sla' },
] as const;

export default function MarketingHomePage() {
  const featuredStories = OUTCOME_CASE_STUDIES.slice(0, 3);
  const scenarios = MARKETING_TESTIMONIALS.slice(0, 3);

  return (
    <MarketingShell>
      {/* 1. Hero — brand + pain/outcome + CTA + real product */}
      <section className="mkt-hero">
        <div className="mkt-hero-atmosphere" aria-hidden="true" />
        <MarketingContainer className="relative z-10">
          <div className="mkt-hero-grid">
            <div className="mkt-hero-copy mkt-reveal">
              <p className="mkt-brand-lockup">
                <span className="mkt-brand-lockup-mark" aria-hidden="true">
                  <Image src="/logo.png" alt="" width={40} height={40} priority className="h-10 w-10 object-contain" />
                </span>
                <span className="mkt-brand-lockup-name">AlphaClone</span>
              </p>

              <h1 className="font-marketing-heading mt-6 text-[var(--marketing-text-primary)]">
                {OUTCOME_PROMISE.headline}{' '}
                <span className="mkt-accent-text">{OUTCOME_PROMISE.headlineAccent}</span>
              </h1>

              <p className="mt-5 max-w-xl text-lg leading-8 text-[var(--marketing-text-secondary)]">
                {OUTCOME_PROMISE.subhead}
              </p>

              <CtaPair className="mt-8" />

              <ul className="mt-6 flex flex-wrap gap-x-4 gap-y-2">
                {OUTCOME_TRUST_POINTS.map((point) => (
                  <li
                    key={point}
                    className="inline-flex items-center gap-2 text-sm text-[var(--marketing-text-muted)]"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--marketing-accent)]" aria-hidden="true" />
                    {point}
                  </li>
                ))}
              </ul>
            </div>

            <div className="mkt-hero-visual mkt-reveal mkt-reveal-delay-1">
              <ProductScreenshot
                src="/screenshots/deals-dashboard.png"
                alt="AlphaClone CRM deals dashboard with pipeline stages (demonstration data)"
                priority
              />
            </div>
          </div>
        </MarketingContainer>
      </section>

      {/* Proof strip — honest operating facts, not vanity metrics */}
      <MarketingSection className="py-8" tone="muted">
        <MarketingContainer>
          <div className="mkt-proof-strip">
            {OUTCOME_PROOF_STATS.map((stat) => (
              <div key={stat.label} className="mkt-proof-item">
                <p className="mkt-proof-value">{stat.value}</p>
                <p className="mkt-proof-label">{stat.label}</p>
                <p className="mkt-proof-detail">{stat.detail}</p>
              </div>
            ))}
          </div>
        </MarketingContainer>
      </MarketingSection>

      {/* 2. Before / after */}
      <MarketingSection id="before-after">
        <MarketingContainer>
          <div className="mb-10 max-w-3xl">
            <p className="mkt-label mb-4">The gap that costs you clients</p>
            <h2 className="font-marketing-heading text-[var(--marketing-text-primary)]">
              Stop losing revenue between your tools.
            </h2>
            <p className="mt-4 text-lg text-[var(--marketing-text-secondary)]">
              Most service teams do not have a sales problem — they have a handoff problem. Here is
              what changes when the client record stays with the work.
            </p>
          </div>

          <div className="mkt-ba-list">
            {BEFORE_AFTER_WORKFLOWS.map((row) => (
              <article key={row.before} className="mkt-ba-row">
                <div className="mkt-ba-before">
                  <p className="mkt-ba-kicker">Before</p>
                  <p>{row.before}</p>
                </div>
                <div className="mkt-ba-arrow" aria-hidden="true">
                  <ArrowRight className="h-5 w-5" />
                </div>
                <div className="mkt-ba-after">
                  <p className="mkt-ba-kicker">With AlphaClone</p>
                  <p>{row.after}</p>
                </div>
              </article>
            ))}
          </div>
        </MarketingContainer>
      </MarketingSection>

      {/* 3. How it works */}
      <MarketingSection id="how-it-works" tone="muted">
        <MarketingContainer>
          <div className="mb-10 max-w-3xl">
            <p className="mkt-label mb-4">How it works</p>
            <h2 className="font-marketing-heading text-[var(--marketing-text-primary)]">
              Connect → run client work → get paid.
            </h2>
            <p className="mt-4 text-lg text-[var(--marketing-text-secondary)]">
              One operating flow — not a pile of modules competing for attention.
            </p>
          </div>

          <ol className="mkt-flow">
            {HOW_IT_WORKS.map((item) => (
              <li key={item.title} className="mkt-flow-step">
                <span className="mkt-flow-num">{item.step}</span>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </li>
            ))}
          </ol>

          <ul className="mt-10 grid gap-3 sm:grid-cols-3">
            {OUTCOME_HERO_BULLETS.map((bullet) => (
              <li key={bullet} className="mkt-outcome-bullet">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--marketing-accent-hover)]" aria-hidden="true" />
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        </MarketingContainer>
      </MarketingSection>

      {/* 4. Outcome stories */}
      <MarketingSection id="results">
        <MarketingContainer>
          <div className="mb-10 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="mkt-label mb-4">Outcome stories</p>
              <h2 className="font-marketing-heading text-[var(--marketing-text-primary)]">
                What changes when the stack collapses into one workspace.
              </h2>
              <p className="mt-4 text-[var(--marketing-text-secondary)]">
                Representative scenarios for service teams — labeled honestly until named customers
                approve publication.
              </p>
            </div>
            <Link href="/results" className="mkt-btn mkt-btn-secondary self-start">
              View all workflow examples
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {featuredStories.map((story) => (
              <article key={story.id} className="mkt-story">
                <div className="mkt-story-meta">
                  <p className="mkt-story-persona">{story.persona}</p>
                  {story.representative ? (
                    <span className="mkt-story-tag">Representative</span>
                  ) : null}
                </div>
                <p className="mkt-story-industry">{story.industry}</p>
                <p className="mt-4 text-sm leading-6 text-[var(--marketing-text-secondary)]">
                  <span className="font-semibold text-[var(--marketing-text-primary)]">Problem: </span>
                  {story.problem}
                </p>
                <p className="mt-3 text-sm leading-6 text-[var(--marketing-text-secondary)]">
                  <span className="font-semibold text-[var(--marketing-accent-hover)]">Outcome: </span>
                  {story.outcome}
                </p>
                <p className="mt-4 text-xs text-[var(--marketing-text-muted)]">
                  Replaces: {story.stackReplaced}
                </p>
              </article>
            ))}
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {scenarios.map((item) => (
              <blockquote key={item.persona} className="mkt-scenario">
                <p>&ldquo;{item.quote}&rdquo;</p>
                <footer>
                  <cite>{item.persona}</cite>
                  <span>{item.outcome}</span>
                </footer>
              </blockquote>
            ))}
          </div>
        </MarketingContainer>
      </MarketingSection>

      {/* 5. Capabilities as enablers — not the headline */}
      <MarketingSection id="platform" tone="muted">
        <MarketingContainer>
          <div className="mb-10 max-w-3xl">
            <p className="mkt-label mb-4">Under the hood</p>
            <h2 className="font-marketing-heading text-[var(--marketing-text-primary)]">
              Modules exist to finish the client journey — not to pad a feature list.
            </h2>
          </div>
          <div className="mkt-capability-row">
            {HOMEPAGE_PLATFORM_FEATURES.map((feature) => (
              <Link key={feature.href} href={feature.href} className="mkt-capability">
                <span className="mkt-capability-name">{feature.name}</span>
                <span className="mkt-capability-outcome">{feature.outcome}</span>
              </Link>
            ))}
          </div>
        </MarketingContainer>
      </MarketingSection>

      {/* Mid conversion */}
      <MarketingSection>
        <MarketingContainer>
          <ConversionBanner
            title="Ready to stop losing work between tools?"
            description="Start a 14-day trial with a real workspace — or book a walkthrough of lead → project → invoice."
          />
        </MarketingContainer>
      </MarketingSection>

      {/* 6. Pricing teaser */}
      <MarketingSection id="pricing" tone="muted">
        <MarketingContainer>
          <div className="mb-10 max-w-3xl">
            <p className="mkt-label mb-4">Pricing</p>
            <h2 className="font-marketing-heading text-[var(--marketing-text-primary)]">
              One price. Your whole operation connected.
            </h2>
            <p className="mt-4 text-lg text-[var(--marketing-text-secondary)]">
              Plans start at ${PRICING_FROM}/month. 14-day trial — no card required.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {PUBLIC_PRICING_PLANS.map((plan) => (
              <article
                key={plan.id}
                className={`mkt-price-card${plan.highlight ? ' is-popular' : ''}`}
              >
                {plan.highlight ? <span className="mkt-price-badge">Most chosen</span> : null}
                <h3 className="text-xl font-semibold text-[var(--marketing-text-primary)]">
                  {plan.name}
                </h3>
                <p className="mt-2 text-sm leading-6 text-[var(--marketing-text-secondary)]">
                  {plan.tagline}
                </p>
                <p className="mt-6 text-[var(--marketing-text-primary)]">
                  <span className="font-marketing-heading text-5xl font-bold">${plan.price}</span>
                  <span className="text-sm text-[var(--marketing-text-muted)]"> / month</span>
                </p>
                <ul className="mt-6 flex-1 space-y-3">
                  {plan.features.slice(0, 4).map((feature) => (
                    <li
                      key={feature}
                      className="flex gap-3 text-sm text-[var(--marketing-text-secondary)]"
                    >
                      <CheckCircle2
                        className="mt-0.5 h-4 w-4 shrink-0 text-[var(--marketing-accent-hover)]"
                        aria-hidden="true"
                      />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <PrimaryCTA href={trialHrefForPlan(plan.id)} className="mt-8 w-full">
                  Start free for 14 days
                </PrimaryCTA>
              </article>
            ))}
          </div>

          <div className="mt-8 text-center">
            <Link href="/pricing" className="mkt-btn mkt-btn-secondary">
              See full plan limits
            </Link>
          </div>
        </MarketingContainer>
      </MarketingSection>

      {/* 7. Trust — substance */}
      <MarketingSection id="trust">
        <MarketingContainer>
          <div className="mkt-trust-panel">
            <div>
              <p className="mkt-label mb-4">Trust & control</p>
              <h2 className="font-marketing-heading text-[var(--marketing-text-primary)]">
                Policies you can actually read.
              </h2>
              <p className="mt-4 max-w-xl text-[var(--marketing-text-secondary)]">
                Role-based access, tenant isolation, and published privacy, security, and deletion
                practices — not a badge wall.
              </p>
            </div>
            <ul className="mkt-trust-links">
              {TRUST_LINKS.map((item) => (
                <li key={item.href}>
                  <Link href={item.href}>
                    <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                    {item.label}
                    <ArrowRight className="h-4 w-4 opacity-60" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </MarketingContainer>
      </MarketingSection>

      {/* FAQ */}
      <MarketingSection id="faq" tone="muted">
        <MarketingContainer>
          <div className="mb-10 max-w-3xl">
            <p className="mkt-label mb-4">FAQ</p>
            <h2 className="font-marketing-heading text-[var(--marketing-text-primary)]">
              Questions teams ask before starting.
            </h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {HOMEPAGE_FAQ.map((item) => (
              <details key={item.question} className="mkt-faq">
                <summary>
                  <span>{item.question}</span>
                  <span className="mkt-faq-plus" aria-hidden="true">
                    +
                  </span>
                </summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
          <div className="mt-8">
            <Link href="/faq" className="mkt-btn mkt-btn-secondary">
              Read the full FAQ
            </Link>
          </div>
        </MarketingContainer>
      </MarketingSection>
    </MarketingShell>
  );
}
