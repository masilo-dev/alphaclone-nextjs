import Link from 'next/link';
import {
  Bot,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  FileText,
  FolderKanban,
  Megaphone,
  Receipt,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
  Zap,
} from 'lucide-react';
import { PUBLIC_PRICING_PLANS } from '@/config/pricingPlans';
import { MARKETING_TESTIMONIALS } from '@/config/marketingTestimonials';
import { trialHrefForPlan } from '@/lib/marketing/cta';
import { HOMEPAGE_FAQ } from '@/lib/marketing/productFeatures';
import { CtaPair, PrimaryCTA } from './CtaButtons';
import { ConversionBanner } from './ConversionBanner';
import DashboardMockup from './DashboardMockup';
import { MarketingContainer, MarketingSection } from './LayoutPrimitives';
import MarketingShell from './MarketingShell';

const TRUST_SIGNALS = [
  { icon: CreditCard, label: 'No credit card required' },
  { icon: Clock3, label: 'Setup in under 10 minutes' },
  { icon: ShieldCheck, label: 'Cancel anytime' },
] as const;

const CLIENT_LOGOS = [
  'Vision Studio',
  'Nexa Agency',
  'Northline Co',
  'Brightfield',
  'Orbit Labs',
  'Harbor & Co',
] as const;

const FEATURES = [
  {
    name: 'CRM',
    body: 'Track leads, deals, and every client conversation in one shared record.',
    icon: Users,
    href: '/crm',
  },
  {
    name: 'Invoicing',
    body: 'Create, send, and track invoices connected to the work you already delivered.',
    icon: Receipt,
    href: '/docs#financials',
  },
  {
    name: 'Projects',
    body: 'Plan delivery with owners, milestones, and context from the won deal.',
    icon: FolderKanban,
    href: '/project-management',
  },
  {
    name: 'Documents',
    body: 'Keep contracts, proposals, and files next to the client who needs them.',
    icon: FileText,
    href: '/docs',
  },
  {
    name: 'AI Assistant',
    body: 'Ask Bonnie to draft follow-ups, summarize work, and surface next steps.',
    icon: Bot,
    href: '/ai-agents',
  },
  {
    name: 'And more',
    body: 'Marketing, calendar, meetings, and workflows — in the same operating system.',
    icon: Megaphone,
    href: '/ecosystem',
  },
] as const;

const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Sign up',
    body: 'Create your workspace in minutes and invite the people who need access.',
    icon: Sparkles,
  },
  {
    step: '02',
    title: 'Organize',
    body: 'Bring leads, projects, invoices, and documents into one connected flow.',
    icon: CalendarDays,
  },
  {
    step: '03',
    title: 'Grow',
    body: 'Run follow-up, delivery, and billing from the same client record every day.',
    icon: Zap,
  },
] as const;

const STATS = [
  { value: '65%', label: 'Faster client handoffs' },
  { value: '5x', label: 'Fewer tool switches' },
  { value: '1 workspace', label: 'For sales to billing' },
  { value: '14 days', label: 'Free to try everything' },
] as const;

const TESTIMONIALS = MARKETING_TESTIMONIALS.slice(0, 3);

