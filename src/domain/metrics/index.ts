export {
  percentChange,
  directionFromDelta,
  sentimentForDirection,
  buildComparison,
  formatPercentChange,
  leadConversionRate,
  isLeadConverted,
  isDealWon,
  cashFlowSection,
  goalProgress,
} from './calculations';

export type {
  MetricDirection,
  MetricSentiment,
  MetricAvailability,
  MetricComparison,
  MetricDefinition,
  MetricValue,
} from './metric-types';

export { LEAD_CONVERTED_STATUSES, DEAL_WON_STAGES } from './metric-types';
