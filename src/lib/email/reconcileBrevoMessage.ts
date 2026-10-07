import { createHash } from 'node:crypto';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { resolveAllConnectedEmailProviders } from '@/lib/email/providerIntegrationResolver';
import { syncSuppressionCleanup } from '@/lib/email/suppression';
import { DeliveryReconciliationService } from '@/lib/email/deliveryReconciliationService';

export function brevoDeliveryEvent(event: string) {
  switch (event.toLowerCase()) {
    case 'delivered': return 'delivered' as const;
    case 'requests': case 'request': return 'provider_accepted' as const;
    case 'soft_bounce': case 'deferred': return 'deferred' as const;
    case 'hard_bounce': return 'bounced' as const;
    case 'blocked': case 'invalid_email': case 'error': return 'failed' as const;
    case 'spam': return 'complained' as const;
    case 'unsubscribed': return 'unsubscribed' as const;
    default: return null;
  }
}

/** Exact message/account reconciliation; this function never sends or retries mail. */
export async function reconcileBrevoMessage(input: { tenantId: string; userId: string; messageId: string; providerAccountId: string }) {
  const db = createSupabaseAdminClient();
  const { data: message, error } = await db.from('email_messages').select('id')
    .eq('tenant_id', input.tenantId).eq('provider_account_id', input.providerAccountId)
    .eq('provider_message_id', input.messageId).maybeSingle();
  if (error || !message) throw new Error('EMAIL_RECONCILIATION_MESSAGE_NOT_FOUND');
  const configs = await resolveAllConnectedEmailProviders({ tenantId: input.tenantId,
    preferredUserId: input.userId, preferredProvider: 'brevo' });
  const config = configs.find((row) => row.provider === 'brevo' && row.providerAccountId === input.providerAccountId);
  if (!config) throw new Error('EMAIL_RECONCILIATION_ACCOUNT_UNAVAILABLE');
  const url = new URL('https://api.brevo.com/v3/smtp/statistics/events');
  url.searchParams.set('messageId', input.messageId); url.searchParams.set('limit', '100');
  const response = await fetch(url, { headers: { 'api-key': config.apiKey }, signal: AbortSignal.timeout(8_000) });
  if (!response.ok) throw new Error(`EMAIL_RECONCILIATION_PROVIDER_HTTP_${response.status}`);
  const body = await response.json();
  let applied = 0;
  for (const raw of body.events || []) {
    if (raw.messageId !== input.messageId && raw['message-id'] !== input.messageId) continue;
    const eventType = brevoDeliveryEvent(String(raw.event || ''));
    if (!eventType) continue;
    const occurredAt = new Date(raw.date).toISOString();
    const eventId = `brevo-api:${createHash('sha256').update(`${input.messageId}:${raw.event}:${occurredAt}:${raw.email || ''}`).digest('hex')}`;
    await DeliveryReconciliationService.applyProviderEvent({ supabase: db, tenantId: input.tenantId,
      providerAccountId: input.providerAccountId, provider: 'brevo', providerMessageId: input.messageId,
      providerEventId: eventId, eventType, recipientEmail: raw.email || null, occurredAt,
      signatureVerified: true, payloadSafe: { source: 'authenticated_provider_api', event: raw.event,
        reason: String(raw.reason || '').slice(0, 300) } });
    if (['bounced', 'complained', 'unsubscribed'].includes(eventType) && typeof raw.email === 'string') {
      await syncSuppressionCleanup({ tenantId: input.tenantId, email: raw.email, provider: 'brevo', eventId,
        reason: eventType === 'bounced' ? 'bounce' : eventType === 'complained' ? 'spam_report' : 'unsubscribe' });
    }
    applied++;
  }
  return { applied, limitation: 'Delivery events confirm receiving-server delivery; they do not prove inbox placement.' };
}
