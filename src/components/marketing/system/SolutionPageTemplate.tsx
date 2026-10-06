'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { AlphaIcon } from '@/components/marketing/icons';
import { ConversionBanner } from './ConversionBanner';
import { MarketingContainer, MarketingSection, SectionHeading } from './LayoutPrimitives';
import { PrimaryCTA, SecondaryCTA } from './CtaButtons';
import { DEMO_HREF } from '@/lib/marketing/cta';
import { EXECUTION_LAYER } from '@/config/marketingPositioning';
import { useLanguage } from '@/contexts/LanguageContext';

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
  const { t } = useLanguage();
  return (
    <div className="bg-[var(--marketing-bg-primary)]">
      <MarketingSection className="relative overflow-hidden pt-16 sm:pt-20">
        <div className="marketing-glow-hero" aria-hidden="true" />
        <MarketingContainer className="relative z-10">
          <div className="mx-auto max-w-4xl text-center">
            <p className="mkt-label mb-5">{t(content.eyebrow)}</p>
            <h1>{t(content.title)}</h1>
            <p className="mx-auto mt-5 max-w-3xl text-lg sm:text-xl text-[var(--marketing-text-secondary)]">
              {t(content.description)}
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <PrimaryCTA href={DEMO_HREF} />
              <SecondaryCTA href={EXECUTION_LAYER.workflowPath} />
            </div>
          </div>
        </MarketingContainer>
      </MarketingSection>

      <MarketingSection tone="muted">
        <MarketingContainer>
          <div className="grid gap-6 lg:grid-cols-2">
            <article className="mkt-surface-elevated p-6 sm:p-8">
              <p className="mkt-label mb-4">{t('Problem')}</p>
              <h2 className="text-2xl font-semibold text-[var(--marketing-text-primary)]">
                {t('Where work gets stuck')}
              </h2>
              <p className="mt-4 text-[var(--marketing-text-secondary)]">{t(content.problem)}</p>
            </article>
            <article className="mkt-surface-elevated p-6 sm:p-8">
              <p className="mkt-label mb-4">{t('Workflow change')}</p>
              <h2 className="text-2xl font-semibold text-[var(--marketing-text-primary)]">
                {t('How AlphaClone changes the day')}
              </h2>
              <p className="mt-4 text-[var(--marketing-text-secondary)]">{t(content.workflowChange)}</p>
            </article>
          </div>
        </MarketingContainer>
      </MarketingSection>

      <MarketingSection>
        <MarketingContainer>
          <SectionHeading
            eyebrow={t('Relevant modules')}
            title={t('The parts of AlphaClone this solution uses')}
            description={t('Each module links back to the product area so teams can inspect the underlying workflow.')}
          />
          <div className="grid gap-4 md:grid-cols-3">
            {content.modules.map((module) => (
              <Link
                key={module.href}
                href={module.href}
                className="mkt-surface group block p-5 transition-colors hover:border-[var(--marketing-accent-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--marketing-focus)]"
              >
                <h3 className="text-lg font-semibold text-[var(--marketing-text-primary)] group-hover:text-[var(--marketing-accent-hover)]">
                  {t(module.label)}
                </h3>
                <p className="mt-2 type-caption leading-relaxed text-[var(--marketing-text-secondary)]">
                  {t(module.description)}
                </p>
                <span className="mt-4 inline-flex items-center gap-2 type-ui font-semibold text-[var(--marketing-accent-hover)]">
                  {t('Explore module')}
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
                eyebrow={t('Outcomes')}
                title={t('What improves without promising magic')}
                description={t('These are workflow outcomes, not invented performance metrics.')}
                align="left"
              />
              <ul className="space-y-3">
                {content.outcomes.map((outcome) => (
                  <li key={outcome} className="flex gap-3 text-[var(--marketing-text-secondary)]">
                    <AlphaIcon name="check" variant="trust" size="md" className="mt-1 shrink-0" />
                    <span>{t(outcome)}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <SectionHeading
                eyebrow={t('Setup')}
                title={t('A practical path to launch')}
                description={t('Start with the records and workflows you already use, then connect them inside AlphaClone.')}
                align="left"
              />
              <ol className="space-y-3">
                {content.setup.map((step, index) => (
                  <li key={step} className="mkt-surface flex gap-4 p-4">
                    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[var(--marketing-accent-soft)] type-ui font-bold text-[var(--marketing-accent-hover)]">
                      {index + 1}
                    </span>
                    <span className="type-caption leading-relaxed text-[var(--marketing-text-secondary)]">
                      {t(step)}
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
          <ConversionBanner title={t(content.ctaTitle)} description={t(content.ctaDescription)} />
        </MarketingContainer>
      </MarketingSection>
    </div>
  );
}
