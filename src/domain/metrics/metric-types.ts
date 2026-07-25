/**
 * Shared metric contracts for production dashboards.
 * Never display fabricated values — use unavailable when data is missing.
 */

export type MetricDirection = 'up' | 'down' | 'flat';
export type MetricSentiment = 'positive' | 'negative' | 'neutral';

export type MetricAvailability =
  | { status: 'available' }
  | { status: 'unavailable'; reason: string }
  | { status: 'loading' }
  | { status: 'error'; message: string };

export interface MetricComparison {
  value: number;
  label: string;
  direction: MetricDirection;
  sentiment: MetricSentiment;
}

export interface MetricDefinition {
  id: string;
  label: string;
  /** Human-readable business definition shown in tooltips / unavailable copy */
  definition: string;
  /** Default reporting period label */
  periodLabel: string;
  /** Drill-down destination when available */
  href?: string;
}

export interface MetricValue {
  definition: MetricDefinition;
  value: number | null;
  formattedValue: string;
  periodLabel: string;
  comparison?: MetricComparison | null;
  availability: MetricAvailability;
  href?: string;
}

/** Lead statuses that count as a genuine conversion to a commercial relationship. */
export const LEAD_CONVERTED_STATUSES = ['converted', 'won', 'client'] as const;

/** Deal stages that count as closed-won revenue opportunities. */
export const DEAL_WON_STAGES = ['closed_won', 'won'] as const;
