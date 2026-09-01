/**
 * Shared reporting periods for KPI comparison across modules.
 * Compare selected period with the immediately preceding equivalent period.
 */

export type MetricPeriodPreset =
  | 'today'
  | 'last_7_days'
  | 'last_30_days'
  | 'this_month'
  | 'previous_month'
  | 'this_quarter'
  | 'this_year'
  | 'custom';

export interface MetricDateRange {
  preset: MetricPeriodPreset;
  start: Date;
  end: Date;
  /** Prior period of equal length, ending the day before `start`. */
  previousStart: Date;
  previousEnd: Date;
  label: string;
  comparisonLabel: string;
}

export const METRIC_PERIOD_OPTIONS: Array<{ id: MetricPeriodPreset; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'last_7_days', label: 'Last 7 days' },
  { id: 'last_30_days', label: 'Last 30 days' },
  { id: 'this_month', label: 'This month' },
  { id: 'previous_month', label: 'Previous month' },
  { id: 'this_quarter', label: 'This quarter' },
  { id: 'this_year', label: 'This year' },
];

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function addDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

function quarterStart(d: Date): Date {
  const q = Math.floor(d.getMonth() / 3);
  return new Date(d.getFullYear(), q * 3, 1);
}

export function resolveMetricDateRange(
  preset: MetricPeriodPreset,
  now = new Date(),
  custom?: { start: Date; end: Date },
): MetricDateRange {
  const today = startOfDay(now);

  if (preset === 'custom' && custom) {
    const start = startOfDay(custom.start);
    const end = endOfDay(custom.end);
    const ms = end.getTime() - start.getTime() + 1;
    const previousEnd = addDays(start, -1);
    const previousStart = new Date(previousEnd.getTime() - ms + 1);
    return {
      preset,
      start,
      end,
      previousStart: startOfDay(previousStart),
      previousEnd: endOfDay(previousEnd),
      label: 'Custom range',
      comparisonLabel: 'vs previous equivalent period',
    };
  }

  switch (preset) {
    case 'today': {
      const previous = addDays(today, -1);
      return {
        preset,
        start: today,
        end: endOfDay(now),
        previousStart: startOfDay(previous),
        previousEnd: endOfDay(previous),
        label: 'Today',
        comparisonLabel: 'vs yesterday',
      };
    }
    case 'last_7_days': {
      const start = addDays(today, -6);
      const prevEnd = addDays(start, -1);
      const prevStart = addDays(prevEnd, -6);
      return {
        preset,
        start,
        end: endOfDay(now),
        previousStart: startOfDay(prevStart),
        previousEnd: endOfDay(prevEnd),
        label: 'Last 7 days',
        comparisonLabel: 'vs previous 7 days',
      };
    }
    case 'this_month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const prevEnd = addDays(start, -1);
      const prevStart = new Date(prevEnd.getFullYear(), prevEnd.getMonth(), 1);
      return {
        preset,
        start,
        end: endOfDay(now),
        previousStart: startOfDay(prevStart),
        previousEnd: endOfDay(prevEnd),
        label: 'This month',
        comparisonLabel: 'vs previous month',
      };
    }
    case 'previous_month': {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = endOfDay(new Date(now.getFullYear(), now.getMonth(), 0));
      const prevEnd = addDays(start, -1);
      const prevStart = new Date(prevEnd.getFullYear(), prevEnd.getMonth(), 1);
      return {
        preset,
        start,
        end,
        previousStart: startOfDay(prevStart),
        previousEnd: endOfDay(prevEnd),
        label: 'Previous month',
        comparisonLabel: 'vs month before',
      };
    }
    case 'this_quarter': {
      const start = quarterStart(now);
      const prevEnd = addDays(start, -1);
      const prevStart = quarterStart(prevEnd);
      return {
        preset,
        start,
        end: endOfDay(now),
        previousStart: startOfDay(prevStart),
        previousEnd: endOfDay(prevEnd),
        label: 'This quarter',
        comparisonLabel: 'vs previous quarter',
      };
    }
    case 'this_year': {
      const start = new Date(now.getFullYear(), 0, 1);
      const prevEnd = addDays(start, -1);
      const prevStart = new Date(prevEnd.getFullYear(), 0, 1);
      return {
        preset,
        start,
        end: endOfDay(now),
        previousStart: startOfDay(prevStart),
        previousEnd: endOfDay(prevEnd),
        label: 'This year',
        comparisonLabel: 'vs previous year',
      };
    }
    case 'last_30_days':
    default: {
      const start = addDays(today, -29);
      const prevEnd = addDays(start, -1);
      const prevStart = addDays(prevEnd, -29);
      return {
        preset: 'last_30_days',
        start,
        end: endOfDay(now),
        previousStart: startOfDay(prevStart),
        previousEnd: endOfDay(prevEnd),
        label: 'Last 30 days',
        comparisonLabel: 'vs previous 30 days',
      };
    }
  }
}

export function periodPresetToIsoRange(preset: MetricPeriodPreset): {
  startIso: string;
  endIso: string;
  previousStartIso: string;
  previousEndIso: string;
  comparisonLabel: string;
} {
  const range = resolveMetricDateRange(preset);
  return {
    startIso: range.start.toISOString(),
    endIso: range.end.toISOString(),
    previousStartIso: range.previousStart.toISOString(),
    previousEndIso: range.previousEnd.toISOString(),
    comparisonLabel: range.comparisonLabel,
  };
}

/** Bonnie analytics API accepts 1–90 day windows. */
export function periodPresetToDayCount(preset: MetricPeriodPreset, now = new Date()): number {
  const range = resolveMetricDateRange(preset, now);
  const ms = range.end.getTime() - range.start.getTime();
  return Math.max(1, Math.min(90, Math.ceil(ms / 86_400_000)));
}
