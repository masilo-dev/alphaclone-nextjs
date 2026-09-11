'use client';

export type KpiStatus = 'healthy' | 'improving' | 'warning' | 'critical' | 'stagnant' | 'neutral' | 'insufficient_data';

export type TrendDirection = 'up' | 'down' | 'flat';

export interface KpiComparison {
  current: number;
  previous: number;
  absoluteChange: number;
  percentageChange: number | null;
  percentagePointsChange: number | null;
  referencePeriod: string;
  trend: TrendDirection;
}

export interface KpiWithTarget extends KpiComparison {
  target: number | null;
  progressPct: number | null;
  requiredPace: number | null;
  currentPace: number | null;
  daysRemaining: number | null;
  status: KpiStatus;
}

export interface FullKpiViewModel extends KpiWithTarget {
  label: string;
  valueFormatted: string;
  formattedDelta: string;
  statusLabel: string;
  contextNarrative: string;
  isBetterHigher: boolean;
}

export function computeComparison(
  current: number,
  previous: number,
  opts: { isPercentage?: boolean; referencePeriod?: string } = {},
): KpiComparison {
  const { isPercentage = false, referencePeriod = 'vs previous period' } = opts;
  const currentSafe = Number.isFinite(current) ? current : 0;
  const previousSafe = Number.isFinite(previous) ? previous : 0;
  const absoluteChange = currentSafe - previousSafe;
  let percentageChange: number | null = null;

  if (previousSafe !== 0) {
    percentageChange = Math.round((absoluteChange / Math.abs(previousSafe)) * 1000) / 10;
  } else if (currentSafe > 0) {
    percentageChange = 100;
  }

  const percentagePointsChange = isPercentage ? absoluteChange : null;

  let trend: TrendDirection = 'flat';
  const threshold = isPercentage ? 0.5 : 1;
  if (Math.abs(absoluteChange) >= threshold) {
    trend = absoluteChange > 0 ? 'up' : 'down';
  }

  return {
    current: currentSafe,
    previous: previousSafe,
    absoluteChange,
    percentageChange,
    percentagePointsChange,
    referencePeriod,
    trend,
  };
}

export function computeKpiStatus(
  comparison: KpiComparison,
  opts: {
    target?: number | null;
    isBetterHigher?: boolean;
    warningThreshold?: number;
    criticalThreshold?: number;
    improvementThreshold?: number;
  } = {},
): KpiStatus {
  const {
    target = null,
    isBetterHigher = true,
    warningThreshold = 10,
    criticalThreshold = 25,
    improvementThreshold = 5,
  } = opts;

  const { current, percentageChange } = comparison;

  if (target && target > 0) {
    const pct = (current / target) * 100;
    if (pct < (100 - criticalThreshold)) return 'critical';
    if (pct < (100 - warningThreshold)) return 'warning';
    if (pct >= 100) return 'healthy';
  }

  if (percentageChange == null) return target ? 'stagnant' : 'insufficient_data';

  const delta = isBetterHigher ? percentageChange : -percentageChange;

  if (delta >= improvementThreshold) return 'improving';
  if (delta <= -criticalThreshold) return 'critical';
  if (delta <= -warningThreshold) return 'warning';
  if (Math.abs(delta) < 1) return 'stagnant';

  return 'neutral';
}

export function formatDelta(comparison: KpiComparison, opts: { isPercentage?: boolean; label?: string } = {}): string {
  const { isPercentage = false } = opts;
  const { percentageChange, percentagePointsChange, absoluteChange, trend } = comparison;

  if (trend === 'flat' || percentageChange == null) {
    if (Math.abs(absoluteChange) > 0) {
      const sign = absoluteChange > 0 ? '+' : '';
      return isPercentage
        ? `${sign}${Math.round(absoluteChange * 10) / 10} pp · flat trend`
        : `${sign}${absoluteChange.toLocaleString()} · flat trend`;
    }
    return 'No meaningful change';
  }

  const sign = percentageChange > 0 ? '+' : '';
  if (isPercentage && percentagePointsChange != null) {
    const ppSign = percentagePointsChange > 0 ? '+' : '';
    return `${ppSign}${Math.round(percentagePointsChange * 10) / 10} pp (${sign}${percentageChange.toFixed(1)}%)`;
  }

  return `${sign}${percentageChange.toFixed(1)}%`;
}

export function statusToLabel(status: KpiStatus): string {
  const map: Record<KpiStatus, string> = {
    healthy: 'On target',
    improving: 'Improving',
    warning: 'Needs attention',
    critical: 'At risk',
    stagnant: 'Stagnant',
    neutral: 'Stable',
    insufficient_data: 'Collecting data',
  };
  return map[status];
}

