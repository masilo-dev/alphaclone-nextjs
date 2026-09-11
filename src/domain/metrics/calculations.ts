/**
 * Pure metric calculation helpers — unit-tested, no UI.
 */

import {
  DEAL_WON_STAGES,
  LEAD_CONVERTED_STATUSES,
  type MetricComparison,
  type MetricDirection,
  type MetricSentiment,
} from './metric-types';

export function percentChange(
  current: number | null | undefined,
  previous: number | null | undefined
): number | null {
  if (current == null || previous == null) return null;
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  if (previous === 0) {
    if (current === 0) return 0;
    return null; // cannot compute meaningful % from a zero baseline
  }
  return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10;
}

export function directionFromDelta(delta: number | null | undefined): MetricDirection {
  if (delta == null || delta === 0) return 'flat';
  return delta > 0 ? 'up' : 'down';
}

export function sentimentForDirection(
  direction: MetricDirection,
  /** When higher is worse (e.g. overdue invoices), invert sentiment. */
  invert = false
): MetricSentiment {
  if (direction === 'flat') return 'neutral';
  const positive = direction === 'up';
  if (invert) return positive ? 'negative' : 'positive';
  return positive ? 'positive' : 'negative';
}

export function buildComparison(
  current: number | null | undefined,
  previous: number | null | undefined,
  label = 'vs prior period',
  invertSentiment = false
): MetricComparison | null {
  const delta = percentChange(current, previous);
  if (delta == null) return null;
  const direction = directionFromDelta(delta);
  return {
    value: delta,
    label,
    direction,
    sentiment: sentimentForDirection(direction, invertSentiment),
  };
}

export function formatPercentChange(delta: number | null | undefined): string | null {
  if (delta == null || !Number.isFinite(delta)) return null;
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta}%`;
}

/**
 * Lead conversion rate: converted / total.
 * Does NOT treat "qualified" or mere client_id presence as a win.
 * Pass statuses that are already normalised to lowercase.
 */
export function leadConversionRate(input: {
  total: number;
  converted: number;
}): { rate: number | null; unavailableReason?: string } {
  const { total, converted } = input;
  if (!Number.isFinite(total) || total < 0 || !Number.isFinite(converted) || converted < 0) {
    return { rate: null, unavailableReason: 'Invalid lead totals' };
  }
  if (total === 0) {
    return { rate: null, unavailableReason: 'No leads in this period yet' };
  }
  if (converted > total) {
    return { rate: null, unavailableReason: 'Converted count exceeds total leads' };
  }
  return { rate: Math.round((converted / total) * 1000) / 10 };
}

export function isLeadConverted(status: string | null | undefined, clientId?: string | null): boolean {
  const s = String(status || '').toLowerCase();
  if ((LEAD_CONVERTED_STATUSES as readonly string[]).includes(s)) return true;
  // client_id alone is a weak signal — only count when status also implies conversion
  // or status is explicitly converted-family. Do not count qualified + client_id as won.
  void clientId;
  return false;
}

export function isDealWon(stage: string | null | undefined): boolean {
  const s = String(stage || '').toLowerCase();
  return (DEAL_WON_STAGES as readonly string[]).includes(s);
}

/**
 * Cash-flow sections that are not tracked must not render as 0.
 */
export function cashFlowSection(
  amount: number | null | undefined,
  tracked: boolean
): { amount: number | null; tracked: boolean; labelSuffix?: string } {
  if (!tracked) {
    return { amount: null, tracked: false, labelSuffix: 'Not tracked yet' };
  }
  if (amount == null || !Number.isFinite(amount)) {
    return { amount: null, tracked: true, labelSuffix: 'Unavailable' };
  }
  return { amount, tracked: true };
}

/** Progress toward a goal — never invent a secondary fake delta. */
export function goalProgress(
  actual: number | null | undefined,
  goal: number | null | undefined
): { percent: number | null; unavailableReason?: string } {
  if (actual == null || goal == null || !Number.isFinite(actual) || !Number.isFinite(goal)) {
    return { percent: null, unavailableReason: 'Goal or actual value missing' };
  }
  if (goal <= 0) {
    return { percent: null, unavailableReason: 'Goal must be greater than zero' };
  }
  return { percent: Math.min(100, Math.round((actual / goal) * 1000) / 10) };
}
