import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { reconcileBrevoMessage } from '@/lib/email/reconcileBrevoMessage';

export async function emailReceiptEvidence(tenantId: string, userId: string, receipt: Record<string, any>) {
  const output = receipt.sanitized_output || {};
  const reference = receipt.provider_reference || output.emailId || output.message_id;
  if (!reference || !['send_email', 'canonical_email_send', 'send_contract', 'send_transactional_email', 'reply_to_email'].includes(receipt.tool)) return { receipt };
  const db = createSupabaseAdminClient();
  const lookup = () => {
    let query = db.from('email_messages')
    .select('id, provider_account_id, provider_message_id, application_status, delivery_status, provider_accepted_at, delivered_at, bounced_at, failed_at, metadata')
    .eq('tenant_id', tenantId).eq('provider_message_id', reference);
    if (output.providerAccountId) query = query.eq('provider_account_id', output.providerAccountId);
    return query.maybeSingle();
  };
  let { data: message, error } = await lookup();
  if (error) throw new Error('EMAIL_DELIVERY_EVIDENCE_LOOKUP_FAILED');
  if (!message) return { receipt, delivery_evidence: null, limitation: 'No canonical provider receipt is available.' };
  let reconciliationError: string | null = null;
  if (message.metadata?.provider === 'brevo') {
    try {
      await reconcileBrevoMessage({ tenantId, userId, messageId: reference, providerAccountId: message.provider_account_id });
      const refreshed = await lookup();
      if (refreshed.error) throw new Error('EMAIL_DELIVERY_EVIDENCE_LOOKUP_FAILED');
      message = refreshed.data || message;
    } catch {
      reconciliationError = 'Provider event lookup unavailable; existing acceptance evidence is retained. No retry was made.';
    }
  }
  const executionState = message.bounced_at
    ? 'BOUNCED'
    : message.failed_at
    ? 'FAILED'
    : message.delivered_at
    ? 'DELIVERED'
    : message.provider_accepted_at
    ? 'PROVIDER_ACCEPTED'
    : 'UNKNOWN_PENDING_VERIFICATION';

  return { receipt, delivery_evidence: {
    message_id: message.provider_message_id, provider_account_id: message.provider_account_id,
    sender: message.metadata?.sender || null, accepted_at: message.provider_accepted_at,
    delivered_at: message.delivered_at, bounced_at: message.bounced_at, failed_at: message.failed_at,
    status: message.bounced_at ? 'bounced' : message.failed_at ? 'failed' : message.delivered_at ? 'delivered'
      : message.delivery_status === 'deferred' ? 'deferred' : message.provider_accepted_at ? 'provider_accepted' : 'unknown',
    execution_state: executionState,
  }, reconciliation_error: reconciliationError,
    limitation: 'Provider delivery confirms receiving-server acceptance, not inbox placement. Zoho may have no delivery callback.' };
}
