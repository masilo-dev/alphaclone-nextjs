import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { runContractSignedFlow } from '@/lib/contracts/contractSignedSteps';
import { isExecutionFeatureEnabled } from '@/lib/projects/executionFeatureFlags';
import {
  evaluateProjectKickoff,
  projectKickoffIdempotencyKey,
} from '@/lib/projects/projectAutomationPolicy';

export type ProjectAutomationTrigger = 'contract.signed' | 'payment.received';

export type ProjectAutomationEventInput = {
  tenantId: string;
  contractId: string;
  trigger: ProjectAutomationTrigger;
  actorUserId?: string;
  correlationId?: string;
};

export type ProjectAutomationEventResult = {
  status: 'disabled' | 'not_configured' | 'waiting' | 'duplicate' | 'succeeded' | 'failed';
  projectId?: string;
  executionId?: string;
  reasons?: string[];
};

async function loadAmountPaid(supabase: SupabaseClient, tenantId: string, contractId: string): Promise<number> {
  const { data } = await supabase
    .from('business_invoices')
    .select('amount_paid')
    .eq('tenant_id', tenantId)
    .eq('contract_id', contractId);
  return (data || []).reduce((sum: number, row: any) => sum + Number(row.amount_paid || 0), 0);
}

export async function runProjectAutomationEvent(
  input: ProjectAutomationEventInput,
): Promise<ProjectAutomationEventResult> {
  const admin = createSupabaseAdminClient();
  const enabled = await isExecutionFeatureEnabled(admin, 'PROJECT_AUTOMATION_ENABLED', input.tenantId);
  if (!enabled) return { status: 'disabled' };

  const { data: policy, error: policyError } = await admin
    .from('project_automation_policies')
    .select('*')
    .eq('tenant_id', input.tenantId)
    .eq('enabled', true)
    .eq('trigger_event', input.trigger)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (policyError) throw policyError;
  if (!policy) return { status: 'not_configured' };

  const { data: contract, error: contractError } = await admin
    .from('contracts')
    .select('id, project_id, status, lifecycle_status, value, total_amount, payment_amount')
    .eq('tenant_id', input.tenantId)
    .eq('id', input.contractId)
    .maybeSingle();
  if (contractError) throw contractError;
  if (!contract) throw new Error('contract_not_found');

  const signed = ['signed', 'active', 'expiring', 'renewed'].includes(
    String(contract.lifecycle_status || contract.status || '').toLowerCase(),
  );
  const amountPaid = await loadAmountPaid(admin, input.tenantId, input.contractId);
  const contractValue = Number(contract.value ?? contract.total_amount ?? contract.payment_amount ?? 0);
  const decision = evaluateProjectKickoff(
    {
      enabled: Boolean(policy.enabled),
      requireSignedContract: Boolean(policy.require_signed_contract),
      requireDeposit: Boolean(policy.require_deposit),
      minimumDepositAmount: policy.minimum_deposit_amount == null ? null : Number(policy.minimum_deposit_amount),
      minimumDepositPercent: policy.minimum_deposit_percent == null ? null : Number(policy.minimum_deposit_percent),
    },
    {
      contractSigned: signed,
      contractValue,
      amountPaid,
      projectAlreadyExists: Boolean(contract.project_id),
    },
  );

  if (decision.idempotentSuccess && contract.project_id) {
    return { status: 'duplicate', projectId: contract.project_id, reasons: decision.reasons };
  }

  const correlationId = input.correlationId || globalThis.crypto.randomUUID();
  const idempotencyKey = projectKickoffIdempotencyKey({
    tenantId: input.tenantId,
    contractId: input.contractId,
    policyVersion: Number(policy.version || 1),
  });

  const { data: execution, error: claimError } = await admin
    .from('project_automation_executions')
    .insert({
      tenant_id: input.tenantId,
      policy_id: policy.id,
      policy_version: Number(policy.version || 1),
      contract_id: input.contractId,
      trigger_event: input.trigger,
      correlation_id: correlationId,
      idempotency_key: idempotencyKey,
      status: decision.eligible ? 'running' : 'waiting',
      decision: { eligible: decision.eligible, reasons: decision.reasons, amountPaid, contractValue },
      actor_user_id: input.actorUserId || null,
      started_at: decision.eligible ? new Date().toISOString() : null,
    })
    .select('id,status,project_id,result')
    .single();

  if (claimError?.code === '23505') {
    const { data: prior } = await admin
      .from('project_automation_executions')
      .select('id,status,project_id,result,decision')
      .eq('tenant_id', input.tenantId)
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();
    return {
      status: prior?.status === 'succeeded' ? 'duplicate' : prior?.status === 'waiting' ? 'waiting' : 'duplicate',
      executionId: prior?.id,
      projectId: prior?.project_id || prior?.result?.project_id,
      reasons: prior?.decision?.reasons,
    };
  }
  if (claimError) throw claimError;

  if (!decision.eligible) {
    return { status: 'waiting', executionId: execution.id, reasons: decision.reasons };
  }

  try {
    const result = await runContractSignedFlow({
      tenantId: input.tenantId,
      contractId: input.contractId,
      actorUserId: input.actorUserId,
    });
    await admin
      .from('project_automation_executions')
      .update({
        status: 'succeeded',
        project_id: result.project_id || null,
        result,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', input.tenantId)
      .eq('id', execution.id);

    return { status: 'succeeded', executionId: execution.id, projectId: result.project_id };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await admin
      .from('project_automation_executions')
      .update({
        status: 'failed',
        error: message,
        retry_count: 1,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', input.tenantId)
      .eq('id', execution.id);
    return { status: 'failed', executionId: execution.id, reasons: [message] };
  }
}
