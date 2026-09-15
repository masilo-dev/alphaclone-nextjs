import 'server-only';

import { createHash, randomUUID } from 'node:crypto';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { resolveTenantIdentityForPublish } from '@/lib/social/socialIdentityStore';
import type { SocialIdentityType, SocialPlatform } from '@/lib/social/types';
import { deterministicPublishKey, normalizeSocialCaption } from '@/lib/social/publishIdempotency';

export const PUBLISH_PENDING_STATES = new Set([
  'created', 'preflighting', 'uploading', 'provider_processing', 'verifying', 'reconciliation_required',
]);

export async function createPublishOperation(input: {
  tenantId: string; userId: string; platform: SocialPlatform; identityType: SocialIdentityType;
  identityId?: string; assetIds: string[]; caption: string; requestedPublishTime?: string | null;
  correlationId?: string;
}) {
  const admin = createSupabaseAdminClient();
  const identity = await resolveTenantIdentityForPublish({
    tenantId: input.tenantId, provider: input.platform, identityId: input.identityId,
    identityType: input.identityType, allowDefault: !input.identityId,
  });
  if (identity.tenant_id !== input.tenantId || identity.provider !== input.platform ||
      identity.identity_type !== input.identityType) {
    const code = input.platform === 'linkedin' ? 'LINKEDIN_DESTINATION_MISMATCH' : 'SOCIAL_IDENTITY_MISMATCH';
    throw new Error(`${code}: requested ${input.identityType}, resolved ${identity.identity_type}`);
  }
  if (!identity.can_publish) throw new Error('SOCIAL_IDENTITY_NOT_PUBLISHABLE: connected identity lacks publish capability');
  const { data: assets, error: assetError } = await admin.from('media_assets')
    .select('id, tenant_id, checksum_sha256, status, original_metadata, final_metadata')
    .eq('tenant_id', input.tenantId).in('id', input.assetIds);
  if (assetError) throw new Error(assetError.message);
  if (!assets || assets.length !== input.assetIds.length) throw new Error('CROSS_TENANT_MEDIA_DENIED: media asset is not owned by this tenant');
  if (assets.some((asset) => asset.status !== 'ready' || !asset.checksum_sha256)) {
    throw new Error('MEDIA_NOT_READY: every asset must pass storage retrieval and full probe');
  }
  const checksum = createHash('sha256').update(input.assetIds.map((id) => {
    const asset = assets.find((row) => row.id === id)!;
    return `${id}:${asset.checksum_sha256}`;
  }).join('|')).digest('hex');
  const idempotencyKey = deterministicPublishKey({
    tenantId: input.tenantId, identityId: identity.identity_id, platform: input.platform,
    mediaChecksum: checksum, caption: input.caption, requestedPublishTime: input.requestedPublishTime,
  });
  const row = {
    tenant_id: input.tenantId, user_id: input.userId, identity_id: identity.identity_id,
    platform: input.platform, requested_identity_type: input.identityType,
    resolved_identity_type: identity.identity_type, provider_identity_id: identity.provider_identity_id,
    requested_publish_time: input.requestedPublishTime || null,
    normalized_caption: normalizeSocialCaption(input.caption), media_asset_ids: input.assetIds,
    media_checksum: checksum, idempotency_key: idempotencyKey,
    correlation_id: input.correlationId || randomUUID(), state: 'created', retry_safe: false,
  };
  const { data, error } = await admin.from('social_publish_operations').insert(row).select('*').single();
  if (error?.code === '23505') {
    const { data: existing, error: existingError } = await admin.from('social_publish_operations')
      .select('*').eq('tenant_id', input.tenantId).eq('idempotency_key', idempotencyKey).single();
    if (existingError) throw new Error(existingError.message);
    return { operation: existing, identity, assets, reused: true };
  }
  if (error) throw new Error(error.message);
  return { operation: data, identity, assets, reused: false };
}

export function operationReceipt(operation: any) {
  const pending = PUBLISH_PENDING_STATES.has(operation.state);
  return {
    published: operation.state === 'published',
    provider: operation.platform,
    verified: operation.provider_identity_verified === true,
    verification_timestamp: operation.verification_timestamp || null,
    asset_ids: operation.media_asset_ids || [],
    operation_id: operation.id, correlation_id: operation.correlation_id,
    social_post_id: operation.social_post_id || null, platform: operation.platform,
    requested_identity_id: operation.identity_id,
    requested_identity_type: operation.requested_identity_type,
    resolved_identity_id: operation.identity_id,
    resolved_identity_type: operation.resolved_identity_type,
    provider_identity: operation.provider_identity_id,
    media_asset_ids: operation.media_asset_ids || [], media_checksum: operation.media_checksum,
    provider_container_id: operation.provider_container_id || null,
    provider_post_id: operation.provider_post_id || null,
    live_url: operation.provider_permalink || null, state: operation.state,
    created_time: operation.created_at, published_time: operation.published_at || null,
    verification_time: operation.verification_timestamp || null,
    retry_safe: operation.retry_safe === true,
    retry_after: pending ? operation.retry_after || new Date(Date.now() + 15_000).toISOString() : null,
    rollback_available: operation.platform === 'facebook',
    provider_deletion_available: operation.platform === 'facebook',
    verification_status: operation.provider_identity_verified ? 'verified' : pending ? 'pending' : 'unverified',
  };
}
