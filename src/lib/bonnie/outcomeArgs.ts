/**
 * Coerce LLM / client args for define_outcome into the strict shape.
 * Models often pass criteria as a string/object and status as "completed"/"failed".
 */

export type OutcomeStatus = 'success' | 'partial' | 'failure';

export type OutcomeCriterion = {
  metric: string;
  target: string | number;
  actual?: string | number;
  met: boolean;
};

const STATUS_ALIASES: Record<string, OutcomeStatus> = {
  success: 'success',
  ok: 'success',
  completed: 'success',
  complete: 'success',
  done: 'success',
  passed: 'success',
  pass: 'success',
  succeeded: 'success',
  partial: 'partial',
  partial_success: 'partial',
  mixed: 'partial',
  incomplete: 'partial',
  warning: 'partial',
  failure: 'failure',
  failed: 'failure',
  fail: 'failure',
  error: 'failure',
  errored: 'failure',
};

export function coerceOutcomeStatus(raw: unknown, fallback: OutcomeStatus = 'partial'): OutcomeStatus {
  if (typeof raw !== 'string') return fallback;
  const key = raw.trim().toLowerCase().replace(/[\s-]+/g, '_');
  return STATUS_ALIASES[key] || fallback;
}

function asCriterion(raw: unknown, index: number): OutcomeCriterion | null {
  if (typeof raw === 'string') {
    const metric = raw.trim();
    if (!metric) return null;
    return { metric, target: 'completed', met: true };
  }
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const metric = String(obj.metric || obj.name || obj.label || `criterion_${index + 1}`).trim();
  if (!metric) return null;
  const target =
    obj.target != null
      ? (typeof obj.target === 'number' || typeof obj.target === 'string' ? obj.target : String(obj.target))
      : 'completed';
  const actual =
    obj.actual == null
      ? undefined
      : typeof obj.actual === 'number' || typeof obj.actual === 'string'
        ? obj.actual
        : String(obj.actual);
  const met =
    typeof obj.met === 'boolean'
      ? obj.met
      : typeof obj.passed === 'boolean'
        ? obj.passed
        : true;
  return { metric, target, actual, met };
}

export function coerceOutcomeCriteria(raw: unknown, status: OutcomeStatus, notes?: string): OutcomeCriterion[] {
  let list: unknown[] | null = null;

  if (Array.isArray(raw)) {
    list = raw;
  } else if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) list = parsed;
      } catch {
        // treat as single metric string below
      }
    }
    if (!list && trimmed) {
      list = [trimmed];
    }
  } else if (raw && typeof raw === 'object') {
    list = [raw];
  }

  const criteria = (list || [])
    .map((item, i) => asCriterion(item, i))
    .filter((c): c is OutcomeCriterion => Boolean(c));

  if (criteria.length > 0) return criteria;

  return [
    {
      metric: 'session_outcome',
      target: status,
      actual: notes?.trim() || status,
      met: status !== 'failure',
    },
  ];
}

export function normalizeDefineOutcomeArgs(input: Record<string, unknown>): {
  tenant_id?: string;
  session_id?: string;
  notes?: string;
  status: OutcomeStatus;
  criteria: OutcomeCriterion[];
} {
  const tenant_id =
    typeof input.tenant_id === 'string'
      ? input.tenant_id
      : typeof input.tenantId === 'string'
        ? input.tenantId
        : undefined;
  const session_id =
    typeof input.session_id === 'string'
      ? input.session_id
      : typeof input.sessionId === 'string'
        ? input.sessionId
        : undefined;
  const notes = typeof input.notes === 'string' ? input.notes : undefined;
  const status = coerceOutcomeStatus(input.status);
  const criteria = coerceOutcomeCriteria(input.criteria, status, notes);
  return { tenant_id, session_id, notes, status, criteria };
}
