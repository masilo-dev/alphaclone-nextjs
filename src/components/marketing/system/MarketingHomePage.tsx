import Link from 'next/link';
import { CheckCircle2, Clock3, CreditCard, ShieldCheck, XCircle } from 'lucide-react';
import { PUBLIC_PRICING_PLANS, PRICING_FROM } from '@/config/pricingPlans';
import { VERIFIED_PARTNERS } from '@/config/verifiedPartners';
import { trialHrefForPlan } from '@/lib/marketing/cta';
import { CtaPair, PrimaryCTA } from './CtaButtons';
import FAQAccordion from './FAQAccordion';
import {
  APPROVED_TESTIMONIALS,
  ExploreFeaturesLink,
  HOME_FAQ,
  HOME_HOW_IT_WORKS,
  HOME_OUTCOMES,
  HOME_PLATFORM_FEATURES,
  HOME_TRUST_NOTES,
  MidPageCTA,
} from './homeContent';
import { MarketingContainer, MarketingSection } from './LayoutPrimitives';
import MarketingShell from './MarketingShell';
import ProductPreview from './ProductPreview';

const TRUST_ICONS = [CreditCard, Clock3, XCircle, ShieldCheck] as const;

export default function MarketingHomePage() {
  const showTestimonials = APPROVED_TESTIMONIALS.length > 0;
  const partnerLabels = VERIFIED_PARTNERS.slice(0, 8).map((partner) => partner.name);

  return (
    <MarketingShell>
      {/* Hero */}
      <section className="mkt-hero">
        <div className="mkt-hero-atmosphere" aria-hidden="true" />
        <MarketingContainer>
          <div className="mkt-hero-copy mkt-reveal">
            <p className="mkt-eyebrow">The all-in-one operating system for service businesses</p>
            <h1>
              Run your entire business.
              <br />
              <span className="mkt-accent-text">On one intelligent platform.</span>
            </h1>
            <p className="mkt-lead">
              Manage clients, leads, projects, invoices, documents, communication and AI-powered
              work from one connected workspace.
            </p>
            <CtaPair className="mkt-cta-row justify-center" />
            <ul className="mkt-trust-notes">
              {HOME_TRUST_NOTES.map((note, index) => {
                const Icon = TRUST_ICONS[index] ?? ShieldCheck;
                return (
                  <li key={note}>
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    {note}
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="mkt-hero-preview mkt-reveal mkt-reveal-delay-1">
            <ProductPreview />
          </div>
        </MarketingContainer>
      </section>

      {/* Trusted-by */}
      <MarketingSection className="py-10" tone="muted">
        <MarketingContainer>
          <div className="mkt-trust-strip">
            <p className="mkt-trust-strip-title">Trusted by service businesses</p>
            <p className="mb-5 text-sm text-[var(--text-secondary)]">
              Built for agencies, consultants and service businesses — with verified integrations
              you can connect today.
            </p>
            <ul className="mkt-trust-labels" aria-label="Verified integrations">
              {partnerLabels.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
          </div>
        </MarketingContainer>
      </MarketingSection>

      {/* Platform overview */}
      <MarketingSection id="platform">
        <MarketingContainer>
          <div className="mkt-platform-grid">
            <div>
              <p className="mkt-eyebrow mb-4">All your work, connected</p>
              <h2 className="font-marketing-heading">Everything you need to run your business.</h2>
              <p className="mt-4 max-w-md text-sm sm:text-base text-[var(--text-secondary)]">
                Powerful tools that work together across your clients, money, projects, documents,
                marketing and everyday operations.
              </p>
              <ExploreFeaturesLink />
            </div>
            <div className="mkt-feature-grid">
              {HOME_PLATFORM_FEATURES.map(({ name, body, href, icon: Icon }) => (
                <Link key={name} href={href} className="mkt-feature-card">
                  <span className="mkt-icon-wrap">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3>{name}</h3>
                  <p>{body}</p>
                </Link>
              ))}
            </div>
          </div>
        </MarketingContainer>
      </MarketingSection>

      {/* How it works */}
      <MarketingSection id="how-it-works" tone="muted">
        <MarketingContainer>
          <div className="mb-12 max-w-3xl mx-auto text-center">
            <h2 className="font-marketing-heading">How AlphaClone works</h2>
            <p className="mt-4 text-sm sm:text-base text-[var(--text-secondary)]">
              Three steps from empty workspace to a connected operating rhythm.
            </p>
          </div>
          <div className="mkt-steps">
            {HOME_HOW_IT_WORKS.map(({ step, title, body, icon: Icon }) => (
              <div key={title} className="mkt-step">
                <span className="mkt-step-num" aria-hidden="true">
                  {step}
                </span>
                <span className="mkt-icon-wrap mt-4 mx-auto lg:flex hidden">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3>{title}</h3>
                <p>{body}</p>
              </div>
            ))}
          </div>
        </MarketingContainer>
      </MarketingSection>

      {/* Outcome band — verified product outcomes only */}
      <MarketingSection>
        <MarketingContainer>
          <div className="mkt-outcome-band">
            <div>
              <h2 className="font-marketing-heading text-xl sm:text-2xl">
                Built to help you save time and run your business with less friction.
              </h2>
            </div>
            <div className="mkt-outcome-cards">
              {HOME_OUTCOMES.map((item) => (
                <div key={item.title} className="mkt-outcome-card">
                  <strong>{item.title}</strong>
                  <span>{item.detail}</span>
                </div>
              ))}
            </div>
          </div>
        </MarketingContainer>
      </MarketingSection>

      {/* Testimonials — only when approved named quotes exist */}
      {showTestimonials ? (
        <MarketingSection id="testimonials" tone="muted">
          <MarketingContainer>
            <div className="mb-10 text-center max-w-3xl mx-auto">
              <h2 className="font-marketing-heading">Loved by service businesses</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {APPROVED_TESTIMONIALS.map((item) => (
                <blockquote key={`${item.name}-${item.company}`} className="mkt-surface p-6">
                  <p className="text-[var(--text-secondary)]">&ldquo;{item.quote}&rdquo;</p>
                  <footer className="mt-5">
                    <cite className="not-italic font-semibold text-[var(--text-primary)]">
                      {item.name}
                    </cite>
                    <p className="text-sm text-[var(--text-muted)]">
                      {item.role}, {item.company}
                    </p>
                  </footer>
                </blockquote>
              ))}
            </div>
          </MarketingContainer>
        </MarketingSection>
      ) : null}

      {/* Mid-page CTA */}
      <MarketingSection>
        <MarketingContainer>
          <MidPageCTA />
        </MarketingContainer>
      </MarketingSection>

      {/* Pricing */}
      <MarketingSection id="pricing" tone="muted">
        <MarketingContainer>
          <div className="mb-10 max-w-3xl mx-auto text-center">
            <h2 className="font-marketing-heading">Simple pricing. No surprises.</h2>
            <p className="mt-4 text-sm sm:text-base text-[var(--text-secondary)]">
              Plans start at ${PRICING_FROM}/month. Every plan includes a 14-day free trial — no card
              required.
            </p>
          </div>
          <div className="mkt-price-grid">
            {PUBLIC_PRICING_PLANS.map((plan) => (
              <article
                key={plan.id}
                className={`mkt-price-card${plan.highlight ? ' is-popular' : ''}`}
              >
                {plan.highlight ? <span className="mkt-price-badge">Recommended</span> : null}
                <h3 className="text-lg font-semibold text-[var(--text-primary)]">{plan.name}</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{plan.tagline}</p>
                <p className="mt-6 text-[var(--text-primary)]">
                  <span className="font-marketing-heading text-3xl sm:text-4xl font-bold">${plan.price}</span>
                  <span className="text-sm text-[var(--text-muted)]"> / month</span>
                </p>
                <ul className="mt-6 flex-1 space-y-3">
                  {plan.features.slice(0, 5).map((feature) => (
                    <li key={feature} className="flex gap-3 text-sm text-[var(--text-secondary)]">
                      <CheckCircle2
                        className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand-cyan-soft)]"
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
              See full pricing details
            </Link>
          </div>
        </MarketingContainer>
      </MarketingSection>

      {/* FAQ */}
      <MarketingSection id="faq">
        <MarketingContainer>
          <div className="mb-10 max-w-3xl mx-auto text-center">
            <h2 className="font-marketing-heading">Frequently asked questions</h2>
            <p className="mt-4 text-sm sm:text-base text-[var(--text-secondary)]">
              Straight answers before you start a trial.
            </p>
          </div>
          <FAQAccordion items={[...HOME_FAQ]} />
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
