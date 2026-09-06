'use client';

import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  METRIC_PERIOD_OPTIONS,
  type MetricPeriodPreset,
} from '@/lib/metrics/dateRange';

interface MetricDateRangeSelectorProps {
  value: MetricPeriodPreset;
  onChange: (preset: MetricPeriodPreset) => void;
  className?: string;
  compact?: boolean;
}

/**
 * Consistent period selector for module KPI rows.
 */
export function MetricDateRangeSelector({
  value,
  onChange,
  className,
  compact = false,
}: MetricDateRangeSelectorProps) {
  const { t } = useLanguage();
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-1.5',
        compact ? '' : 'mb-4',
        className,
      )}
      role="group"
      aria-label={t('Reporting period')}
    >
      {METRIC_PERIOD_OPTIONS.map((opt) => {
        const active = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={cn(
              'h-8 px-3 rounded-md text-[12px] font-medium border transition-colors',
              active
                ? 'bg-[color-mix(in_srgb,var(--brand-green-500,#22c55e)_14%,transparent)] text-[var(--ws-text-primary)] border-[color-mix(in_srgb,var(--brand-green-500,#22c55e)_35%,transparent)]'
                : 'bg-[var(--ws-surface-secondary)] text-[var(--ws-text-secondary)] border-[var(--ws-border)] hover:bg-[var(--ws-hover)] hover:text-[var(--ws-text-primary)]',
            )}
            aria-pressed={active}
          >
            {t(opt.label)}
          </button>
        );
      })}
    </div>
  );
}
