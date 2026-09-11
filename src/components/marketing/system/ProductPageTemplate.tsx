import Link from 'next/link';
import type { MarketingProductFeature } from '@/lib/marketing/productFeatures';
import { MARKETING_PRODUCT_FEATURES } from '@/lib/marketing/productFeatures';
import { CtaPair } from './CtaButtons';
import { ConversionBanner } from './ConversionBanner';
import { WorkflowStep } from './FeatureBlocks';
import { MarketingContainer, MarketingSection, SectionHeading } from './LayoutPrimitives';
import ProductScreenshot from './ProductScreenshot';

type ProductPageTemplateProps = {
  feature: MarketingProductFeature;
};

function RelatedFeatureCard({ label, href }: { label: string; href: string }) {
  const matchingFeature = MARKETING_PRODUCT_FEATURES.find((item) => item.href === href);

  return (
    <Link
      href={href}
      className="mkt-surface group block p-5 transition-colors hover:border-[rgba(20,184,166,0.35)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--marketing-focus)]"
    >
      <h3 className="text-lg font-semibold text-[var(--marketing-text-primary)] group-hover:text-[var(--marketing-accent-hover)]">
        {label}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-[var(--marketing-text-secondary)]">
        {matchingFeature?.outcome ?? 'Explore how this capability connects with the rest of AlphaClone.'}
      </p>
    </Link>
  );
}

export default function ProductPageTemplate({ feature }: ProductPageTemplateProps) {
  return (
    <main className="bg-[var(--marketing-bg-primary)]">
      <MarketingSection className="relative overflow-hidden pt-16 sm:pt-20">
        <div className="marketing-glow-hero" aria-hidden="true" />
        <MarketingContainer className="relative z-10">
          <div className="mx-auto max-w-4xl text-center">
            <p className="mkt-label mb-5">{feature.name}</p>
            <h1>{feature.hero}</h1>
            <p className="mx-auto mt-5 max-w-3xl text-lg sm:text-xl text-[var(--marketing-text-secondary)]">
              {feature.summary}
            </p>
            <CtaPair className="mt-8 justify-center" />
          </div>

          {feature.screenshot ? (
            <ProductScreenshot
              src={feature.screenshot.src}
              alt={feature.screenshot.alt}
              caption={`${feature.name} view shown with demonstration data.`}
              priority
              className="mt-12"
            />
          ) : null}
        </MarketingContainer>
      </MarketingSection>

      <MarketingSection id="workflow" tone="muted">
        <MarketingContainer>
          <SectionHeading
            eyebrow="Workflow"
            title={`How ${feature.name} works in AlphaClone`}
            description="Each step keeps context on the same client record, so teams can move from interest to delivery without rebuilding the story in another tool."
          />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {feature.workflows.map((workflow, index) => (
              <WorkflowStep
                key={workflow.title}
                step={index + 1}
                title={workflow.title}
                body={workflow.body}
              />
            ))}
          </div>
        </MarketingContainer>
      </MarketingSection>

      <MarketingSection>
        <MarketingContainer>
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div>
              <SectionHeading
                eyebrow="Audience"
                title="Built for the teams who feel the handoffs"
                description={feature.audience}
                align="left"
              />
              <div className="mkt-surface-elevated p-6">
                <h3 className="text-xl font-semibold text-[var(--marketing-text-primary)]">
                  Scenario
                </h3>
                <p className="mt-3 text-[var(--marketing-text-secondary)]">
                  Use {feature.name} when the next step depends on shared context: who the customer is,
                  what they asked for, what was promised, and what still needs to happen.
                </p>
              </div>
            </div>

            <div>
              <SectionHeading
                eyebrow="Connections"
                title="Related AlphaClone modules"
                description="Product pages are connected because the operating workflow is connected."
                align="left"
              />
              <div className="grid gap-4 sm:grid-cols-2">
                {feature.connections.map((connection) => (
                  <RelatedFeatureCard
                    key={connection.href}
                    label={connection.label}
                    href={connection.href}
                  />
                ))}
              </div>
            </div>
          </div>
        </MarketingContainer>
      </MarketingSection>

      <MarketingSection tone="accent">
        <MarketingContainer>
          <ConversionBanner
            title={`Ready to try ${feature.name} in a connected workspace?`}
            description="Start a 14-day trial or book a walkthrough using a real AlphaClone workflow."
          />
        </MarketingContainer>
      </MarketingSection>
    </main>
  );
}
