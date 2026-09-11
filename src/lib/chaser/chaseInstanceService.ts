import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import {
  buildChaseIdempotencyKey,
  getChasePolicy,
  resolveChaseAutomationMode,
} from '@/lib/chaser/policyRegistry';
import type {
  ChaseAutomationMode,
  ChaseEntityType,
  ChaseInstanceRow,
  ChasePolicyKey,
  ChaseState,
} from '@/lib/chaser/types';

export type UpsertChaseInput = {
  tenantId: string;
  policyKey: ChasePolicyKey;
  entityType: ChaseEntityType;
  entityId: string;
  reasonCode?: string;
  waitingOn?: string;
  severity?: string;
  ownerUserId?: string | null;
  assigneeUserId?: string | null;
  relatedContactId?: string | null;
  relatedClientId?: string | null;
  relatedProjectId?: string | null;
  relatedTaskId?: string | null;
  expectedOutcome?: string;
  lastObservedState?: string;
  contextSnapshot?: Record<string, unknown>;
  automationMode?: ChaseAutomationMode;
  nextActionAt?: string | null;
  agentTaskId?: string | null;
  runId?: string | null;
};

function isMissingChaseTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === '42P01' ||
    /chase_instances/i.test(error.message || '') ||
    /schema cache/i.test(error.message || '')
  );
}

export async function upsertChaseInstance(
  input: UpsertChaseInput,
  supabase: SupabaseClient = createSupabaseAdminClient(),
): Promise<{ data: ChaseInstanceRow | null; created: boolean; error: string | null }> {
  const policy = getChasePolicy(input.policyKey);
  const idempotencyKey = buildChaseIdempotencyKey({
    tenantId: input.tenantId,
    policyKey: input.policyKey,
    entityType: input.entityType,
    entityId: input.entityId,
  });
  const automationMode = resolveChaseAutomationMode(policy, input.automationMode);
  const now = new Date().toISOString();

  const { data: existing, error: existingError } = await supabase
    .from('chase_instances')
    .select('*')
    .eq('tenant_id', input.tenantId)
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle();

  if (existingError && !isMissingChaseTable(existingError)) {
    return { data: null, created: false, error: existingError.message };
  }
  if (isMissingChaseTable(existingError)) {
    return { data: null, created: false, error: 'chase_instances table not migrated yet' };
  }

  if (existing) {
    const { data, error } = await supabase
      .from('chase_instances')
      .update({
        reason_code: input.reasonCode ?? existing.reason_code,
        waiting_on: input.waitingOn ?? existing.waiting_on,
        severity: input.severity ?? existing.severity,
        last_observed_state: input.lastObservedState ?? existing.last_observed_state,
        context_snapshot: {
          ...(existing.context_snapshot as Record<string, unknown>),
          ...(input.contextSnapshot || {}),
        },
        next_action_at: input.nextActionAt ?? existing.next_action_at,
        updated_at: now,
      })
      .eq('id', existing.id)
      .select('*')
      .single();
    return { data: data as ChaseInstanceRow, created: false, error: error?.message || null };
  }

  const payload = {
    tenant_id: input.tenantId,
    policy_key: input.policyKey,
    entity_type: input.entityType,
    entity_id: input.entityId,
    related_contact_id: input.relatedContactId ?? null,
    related_client_id: input.relatedClientId ?? null,
    related_project_id: input.relatedProjectId ?? null,
    related_task_id: input.relatedTaskId ?? null,
    owner_user_id: input.ownerUserId ?? null,
    assignee_user_id: input.assigneeUserId ?? null,
    state: 'DETECTED' as ChaseState,
    severity: input.severity || 'normal',
    reason_code: input.reasonCode ?? null,
    waiting_on: input.waitingOn ?? null,
    attempt_count: 0,
    max_attempts: policy.maxAttempts,
    next_action_at: input.nextActionAt ?? now,
    last_observed_state: input.lastObservedState ?? null,
    expected_outcome: input.expectedOutcome ?? policy.verifiedStopOutcomes[0] ?? null,
    channel: policy.channel,
    automation_mode: automationMode,
    approval_required: policy.approvalRequired,
    idempotency_key: idempotencyKey,
    run_id: input.runId ?? null,
    agent_task_id: input.agentTaskId ?? null,
    policy_snapshot: policy,
    context_snapshot: input.contextSnapshot || {},
    evidence: { detected_at: now, mode: automationMode },
    created_at: now,
    updated_at: now,
  };

  const { data, error } = await supabase.from('chase_instances').insert(payload).select('*').single();
  if (error) {
    if (error.code === '23505') {
      const { data: raced } = await supabase
        .from('chase_instances')
        .select('*')
        .eq('tenant_id', input.tenantId)
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle();
      return { data: raced as ChaseInstanceRow | null, created: false, error: null };
    }
    return { data: null, created: false, error: error.message };
  }
  return { data: data as ChaseInstanceRow, created: true, error: null };
}

export async function listChaseInstances(
  tenantId: string,
  filters?: {
    state?: ChaseState | ChaseState[];
    policyKey?: ChasePolicyKey;
    limit?: number;
  },
  supabase: SupabaseClient = createSupabaseAdminClient(),
): Promise<{ data: ChaseInstanceRow[]; error: string | null }> {
  let query = supabase
    .from('chase_instances')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('next_action_at', { ascending: true, nullsFirst: false })
    .limit(filters?.limit ?? 100);

  if (filters?.policyKey) query = query.eq('policy_key', filters.policyKey);
  if (filters?.state) {
    const states = Array.isArray(filters.state) ? filters.state : [filters.state];
    query = query.in('state', states);
  }

  const { data, error } = await query;
  if (isMissingChaseTable(error)) {
    return { data: [], error: 'chase_instances table not migrated yet' };
  }
  return { data: (data || []) as ChaseInstanceRow[], error: error?.message || null };
}

export async function getChaseInstanceById(
  tenantId: string,
  chaseId: string,
  supabase: SupabaseClient = createSupabaseAdminClient(),
): Promise<{ data: ChaseInstanceRow | null; error: string | null }> {
  const { data, error } = await supabase
    .from('chase_instances')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', chaseId)
    .maybeSingle();
  if (isMissingChaseTable(error)) {
    return { data: null, error: 'chase_instances table not migrated yet' };
  }
  return { data: data as ChaseInstanceRow | null, error: error?.message || null };
}

export async function transitionChaseState(
  tenantId: string,
  chaseId: string,
  params: {
    state: ChaseState;
    terminalOutcome?: string;
    evidence?: Record<string, unknown>;
    snoozedUntil?: string | null;
  },
  supabase: SupabaseClient = createSupabaseAdminClient(),
): Promise<{ ok: boolean; error?: string }> {
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    state: params.state,
    updated_at: now,
  };
  if (params.terminalOutcome) {
    patch.terminal_outcome = params.terminalOutcome;
    patch.resolved_at = now;
  }
  if (params.snoozedUntil) patch.snoozed_until = params.snoozedUntil;
  if (params.evidence) {
    const { data: row } = await supabase
      .from('chase_instances')
      .select('evidence')
      .eq('tenant_id', tenantId)
      .eq('id', chaseId)
      .maybeSingle();
    patch.evidence = {
      ...((row?.evidence as Record<string, unknown>) || {}),
      ...params.evidence,
    };
  }

  const { error } = await supabase
    .from('chase_instances')
    .update(patch)
    .eq('tenant_id', tenantId)
    .eq('id', chaseId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
