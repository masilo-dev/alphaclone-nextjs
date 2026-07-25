import Link from 'next/link';
import { PUBLIC_PRICING_PLANS, PRICING_FROM } from '@/config/pricingPlans';
import { trialHrefForPlan } from '@/lib/marketing/cta';
import { AlphaIcon, IconFrame, ICON_ACCENT } from '@/components/marketing/icons';
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
import VerifiedIntegrationsStrip from './VerifiedIntegrationsStrip';
import {
  CurvedDotField,
  HeroDataWaves,
  SectionAmbientLight,
  SectionConnector,
} from './atmosphere';

export default function MarketingHomePage() {
  const showTestimonials = APPROVED_TESTIMONIALS.length > 0;

  return (
    <MarketingShell>
      {/* Hero — no product demo screenshot; atmosphere + conversion only */}
      <section className="mkt-hero mkt-hero--compact">
        <SectionAmbientLight variant="hero" />
        <HeroDataWaves />
        <CurvedDotField />
        <MarketingContainer>
          <div className="mkt-hero-copy mkt-reveal">
            <p className="mkt-eyebrow">AlphaClone</p>
            <h1>
              Run your entire business.
              <br />
              <span className="mkt-accent-text">On one intelligent platform.</span>
            </h1>
            <p className="mkt-lead">
              AlphaClone is the operating system for service businesses — CRM, projects, invoicing,
              documents, and AI-assisted work in one connected workspace, so your team stops losing
              time across disconnected tools.
            </p>
            <CtaPair className="mkt-cta-row justify-center" />
            <ul className="mkt-trust-notes">
              {HOME_TRUST_NOTES.map((note) => (
                <li key={note.label}>
                  <AlphaIcon name={note.icon} variant="trust" size="sm" className="mkt-trust-icon" />
                  {note.label}
                </li>
              ))}
            </ul>
          </div>
        </MarketingContainer>
      </section>

      <SectionConnector variant="fade" />

      {/* Trusted integrations — proper brand marks, not plain name lists */}
      <MarketingSection className="py-8" atmosphere="trust">
        <MarketingContainer>
          <div className="mkt-trust-strip">
            <p className="mkt-trust-strip-title">Connects with the tools you already use</p>
            <p className="mkt-trust-strip-lead">
              Verified integrations for social, payments, productivity, and team chat — so AlphaClone
              fits into your stack instead of replacing everything overnight.
            </p>
            <VerifiedIntegrationsStrip />
          </div>
        </MarketingContainer>
      </MarketingSection>

      <SectionConnector />

      {/* Platform overview — side intro + 2-column feature pairs */}
      <MarketingSection id="platform" atmosphere="platform">
        <MarketingContainer>
          <div className="mkt-platform-grid">
            <div className="mkt-platform-intro">
              <p className="mkt-eyebrow mb-4">All your work, connected</p>
              <h2 className="font-marketing-heading">Everything you need to run your business.</h2>
              <p className="mt-4 max-w-md text-sm sm:text-base text-[var(--text-secondary)]">
                Each module shares the same client and project context, so CRM, money, delivery, and
                documents reinforce each other instead of becoming another silo.
              </p>
              <ExploreFeaturesLink />
            </div>
            <div className="mkt-feature-grid">
              {HOME_PLATFORM_FEATURES.map(({ name, body, href, icon }) => (
                <Link key={name} href={href} className="mkt-feature-card">
                  <div className="mkt-feature-card-head">
                    <IconFrame size="md" accent={ICON_ACCENT[icon] ?? 'default'}>
                      <AlphaIcon name={icon} variant="feature" size="lg" />
                    </IconFrame>
                    <h3>{name}</h3>
                  </div>
                  <p>{body}</p>
                </Link>
              ))}
            </div>
          </div>
        </MarketingContainer>
      </MarketingSection>

      <SectionConnector />

      {/* How it works — compact horizontal steps */}
      <MarketingSection id="how-it-works" atmosphere="how">
        <SectionAmbientLight variant="how" />
        <MarketingContainer>
          <div className="mb-8 max-w-3xl">
            <h2 className="font-marketing-heading">How AlphaClone works</h2>
            <p className="mt-3 text-sm sm:text-base text-[var(--text-secondary)]">
              Three focused steps from an empty workspace to a connected operating rhythm your team
              can run every day.
            </p>
          </div>
          <div className="mkt-steps mkt-steps--row">
            {HOME_HOW_IT_WORKS.map(({ step, title, body, icon }) => (
              <div key={title} className="mkt-step mkt-step--inline">
                <div className="mkt-step-inline-head">
                  <span className="mkt-step-num" aria-hidden="true">
                    {step}
                  </span>
                  <IconFrame size="sm" className="mkt-step-symbol-sm">
                    <AlphaIcon name={icon} variant="feature" size="md" />
                  </IconFrame>
                </div>
                <h3>{title}</h3>
                <p>{body}</p>
              </div>
            ))}
          </div>
        </MarketingContainer>
      </MarketingSection>

      {/* Outcomes — 2×2 side pairs, not a tall list */}
      <MarketingSection atmosphere="outcomes">
        <MarketingContainer>
          <div className="mkt-outcome-band mkt-outcome-band--stacked">
            <h2 className="font-marketing-heading text-xl sm:text-2xl">
              Built to help you save time and run your business with less friction.
            </h2>
            <div className="mkt-outcome-cards mkt-outcome-cards--pair">
              {HOME_OUTCOMES.map((item) => (
                <div key={item.title} className="mkt-outcome-card">
                  <IconFrame size="sm" className="mb-2">
                    <AlphaIcon name={item.icon} variant="metric" size="md" />
                  </IconFrame>
                  <strong>{item.title}</strong>
                  <span>{item.detail}</span>
                </div>
              ))}
            </div>
          </div>
        </MarketingContainer>
      </MarketingSection>

      {showTestimonials ? (
        <>
          <SectionConnector variant="fade" />
          <MarketingSection id="testimonials" atmosphere="testimonials">
            <MarketingContainer>
              <div className="mb-10 text-center max-w-3xl mx-auto">
                <h2 className="font-marketing-heading">Loved by service businesses</h2>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
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
        </>
      ) : null}

      <MarketingSection atmosphere="cta">
        <MarketingContainer>
          <MidPageCTA />
        </MarketingContainer>
      </MarketingSection>

      <SectionConnector variant="fade" />

      {/* Pricing — compact cards; feature chips in 2 columns */}
      <MarketingSection id="pricing" atmosphere="pricing">
        <MarketingContainer>
          <div className="mb-8 max-w-3xl mx-auto text-center">
            <h2 className="font-marketing-heading">Simple pricing. No surprises.</h2>
            <p className="mt-4 text-sm sm:text-base text-[var(--text-secondary)]">
              Plans start at ${PRICING_FROM}/month. Every plan includes a 14-day free trial — no card
              required — so you can prove the workflow with real client work first.
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
                <p className="mt-5 text-[var(--text-primary)]">
                  <span className="font-marketing-heading text-3xl sm:text-4xl font-bold">${plan.price}</span>
                  <span className="text-sm text-[var(--text-muted)]"> / month</span>
                </p>
                <ul className="mkt-price-features">
                  {plan.features.slice(0, 6).map((feature) => (
                    <li key={feature}>
                      <AlphaIcon name="check" variant="trust" size="xs" className="shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <PrimaryCTA href={trialHrefForPlan(plan.id)} className="mt-6 w-full">
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

      <SectionConnector />

      {/* FAQ — two-column accordion on desktop */}
      <MarketingSection id="faq" atmosphere="faq">
        <MarketingContainer>
          <div className="mb-8 max-w-3xl">
            <h2 className="font-marketing-heading">Frequently asked questions</h2>
            <p className="mt-3 text-sm sm:text-base text-[var(--text-secondary)]">
              Straight answers on trials, billing, security, and setup before you start.
            </p>
          </div>
          <div className="mkt-faq-split">
            <FAQAccordion items={[...HOME_FAQ]} />
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
