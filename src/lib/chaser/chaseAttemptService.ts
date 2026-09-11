import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export async function recordChaseAttempt(
  params: {
    tenantId: string;
    chaseId: string;
    attemptNumber: number;
    actionKey: string;
    recipient?: string | null;
    templateKey?: string;
    provider?: string | null;
    providerRequestId?: string | null;
    deliveryState?: string;
    receipt?: Record<string, unknown>;
    failureReason?: string | null;
  },
  supabase: SupabaseClient = createSupabaseAdminClient(),
): Promise<{ id: string | null; error: string | null }> {
  const idempotencyKey = `${params.chaseId}:${params.attemptNumber}:${params.actionKey}`;
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('chase_attempts')
    .insert({
      tenant_id: params.tenantId,
      chase_id: params.chaseId,
      attempt_number: params.attemptNumber,
      action_key: params.actionKey,
      recipient: params.recipient ?? null,
      template_key: params.templateKey ?? null,
      provider: params.provider ?? null,
      provider_request_id: params.providerRequestId ?? null,
      delivery_state: params.deliveryState || 'queued',
      receipt: params.receipt || {},
      failure_reason: params.failureReason ?? null,
      idempotency_key: idempotencyKey,
      queued_at: now,
    })
    .select('id')
    .single();

  if (error?.code === '23505') {
    return { id: null, error: null };
  }
  return { id: data?.id || null, error: error?.message || null };
}

export async function updateChaseAttemptDelivery(
  attemptId: string,
  tenantId: string,
  params: {
    deliveryState: string;
    providerRequestId?: string;
    receipt?: Record<string, unknown>;
    failureReason?: string;
  },
  supabase: SupabaseClient = createSupabaseAdminClient(),
): Promise<void> {
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    delivery_state: params.deliveryState,
    receipt: params.receipt || {},
  };
  if (params.providerRequestId) patch.provider_request_id = params.providerRequestId;
  if (params.failureReason) patch.failure_reason = params.failureReason;
  if (params.deliveryState === 'sent') patch.sent_at = now;
  if (params.deliveryState === 'delivered') patch.delivered_at = now;
  if (params.deliveryState === 'failed') patch.failed_at = now;

  await supabase
    .from('chase_attempts')
    .update(patch)
    .eq('id', attemptId)
    .eq('tenant_id', tenantId);
}
