import { PrimaryCTA, SecondaryCTA } from './CtaButtons';

export function ConversionBanner({
  title = 'Ready to run your business from one workspace?',
  description = 'Start your 14-day trial. No credit card required.',
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="mkt-mid-cta">
      <div>
        <h2 className="font-marketing-heading text-xl sm:text-2xl text-white">{title}</h2>
        <p className="mt-3 text-[var(--text-secondary)]">{description}</p>
      </div>
      <div className="mkt-mid-cta-actions">
        <PrimaryCTA className="mkt-btn-large" />
        <SecondaryCTA className="mkt-btn-large" />
      </div>
    </div>
  );
}
