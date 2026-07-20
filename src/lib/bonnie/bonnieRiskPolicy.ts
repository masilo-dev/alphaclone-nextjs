/**
 * bonnieRiskPolicy.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Centralized risk policy evaluator for Bonnie's action approval gate.
 *
 * Risk levels (from autonomous_runner_approvals.risk_level):
 *   low    → auto-execute if auto_send_enabled, otherwise soft-confirm
 *   medium → always require approval from any tenant user
 *   high   → require tenant_admin / admin / owner role
 *   critical → alias for high; blocks until admin confirms
 *
 * The evaluator returns one of three decisions:
 *   'auto_execute'          → run immediately, no human gate
 *   'require_approval'      → any authenticated tenant user can approve
 *   'require_admin_approval' → only tenant_admin, admin, or owner can approve
 */

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type RiskDecision =
  | 'auto_execute'
  | 'require_approval'
  | 'require_admin_approval';

export type BonnieRulePolicy = {
  enabled: boolean;
  auto_send_enabled: boolean;
  auto_send_confidence_threshold: number;
  high_risk_approval_required: boolean;
};

/**
 * Determine what gate should be applied to an action given its risk level
 * and the tenant's current autonomous runner policy.
 */
export function evaluateRiskPolicy(
  riskLevel: string | undefined | null,
  rules: BonnieRulePolicy
): RiskDecision {
  const level = (riskLevel || 'medium').toLowerCase() as RiskLevel;

  switch (level) {
    case 'low':
      // Low-risk: auto-execute only if the tenant has explicitly enabled auto-send
      return rules.auto_send_enabled ? 'auto_execute' : 'require_approval';

    case 'medium':
      // Medium-risk: always requires a human approval, but any tenant user qualifies
      return 'require_approval';

    case 'high':
    case 'critical':
      // High/critical: requires a tenant admin regardless of auto_send settings
      return rules.high_risk_approval_required ? 'require_admin_approval' : 'require_approval';

    default:
      // Unknown risk level → treat conservatively as medium
      return 'require_approval';
  }
}

/**
 * Roles that are permitted to approve high-risk actions.
 */
export const ADMIN_ROLES = ['tenant_admin', 'admin', 'owner', 'super_admin'] as const;

/**
 * Check whether a given role can approve a high-risk action.
 */
export function canApproveHighRisk(role: string | null | undefined): boolean {
  return ADMIN_ROLES.includes((role || '') as (typeof ADMIN_ROLES)[number]);
}

/**
 * Map a risk level string to a numeric confidence threshold.
 * Used when creating autonomous_runner_approvals rows.
 */
export function riskLevelToConfidenceScore(riskLevel: string): number {
  switch ((riskLevel || '').toLowerCase()) {
    case 'low':
      return 90;
    case 'medium':
      return 70;
    case 'high':
      return 50;
    case 'critical':
      return 30;
    default:
      return 70;
  }
}

/**
 * Derive a human-readable gate label for UI display.
 */
export function riskDecisionLabel(decision: RiskDecision): string {
  switch (decision) {
    case 'auto_execute':
      return 'Auto-execute';
    case 'require_approval':
      return 'Requires approval';
    case 'require_admin_approval':
      return 'Requires admin approval';
  }
}
