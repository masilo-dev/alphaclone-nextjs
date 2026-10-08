import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { persistActionReceipt } from '@/lib/mcp/actionReceipts';
import { insertTenantNotification } from '@/lib/notifications/insertTenantNotification';

export type ReconcileRow = {
  action_id: string;
  tenant_id: string;
  user_id: string | null;
  tool_name: string;
  status: string;
  provider: string | null;
  provider_reference: string | null;
  idempotency_key: string | null;
  payload: Record<string, unknown> | null;
  failure_reason: string | null;
  created_at: string;
};

export type ReconcileOutcome = 'verified' | 'failed' | 'still_unknown';

const MAX_ATTEMPTS = 8;

function backoffMinutes(attempt: number): number {
  return Math.min(60 * 24, 5 * 2 ** Math.min(attempt, 6));
}

async function reconcileEmailAction(row: ReconcileRow): Promise<ReconcileOutcome> {
  const admin = createSupabaseAdminClient();
  const providerRef = row.provider_reference || row.idempotency_key;

  // 1. Check canonical email_messages table
  if (providerRef) {
    const { data: msg } = await admin
      .from('email_messages')
      .select('id, delivery_status, provider_message_id, folder_name')
      .eq('tenant_id', row.tenant_id)
      .or(`id.eq.${providerRef},provider_message_id.eq.${providerRef}`)
      .maybeSingle();

    if (msg) {
      const delivery = String(msg.delivery_status || '').toLowerCase();
      const folder = String(msg.folder_name || '').toLowerCase();
      if (delivery === 'delivered' || delivery === 'sent' || delivery === 'verified' || folder === 'sent') {
        return 'verified';
      }
      if (delivery === 'failed' || delivery === 'bounced' || delivery === 'rejected') {
        return 'failed';
      }
    }
  }

  // 2. Check unified_messages table
  if (providerRef) {
    const { data: unified } = await admin
      .from('unified_messages')
      .select('id, delivery_status, folder, external_id')
      .eq('tenant_id', row.tenant_id)
      .or(`id.eq.${providerRef},external_id.eq.${providerRef}`)
      .maybeSingle();

    if (unified) {
      const delivery = String(unified.delivery_status || '').toLowerCase();
      const folder = String(unified.folder || '').toLowerCase();
      if (delivery === 'delivered' || delivery === 'sent' || folder === 'sent') {
        return 'verified';
      }
      if (delivery === 'failed' || delivery === 'bounced') {
        return 'failed';
      }
    }
  }

  // 3. Fallback: check legacy emails table if populated
  if (providerRef) {
    const { data: legacy } = await admin
      .from('emails')
      .select('id, delivery_status, provider_message_id')
      .eq('tenant_id', row.tenant_id)
      .or(`id.eq.${providerRef},provider_message_id.eq.${providerRef}`)
      .maybeSingle();

    if (legacy) {
      const status = String(legacy.delivery_status || '').toLowerCase();
      if (status === 'delivered' || status === 'sent' || status === 'verified') return 'verified';
      if (status === 'failed' || status === 'bounced') return 'failed';
    }
  }

  return 'still_unknown';
}

async function reconcileSocialAction(row: ReconcileRow): Promise<ReconcileOutcome> {
  const providerRef = row.provider_reference || row.idempotency_key;
  if (!providerRef) return 'still_unknown';
  const admin = createSupabaseAdminClient();
  const { data: post } = await admin
    .from('social_posts')
    .select('id, status, external_post_id, linkedin_post_urn, facebook_post_id')
    .eq('tenant_id', row.tenant_id)
    .or(`id.eq.${providerRef},external_post_id.eq.${providerRef}`)
    .maybeSingle();

  if (!post) return 'still_unknown';
  const status = String(post.status).toLowerCase();
  if (status === 'published' || post.linkedin_post_urn || post.facebook_post_id) return 'verified';
  if (status === 'failed') return 'failed';
  return 'still_unknown';
}

