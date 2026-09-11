/**
 * Resolve social_chaser instances when a verified provider publish receipt exists.
 */

import 'server-only';

import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { transitionChaseState } from '@/lib/chaser/chaseInstanceService';

export type ReconcileSocialReceiptInput = {
  tenantId: string;
  postId?: string;
  connectionId?: string;
  provider?: string;
  providerReference?: string | null;
};

export async function reconcileSocialChaseOnPublishReceipt(
  input: ReconcileSocialReceiptInput,
): Promise<number> {
  const admin = createSupabaseAdminClient();
  let resolved = 0;

  let connectionId = input.connectionId;
  if (!connectionId && input.provider) {
    const { data: conn } = await admin
      .from('social_connections')
      .select('id')
      .eq('tenant_id', input.tenantId)
      .eq('provider', input.provider)
      .eq('connection_status', 'active')
      .limit(1)
      .maybeSingle();
    connectionId = conn?.id;
  }

  if (connectionId) {
    const { data: chases } = await admin
      .from('chase_instances')
      .select('id')
      .eq('tenant_id', input.tenantId)
      .eq('policy_key', 'social_chaser')
      .eq('entity_type', 'social_account')
      .eq('entity_id', connectionId)
      .not('state', 'in', '("RESOLVED","EXHAUSTED","CANCELLED")')
      .limit(10);

    for (const chase of chases || []) {
      const ok = await transitionChaseState(input.tenantId, chase.id, {
        state: 'RESOLVED',
        terminalOutcome: 'verified_publish',
        evidence: {
          resolved_by: 'social_publish_receipt',
          post_id: input.postId || null,
          provider_reference: input.providerReference || null,
          at: new Date().toISOString(),
        },
      });
      if (ok.ok) resolved += 1;
    }
  }

  return resolved;
}

/** Scan active social chases and resolve any with a verified publish in the lookback window. */
export async function reconcileSocialChasesForTenant(tenantId: string): Promise<number> {
  const admin = createSupabaseAdminClient();
  const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString();
  let resolved = 0;

  const { data: chases } = await admin
    .from('chase_instances')
    .select('id, entity_id, context_snapshot')
    .eq('tenant_id', tenantId)
    .eq('policy_key', 'social_chaser')
    .not('state', 'in', '("RESOLVED","EXHAUSTED","CANCELLED")')
    .limit(50);

  for (const chase of chases || []) {
    const provider = String(
      (chase.context_snapshot as Record<string, unknown>)?.provider || '',
    );
    if (!provider) continue;

    const { data: recentPost } = await admin
      .from('social_posts')
      .select('id, facebook_post_id, linkedin_post_urn, published_at')
      .eq('tenant_id', tenantId)
      .eq('status', 'published')
      .gte('published_at', twoDaysAgo)
      .contains('platforms', [provider])
      .or('facebook_post_id.not.is.null,linkedin_post_urn.not.is.null')
      .limit(1)
      .maybeSingle();

    if (!recentPost?.id) continue;

    const providerReference = recentPost.facebook_post_id || recentPost.linkedin_post_urn;
    const ok = await transitionChaseState(tenantId, chase.id, {
      state: 'RESOLVED',
      terminalOutcome: 'verified_publish',
      evidence: {
        resolved_by: 'social_receipt_reconciliation',
        post_id: recentPost.id,
        provider_reference: providerReference,
        published_at: recentPost.published_at,
        at: new Date().toISOString(),
      },
    });
    if (ok.ok) resolved += 1;
  }

  return resolved;
}
