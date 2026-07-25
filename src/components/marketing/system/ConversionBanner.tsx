import { PrimaryCTA, SecondaryCTA } from './CtaButtons';

export function ConversionBanner({
  title = 'Ready to run your business from one workspace?',
  description = 'Start a 14-day trial or book a live walkthrough with a real AlphaClone workspace.',
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-[var(--marketing-radius-lg)] border border-[rgba(20,184,166,0.28)] bg-gradient-to-br from-[rgba(20,184,166,0.18)] via-[var(--marketing-surface)] to-[var(--marketing-bg-secondary)] p-8 sm:p-10">
      <div className="marketing-glow-hero opacity-60" aria-hidden="true" />
      <div className="relative z-10 max-w-2xl">
        <h2 className="font-marketing-heading text-2xl sm:text-3xl text-[var(--marketing-text-primary)]">
          {title}
        </h2>
        <p className="mt-3 text-[var(--marketing-text-secondary)]">{description}</p>
        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <PrimaryCTA />
          <SecondaryCTA />
        </div>
      </div>
    </div>
  );
}
