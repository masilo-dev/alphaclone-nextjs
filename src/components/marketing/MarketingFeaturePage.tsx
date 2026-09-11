import type { ComparisonRow } from '@/config/marketingCopy';
import { PrimaryCTA, SecondaryCTA } from '@/components/marketing/system/CtaButtons';
import { MarketingContainer, MarketingSection, SectionHeading } from '@/components/marketing/system/LayoutPrimitives';

type Props = {
  title: string;
  description: string;
  bullets: string[];
  comparison: ComparisonRow[];
  competitorName: string;
};

export default function MarketingFeaturePage({ title, description, bullets, comparison, competitorName }: Props) {
  return (
    <main className="bg-[var(--marketing-bg-primary)]">
      <MarketingSection className="relative overflow-hidden pt-16 sm:pt-20">
        <div className="marketing-glow-hero" aria-hidden="true" />
        <MarketingContainer className="relative z-10">
          <SectionHeading
            eyebrow="Marketing workflows"
            title={title}
            description={description}
          />
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <PrimaryCTA />
            <SecondaryCTA href="/pricing">See pricing</SecondaryCTA>
          </div>
        </MarketingContainer>
      </MarketingSection>

      <MarketingSection tone="muted" className="pt-0">
        <MarketingContainer>
          <div className="grid gap-4 md:grid-cols-2">
            {bullets.map((bullet) => (
              <div key={bullet} className="mkt-surface p-5">
                <span className="mkt-icon-wrap mb-4" aria-hidden="true">
                  <span className="h-2.5 w-2.5 rounded-full bg-[var(--marketing-accent-hover)]" />
                </span>
                <p className="text-sm leading-relaxed text-[var(--marketing-text-secondary)]">
                  {bullet}
                </p>
              </div>
            ))}
          </div>
        </MarketingContainer>
      </MarketingSection>

      <MarketingSection>
        <MarketingContainer>
          <SectionHeading
            eyebrow="Comparison"
            title={`AlphaClone compared with ${competitorName}`}
            description="A concise view of where the marketing workflow fits inside the broader operating workspace."
          />
          <div className="overflow-x-auto rounded-[var(--marketing-radius-lg)] border border-[var(--marketing-border)]">
            <table className="w-full min-w-[640px] bg-[var(--marketing-surface)] text-sm">
              <thead>
                <tr className="border-b border-[var(--marketing-border)]">
                  <th className="p-4 text-left font-semibold text-[var(--marketing-text-primary)]">Feature</th>
                  <th className="p-4 text-left font-semibold text-[var(--marketing-accent-hover)]">AlphaClone</th>
                  <th className="p-4 text-left font-semibold text-[var(--marketing-text-primary)]">{competitorName}</th>
                </tr>
              </thead>
              <tbody>
                {comparison.map((row) => (
                  <tr key={row.feature} className="border-b border-[var(--marketing-border)] last:border-0">
                    <td className="p-4 text-[var(--marketing-text-primary)]">{row.feature}</td>
                    <td className="p-4 font-medium text-[var(--marketing-accent-hover)]">{row.alphaclone}</td>
                    <td className="p-4 text-[var(--marketing-text-secondary)]">{row.competitor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </MarketingContainer>
      </MarketingSection>
    </main>
  );
}
