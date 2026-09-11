/** Canonical audit_logs.severity values enforced by production CHECK constraint. */
export const AUDIT_SEVERITY_VALUES = ['info', 'warning', 'error', 'critical'] as const;

export type AuditSeverity = (typeof AUDIT_SEVERITY_VALUES)[number];

const ALIAS_MAP: Record<string, AuditSeverity> = {
  info: 'info',
  informational: 'info',
  low: 'info',
  notice: 'info',
  warning: 'warning',
  warn: 'warning',
  medium: 'warning',
  error: 'error',
  high: 'error',
  failed: 'error',
  failure: 'error',
  critical: 'critical',
  severe: 'critical',
};

/**
 * Normalize any caller severity string to a value accepted by audit_logs_severity_check.
 */
export function normalizeAuditSeverity(
  input: string | null | undefined,
  fallback: AuditSeverity = 'info'
): AuditSeverity {
  const key = String(input || '')
    .trim()
    .toLowerCase();
  if (!key) return fallback;
  return ALIAS_MAP[key] || fallback;
}

export function auditSeverityFromStatus(
  status: string | null | undefined,
  fallback: AuditSeverity = 'info'
): AuditSeverity {
  const normalized = String(status || '')
    .trim()
    .toLowerCase();
  if (normalized === 'failed' || normalized === 'blocked' || normalized === 'error') {
    return 'error';
  }
  if (normalized === 'at_risk' || normalized === 'waiting' || normalized === 'pending_approval') {
    return 'warning';
  }
  if (normalized === 'critical') {
    return 'critical';
  }
  return fallback;
}