export function buildNarrative(
  label: string,
  kpi: KpiWithTarget,
  opts: { isBetterHigher?: boolean; unit?: string; isPercentage?: boolean } = {},
): string {
  const { isBetterHigher = true, unit = '', isPercentage = false } = opts;
  const { current, target, progressPct, status, percentageChange, previous } = kpi;

  if (status === 'insufficient_data' || (!percentageChange && !target)) {
    return `Tracking ${label.toLowerCase()} — ${current.toLocaleString()}${unit} recorded.`;
  }

  const movement = percentageChange
    ? (percentageChange > 0 ? (isBetterHigher ? 'up' : 'down') : isBetterHigher ? 'down' : 'up')
    : null;

  const magnitude = percentageChange
    ? Math.abs(percentageChange) >= 20
      ? 'sharply'
      : Math.abs(percentageChange) >= 5
        ? 'notably'
        : 'slightly'
    : null;

  let againstTarget = '';
  if (target && progressPct != null) {
    if (progressPct >= 100) {
      againstTarget = ` · on target at ${progressPct}%`;
    } else {
      againstTarget = ` · ${progressPct}% of ${target.toLocaleString()}${unit} goal`;
    }
  }

  let comparative = '';
  if (percentageChange != null && previous > 0) {
    comparative = movement && magnitude ? ` ${movement} ${magnitude} from ${previous.toLocaleString()}${unit}` : '';
  }

  let implication = '';
  if (status === 'critical') {
    implication = isBetterHigher ? ' Action recommended soon.' : ' Review for impact.';
  } else if (status === 'warning') {
    implication = ' Monitor closely.';
  } else if (status === 'improving') {
    implication = isBetterHigher ? ' Maintain current momentum.' : ' Confirm cause.';
  } else if (status === 'healthy') {
    implication = ' Keep the pattern going.';
  }

  const valueText = isPercentage ? `${current.toFixed(1)}%` : `${current.toLocaleString()}${unit}`;

  return `${label}: ${valueText}${comparative}${againstTarget}.${implication}`;
}

export function computePace({
  currentValue,
  targetValue,
  periodStart,
  periodEnd,
  asOf,
}: {
  currentValue: number;
  targetValue: number;
  periodStart: Date;
  periodEnd: Date;
  asOf?: Date;
}): { requiredPace: number | null; currentPace: number | null; daysRemaining: number | null; progressPct: number | null } {
  const now = asOf ?? new Date();
  const totalMs = periodEnd.getTime() - periodStart.getTime();
  if (totalMs <= 0 || targetValue <= 0) {
    return { requiredPace: null, currentPace: null, daysRemaining: null, progressPct: null };
  }

  const elapsedMs = Math.max(0, now.getTime() - periodStart.getTime());
  const remainingMs = Math.max(0, periodEnd.getTime() - now.getTime());
  const daysRemaining = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));
  const elapsedDays = Math.max(1, Math.floor(elapsedMs / (1000 * 60 * 60 * 24)));

  const progressPct = Math.round((currentValue / targetValue) * 1000) / 10;
  const currentPace = currentValue / elapsedDays;
  const requiredPace = daysRemaining > 0 ? Math.max(0, (targetValue - currentValue) / daysRemaining) : 0;

  return {
    requiredPace: Math.round(requiredPace * 100) / 100,
    currentPace: Math.round(currentPace * 100) / 100,
    daysRemaining,
    progressPct,
  };
}

export function buildFullKpiViewModel(input: {
  label: string;
  current: number;
  previous?: number;
  target?: number;
  isBetterHigher?: boolean;
  unit?: string;
  isPercentage?: boolean;
  referencePeriod?: string;
  pace?: { periodStart: Date; periodEnd: Date; asOf?: Date };
}): FullKpiViewModel {
  const {
    label,
    current,
    previous = 0,
    target = null,
    isBetterHigher = true,
    unit = '',
    isPercentage = false,
    referencePeriod,
    pace,
  } = input;

  const comparison = computeComparison(current, previous, { isPercentage, referencePeriod });
  const status = computeKpiStatus(comparison, { target, isBetterHigher });

  let progressPct: number | null = null;
  let requiredPace: number | null = null;
  let currentPace: number | null = null;
  let daysRemaining: number | null = null;

  if (pace) {
    const paceResult = computePace({ currentValue: current, targetValue: target ?? 0, ...pace });
    progressPct = paceResult.progressPct;
    requiredPace = paceResult.requiredPace;
    currentPace = paceResult.currentPace;
    daysRemaining = paceResult.daysRemaining;
  } else if (target && target > 0) {
    progressPct = Math.round((current / target) * 1000) / 10;
  }

  const valueFormatted = isPercentage ? `${current.toFixed(1)}%` : `${current.toLocaleString()}${unit}`;
  const formattedDelta = formatDelta(comparison, { isPercentage, label });
  const statusLabel = statusToLabel(status);
  const contextNarrative = buildNarrative(label, { ...comparison, target, progressPct, requiredPace, currentPace, daysRemaining, status }, { isBetterHigher, unit, isPercentage });

  return {
    ...comparison,
    target,
    progressPct,
    requiredPace,
    currentPace,
    daysRemaining,
    status,
    label,
    valueFormatted,
    formattedDelta,
    statusLabel,
    contextNarrative,
    isBetterHigher,
  };
}
