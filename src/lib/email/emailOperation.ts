import { randomUUID } from 'node:crypto';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { sanitizeForAudit } from '@/lib/email/sanitizeEmailExecutionEvidence';

type StoredOperation = { action_id: string; final_status: string; sanitized_output?: Record<string, unknown> };
export interface EmailOperationStore {
  claim(actionId: string): Promise<boolean>;
  read(): Promise<StoredOperation | null>;
  save(actionId: string, status: string, output: Record<string, unknown>): Promise<void>;
  reconcile(): Promise<Record<string, unknown> | null>;
}

/** Preserve every recipient; generic audit snapshots deliberately truncate arrays. */
function safeOutput(output: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(output).map(([key, value]) => [key,
    Array.isArray(value) ? value.map((item) => sanitizeForAudit(item)) : sanitizeForAudit(value),
  ]));
}

export function emailOperationStore(tenantId: string, tool: string, key: string): EmailOperationStore {
  const db = createSupabaseAdminClient();
  return {
    async claim(actionId) {
      const { error } = await db.from('mcp_action_receipts').insert({
        tenant_id: tenantId, tool, idempotency_key: key, action_id: actionId,
        final_status: 'running', success: false, entity_type: tool === 'email_batch' ? 'bulk_email' : 'email_message',
        sanitized_output: { status: 'executing', action_id: actionId },
      });
      if (error?.code === '23505') return false;
      if (error) throw new Error(`EMAIL_OPERATION_PERSIST_FAILED: ${error.message}`);
      return true;
    },
    async read() {
      const { data, error } = await db.from('mcp_action_receipts').select('action_id, final_status, sanitized_output')
        .eq('tenant_id', tenantId).eq('tool', tool).eq('idempotency_key', key).maybeSingle();
      if (error) throw new Error(`EMAIL_OPERATION_LOOKUP_FAILED: ${error.message}`);
      return data;
    },
    async save(actionId, status, output) {
      const { error } = await db.from('mcp_action_receipts').update({
        final_status: status, success: !['failed', 'unknown_execution_state', 'running'].includes(status),
        sanitized_output: safeOutput(output), provider: output.provider || null,
        provider_reference: output.emailId || null,
      }).eq('tenant_id', tenantId).eq('tool', tool).eq('idempotency_key', key).eq('action_id', actionId);
      if (error) throw new Error(`EMAIL_OPERATION_UPDATE_FAILED: ${error.message}`);
    },
    async reconcile() {
      if (tool !== 'canonical_email_send') return null;
      const { data, error } = await db.from('email_messages')
        .select('id, provider_account_id, provider_message_id, provider_accepted_at, delivered_at, failed_at, bounced_at, delivery_status, metadata')
        .eq('tenant_id', tenantId).eq('idempotency_key', key).limit(1).maybeSingle();
      if (error) throw new Error(`EMAIL_RECONCILIATION_LOOKUP_FAILED: ${error.message}`);
      if (!data?.provider_accepted_at) return null;
      return { success: !data.failed_at && !data.bounced_at, emailId: data.provider_message_id, canonicalMessageId: data.id,
        providerAccountId: data.provider_account_id, provider: data.metadata?.provider,
        sender: data.metadata?.sender, deliveryStatus: data.failed_at || data.bounced_at ? 'failed' : data.delivered_at ? 'delivered' : 'provider_accepted',
        deliveredAt: data.delivered_at || null, tried: [], reconciled: true };
    },
  };
}

/** Atomic claim + durable replay, shared by the existing gateway and batch executor. */
export async function runEmailOperation<T extends Record<string, unknown>>(params: {
  store: EmailOperationStore;
  execute: (actionId: string, checkpoint: (output: Record<string, unknown>) => Promise<void>) => Promise<T>;
}): Promise<T> {
  const actionId = randomUUID();
  if (!await params.store.claim(actionId)) {
    const existing = await params.store.read();
    if (!existing) throw new Error('EMAIL_OPERATION_CLAIM_NOT_FOUND');
    const reconciled = await params.store.reconcile();
    if (reconciled) {
      await params.store.save(existing.action_id, reconciled.deliveryStatus === 'failed' ? 'failed' : reconciled.deliveryStatus === 'delivered' ? 'delivered' : 'provider_accepted', reconciled);
      return { ...reconciled, idempotent_replay: true } as unknown as T;
    }
    if (['running', 'unknown_execution_state'].includes(existing.final_status)) {
      return { ...existing.sanitized_output, success: false, status: 'unknown', deliveryStatus: 'unknown',
        code: 'OUTCOME_UNKNOWN', error: 'Reconcile the original operation before retrying; no new send was made.',
        action_id: existing.action_id, idempotent_replay: true } as unknown as T;
    }
    return { ...existing.sanitized_output, idempotent_replay: true } as unknown as T;
  }
  try {
    const output = await params.execute(actionId, (snapshot) => params.store.save(actionId, 'running', snapshot));
    const status = output.deliveryStatus === 'unknown' || output.status === 'unknown' || output.code === 'OUTCOME_UNKNOWN'
      ? 'unknown_execution_state' : output.success === false || Number(output.failed || 0) > 0
        ? 'failed' : output.deliveryStatus === 'provider_accepted' ? 'provider_accepted' : 'completed';
    await params.store.save(actionId, status, output);
    return output;
  } catch (error) {
    // A process/persistence failure may follow acceptance. Never release the claim.
    const previous = await params.store.read().catch(() => null);
    const output = { ...previous?.sanitized_output, success: false, status: 'unknown', deliveryStatus: 'unknown', code: 'OUTCOME_UNKNOWN',
      error: 'Email execution interrupted. Reconciliation is required before another send.', action_id: actionId };
    await params.store.save(actionId, 'unknown_execution_state', output).catch(() => undefined);
    throw error;
  }
}
