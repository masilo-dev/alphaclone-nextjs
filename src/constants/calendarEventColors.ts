/**
 * FullCalendar and similar runtimes need resolved color strings (not CSS var()).
 * Values mirror semantic tokens in brand.ts — keep in sync.
 */
import { BRAND_BLUE, BRAND_VIOLET, LIGHT_NEUTRALS, SEMANTIC } from '@/constants/brand';

export const CALENDAR_TASK_COLORS = {
  completed: SEMANTIC.success[500],
  overdue: SEMANTIC.error[500],
  pending: SEMANTIC.warning[500],
} as const;

export const CALENDAR_EVENT_TYPE_COLORS: Record<string, string> = {
  call: SEMANTIC.success[500],
  meeting: SEMANTIC.info[500],
  reminder: SEMANTIC.warning[500],
  deadline: SEMANTIC.error[500],
  invoice: SEMANTIC.error[500],
  project: BRAND_VIOLET[400],
  milestone: SEMANTIC.communication[500],
  lead: BRAND_BLUE[500],
  deal: SEMANTIC.warning[500],
  suggestion: BRAND_VIOLET[500],
  default: SEMANTIC.info[500],
};

export const CALENDAR_UI = {
  textOnEvent: LIGHT_NEUTRALS.surfacePrimary,
  suggestionBorder: BRAND_VIOLET[500],
  suggestionText: BRAND_VIOLET[300],
} as const;
