'use client';

import { useLanguage } from '@/contexts/LanguageContext';

export type BillingPeriod = 'monthly' | 'annual';

type MarketingPricingToggleProps = {
  value: BillingPeriod;
  onChange: (value: BillingPeriod) => void;
  className?: string;
};

export default function MarketingPricingToggle({ value, onChange, className }: MarketingPricingToggleProps) {
  const { t } = useLanguage();
  return (
    <div className={`mkt-pricing-toggle ${className ?? ''}`}>
      <div className="flex flex-col items-center gap-3">
        <div role="group" aria-label={t('Billing period')} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--marketing-border)] bg-[var(--marketing-surface-elevated)] p-1 marketing-shadow-sm">
          {(['monthly', 'annual'] as const).map((period) => (
            <button key={period} type="button" aria-pressed={value === period} onClick={() => onChange(period)} className="inline-flex min-h-10 min-w-[7rem] items-center justify-center rounded-lg px-4 py-2 type-ui font-semibold transition-colors">
              {t(period === 'monthly' ? 'Monthly' : 'Annual')}
            </button>
          ))}
        </div>
        <p className="type-card-description font-medium text-[var(--marketing-text-secondary)]">
          {t('Save up to 20% with annual billing')}
        </p>
      </div>
    </div>
  );
}
