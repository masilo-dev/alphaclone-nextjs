import { randomUUID } from 'node:crypto';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { sanitizeForAudit } from '@/lib/email/sanitizeEmailExecutionEvidence';

type StoredOperation = { action_id: string; final_status: string; sanitized_output?: Record<string, unknown>; created_at?: string };
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

export function emailOperationStore(tenantId: string, tool: string, key: string, approvalEvidence?: { userId: string; recipientHash: string; approvalFingerprint: string; senderRevision: string; messageScopeHash?: string }): EmailOperationStore {
  const db = createSupabaseAdminClient();
  return {
    async claim(actionId) {
      const { error } = await db.from('mcp_action_receipts').insert({
        tenant_id: tenantId, tool, idempotency_key: key, action_id: actionId,
        ...(approvalEvidence ? { user_id: approvalEvidence.userId, sanitized_input: { recipient_hash: approvalEvidence.recipientHash, approval_fingerprint: approvalEvidence.approvalFingerprint, sender_revision: approvalEvidence.senderRevision, message_scope_hash: approvalEvidence.messageScopeHash, approved_at: new Date().toISOString() } } : {}),
        final_status: 'running', success: false, entity_type: tool === 'email_batch' ? 'bulk_email' : 'email_message',
        sanitized_output: { status: 'executing', action_id: actionId },
      });
      if (error?.code === '23505') {
        // A corrected sender connection can retry a proven failure, atomically.
        // Unknown/accepted operations are never reclaimed, even after settings change.
        if (tool !== 'ui_outreach_send' || !approvalEvidence) return false;
        const retried = await db.from('mcp_action_receipts').update({ action_id: actionId,
          final_status: 'running', success: false,
          sanitized_input: { recipient_hash: approvalEvidence.recipientHash, approval_fingerprint: approvalEvidence.approvalFingerprint,
            sender_revision: approvalEvidence.senderRevision, message_scope_hash: approvalEvidence.messageScopeHash, approved_at: new Date().toISOString() },
          sanitized_output: { status: 'executing', action_id: actionId, retry_after_sender_change: true },
        }).eq('tenant_id', tenantId).eq('tool', tool).eq('idempotency_key', key).eq('final_status', 'failed')
          .neq('sanitized_input->>sender_revision', approvalEvidence.senderRevision).select('action_id');
        if (retried.error) throw new Error('EMAIL_OPERATION_RETRY_CLAIM_FAILED');
        return Boolean(retried.data?.length);
      }
      if (error) throw new Error(`EMAIL_OPERATION_PERSIST_FAILED: ${error.message}`);
      return true;
    },
    async read() {
      const { data, error } = await db.from('mcp_action_receipts').select('action_id, final_status, sanitized_output, created_at')
        .eq('tenant_id', tenantId).eq('tool', tool).eq('idempotency_key', key).maybeSingle();
      if (error) throw new Error(`EMAIL_OPERATION_LOOKUP_FAILED: ${error.message}`);
      return data;
    },
    async save(actionId, status, output) {
      const { error } = await db.from('mcp_action_receipts').update({
        final_status: status, success: !['failed', 'unknown_execution_state', 'running'].includes(status),
        sanitized_output: safeOutput(output), provider: output.provider || null,
        provider_reference: output.emailId || output.messageId || null,
      }).eq('tenant_id', tenantId).eq('tool', tool).eq('idempotency_key', key).eq('action_id', actionId);
      if (error) throw new Error(`EMAIL_OPERATION_UPDATE_FAILED: ${error.message}`);
    },
    async reconcile() {
      if (!['canonical_email_send', 'ui_outreach_send'].includes(tool)) return null;
      const { data, error } = await db.from('email_messages')
        .select('id, provider_account_id, provider_message_id, provider_accepted_at, delivered_at, failed_at, bounced_at, delivery_status, metadata')
        .eq('tenant_id', tenantId).eq('idempotency_key', key).limit(1).maybeSingle();
      if (error) throw new Error(`EMAIL_RECONCILIATION_LOOKUP_FAILED: ${error.message}`);
      if (!data?.provider_accepted_at) {
        // Older/native outreach can have acceptance in the durable receipt or exact outreach log.
        if (tool !== 'ui_outreach_send') return null;
        const own = await db.from('mcp_action_receipts').select('sanitized_output')
          .eq('tenant_id', tenantId).eq('tool', tool).eq('idempotency_key', key).maybeSingle();
        if (own.error) throw new Error('EMAIL_RECONCILIATION_LOOKUP_FAILED');
        const output = own.data?.sanitized_output;
        if (output?.success === true && ['provider_accepted', 'delivered'].includes(output.deliveryStatus)) return output;
        if (!output?.logId) return null;
        const log = await db.from('lead_outreach_log').select('id, status, provider, provider_message_id, sent_at')
          .eq('tenant_id', tenantId).eq('id', output.logId).maybeSingle();
        if (log.error) throw new Error('EMAIL_RECONCILIATION_LOOKUP_FAILED');
        if (!log.data?.sent_at || !['sent', 'delivered', 'opened', 'clicked'].includes(log.data.status)) return null;
        return { success: true, deliveryStatus: log.data.status === 'delivered' ? 'delivered' : 'provider_accepted',
          logId: log.data.id, messageId: log.data.provider_message_id, provider: log.data.provider, reconciled: true };
      }
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
    const providerEvidence = existing.sanitized_output?.success === true && ['provider_accepted', 'delivered'].includes(String(existing.sanitized_output.deliveryStatus))
      ? existing.sanitized_output : await params.store.reconcile();
    const reconciled: Record<string, unknown> | null = providerEvidence ? { ...providerEvidence, logId: existing.sanitized_output?.logId, operationId: existing.sanitized_output?.operationId } : null;
    if (reconciled) {
      await params.store.save(existing.action_id, reconciled.deliveryStatus === 'failed' ? 'failed' : reconciled.deliveryStatus === 'delivered' ? 'delivered' : 'provider_accepted', reconciled);
      return { ...reconciled, idempotent_replay: true } as unknown as T;
    }
    if (['running', 'unknown_execution_state'].includes(existing.final_status)) {
      // Elapsed time without a receipt is not evidence that the provider did not send.
      // Preserve the original claim until provider reconciliation resolves its outcome.
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
    const accepted = previous?.sanitized_output;
    if (accepted?.success === true && ['provider_accepted', 'delivered'].includes(String(accepted.deliveryStatus))) {
      await params.store.save(actionId, String(accepted.deliveryStatus), accepted).catch(() => undefined);
      return { ...accepted, warnings: ['post_send_work_interrupted'], httpStatus: 200 } as unknown as T;
    }
    const output = { ...previous?.sanitized_output, success: false, status: 'unknown', deliveryStatus: 'unknown', code: 'OUTCOME_UNKNOWN',
      error: 'Email execution interrupted. Reconciliation is required before another send.', action_id: actionId };
    await params.store.save(actionId, 'unknown_execution_state', output).catch(() => undefined);
    throw error;
  }
}
