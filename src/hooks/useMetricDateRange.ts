'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  METRIC_PERIOD_OPTIONS,
  resolveMetricDateRange,
  type MetricPeriodPreset,
} from '@/lib/metrics/dateRange';

export function useMetricDateRange(initial: MetricPeriodPreset = 'last_30_days') {
  const [preset, setPreset] = useState<MetricPeriodPreset>(initial);

  const range = useMemo(() => resolveMetricDateRange(preset), [preset]);

  const setPeriod = useCallback((next: MetricPeriodPreset) => {
    setPreset(next);
  }, []);

  return {
    preset,
    setPeriod,
    range,
    comparisonLabel: range.comparisonLabel,
    periodQuery: preset,
  };
}

export { METRIC_PERIOD_OPTIONS };
