/**
 * Shared declaration for cron/worker initiated domain writes.
 * Cron is a SOURCE — not permission to bypass execution guarantees.
 */

import type { PolicySource } from '@/lib/ai/ToolPolicyGate';

export type CronExecutionContext = {
  executionSource: Extract<PolicySource, 'cron'> | 'worker';
  capability: string;
  tenantId: string;
  userId?: string | null;
  idempotencyKey?: string | null;
  /** Tenant automation policy: skip interactive approval for pre-authorized automations */
  skipInteractiveApproval: true;
  skipPolicyEvaluation: boolean;
  jobName: string;
};

export function buildCronExecutionContext(params: {
  jobName: string;
  tenantId: string;
  capability: string;
  userId?: string | null;
  idempotencyKey?: string | null;
  /** When false, still evaluate ToolPolicyGate (observe mode etc.) */
  respectTenantAutonomyPolicy?: boolean;
}): CronExecutionContext {
  return {
    executionSource: 'cron',
    capability: params.capability,
    tenantId: params.tenantId,
    userId: params.userId || null,
    idempotencyKey: params.idempotencyKey || null,
    skipInteractiveApproval: true,
    // Default: skip interactive approval queue for cron; still allow callers to evaluate policy if needed.
    skipPolicyEvaluation: params.respectTenantAutonomyPolicy === true ? false : true,
    jobName: params.jobName,
  };
}
