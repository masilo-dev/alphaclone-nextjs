'use client';

import React from 'react';
import { BarChart3, ChevronRight } from 'lucide-react';
import { MODULE_IDENTITY, type ModuleId } from '@/constants/brand';
import { DASHBOARD_COLORS } from '@/types/dashboardStats';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

export function resolveChartAccent(moduleId?: ModuleId | string, fallback: string = DASHBOARD_COLORS.blue) {
  if (moduleId && moduleId in MODULE_IDENTITY) {
    return MODULE_IDENTITY[moduleId as ModuleId].primary;
  }
  return fallback;
}

export function formatChartValue(value: number, valuePrefix = '') {
  const n = Number(value || 0);
  if (Math.abs(n) >= 1_000_000) return `${valuePrefix}${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${valuePrefix}${Math.round(n / 1_000)}k`;
  return `${valuePrefix}${n.toLocaleString()}`;
}

export function RichChartTooltip({
  active,
  payload,
  label,
  valuePrefix = '',
  dual,
}: {
  active?: boolean;
  payload?: Array<{ value?: number; name?: string; color?: string; dataKey?: string }>;
  label?: string;
  valuePrefix?: string;
  dual?: boolean;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="min-w-[150px] rounded-lg border border-white/10 bg-slate-950/95 p-3 shadow-2xl shadow-black/30 backdrop-blur">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</p>
      <div className="mt-2 space-y-1.5">
        {payload.map((item) => {
          const name = item.dataKey === 'value2' || item.name === 'value2' ? 'Collected' : dual ? 'Invoiced' : 'Total';
          return (
            <div key={`${item.dataKey || item.name}-${item.color}`} className="flex items-center justify-between gap-4">
              <span className="inline-flex items-center gap-2 text-[12px] font-medium text-slate-300">
                <span className="h-2 w-2 rounded-full" style={{ background: item.color || DASHBOARD_COLORS.blue }} />
                {name}
              </span>
              <span className="text-[13px] font-black tabular-nums text-white">
                {formatChartValue(Number(item.value || 0), valuePrefix)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function RichChartEmptyState({
  title = 'No data yet',
  description = 'Once this workspace has activity, this chart will show the trend here.',
  actionLabel,
  onAction,
  accentColor = DASHBOARD_COLORS.blue,
}: {
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  accentColor?: string;
}) {
  const { t } = useLanguage();
  return (
    <div className="flex h-[240px] items-center justify-center">
      <div className="mx-auto max-w-[22rem] text-center">
        <span
          className="mx-auto flex h-11 w-11 items-center justify-center rounded-lg border"
          style={{
            color: accentColor,
            borderColor: `color-mix(in srgb, ${accentColor} 28%, transparent)`,
            background: `color-mix(in srgb, ${accentColor} 10%, transparent)`,
          }}
        >
          <BarChart3 className="h-5 w-5" aria-hidden />
        </span>
        <p className="mt-3 text-sm font-semibold text-white">{t(title)}</p>
        <p className="mt-1 text-[12px] leading-relaxed text-[var(--ws-text-tertiary)]">{t(description)}</p>
        {actionLabel && onAction ? (
          <button
            type="button"
            onClick={onAction}
            className={cn(
              'mt-4 inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-3 text-[12px] font-bold transition-colors hover:bg-white/[0.04]',
            )}
            style={{ borderColor: `color-mix(in srgb, ${accentColor} 28%, transparent)`, color: accentColor }}
          >
            {t(actionLabel)}
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </button>
        ) : null}
      </div>
    </div>
  );
}
