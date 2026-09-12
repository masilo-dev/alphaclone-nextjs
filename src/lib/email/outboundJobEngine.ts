import { createHash, randomUUID } from 'node:crypto';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import type { ResolvedEmailRoute } from '@/lib/email/resolveEmailRoute';

function deliveryKey(input: { tenantId: string; campaignId: string; recipientId: string; campaignVersion: string }): string {
  return createHash('sha256').update([
    input.tenantId, input.campaignId, input.recipientId, input.campaignVersion,
  ].join('|')).digest('hex');
}

/**
 * Creates canonical message + recipient + durable job rows. The queue is the
 * source of execution truth; a provider must never be contacted before this
 * returns a durable row.
 */
export async function enqueueCampaignRecipientJob(input: {
  tenantId: string;
  campaignId: string;
  campaignVersion?: string | number;
  recipient: { id: string; email: string; contactId?: string | null };
  subject: string;
  bodyPreview: string;
  userId?: string | null;
  route: ResolvedEmailRoute;
  scheduledFor?: string | null;
  priority?: number;
}): Promise<{ jobId: string; messageId: string; created: boolean; idempotencyKey: string }> {
  const admin = createSupabaseAdminClient();
  const idempotencyKey = deliveryKey({
    tenantId: input.tenantId, campaignId: input.campaignId, recipientId: input.recipient.id,
    campaignVersion: String(input.campaignVersion || 1),
  });
  const { data: existing, error: existingError } = await admin.from('email_outbound_jobs')
    .select('id, message_id').eq('tenant_id', input.tenantId).eq('idempotency_key', idempotencyKey).maybeSingle();
  if (existingError) throw new Error(`EMAIL_JOB_LOOKUP_FAILED: ${existingError.message}`);
  if (existing) return { jobId: String(existing.id), messageId: String(existing.message_id), created: false, idempotencyKey };

  const now = new Date().toISOString();
  const messageId = randomUUID();
  const { error: messageError } = await admin.from('email_messages').insert({
    id: messageId, tenant_id: input.tenantId, provider_account_id: input.route.providerAccountId,
    sender_identity_id: input.route.senderIdentityId, direction: 'outbound', purpose: 'marketing',
    subject: input.subject, body_preview: input.bodyPreview.slice(0, 500), application_status: 'queued',
    delivery_status: 'unknown', created_by: input.userId || null,
    metadata: { campaign_id: input.campaignId, campaign_recipient_id: input.recipient.id, idempotency_key: idempotencyKey },
  });
  if (messageError) throw new Error(`EMAIL_MESSAGE_QUEUE_FAILED: ${messageError.message}`);

  const { error: recipientError } = await admin.from('email_message_recipients').insert({
    tenant_id: input.tenantId, message_id: messageId, recipient_type: 'to', email_address: input.recipient.email.toLowerCase(),
    contact_id: input.recipient.contactId || null, delivery_status: 'queued',
  });
  if (recipientError) throw new Error(`EMAIL_MESSAGE_RECIPIENT_QUEUE_FAILED: ${recipientError.message}`);

  const jobId = randomUUID();
  const { error: jobError } = await admin.from('email_outbound_jobs').insert({
    id: jobId, tenant_id: input.tenantId, campaign_id: input.campaignId, recipient_id: input.recipient.id,
    message_id: messageId, provider_account_id: input.route.providerAccountId, sender_identity_id: input.route.senderIdentityId,
    requested_provider: input.route.requestedProvider, resolved_provider: input.route.provider,
    status: input.scheduledFor ? 'scheduled' : 'queued', priority: input.priority || 0,
    scheduled_for: input.scheduledFor || null, next_attempt_at: input.scheduledFor || now,
    max_attempts: 5, idempotency_key: idempotencyKey,
  });
  if (jobError) {
    // The unique idempotency constraint is the concurrency safety net.
    const { data: duplicate } = await admin.from('email_outbound_jobs').select('id, message_id')
      .eq('tenant_id', input.tenantId).eq('idempotency_key', idempotencyKey).maybeSingle();
    if (duplicate) return { jobId: String(duplicate.id), messageId: String(duplicate.message_id), created: false, idempotencyKey };
    throw new Error(`EMAIL_JOB_ENQUEUE_FAILED: ${jobError.message}`);
  }
  return { jobId, messageId, created: true, idempotencyKey };
}

export function nextEmailRetryAt(attemptCount: number, now = Date.now()): string {
  const delays = [0, 60_000, 5 * 60_000, 30 * 60_000, 2 * 60 * 60_000];
  return new Date(now + (delays[Math.min(Math.max(attemptCount, 0), delays.length - 1)] || 0)).toISOString();
}
