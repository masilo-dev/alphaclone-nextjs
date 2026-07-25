import { CtaPair } from '@/components/marketing/system/CtaButtons';

/** Shared product/marketing conversion block — teal CTA system only. */
export default function MarketingProductCta({
  title = 'Ready to run this workflow in AlphaClone?',
  description = 'Start a 14-day trial with no card required, or book a demo to see a live workspace.',
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="mt-10 rounded-[var(--marketing-radius-lg)] border border-[rgba(20,184,166,0.28)] bg-[var(--marketing-surface)] p-6 sm:p-8">
      <h2 className="text-xl font-bold text-[var(--marketing-text-primary)] mb-2">{title}</h2>
      <p className="text-sm text-[var(--marketing-text-secondary)] mb-6 leading-relaxed">{description}</p>
      <CtaPair />
    </div>
  );
}
