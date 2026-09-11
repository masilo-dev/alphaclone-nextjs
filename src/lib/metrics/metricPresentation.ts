/**
 * Converts API / tab metrics into Platform KPI card props with correct sentiment.
 */

import type { DeltaColor, DashboardMetric } from '@/types/dashboardStats';
import {
  getMetricDefinition,
  metricPolarityIsBetterHigher,
  type MetricPolarity,
} from '@/lib/metrics/platformMetricRegistry';
import { ENTERPRISE } from '@/constants/design';

export type PlatformKpiState = 'ready' | 'loading' | 'empty' | 'error' | 'restricted';

export interface PlatformKpiCardModel {
  label: string;
  description?: string;
  current: number;
  previous?: number;
  formattedValue?: string;
  unit?: string;
  isPercentage?: boolean;
  isBetterHigher?: boolean;
  referencePeriod?: string;
  href?: string;
  trend?: number[];
  state: PlatformKpiState;
  errorMessage?: string;
  estimated?: boolean;
  metricId?: string;
}

function parseNumericValue(raw: string | number): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  const cleaned = String(raw).replace(/[^0-9.-]/g, '');
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function parseDeltaPercent(delta?: string): number | null {
  if (!delta) return null;
  const cleaned = delta.replace(/[^0-9.-]/g, '');
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function deltaColorToPolarity(color?: DeltaColor): MetricPolarity {
  switch (color) {
    case 'red':
      return 'lower_is_better';
    case 'amber':
      return 'neutral';
    case 'blue':
    case 'teal':
      return 'neutral';
    case 'green':
    default:
      return 'higher_is_better';
  }
}

function inferIsBetterHigher(metric: DashboardMetric, metricId?: string): boolean {
  const def = metricId ? getMetricDefinition(metricId) : undefined;
  if (def) return metricPolarityIsBetterHigher(def.polarity);
  return metricPolarityIsBetterHigher(deltaColorToPolarity(metric.deltaColor));
}

export function platformKpiFromDashboardMetric(
  metric: DashboardMetric,
  options?: {
    metricId?: string;
    previous?: number;
    trend?: number[];
    state?: PlatformKpiState;
    href?: string;
  },
): PlatformKpiCardModel {
  const def = options?.metricId ? getMetricDefinition(options.metricId) : undefined;
  const current = parseNumericValue(metric.value);
  const isPct = String(metric.value).includes('%') || def?.format === 'percent';
  const state =
    options?.state ??
    (current == null && metric.value !== 0 && metric.value !== '0'
      ? 'empty'
      : 'ready');

  const deltaPct = parseDeltaPercent(metric.delta);
  let previous = options?.previous;
  if (previous == null && deltaPct != null && current != null && deltaPct !== -100) {
    previous = Math.round(current / (1 + deltaPct / 100));
  }

  return {
    metricId: options?.metricId,
    label: metric.label,
    description: def?.description,
    current: current ?? 0,
    previous: previous ?? 0,
    formattedValue: typeof metric.value === 'string' ? metric.value : undefined,
    isPercentage: isPct,
    isBetterHigher: inferIsBetterHigher(metric, options?.metricId),
    referencePeriod:
      metric.comparisonText ?? def?.description ?? ENTERPRISE.metricCard.defaultComparison,
    href: options?.href ?? def?.href,
    trend: options?.trend,
    state,
    estimated: def?.estimated,
  };
}

export function platformKpiFromModuleStat(input: {
  label: string;
  value: string | number;
  sub?: string;
  trend?: number;
  metricId?: string;
  isBetterHigher?: boolean;
  href?: string;
  state?: PlatformKpiState;
}): PlatformKpiCardModel {
  const current = parseNumericValue(input.value);
  let previous: number | undefined;
  if (input.trend != null && current != null && input.trend !== -100) {
    previous = Math.round(current / (1 + input.trend / 100));
  }

  const model = platformKpiFromNumbers({
    metricId: input.metricId,
    label: input.label,
    current,
    previous,
    formattedValue: typeof input.value === 'string' ? input.value : undefined,
    referencePeriod: input.sub,
    href: input.href,
    state: input.state,
  });

  if (input.isBetterHigher != null) {
    return { ...model, isBetterHigher: input.isBetterHigher };
  }
  return model;
}

export function platformKpiFromNumbers(input: {
  metricId?: string;
  label: string;
  current: number | null;
  previous?: number | null;
  formattedValue?: string;
  unit?: string;
  isPercentage?: boolean;
  isBetterHigher?: boolean;
  referencePeriod?: string;
  href?: string;
  trend?: number[];
  state?: PlatformKpiState;
  errorMessage?: string;
}): PlatformKpiCardModel {
  const def = input.metricId ? getMetricDefinition(input.metricId) : undefined;
  const hasValue = input.current != null && Number.isFinite(input.current);
  const state =
    input.state ??
    (input.errorMessage ? 'error' : !hasValue ? 'empty' : 'ready');

  const isBetterHigher =
    input.isBetterHigher ??
    (def ? metricPolarityIsBetterHigher(def.polarity) : true);

  return {
    metricId: input.metricId,
    label: input.label,
    description: def?.description,
    current: hasValue ? (input.current as number) : 0,
    previous: input.previous ?? 0,
    formattedValue: input.formattedValue,
    unit: input.unit,
    isPercentage: input.isPercentage ?? def?.format === 'percent',
    isBetterHigher,
    referencePeriod: input.referencePeriod ?? ENTERPRISE.metricCard.defaultComparison,
    href: input.href ?? def?.href,
    trend: input.trend,
    state,
    errorMessage: input.errorMessage,
    estimated: def?.estimated,
  };
}
