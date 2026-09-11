'use client';

import type { ComponentType } from 'react';
import { AlertCircle, Ban, Minus } from 'lucide-react';
import { IntelligentKpiCard } from '@/components/ui/intelligence';
import type { AlphacloneIconProps } from '@/components/icons/alphaclone';
import { WORKSPACE } from '@/constants/design';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import type { PlatformKpiCardModel } from '@/lib/metrics/metricPresentation';

export interface PlatformKpiCardProps extends PlatformKpiCardModel {
  icon?: ComponentType<AlphacloneIconProps>;
  iconColor?: string;
  compact?: boolean;
  className?: string;
  onClick?: () => void;
}

function StateShell({
  label,
  message,
  icon: Icon,
  className,
}: {
  label: string;
  message: string;
  icon: ComponentType<{ className?: string }>;
  className?: string;
}) {
  const { t } = useLanguage();
  return (
    <div
      className={cn(
        WORKSPACE.panel.base,
        'p-4 min-h-[112px] flex flex-col justify-between',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[13px] font-medium text-[var(--ws-text-secondary)] truncate">{t(label)}</p>
        <Icon className="w-4 h-4 text-[var(--ws-text-muted)] shrink-0" aria-hidden />
      </div>
      <p className="mt-3 text-sm text-[var(--ws-text-muted)] leading-snug">{t(message)}</p>
    </div>
  );
}

/**
 * Canonical KPI card for all AlphaClone modules.
 * Wraps IntelligentKpiCard with loading, empty, error, and permission states.
 */
export function PlatformKpiCard({
  label,
  description,
  current,
  previous = 0,
  formattedValue,
  unit = '',
  isPercentage = false,
  isBetterHigher = true,
  referencePeriod,
  href,
  trend,
  state,
  errorMessage,
  estimated,
  icon,
  iconColor,
  compact,
  className,
  onClick,
}: PlatformKpiCardProps) {
  const { t } = useLanguage();
  if (state === 'loading') {
    return (
      <IntelligentKpiCard
        label={label}
        current={0}
        loading
        className={className}
        compact={compact}
      />
    );
  }

  if (state === 'restricted') {
    return (
      <StateShell
        label={label}
        message="You do not have permission to view this metric."
        icon={Ban}
        className={className}
      />
    );
  }

  if (state === 'error') {
    return (
      <StateShell
        label={label}
        message={errorMessage || 'This metric could not be loaded.'}
        icon={AlertCircle}
        className={className}
      />
    );
  }

  if (state === 'empty') {
    return (
      <StateShell
        label={label}
        message="No data available."
        icon={Minus}
        className={className}
      />
    );
  }

  return (
    <div
      className={cn('relative', className)}
      title={description ? `${t(description)}${estimated ? ` (${t('Estimated or delayed.')})` : ''}` : undefined}
    >
      <IntelligentKpiCard
        label={label}
        current={current}
        previous={previous}
        isBetterHigher={isBetterHigher}
        unit={unit}
        isPercentage={isPercentage}
        displayValue={formattedValue}
        referencePeriod={referencePeriod}
        href={href}
        onClick={onClick}
        icon={icon}
        iconColor={iconColor}
        trend={trend}
        compact={compact}
      />
      {estimated ? (
        <span className="absolute top-3 right-3 text-[10px] uppercase tracking-wide text-[var(--ws-text-muted)]">
          {t('Est.')}
        </span>
      ) : null}
    </div>
  );
}

export function PlatformKpiCardSkeleton({ className }: { className?: string }) {
  return (
    <IntelligentKpiCard label="Loading" current={0} loading className={className} />
  );
}
