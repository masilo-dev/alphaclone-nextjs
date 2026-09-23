import { COMPANY_LEGAL, formatLegalAddress } from '@/lib/seo/siteEntity';

type Props = {
  className?: string;
  showAddress?: boolean;
  /** Tighter spacing for trust pages */
  compact?: boolean;
};

/** Compact company identity block for trust/legal pages. */
export default function CompanyInfoBlock({
  className = '',
  showAddress = true,
  compact = false,
}: Props) {
  return (
    <div
      className={`rounded-[var(--marketing-radius-md)] border border-[var(--marketing-border)] bg-[var(--marketing-surface)] ${
        compact ? 'p-4 sm:p-5' : 'p-5 sm:p-6'
      } ${className}`.trim()}
    >
      <p className="type-caption font-bold uppercase tracking-widest text-[var(--marketing-accent-hover)] mb-3">
        Company
      </p>
      <p className="type-card-description font-semibold text-[var(--marketing-text-primary)]">
        {COMPANY_LEGAL.legalName}
      </p>
      {showAddress ? (
        <p className="mt-2 type-caption text-[var(--marketing-text-secondary)] leading-relaxed">
          {formatLegalAddress()}
        </p>
      ) : null}
    </div>
  );
}
