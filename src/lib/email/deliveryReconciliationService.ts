import type { SupabaseClient } from '@supabase/supabase-js';
import type { UnifiedEmailProvider } from '@/lib/email/unifiedEmailDomain';

type CanonicalDeliveryState =
  | 'provider_accepted'
  | 'sent'
  | 'delivered'
  | 'opened'
  | 'clicked'
  | 'replied'
  | 'bounced'
  | 'complained'
  | 'unsubscribed'
  | 'failed';

export type ReconcileProviderEventInput = {
  supabase: SupabaseClient;
  tenantId: string;
  providerAccountId: string;
  provider: UnifiedEmailProvider;
  providerMessageId: string;
  providerEventId: string;
  eventType: CanonicalDeliveryState;
  recipientEmail?: string | null;
  occurredAt?: string;
  signatureVerified: boolean;
  payloadSafe?: Record<string, unknown>;
};

type CurrentMessageEvidence = {
  id: string;
  application_status?: string | null;
  delivery_status?: string | null;
  provider_accepted_at?: string | null;
  sent_at?: string | null;
  delivered_at?: string | null;
  opened_at?: string | null;
  clicked_at?: string | null;
  replied_at?: string | null;
  bounced_at?: string | null;
  complained_at?: string | null;
  unsubscribed_at?: string | null;
  failed_at?: string | null;
};

function patchForEvent(eventType: CanonicalDeliveryState, occurredAt: string, current: CurrentMessageEvidence): Record<string, unknown> {
  // Evidence timestamps are monotonic: never erase stronger evidence because an
  // upstream provider sends events out of order. The outbound_emails projection
  // derives precedence from these timestamps.
  switch (eventType) {
    case 'provider_accepted':
      return {
        provider_accepted_at: current.provider_accepted_at || occurredAt,
        application_status: current.application_status === 'draft' || !current.application_status ? 'provider_accepted' : current.application_status,
        delivery_status: current.delivery_status || 'accepted',
      };
    case 'sent':
      return {
        sent_at: current.sent_at || occurredAt,
        application_status: current.application_status === 'failed' ? current.application_status : 'sent',
      };
    case 'delivered':
      return {
        delivered_at: current.delivered_at || occurredAt,
        application_status: current.application_status === 'failed' ? current.application_status : 'sent',
        delivery_status: ['opened', 'clicked', 'bounced', 'complained'].includes(String(current.delivery_status || ''))
          ? current.delivery_status
          : 'delivered',
      };
    case 'opened':
      return {
        opened_at: current.opened_at || occurredAt,
        delivery_status: ['clicked', 'bounced', 'complained'].includes(String(current.delivery_status || '')) ? current.delivery_status : 'opened',
      };
    case 'clicked':
      return { clicked_at: current.clicked_at || occurredAt, delivery_status: ['bounced', 'complained'].includes(String(current.delivery_status || '')) ? current.delivery_status : 'clicked' };
    case 'replied':
      return { replied_at: current.replied_at || occurredAt };
    case 'bounced':
      return { bounced_at: current.bounced_at || occurredAt, delivery_status: current.delivery_status === 'complained' ? 'complained' : 'bounced' };
    case 'complained':
      return { complained_at: current.complained_at || occurredAt, delivery_status: 'complained' };
    case 'unsubscribed':
      return { unsubscribed_at: current.unsubscribed_at || occurredAt };
    case 'failed':
      return {
        failed_at: current.failed_at || occurredAt,
        // Do not overwrite proven acceptance/delivery with an out-of-order generic failure.
        application_status: current.provider_accepted_at || current.sent_at || current.delivered_at || current.opened_at || current.clicked_at
          ? current.application_status
          : 'failed',
      };
  }
}

export const DeliveryReconciliationService = {
  async applyProviderEvent(input: ReconcileProviderEventInput): Promise<{ messageId: string; duplicate: boolean }> {
    if (!input.tenantId || !input.providerAccountId || !input.providerMessageId || !input.providerEventId) {
      throw new Error('EMAIL_RECONCILIATION_CONTEXT_REQUIRED');
    }
    if (!input.signatureVerified) throw new Error('EMAIL_WEBHOOK_SIGNATURE_INVALID');

    const occurredAt = input.occurredAt || new Date().toISOString();
    const { data: account, error: accountError } = await input.supabase
      .from('email_provider_accounts')
      .select('id, tenant_id, provider')
      .eq('tenant_id', input.tenantId)
      .eq('id', input.providerAccountId)
      .eq('provider', input.provider)
      .eq('connection_status', 'connected')
      .is('deleted_at', null)
      .maybeSingle();
    if (accountError) throw new Error(`EMAIL_PROVIDER_ACCOUNT_LOOKUP_FAILED: ${accountError.message}`);
    if (!account) throw new Error('EMAIL_PROVIDER_ACCOUNT_NOT_FOUND');

    const { data: message, error: messageError } = await input.supabase
      .from('email_messages')
      .select('id, application_status, delivery_status, provider_accepted_at, sent_at, delivered_at, opened_at, clicked_at, replied_at, bounced_at, complained_at, unsubscribed_at, failed_at')
      .eq('tenant_id', input.tenantId)
      .eq('provider_account_id', input.providerAccountId)
      .eq('provider_message_id', input.providerMessageId)
      .maybeSingle();
    if (messageError) throw new Error(`EMAIL_MESSAGE_LOOKUP_FAILED: ${messageError.message}`);
    if (!message) throw new Error('EMAIL_MESSAGE_NOT_FOUND');

    const { data: existing, error: existingError } = await input.supabase
      .from('email_delivery_events')
      .select('id')
      .eq('tenant_id', input.tenantId)
      .eq('provider_account_id', input.providerAccountId)
      .eq('provider_event_id', input.providerEventId)
      .maybeSingle();
    if (existingError) throw new Error(`EMAIL_DELIVERY_EVENT_LOOKUP_FAILED: ${existingError.message}`);
    if (existing?.id) return { messageId: String(message.id), duplicate: true };

    const { error: eventError } = await input.supabase.from('email_delivery_events').insert({
      tenant_id: input.tenantId,
      message_id: message.id,
      provider_account_id: input.providerAccountId,
      provider: input.provider,
      provider_message_id: input.providerMessageId,
      provider_event_id: input.providerEventId,
      event_type: input.eventType,
      recipient_email: input.recipientEmail || null,
      occurred_at: occurredAt,
      received_at: new Date().toISOString(),
      payload_safe: input.payloadSafe || {},
      signature_verified: true,
      processed_at: new Date().toISOString(),
    });
    if (eventError) {
      // The unique tenant/provider-account/provider-event constraint closes the
      // select/insert race. Concurrent delivery of the same event is idempotent.
      if ((eventError as { code?: string }).code === '23505') {
        return { messageId: String(message.id), duplicate: true };
      }
      throw new Error(`EMAIL_DELIVERY_EVENT_INSERT_FAILED: ${eventError.message}`);
    }

    const patch = patchForEvent(input.eventType, occurredAt, message as CurrentMessageEvidence);
    const { error: updateError } = await input.supabase
      .from('email_messages')
      .update(patch)
      .eq('tenant_id', input.tenantId)
      .eq('id', message.id)
      .eq('provider_account_id', input.providerAccountId);
    if (updateError) throw new Error(`EMAIL_MESSAGE_RECONCILIATION_FAILED: ${updateError.message}`);

    return { messageId: String(message.id), duplicate: false };
  },
};
