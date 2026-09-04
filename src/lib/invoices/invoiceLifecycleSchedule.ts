/**
 * Due-date-aware invoice reminder ladder (replaces fixed 7-day-from-send timers).
 *
 * Upcoming: 3 days before due
 * Due today: on due date
 * Overdue: day 1, 7, 14 after due
 * Escalate: after day 14
 */

export type InvoiceLifecyclePhase =
  | 'upcoming'
  | 'due_today'
  | 'overdue_1'
  | 'overdue_7'
  | 'overdue_14'
  | 'escalate';

const PHASE_ORDER: InvoiceLifecyclePhase[] = [
  'upcoming',
  'due_today',
  'overdue_1',
  'overdue_7',
  'overdue_14',
  'escalate',
];

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function parseDueDate(dueDate: string): Date {
  const slice = dueDate.slice(0, 10);
  const [y, m, d] = slice.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

/** When each phase should fire relative to due date (days offset). */
function phaseOffsetDays(phase: InvoiceLifecyclePhase): number {
  switch (phase) {
    case 'upcoming':
      return -3;
    case 'due_today':
      return 0;
    case 'overdue_1':
      return 1;
    case 'overdue_7':
      return 7;
    case 'overdue_14':
      return 14;
    case 'escalate':
      return 15;
    default: {
      const _exhaustive: never = phase;
      return _exhaustive;
    }
  }
}

export function computeInvoiceLifecyclePhaseAt(
  dueDate: string,
  phase: InvoiceLifecyclePhase,
): Date {
  const due = parseDueDate(dueDate);
  return addUtcDays(due, phaseOffsetDays(phase));
}

/** Next phase to schedule after `currentPhase`, or null when ladder is complete. */
export function nextInvoiceLifecyclePhase(
  currentPhase: InvoiceLifecyclePhase | null,
): InvoiceLifecyclePhase | null {
  if (!currentPhase) return PHASE_ORDER[0];
  const idx = PHASE_ORDER.indexOf(currentPhase);
  if (idx < 0 || idx >= PHASE_ORDER.length - 1) return null;
  return PHASE_ORDER[idx + 1];
}

/**
 * Pick the first phase whose scheduled time is still in the future.
 * If all past phases were skipped (e.g. invoice sent late), returns the next applicable phase now.
 */
export function computeInitialInvoiceLifecycleTimer(params: {
  dueDate: string;
  now?: Date;
}): { executeAt: Date; phase: InvoiceLifecyclePhase } | null {
  const now = params.now || new Date();
  const nowDay = startOfUtcDay(now).getTime();

  for (const phase of PHASE_ORDER) {
    const executeAt = computeInvoiceLifecyclePhaseAt(params.dueDate, phase);
    if (startOfUtcDay(executeAt).getTime() >= nowDay) {
      return { executeAt, phase };
    }
  }

  return { executeAt: now, phase: 'escalate' };
}

export function computeNextInvoiceLifecycleTimer(params: {
  dueDate: string;
  currentPhase: InvoiceLifecyclePhase;
  now?: Date;
}): { executeAt: Date; phase: InvoiceLifecyclePhase } | null {
  const next = nextInvoiceLifecyclePhase(params.currentPhase);
  if (!next) return null;
  return {
    executeAt: computeInvoiceLifecyclePhaseAt(params.dueDate, next),
    phase: next,
  };
}
