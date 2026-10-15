import 'server-only';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { sendEmailServer } from '@/lib/email/sendEmailServer';
import { nextEmailRetryAt } from '@/lib/email/outboundJobEngine';

export async function processOutboundEmailJobs(limit = 20): Promise<{
  processed: number;
  accepted: number;
  retried: number;
  failed: number;
}> {
  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const workerId = `email-worker-${process.pid}-${Date.now()}`;
  const counts = { processed: 0, accepted: 0, retried: 0, failed: 0 };

  // 1. Reclaim stale running locks older than 10 minutes
  const staleThreshold = new Date(Date.now() - 10 * 60_000).toISOString();
  const { data: staleJobs } = await admin
    .from('email_outbound_jobs')
    .select('id, tenant_id, message_id, attempt_count, max_attempts')
    .eq('status', 'running')
    .lt('locked_at', staleThreshold)
    .limit(limit);

  for (const stale of staleJobs || []) {
    // Check if the underlying email_messages row was already accepted
    const { data: msg } = await admin
      .from('email_messages')
      .select('application_status, provider_message_id')
      .eq('tenant_id', stale.tenant_id)
      .eq('id', stale.message_id)
      .maybeSingle();

    if (msg?.provider_message_id || msg?.application_status === 'provider_accepted' || msg?.application_status === 'sent') {
      await admin
        .from('email_outbound_jobs')
        .update({
          status: 'provider_accepted',
          accepted_at: now,
          provider_message_id: msg.provider_message_id,
          updated_at: now,
        })
        .eq('id', stale.id);
    } else {
      const nextStatus = stale.attempt_count < (stale.max_attempts || 5) ? 'retryable' : 'failed';
      await admin
        .from('email_outbound_jobs')
        .update({
          status: nextStatus,
          last_error_message: 'Worker claim expired; recovering from unconfirmed execution',
          next_attempt_at: nextEmailRetryAt(stale.attempt_count),
          updated_at: now,
        })
        .eq('id', stale.id);
    }
  }

  // 2. Query due jobs
  const { data: dueJobs, error: dueError } = await admin
    .from('email_outbound_jobs')
    .select('id, tenant_id, message_id, provider_account_id, campaign_id, recipient_id, requested_provider, resolved_provider, attempt_count, max_attempts, idempotency_key')
    .in('status', ['queued', 'retryable'])
    .or(`next_attempt_at.is.null,next_attempt_at.lte.${now}`)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(limit);

  if (dueError || !dueJobs?.length) return counts;

  for (const job of dueJobs) {
    // Atomic claim
    const { data: claimed, error: claimError } = await admin
      .from('email_outbound_jobs')
      .update({
        status: 'running',
        locked_at: now,
        locked_by: workerId,
        started_at: now,
        attempt_count: (job.attempt_count || 0) + 1,
        updated_at: now,
      })
      .eq('id', job.id)
      .in('status', ['queued', 'retryable'])
      .select('id')
      .maybeSingle();

    if (claimError || !claimed) continue;
    counts.processed++;

    try {
      // Load canonical message and recipient
      const [msgRes, recRes] = await Promise.all([
        admin
          .from('email_messages')
          .select('id, subject, body_preview, metadata, purpose, created_by')
          .eq('tenant_id', job.tenant_id)
          .eq('id', job.message_id)
          .maybeSingle(),
        admin
          .from('email_message_recipients')
          .select('id, email_address, contact_id')
          .eq('tenant_id', job.tenant_id)
          .eq('message_id', job.message_id)
          .limit(1)
          .maybeSingle(),
      ]);

      const message = msgRes.data;
      const recipient = recRes.data;

      if (!message || !recipient?.email_address) {
        await admin
          .from('email_outbound_jobs')
          .update({
            status: 'failed',
            failed_at: new Date().toISOString(),
            last_error_code: 'MESSAGE_OR_RECIPIENT_MISSING',
            last_error_message: 'Associated canonical message or recipient record could not be found',
            updated_at: new Date().toISOString(),
          })
          .eq('id', job.id);
        counts.failed++;
        continue;
      }

      // Dispatch via canonical sendEmailServer
      const result = await sendEmailServer({
        tenantId: job.tenant_id,
        userId: message.created_by || undefined,
        to: recipient.email_address,
        subject: message.subject || '',
        text: message.body_preview || '',
        category: (message.purpose === 'marketing' ? 'marketing' : 'outreach') as any,
        providerAccountId: job.provider_account_id || undefined,
        idempotencyKey: job.idempotency_key,
        auditMetadata: {
          job_id: job.id,
          campaign_id: job.campaign_id,
          message_id: message.id,
          contact_id: recipient.contact_id,
          source_module: 'CAMPAIGNS',
          source_action: 'outbound_job_dispatch',
        },
      });

      if (result.success) {
        const completedAt = new Date().toISOString();
        await admin
          .from('email_outbound_jobs')
          .update({
            status: 'provider_accepted',
            accepted_at: completedAt,
            provider_message_id: result.emailId || null,
            resolved_provider: result.provider || job.resolved_provider,
            last_error_message: null,
            updated_at: completedAt,
          })
          .eq('id', job.id);

        await admin
          .from('email_messages')
          .update({
            application_status: 'provider_accepted',
            provider_message_id: result.emailId || null,
            sent_at: completedAt,
            updated_at: completedAt,
          })
          .eq('id', job.message_id);

        counts.accepted++;
      } else {
        const attempts = (job.attempt_count || 0) + 1;
        const retryable = attempts < (job.max_attempts || 5);
        const retryAt = nextEmailRetryAt(attempts);

        await admin
          .from('email_outbound_jobs')
          .update({
            status: retryable ? 'retryable' : 'failed',
            last_error_code: result.code || 'SEND_FAILED',
            last_error_message: result.error || 'Outbound email send failed',
            next_attempt_at: retryable ? retryAt : null,
            failed_at: retryable ? null : new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', job.id);

        if (retryable) counts.retried++;
        else counts.failed++;
      }
    } catch (err: any) {
      const attempts = (job.attempt_count || 0) + 1;
      const retryable = attempts < (job.max_attempts || 5);
      await admin
        .from('email_outbound_jobs')
        .update({
          status: retryable ? 'retryable' : 'failed',
          last_error_message: err instanceof Error ? err.message : String(err),
          next_attempt_at: retryable ? nextEmailRetryAt(attempts) : null,
          failed_at: retryable ? null : new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.id);

      if (retryable) counts.retried++;
      else counts.failed++;
    }
  }

  return counts;
}
