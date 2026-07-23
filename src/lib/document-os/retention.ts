/**
 * Configurable retention policies and legal hold.
 */

export interface RetentionPolicy {
  retention_policy_id: string;
  tenant_id: string;
  document_type?: string;
  country?: string;
  client_id?: string;
  active_retention_days: number;
  archive_after_days: number;
  legal_requirement?: string;
  business_policy?: string;
}

export interface RetentionState {
  legal_hold: boolean;
  archive_eligible_at?: string;
  deletion_eligible_at?: string;
  archived_at?: string;
}

export function computeRetentionDates(
  createdAt: string,
  policy: RetentionPolicy
): { archive_eligible_at: string; deletion_eligible_at: string } {
  const created = new Date(createdAt).getTime();
  return {
    archive_eligible_at: new Date(created + policy.archive_after_days * 86400000).toISOString(),
    deletion_eligible_at: new Date(created + policy.active_retention_days * 86400000).toISOString(),
  };
}

export function assertNotOnLegalHold(legalHold: boolean, action: string): void {
  if (legalHold) {
    throw new Error(
      `Legal-hold records cannot be ${action} until the hold is released by an authorized actor.`
    );
  }
}

export function canSecureDelete(state: RetentionState, now = new Date()): boolean {
  if (state.legal_hold) return false;
  if (!state.deletion_eligible_at) return false;
  return Date.parse(state.deletion_eligible_at) <= now.getTime();
}
