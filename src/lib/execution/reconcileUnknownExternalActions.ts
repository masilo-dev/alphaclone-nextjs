import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { persistActionReceipt } from '@/lib/mcp/actionReceipts';

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
  if (!row.provider_reference) return 'still_unknown';
  const admin = createSupabaseAdminClient();
  const { data: emailRow } = await admin
    .from('emails')
    .select('id, delivery_status, provider_message_id')
    .eq('tenant_id', row.tenant_id)
    .or(`id.eq.${row.provider_reference},provider_message_id.eq.${row.provider_reference}`)
    .maybeSingle();
  if (!emailRow) return 'still_unknown';
  const status = String(emailRow.delivery_status || '').toLowerCase();
  if (status === 'delivered' || status === 'sent' || status === 'verified') return 'verified';
  if (status === 'failed' || status === 'bounced') return 'failed';
  return 'still_unknown';
}

async function reconcileSocialAction(row: ReconcileRow): Promise<ReconcileOutcome> {
  if (!row.provider_reference) return 'still_unknown';
  const admin = createSupabaseAdminClient();
  const { data: post } = await admin
    .from('social_posts')
    .select('id, status, external_post_id')
    .eq('tenant_id', row.tenant_id)
    .or(`id.eq.${row.provider_reference},external_post_id.eq.${row.provider_reference}`)
    .maybeSingle();
  if (!post) return 'still_unknown';
  if (String(post.status).toLowerCase() === 'published') return 'verified';
  if (String(post.status).toLowerCase() === 'failed') return 'failed';
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
      receipt: {
        action_id: row.action_id,
        status: 'verified',
        timestamp: new Date().toISOString(),
        provider_reference: row.provider_reference || undefined,
      },
      success: true,
    }).catch(() => undefined);
  } else if (outcome === 'failed') {
    patch.status = 'failed';
    patch.failure_reason = 'Reconciliation determined provider failure';
  } else if (attempts >= MAX_ATTEMPTS) {
    patch.status = 'failed';
    patch.failure_reason = 'Reconciliation exhausted — outcome remains unknown';
  } else {
    patch.status = 'unknown_execution_state';
    patch.failure_reason = row.failure_reason || 'Awaiting provider evidence';
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
  const { data: rows, error } = await admin
    .from('external_actions')
    .select(
      'action_id, tenant_id, user_id, tool_name, status, provider, provider_reference, idempotency_key, payload, failure_reason, created_at'
    )
    .eq('status', 'unknown_execution_state')
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