async function reconcileOne(row: ReconcileRow): Promise<{ actionId: string; outcome: ReconcileOutcome }> {
  const admin = createSupabaseAdminClient();
  const payload = (row.payload || {}) as Record<string, unknown>;
  const attempts = Number(payload.reconciliation_attempts || 0) + 1;
  const tool = String(row.tool_name || '').toLowerCase();

  let outcome: ReconcileOutcome = 'still_unknown';
  if (tool.includes('email') || tool === 'send_email') {
    outcome = await reconcileEmailAction(row);
  } else if (tool.includes('social') || tool.startsWith('publish_')) {
    outcome = await reconcileSocialAction(row);
  }

  const patch: Record<string, unknown> = {
    payload: {
      ...payload,
      reconciliation_attempts: attempts,
      last_reconciliation_at: new Date().toISOString(),
      reconciliation_outcome: outcome,
    },
  };

  if (outcome === 'verified') {
    patch.status = 'completed';
    patch.completed_at = new Date().toISOString();
    patch.failure_reason = null;
    await persistActionReceipt({
      tenantId: row.tenant_id,
      userId: row.user_id,
      tool: row.tool_name,
      idempotencyKey: row.idempotency_key,
      correlationId: row.action_id,
      receipt: {
        action_id: row.action_id,
        execution_id: row.action_id,
        correlation_id: row.action_id,
        status: 'succeeded',
        verification_status: 'verified',
        timestamp: new Date().toISOString(),
        provider_reference: row.provider_reference || undefined,
      },
      success: true,
    }).catch(() => undefined);

    // Synchronize the user notification to verified success!
    if (row.user_id) {
      await insertTenantNotification(admin, {
        tenantId: row.tenant_id,
        recipientUserId: row.user_id,
        eventType: tool.includes('email') ? 'email.sent' : 'social.post_published',
        title: `${row.tool_name} (Verified)`,
        message: 'Action completed and verified successfully by background reconciliation.',
        severity: 'medium',
        correlationId: row.action_id,
        dedupeKey: `exec:${row.action_id}`,
      }).catch(() => undefined);
    }
  } else if (outcome === 'failed') {
    patch.status = 'failed';
    patch.failure_reason = 'Reconciliation determined definitive provider failure';
    if (row.user_id) {
      await insertTenantNotification(admin, {
        tenantId: row.tenant_id,
        recipientUserId: row.user_id,
        eventType: tool.includes('email') ? 'email.failed' : 'social.post_failed',
        title: `${row.tool_name} Failed`,
        message: 'Background verification established that the action failed with the provider.',
        severity: 'high',
        correlationId: row.action_id,
        dedupeKey: `exec:${row.action_id}`,
      }).catch(() => undefined);
    }
  } else if (attempts >= MAX_ATTEMPTS) {
    // Explicit unresolved state — never invent a failure!
    patch.status = 'outcome_unknown';
    patch.failure_reason = 'Verification window expired without provider evidence. Outcome remains unresolved.';
    (patch.payload as Record<string, unknown>).unresolved = true;
    (patch.payload as Record<string, unknown>).canonical_state = 'pending_verification';
  } else {
    patch.status = 'outcome_unknown';
    patch.failure_reason = row.failure_reason || 'Awaiting provider evidence';
    (patch.payload as Record<string, unknown>).canonical_state = 'pending_verification';
    (patch.payload as Record<string, unknown>).next_reconciliation_at = new Date(
      Date.now() + backoffMinutes(attempts) * 60_000
    ).toISOString();
  }

  await admin.from('external_actions').update(patch).eq('action_id', row.action_id);
  return { actionId: row.action_id, outcome };
}

export async function reconcileUnknownExternalActions(limit = 25): Promise<{
  processed: number;
  results: Array<{ actionId: string; outcome: ReconcileOutcome }>;
}> {
  const admin = createSupabaseAdminClient();
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60_000).toISOString();

  // Query ambiguous states AND stale running actions that may have crashed
  const { data: rows, error } = await admin
    .from('external_actions')
    .select(
      'action_id, tenant_id, user_id, tool_name, status, provider, provider_reference, idempotency_key, payload, failure_reason, created_at'
    )
    .or(`status.in.(unknown_execution_state,outcome_unknown,verification_pending),and(status.eq.running,created_at.lt.${fiveMinutesAgo})`)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    console.warn('[reconcileUnknownExternalActions] query failed:', error.message);
    return { processed: 0, results: [] };
  }

  const results: Array<{ actionId: string; outcome: ReconcileOutcome }> = [];
  for (const row of (rows || []) as ReconcileRow[]) {
    results.push(await reconcileOne(row));
  }
  return { processed: results.length, results };
}
