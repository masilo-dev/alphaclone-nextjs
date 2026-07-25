import MarketingLandingShell from '@/components/landing/MarketingLandingShell';
import type { Metadata } from 'next';
import { absoluteUrl } from '@/lib/siteUrl';
import { OUTCOME_CASE_STUDIES } from '@/config/marketingOutcomes';
import { ConversionBanner } from '@/components/marketing/system/ConversionBanner';
import { MarketingContainer, MarketingSection, SectionHeading } from '@/components/marketing/system/LayoutPrimitives';

export const metadata: Metadata = {
  title: 'Results & Workflow Stories | AlphaClone Systems',
  description:
    'See how service businesses connect leads, delivery, contracts, and billing in one workspace — representative workflow stories by team type.',
  alternates: { canonical: absoluteUrl('/results') },
  openGraph: {
    images: [{ url: '/opengraph-image', width: 1200, height: 630 }],
    title: 'Results & Workflow Stories | AlphaClone Systems',
    description: 'Before-and-after workflows for consultants, agencies, and founders replacing fragmented SaaS stacks.',
    url: absoluteUrl('/results'),
    type: 'website',
  },
};

export default function ResultsPage() {
  return (
    <MarketingLandingShell>
      <main className="bg-[var(--marketing-bg-primary)]">
        <MarketingSection className="pt-16 sm:pt-20">
          <MarketingContainer>
            <SectionHeading
              eyebrow="Workflow stories"
              title="What changes when client work shares one workspace"
              description="Each story follows the same structure: the problem, what changed in the workflow, and the business outcome."
            />
            <p className="mx-auto max-w-3xl rounded-[var(--marketing-radius-md)] border border-[var(--marketing-border)] bg-[var(--marketing-surface)] px-4 py-3 text-center text-sm text-[var(--marketing-text-muted)]">
              Stories on this page are representative workflow composites — not verified customer
              metrics. Request a live demo for audited outcomes from your segment.
            </p>
          </MarketingContainer>
        </MarketingSection>

        <MarketingSection tone="muted" className="pt-0">
          <MarketingContainer>
            <div className="space-y-6">
              {OUTCOME_CASE_STUDIES.map((study) => (
                <article
                  key={study.id}
                  id={study.id}
                  className="mkt-surface-elevated scroll-mt-24 p-6 sm:p-8"
                >
                  <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-semibold text-[var(--marketing-text-primary)]">
                        {study.persona}
                      </h2>
                      <p className="text-sm text-[var(--marketing-text-muted)]">{study.industry}</p>
                    </div>
                    {study.representative ? (
                      <span className="rounded-full border border-[var(--marketing-border)] bg-[var(--marketing-bg-secondary)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--marketing-text-muted)]">
                        Representative scenario
                      </span>
                    ) : null}
                  </div>

                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--marketing-text-muted)]">
                    Stack replaced
                  </p>
                  <p className="mt-1 text-sm font-medium text-[var(--marketing-accent-hover)]">
                    {study.stackReplaced}
                  </p>

                  <div className="mt-6 grid gap-5 md:grid-cols-3">
                    <div className="mkt-surface p-4">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--marketing-text-muted)]">
                        Problem
                      </p>
                      <p className="text-sm leading-relaxed text-[var(--marketing-text-secondary)]">
                        {study.problem}
                      </p>
                    </div>
                    <div className="mkt-surface p-4">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--marketing-text-muted)]">
                        What changed
                      </p>
                      <p className="text-sm leading-relaxed text-[var(--marketing-text-secondary)]">
                        {study.whatChanged}
                      </p>
                    </div>
                    <div className="mkt-surface p-4">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--marketing-text-muted)]">
                        Outcome
                      </p>
                      <p className="text-sm font-medium leading-relaxed text-[var(--marketing-text-primary)]">
                        &ldquo;{study.outcome}&rdquo;
                      </p>
                    </div>
                  </div>

                  <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-[var(--marketing-text-muted)]">
                    Capabilities used
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {study.modulesUsed.map((moduleName) => (
                      <span
                        key={moduleName}
                        className="rounded-full border border-[var(--marketing-border)] bg-[var(--marketing-bg-secondary)] px-3 py-1 text-xs text-[var(--marketing-text-secondary)]"
                      >
                        {moduleName}
                      </span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </MarketingContainer>
        </MarketingSection>

        <MarketingSection tone="accent">
          <MarketingContainer>
            <ConversionBanner
              title="Want to test your own workflow?"
              description="Use a trial or live walkthrough to inspect AlphaClone with your actual client process, not a fabricated benchmark."
            />
          </MarketingContainer>
        </MarketingSection>
      </main>
    </MarketingLandingShell>
  );
}
