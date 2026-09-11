import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { AlphaIcon } from '@/components/marketing/icons';
import { ConversionBanner } from './ConversionBanner';
import { MarketingContainer, MarketingSection, SectionHeading } from './LayoutPrimitives';
import { PrimaryCTA, SecondaryCTA } from './CtaButtons';

export type SolutionModule = {
  label: string;
  href: string;
  description: string;
};

export type SolutionPageContent = {
  eyebrow: string;
  title: string;
  description: string;
  problem: string;
  workflowChange: string;
  modules: SolutionModule[];
  outcomes: string[];
  setup: string[];
  ctaTitle: string;
  ctaDescription: string;
};

type SolutionPageTemplateProps = {
  content: SolutionPageContent;
};

export default function SolutionPageTemplate({ content }: SolutionPageTemplateProps) {
  return (
    <main className="bg-[var(--marketing-bg-primary)]">
      <MarketingSection className="relative overflow-hidden pt-16 sm:pt-20">
        <div className="marketing-glow-hero" aria-hidden="true" />
        <MarketingContainer className="relative z-10">
          <div className="mx-auto max-w-4xl text-center">
            <p className="mkt-label mb-5">{content.eyebrow}</p>
            <h1>{content.title}</h1>
            <p className="mx-auto mt-5 max-w-3xl text-lg sm:text-xl text-[var(--marketing-text-secondary)]">
              {content.description}
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <PrimaryCTA />
              <SecondaryCTA />
            </div>
          </div>
        </MarketingContainer>
      </MarketingSection>

      <MarketingSection tone="muted">
        <MarketingContainer>
          <div className="grid gap-6 lg:grid-cols-2">
            <article className="mkt-surface-elevated p-6 sm:p-8">
              <p className="mkt-label mb-4">Problem</p>
              <h2 className="text-2xl font-semibold text-[var(--marketing-text-primary)]">
                Where work gets stuck
              </h2>
              <p className="mt-4 text-[var(--marketing-text-secondary)]">{content.problem}</p>
            </article>
            <article className="mkt-surface-elevated p-6 sm:p-8">
              <p className="mkt-label mb-4">Workflow change</p>
              <h2 className="text-2xl font-semibold text-[var(--marketing-text-primary)]">
                How AlphaClone changes the day
              </h2>
              <p className="mt-4 text-[var(--marketing-text-secondary)]">{content.workflowChange}</p>
            </article>
          </div>
        </MarketingContainer>
      </MarketingSection>

      <MarketingSection>
        <MarketingContainer>
          <SectionHeading
            eyebrow="Relevant modules"
            title="The parts of AlphaClone this solution uses"
            description="Each module links back to the product area so teams can inspect the underlying workflow."
          />
          <div className="grid gap-4 md:grid-cols-3">
            {content.modules.map((module) => (
              <Link
                key={module.href}
                href={module.href}
                className="mkt-surface group block p-5 transition-colors hover:border-[rgba(20,184,166,0.35)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--marketing-focus)]"
              >
                <h3 className="text-lg font-semibold text-[var(--marketing-text-primary)] group-hover:text-[var(--marketing-accent-hover)]">
                  {module.label}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--marketing-text-secondary)]">
                  {module.description}
                </p>
                <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[var(--marketing-accent-hover)]">
                  Explore module
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </span>
              </Link>
            ))}
          </div>
        </MarketingContainer>
      </MarketingSection>

      <MarketingSection tone="muted">
        <MarketingContainer>
          <div className="grid gap-8 lg:grid-cols-2">
            <div>
              <SectionHeading
                eyebrow="Outcomes"
                title="What improves without promising magic"
                description="These are workflow outcomes, not invented performance metrics."
                align="left"
              />
              <ul className="space-y-3">
                {content.outcomes.map((outcome) => (
                  <li key={outcome} className="flex gap-3 text-[var(--marketing-text-secondary)]">
                    <AlphaIcon name="check" variant="trust" size="md" className="mt-1 shrink-0" />
                    <span>{outcome}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <SectionHeading
                eyebrow="Setup"
                title="A practical path to launch"
                description="Start with the records and workflows you already use, then connect them inside AlphaClone."
                align="left"
              />
              <ol className="space-y-3">
                {content.setup.map((step, index) => (
                  <li key={step} className="mkt-surface flex gap-4 p-4">
                    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[var(--marketing-accent-soft)] text-sm font-bold text-[var(--marketing-accent-hover)]">
                      {index + 1}
                    </span>
                    <span className="text-sm leading-relaxed text-[var(--marketing-text-secondary)]">
                      {step}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </MarketingContainer>
      </MarketingSection>

      <MarketingSection tone="accent">
        <MarketingContainer>
          <ConversionBanner title={content.ctaTitle} description={content.ctaDescription} />
        </MarketingContainer>
      </MarketingSection>
    </main>
  );
}