export default function MarketingHomePage() {
  return (
    <MarketingShell>
      {/* ── Hero ── */}
      <MarketingSection className="relative overflow-hidden pb-8 pt-14 sm:pt-20 lg:pt-24">
        <div className="mkt-hero-waves" aria-hidden="true" />
        <div className="marketing-glow-hero mkt-hero-glow" aria-hidden="true" />
        <MarketingContainer className="relative z-10 text-center">
          <div className="mkt-reveal mx-auto max-w-4xl">
            <p className="mkt-label mb-5">
              All-in-one operating system for service businesses
            </p>
            <h1 className="font-marketing-heading text-[var(--marketing-text-primary)]">
              Run your entire business.{' '}
              <span className="mkt-accent-text">On one intelligent platform.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-[var(--marketing-text-secondary)]">
              CRM, invoicing, projects, documents, and AI work — connected in one AlphaClone
              workspace so your team stops bouncing between tools.
            </p>
            <CtaPair className="mt-8 justify-center" />
            <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
              {TRUST_SIGNALS.map(({ icon: Icon, label }) => (
                <li
                  key={label}
                  className="inline-flex items-center gap-2 text-sm text-[var(--marketing-text-muted)]"
                >
                  <Icon className="h-4 w-4 text-[var(--marketing-accent-hover)]" aria-hidden="true" />
                  {label}
                </li>
              ))}
            </ul>
          </div>
        </MarketingContainer>
      </MarketingSection>

      {/* ── Product mock ── */}
      <MarketingSection className="relative z-10 pt-0 pb-4">
        <MarketingContainer>
          <div className="mkt-reveal mkt-reveal-delay-1">
            <DashboardMockup />
          </div>
        </MarketingContainer>
      </MarketingSection>

      {/* ── Logos ── */}
      <MarketingSection className="py-10" tone="muted">
        <MarketingContainer>
          <p className="mb-6 text-center text-sm font-medium uppercase tracking-[0.18em] text-[var(--marketing-text-muted)]">
            Trusted by growing service teams
          </p>
          <div className="mkt-logo-row" aria-label="Example service business names">
            {CLIENT_LOGOS.map((name) => (
              <span key={name} className="mkt-logo-chip">
                {name}
              </span>
            ))}
          </div>
        </MarketingContainer>
      </MarketingSection>

      {/* ── Features ── */}
      <MarketingSection id="platform">
        <MarketingContainer>
          <div className="mb-10 mx-auto max-w-3xl text-center">
            <h2 className="font-marketing-heading text-[var(--marketing-text-primary)]">
              Everything you need to run your business.
            </h2>
            <p className="mt-4 text-lg text-[var(--marketing-text-secondary)]">
              One workspace for the tools service businesses use every day — without stitching five
              subscriptions together.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ name, body, icon: Icon, href }) => (
              <Link
                key={name}
                href={href}
                className="mkt-feature-card group"
              >
                <span className="mkt-icon-wrap mb-4">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="text-lg font-semibold text-[var(--marketing-text-primary)] group-hover:text-[var(--marketing-accent-hover)]">
                  {name}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--marketing-text-secondary)]">
                  {body}
                </p>
              </Link>
            ))}
          </div>
        </MarketingContainer>
      </MarketingSection>

      {/* ── How it works ── */}
      <MarketingSection id="how-it-works" tone="muted">
        <MarketingContainer>
          <div className="mb-12 mx-auto max-w-3xl text-center">
            <h2 className="font-marketing-heading text-[var(--marketing-text-primary)]">
              How it works
            </h2>
            <p className="mt-4 text-lg text-[var(--marketing-text-secondary)]">
              Three steps from empty workspace to a connected operating rhythm.
            </p>
          </div>
          <div className="mkt-steps">
            {HOW_IT_WORKS.map(({ step, title, body, icon: Icon }, index) => (
              <div key={title} className="mkt-step">
                {index < HOW_IT_WORKS.length - 1 ? (
                  <div className="mkt-step-connector" aria-hidden="true" />
                ) : null}
                <div className="mkt-step-icon">
                  <Icon className="h-6 w-6" aria-hidden="true" />
                </div>
                <p className="mkt-step-number">{step}</p>
                <h3 className="mt-2 text-xl font-semibold text-[var(--marketing-text-primary)]">
                  {title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-[var(--marketing-text-secondary)]">
                  {body}
                </p>
              </div>
            ))}
          </div>

          <div className="mkt-stats mt-14">
            {STATS.map((stat) => (
              <div key={stat.label} className="mkt-stat">
                <p className="mkt-stat-value">{stat.value}</p>
                <p className="mkt-stat-label">{stat.label}</p>
              </div>
            ))}
          </div>
        </MarketingContainer>
      </MarketingSection>

      {/* ── Testimonials ── */}
      <MarketingSection>
        <MarketingContainer>
          <div className="mb-10 mx-auto max-w-3xl text-center">
            <h2 className="font-marketing-heading text-[var(--marketing-text-primary)]">
              What teams say about working in one place
            </h2>
            <p className="mt-4 text-lg text-[var(--marketing-text-secondary)]">
              Representative outcomes from service teams evaluating a connected workspace.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {TESTIMONIALS.map((item, index) => (
              <article
                key={item.persona}
                className={`mkt-testimonial${index === 1 ? ' is-featured' : ''}`}
              >
                {index === 1 ? <span className="mkt-testimonial-badge">Most popular</span> : null}
                <div className="mb-4 flex gap-1" aria-label="5 out of 5">
                  {Array.from({ length: 5 }).map((_, star) => (
                    <Star
                      key={star}
                      className="h-4 w-4 fill-[var(--marketing-accent)] text-[var(--marketing-accent)]"
                      aria-hidden="true"
                    />
                  ))}
                </div>
                <p className="text-sm leading-6 text-[var(--marketing-text-secondary)]">
                  &ldquo;{item.quote}&rdquo;
                </p>
                <div className="mt-5 border-t border-[var(--marketing-border)] pt-4">
                  <p className="text-sm font-semibold text-[var(--marketing-text-primary)]">
                    {item.persona}
                  </p>
                  <p className="mt-1 text-xs text-[var(--marketing-accent-hover)]">{item.outcome}</p>
                </div>
              </article>
            ))}
          </div>
        </MarketingContainer>
      </MarketingSection>

      {/* ── Mid CTA ── */}
      <MarketingSection tone="accent">
        <MarketingContainer>
          <ConversionBanner
            title="Ready to run your entire business on one platform?"
            description="Start free for 14 days — or book a live walkthrough of a real AlphaClone workspace."
          />
        </MarketingContainer>
      </MarketingSection>

      {/* ── Pricing ── */}
      <MarketingSection id="pricing">
        <MarketingContainer>
          <div className="mb-10 mx-auto max-w-3xl text-center">
            <h2 className="font-marketing-heading text-[var(--marketing-text-primary)]">
              Simple pricing that scales with you
            </h2>
            <p className="mt-4 text-lg text-[var(--marketing-text-secondary)]">
              Every plan includes a 14-day free trial. No credit card required to start.
            </p>
          </div>
          <div className="grid gap-4 lg:grid-cols-3 lg:items-stretch">
            {PUBLIC_PRICING_PLANS.map((plan) => (
              <article
                key={plan.id}
                className={`mkt-price-card${plan.highlight ? ' is-popular' : ''}`}
              >
                {plan.highlight ? (
                  <span className="mkt-price-badge">Most popular</span>
                ) : null}
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
                  {plan.features.slice(0, 5).map((feature) => (
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
                  Start free trial
                </PrimaryCTA>
              </article>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link href="/pricing" className="mkt-btn mkt-btn-secondary">
              See full pricing details
            </Link>
          </div>
        </MarketingContainer>
      </MarketingSection>

      {/* ── FAQ ── */}
      <MarketingSection id="faq" tone="muted">
        <MarketingContainer>
          <div className="mb-10 mx-auto max-w-3xl text-center">
            <h2 className="font-marketing-heading text-[var(--marketing-text-primary)]">
              Frequently asked questions
            </h2>
            <p className="mt-4 text-lg text-[var(--marketing-text-secondary)]">
              Quick answers before you start your trial.
            </p>
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
          <div className="mt-8 text-center">
            <Link href="/faq" className="mkt-btn mkt-btn-secondary">
              Read the full FAQ
            </Link>
          </div>
        </MarketingContainer>
      </MarketingSection>
    </MarketingShell>
  );
}
