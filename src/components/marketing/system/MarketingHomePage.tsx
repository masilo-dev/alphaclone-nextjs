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
import AllInOnePlatformShowcase from './AllInOnePlatformShowcase';
import {
  InteractiveWorkflowStory,
  DifferentiationMatrix,
  BonnieAiSection,
  StackSavingsCalculator,
} from './LazyBelowFold';
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
      {/* 5-Second Category-Defining Hero */}
      <section className="mkt-hero mkt-hero--compact">
        <SectionAmbientLight variant="hero" />
        <HeroDataWaves />
        <CurvedDotField />
        <MarketingContainer>
          <div className="mkt-hero-copy mkt-reveal text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-300 text-xs sm:text-sm font-semibold mb-6">
              <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse"></span>
              THE CONNECTED OPERATING ENGINE FOR SERVICE FIRMS
            </div>
            
            <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white mb-6 font-marketing-heading leading-tight">
              Stop running your business across <br className="hidden sm:block" />
              <span className="mkt-accent-text">disconnected software tools.</span>
            </h1>

            <p className="mkt-lead text-base sm:text-lg md:text-xl text-slate-300 max-w-3xl mx-auto mb-8 leading-relaxed">
              AlphaClone connects your leads, proposals, e-sign contracts, project delivery, and billing inside a single living workspace—eliminating manual data copy-pasting, lost client handoffs, and paying $500+/month for separate SaaS silos.
            </p>

            {/* Replaces Tool Badge Strip */}
            <div className="inline-flex flex-wrap items-center justify-center gap-2 p-3 rounded-2xl bg-slate-900/80 border border-slate-800 text-xs text-slate-400 mb-8 backdrop-blur-md">
              <span className="font-semibold text-rose-400 uppercase tracking-wider text-[11px]">Replaces 6 Siloed Tools:</span>
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 line-through">HubSpot</span>
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 line-through">DocuSign</span>
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 line-through">QuickBooks</span>
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 line-through">Harvest</span>
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 line-through">Zoom</span>
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 line-through">Zapier</span>
              <span className="text-emerald-400 font-bold ml-1">→ 1 Connected Engine</span>
            </div>

            <CtaPair className="mkt-cta-row justify-center mb-8" />

            <ul className="mkt-trust-notes flex flex-wrap justify-center gap-4 sm:gap-8 text-xs sm:text-sm text-slate-300">
              {HOME_TRUST_NOTES.map((note) => (
                <li key={note.label} className="flex items-center gap-2">
                  <AlphaIcon name={note.icon} variant="trust" size="sm" className="mkt-trust-icon text-teal-400" />
                  <span>{note.label}</span>
                </li>
              ))}
            </ul>
          </div>
        </MarketingContainer>
      </section>

      <SectionConnector variant="fade" />

      {/* Platform Showcase — Architecture Diagram & Showcase Image First */}
      <MarketingSection atmosphere="platform">
        <AllInOnePlatformShowcase />
      </MarketingSection>

      <SectionConnector variant="fade" />

      {/* Verified Integrations Strip */}
      <MarketingSection className="py-8" atmosphere="trust">
        <MarketingContainer>
          <div className="mkt-trust-strip text-center">
            <p className="mkt-trust-strip-title text-xl font-bold text-white mb-2">Connects with the tools you already use</p>
            <p className="mkt-trust-strip-lead text-sm text-slate-400 max-w-2xl mx-auto mb-6">
              Verified integrations for payments, social, productivity, and team chat—so AlphaClone fits into your existing ecosystem seamlessly.
            </p>
            <VerifiedIntegrationsStrip />
          </div>
        </MarketingContainer>
      </MarketingSection>

      <SectionConnector variant="fade" />

      {/* Visual Storytelling: Lead to Cash Workflow */}
      <MarketingSection id="workflow-story" atmosphere="platform">
        <InteractiveWorkflowStory />
      </MarketingSection>

      <SectionConnector />

      {/* Market Differentiation Matrix */}
      <MarketingSection id="differentiation" atmosphere="outcomes">
        <DifferentiationMatrix />
      </MarketingSection>

      <SectionConnector />

      {/* Bonnie AI & MCP Architecture Explanation */}
      <MarketingSection id="ai-engine" atmosphere="platform">
        <BonnieAiSection />
      </MarketingSection>

      <SectionConnector />

      {/* Interactive SaaS Stack & Time Savings Calculator */}
      <MarketingSection id="roi-calculator" atmosphere="pricing">
        <StackSavingsCalculator />
      </MarketingSection>

      <SectionConnector />

      {/* Platform Overview — Module Cards */}
      <MarketingSection id="platform" atmosphere="platform">
        <MarketingContainer>
          <div className="mkt-platform-grid">
            <div className="mkt-platform-intro">
              <p className="mkt-eyebrow mb-4">Unified Architecture</p>
              <h2 className="font-marketing-heading text-2xl sm:text-4xl font-extrabold text-white">
                Everything your service business requires to operate.
              </h2>
              <p className="mt-4 max-w-md text-sm sm:text-base text-[var(--text-secondary)] leading-relaxed">
                Every module shares the same client and project database memory, so CRM, contracts, project delivery, and billing reinforce each other instead of living in separate tabs.
              </p>
              <ExploreFeaturesLink />
            </div>
            <div className="mkt-feature-grid">
              {HOME_PLATFORM_FEATURES.map(({ name, body, href, icon }) => (
                <Link key={name} href={href} className="mkt-feature-card">
                  <div className="mkt-feature-card-head">
                    <IconFrame size="sm" accent={ICON_ACCENT[icon] ?? 'default'}>
                      <AlphaIcon name={icon} variant="feature" size="md" />
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

      {/* How It Works — 3 Steps */}
      <MarketingSection id="how-it-works" atmosphere="how">
        <SectionAmbientLight variant="how" />
        <MarketingContainer>
          <div className="mb-8 max-w-3xl">
            <h2 className="font-marketing-heading text-2xl sm:text-3xl font-bold text-white">How AlphaClone Works</h2>
            <p className="mt-3 text-sm sm:text-base text-[var(--text-secondary)]">
              Three focused steps from initial lead contact to a connected operating rhythm your team runs every day.
            </p>
          </div>
          <div className="mkt-steps mkt-steps--row">
            {HOME_HOW_IT_WORKS.map(({ step, title, body, icon }) => (
              <div key={title} className="mkt-step mkt-step--inline">
                <div className="mkt-step-inline-head">
                  <span className="mkt-step-num font-mono" aria-hidden="true">
                    {step}
                  </span>
                  <IconFrame size="sm" className="mkt-step-symbol-sm">
                    <AlphaIcon name={icon} variant="feature" size="sm" />
                  </IconFrame>
                </div>
                <h3>{title}</h3>
                <p>{body}</p>
              </div>
            ))}
          </div>
        </MarketingContainer>
      </MarketingSection>

      {/* Key Outcomes */}
      <MarketingSection atmosphere="outcomes">
        <MarketingContainer>
          <div className="mkt-outcome-band mkt-outcome-band--stacked">
            <h2 className="font-marketing-heading text-xl sm:text-2xl font-bold text-white">
              Built to save time, eliminate friction, and give founders total operational clarity.
            </h2>
            <div className="mkt-outcome-cards mkt-outcome-cards--pair">
              {HOME_OUTCOMES.map((item) => (
                <div key={item.title} className="mkt-outcome-card">
                  <IconFrame size="sm" className="mb-2">
                    <AlphaIcon name={item.icon} variant="metric" size="sm" />
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
                <h2 className="font-marketing-heading text-2xl sm:text-3xl font-bold text-white">Loved by modern service businesses</h2>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {APPROVED_TESTIMONIALS.map((item) => (
                  <blockquote key={`${item.name}-${item.company}`} className="mkt-surface p-6 rounded-2xl border border-slate-800 bg-slate-900/80">
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

      {/* Pricing Section */}
      <MarketingSection id="pricing" atmosphere="pricing">
        <MarketingContainer>
          <div className="mb-8 max-w-3xl mx-auto text-center">
            <h2 className="font-marketing-heading text-2xl sm:text-4xl font-extrabold text-white">Simple, transparent pricing.</h2>
            <p className="mt-4 text-sm sm:text-base text-[var(--text-secondary)] leading-relaxed">
              Plans start at ${PRICING_FROM}/month. Every plan includes a 14-day free trial—no credit card required—so you can run real client workflows first.
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
                      <AlphaIcon name="check" variant="trust" size="xs" className="shrink-0 text-teal-400" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <PrimaryCTA href={trialHrefForPlan(plan.id)} className="mt-6 w-full">
                  Start 14-Day Free Trial
                </PrimaryCTA>
              </article>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link href="/pricing" className="mkt-btn mkt-btn-secondary">
              See full plan breakdown & features
            </Link>
          </div>
        </MarketingContainer>
      </MarketingSection>

      <SectionConnector />

      {/* FAQ Accordion */}
      <MarketingSection id="faq" atmosphere="faq">
        <MarketingContainer>
          <div className="mb-8 max-w-3xl">
            <h2 className="font-marketing-heading text-2xl sm:text-3xl font-bold text-white">Frequently asked questions</h2>
            <p className="mt-3 text-sm sm:text-base text-[var(--text-secondary)]">
              Clear answers on free trials, data security, tool migration, and AI safety.
            </p>
          </div>
          <div className="mkt-faq-split">
            <FAQAccordion items={[...HOME_FAQ]} />
          </div>
          <div className="mt-8">
            <Link href="/faq" className="mkt-btn mkt-btn-secondary">
              Read the full FAQ hub
            </Link>
          </div>
        </MarketingContainer>
      </MarketingSection>
    </MarketingShell>
  );
}
