/**
 * SocialPublishingService — single canonical publisher for dashboard, Bonnie,
 * ChatGPT, Claude, Cursor, API routes, cron workers, and MCP tools.
 *
 * A successful ok=true response means the content is visible on the provider
 * (or queued with status=queued). Inserting a DB row alone is never "published".
 */

import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { getFacebookIntegrationWithToken } from '@/services/facebook/facebookIntegrationService';
import { publishLinkedInPost } from '@/lib/linkedin/publishPost';
import {
  buildFacebookPostUrl,
  confirmFacebookPublish,
  verifyFacebookPostExists,
  FacebookPublishError,
} from '@/lib/facebook/verifyFacebookPost';
import { isSocialPublishEnabled } from '@/lib/social/publishConfig';
import {
  applyTestCaptionPrefix,
  getTestModeDestinations,
  isSocialPublishTestMode,
  normalizeIdentityType,
} from '@/lib/social/identityResolution';
import { redactSecrets, resolveMediaUrls } from '@/lib/social/mediaUpload';
import type {
  ProviderPublishResult,
  PublishSocialPostInput,
  PublishSocialPostResult,
  ResolvedIdentity,
  SocialActionReceipt,
  SocialPostStatus,
} from '@/lib/social/types';

function newId(): string {
  return crypto.randomUUID();
}

function isStatusConstraintViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const maybe = error as { code?: string; message?: string };
  return maybe.code === '23514' && (maybe.message || '').includes('social_posts_status_check');
}

function mapStatusForLegacyConstraint(status: string): string {
  const map: Record<string, string> = {
    validating: 'draft',
    awaiting_approval: 'draft',
    approved: 'draft',
    uploading_media: 'queued',
    queued: 'scheduled',
    publishing: 'scheduled',
    verification_failed: 'failed',
    retrying: 'scheduled',
    orphaned: 'failed',
    deleted: 'cancelled',
  };
  return map[status] || status;
}

async function updatePost(
  postId: string,
  payload: Record<string, unknown>
): Promise<{ error: { message: string } | null }> {
  const admin = createSupabaseAdminClient();
  const first = await admin.from('social_posts').update(payload).eq('id', postId);
  if (!isStatusConstraintViolation(first.error)) {
    return { error: first.error ? { message: first.error.message } : null };
  }
  const fallback = { ...payload };
  if (typeof fallback.status === 'string') {
    fallback.status = mapStatusForLegacyConstraint(fallback.status);
  }
  const second = await admin.from('social_posts').update(fallback).eq('id', postId);
  return { error: second.error ? { message: second.error.message } : null };
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 25000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function buildLinkedInPermalink(postUrn: string | null | undefined): string | null {
  if (!postUrn) return null;
  const encoded = encodeURIComponent(postUrn);
  return `https://www.linkedin.com/feed/update/${encoded}`;
}

function logPublishEvent(event: Record<string, unknown>): void {
  console.info('[SocialPublishingService]', JSON.stringify(redactSecrets(event)));
}

export class SocialPublishingService {
  async resolveIdentity(input: {
    tenantId: string;
    platform: PublishSocialPostInput['platform'];
    identityType: PublishSocialPostInput['identityType'];
    identityId: string;
  }): Promise<ResolvedIdentity> {
    let identityId = input.identityId;
    const normalizedType = normalizeIdentityType(input.identityType);
    if (isSocialPublishTestMode()) {
      const test = getTestModeDestinations();
      if (input.platform === 'facebook' && test.facebookPageId) {
        identityId = test.facebookPageId;
      }
      if (
        input.platform === 'linkedin' &&
        normalizedType === 'linkedin_organization' &&
        test.linkedinOrganizationId
      ) {
        identityId = test.linkedinOrganizationId;
      }
      if (normalizedType === 'linkedin_person') {
        throw new Error('SOCIAL_PUBLISH_TEST_MODE forbids personal LinkedIn publishing');
      }
    }

    // Prefer tenant-scoped identity store (internal UUID or provider id within tenant)
    const { resolveTenantIdentityForPublish } = await import('@/lib/social/socialIdentityStore');
    const stored = await resolveTenantIdentityForPublish({
      tenantId: input.tenantId,
      identityId,
      identityType: normalizedType,
      provider: input.platform,
      allowDefault: false,
    });

    if (stored.identity_type === 'facebook_page') {
      return {
        platform: 'facebook',
        identity_type: 'facebook_page',
        identity_id: stored.provider_identity_id,
        identity_name: stored.display_name,
        page_id: stored.provider_identity_id,
        can_publish: stored.can_publish,
        missing_permissions: stored.can_publish ? [] : ['pages_manage_posts'],
      };
    }

    if (stored.identity_type === 'linkedin_organization') {
      return {
        platform: 'linkedin',
        identity_type: 'linkedin_organization',
        identity_id: stored.provider_identity_id,
        identity_name: stored.display_name,
        author_urn: stored.provider_identity_urn,
        organization_id: stored.provider_identity_id,
        can_publish: stored.can_publish,
        missing_permissions: [],
        role: (stored.metadata?.role as string) || 'ADMINISTRATOR',
      };
    }

    return {
      platform: 'linkedin',
      identity_type: 'linkedin_person',
      identity_id: stored.provider_identity_id,
      identity_name: stored.display_name,
      author_urn: stored.provider_identity_urn,
      can_publish: stored.can_publish,
      missing_permissions: [],
    };
  }

  async uploadMedia(input: {
    tenantId: string;
    userId: string;
    filename: string;
    mimeType: string;
    contentBase64: string;
    altText?: string;
  }) {
    const { uploadSocialMedia } = await import('@/lib/social/mediaUpload');
    return uploadSocialMedia(input);
  }

  async validateCapabilities(identity: ResolvedIdentity): Promise<void> {
    if (!identity.can_publish) {
      throw new Error(
        `Identity ${identity.identity_name} cannot publish. Missing: ${
          identity.missing_permissions.join(', ') || 'permissions'
        }`
      );
    }
  }

  async createPostRecord(params: {
    tenantId: string;
    userId: string;
    identity: ResolvedIdentity;
    caption: string;
    mediaUrls: string[];
    mediaTypes: string[];
    mediaAssetIds: string[];
    linkUrl?: string | null;
    status: SocialPostStatus;
    scheduledAt?: string | null;
    idempotencyKey?: string | null;
    correlationId: string;
    aiClient?: string | null;
  }): Promise<{ id: string; reused?: boolean; status?: string; hasProviderId?: boolean }> {
    const admin = createSupabaseAdminClient();
    const now = new Date().toISOString();
    const platform = params.identity.platform;

    // Idempotency: return existing row if key already used (caller must not re-publish
    // when status is publishing/published).
    if (params.idempotencyKey) {
      const { data: existing } = await admin
        .from('social_posts')
        .select('id, status, facebook_post_id, linkedin_post_urn')
        .eq('tenant_id', params.tenantId)
        .eq('idempotency_key', params.idempotencyKey)
        .maybeSingle();
      if (existing?.id) {
        return {
          id: existing.id,
          reused: true,
          status: String(existing.status || ''),
          hasProviderId: Boolean(existing.facebook_post_id || existing.linkedin_post_urn),
        };
      }
    }

    const payload: Record<string, unknown> = {
      tenant_id: params.tenantId,
      user_id: params.userId,
      created_by: params.userId,
      platforms: [platform],
      platform,
      caption: params.caption,
      content: params.caption,
      media_urls: params.mediaUrls,
      media_types: params.mediaTypes,
      link_url: params.linkUrl || null,
      status: params.status,
      scheduled_at: params.scheduledAt || (params.status === 'scheduled' ? now : null),
      facebook_page_id: params.identity.page_id || null,
      linkedin_member_id:
        params.identity.identity_type === 'linkedin_person' ? params.identity.identity_id : null,
      linkedin_organization_id: params.identity.organization_id || null,
      linkedin_author_urn: params.identity.author_urn || null,
      idempotency_key: params.idempotencyKey || null,
      correlation_id: params.correlationId,
      metadata: {
        identity_type: params.identity.identity_type,
        identity_id: params.identity.identity_id,
        identity_name: params.identity.identity_name,
        media_asset_ids: params.mediaAssetIds,
        ai_client: params.aiClient || null,
        correlation_id: params.correlationId,
        linkedin_organization_id: params.identity.organization_id || null,
      },
      created_at: now,
      updated_at: now,
    };

    let { data, error } = await admin.from('social_posts').insert(payload).select('id').single();
    if (error && (error.code === '42703' || /column|does not exist/i.test(error.message || ''))) {
      const minimal: Record<string, unknown> = {
        tenant_id: params.tenantId,
        user_id: params.userId,
        platforms: [platform],
        caption: params.caption,
        media_urls: params.mediaUrls,
        media_types: params.mediaTypes,
        status: mapStatusForLegacyConstraint(params.status),
        scheduled_at: params.scheduledAt || now,
        facebook_page_id: params.identity.page_id || null,
        linkedin_organization_id: params.identity.organization_id || null,
        linkedin_author_urn: params.identity.author_urn || null,
        metadata: payload.metadata,
        created_at: now,
        updated_at: now,
      };
      ({ data, error } = await admin.from('social_posts').insert(minimal).select('id').single());
    }
    if (error || !data?.id) throw new Error(error?.message || 'Failed to create social post record');
    return { id: data.id };
  }

  async publishToFacebook(postId: string, identity: ResolvedIdentity): Promise<ProviderPublishResult> {
    const admin = createSupabaseAdminClient();
    const { data: post, error } = await admin
      .from('social_posts')
      .select('id, tenant_id, facebook_page_id, caption, link_url, media_urls, media_types')
      .eq('id', postId)
      .single();
    if (error || !post) {
      return {
        ok: false,
        provider: 'facebook',
        provider_post_id: null,
        live_url: null,
        published_at: null,
        verified: false,
        verified_at: null,
        error: 'post_not_found',
        error_code: 'POST_NOT_FOUND',
      };
    }

    const pageId = identity.page_id || post.facebook_page_id;
    if (!pageId) {
      return {
        ok: false,
        provider: 'facebook',
        provider_post_id: null,
        live_url: null,
        published_at: null,
        verified: false,
        verified_at: null,
        error: 'missing_page_id',
        error_code: 'MISSING_IDENTITY',
      };
    }

    const integration = await getFacebookIntegrationWithToken(admin, {
      tenantId: post.tenant_id,
      pageId,
    });
    if (!integration?.pageAccessToken) {
      return {
        ok: false,
        provider: 'facebook',
        provider_post_id: null,
        live_url: null,
        published_at: null,
        verified: false,
        verified_at: null,
        error: 'Facebook page token missing or expired',
        error_code: 'TOKEN_MISSING',
      };
    }

    const mediaUrls = Array.isArray(post.media_urls)
      ? post.media_urls.filter((u: unknown): u is string => typeof u === 'string' && !!u)
      : [];
    const mediaTypes = Array.isArray(post.media_types)
      ? post.media_types.map((t: unknown) => String(t || '').toLowerCase())
      : [];

    try {
      let graphResponse: Record<string, unknown>;

      if (mediaUrls.length > 1) {
        // Multi-photo: upload unpublished photos then publish attached_media
        const attached: Array<{ media_fbid: string }> = [];
        for (let i = 0; i < mediaUrls.length; i++) {
          const isVideo =
            mediaTypes[i] === 'video' || /\.(mp4|mov|webm|mkv)(\?|$)/i.test(mediaUrls[i]);
          if (isVideo) {
            return {
              ok: false,
              provider: 'facebook',
              provider_post_id: null,
              live_url: null,
              published_at: null,
              verified: false,
              verified_at: null,
              error: 'Multi-media posts currently support photos only (not mixed video)',
              error_code: 'UNSUPPORTED_MEDIA',
            };
          }
          const uploadRes = await fetchWithTimeout(
            `https://graph.facebook.com/v21.0/${pageId}/photos`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                url: mediaUrls[i],
                published: false,
                access_token: integration.pageAccessToken,
              }),
            }
          );
          const uploadBody = (await uploadRes.json()) as Record<string, unknown>;
          if (!uploadRes.ok || uploadBody?.error || !uploadBody?.id) {
            const errObj = uploadBody?.error as { message?: string } | undefined;
            return {
              ok: false,
              provider: 'facebook',
              provider_post_id: null,
              live_url: null,
              published_at: null,
              verified: false,
              verified_at: null,
              error: errObj?.message || 'Facebook multi-photo upload failed',
              error_code: 'PROVIDER_ERROR',
              provider_response: redactSecrets(uploadBody) as Record<string, unknown>,
            };
          }
          attached.push({ media_fbid: String(uploadBody.id) });
        }
        const feedRes = await fetchWithTimeout(`https://graph.facebook.com/v21.0/${pageId}/feed`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: post.caption,
            attached_media: attached,
            access_token: integration.pageAccessToken,
          }),
        });
        graphResponse = (await feedRes.json()) as Record<string, unknown>;
        if (!feedRes.ok || graphResponse?.error) {
          const errObj = graphResponse?.error as { message?: string } | undefined;
          return {
            ok: false,
            provider: 'facebook',
            provider_post_id: null,
            live_url: null,
            published_at: null,
            verified: false,
            verified_at: null,
            error: errObj?.message || 'Facebook feed publish failed',
            error_code: 'PROVIDER_ERROR',
            provider_response: redactSecrets(graphResponse) as Record<string, unknown>,
          };
        }
      } else {
        const mediaUrl = mediaUrls[0];
        const mediaType = mediaTypes[0] || '';
        const isVideo =
          mediaType === 'video' ||
          (typeof mediaUrl === 'string' && /\.(mp4|mov|avi|webm|mkv)(\?|$)/i.test(mediaUrl));
        const fbBody: Record<string, string> = {
          access_token: integration.pageAccessToken,
        };
        if (post.link_url) fbBody.link = post.link_url;
        if (mediaUrl) {
          if (isVideo) {
            fbBody.file_url = mediaUrl;
            fbBody.description = post.caption;
          } else {
            fbBody.url = mediaUrl;
            fbBody.caption = post.caption;
          }
        } else {
          fbBody.message = post.caption;
        }
        const endpoint = mediaUrl
          ? `https://graph.facebook.com/v21.0/${pageId}/${isVideo ? 'videos' : 'photos'}`
          : `https://graph.facebook.com/v21.0/${pageId}/feed`;
        const res = await fetchWithTimeout(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(fbBody),
        });
        graphResponse = (await res.json()) as Record<string, unknown>;
        if (!res.ok || graphResponse?.error) {
          const errObj = graphResponse?.error as { message?: string } | undefined;
          return {
            ok: false,
            provider: 'facebook',
            provider_post_id: null,
            live_url: null,
            published_at: null,
            verified: false,
            verified_at: null,
            error: errObj?.message || 'Facebook publish failed',
            error_code: 'PROVIDER_ERROR',
            provider_response: redactSecrets(graphResponse) as Record<string, unknown>,
          };
        }
      }

      const verified = await confirmFacebookPublish({
        graphResponse,
        pageAccessToken: integration.pageAccessToken,
        pageId,
      });
      const publishedAt = new Date().toISOString();

      await admin
        .from('social_posts')
        .update({
          facebook_post_id: verified.postId,
          facebook_page_id: pageId,
          published_at: publishedAt,
          live_url: verified.postUrl,
          provider_response: redactSecrets(graphResponse),
        })
        .eq('id', postId);

      return {
        ok: true,
        provider: 'facebook',
        provider_post_id: verified.postId,
        live_url: verified.postUrl,
        published_at: publishedAt,
        verified: true,
        verified_at: publishedAt,
        provider_response: redactSecrets(graphResponse) as Record<string, unknown>,
      };
    } catch (err) {
      const message =
        err instanceof FacebookPublishError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Facebook publish failed';
      const code =
        err instanceof FacebookPublishError && err.code === 'VERIFICATION_FAILED'
          ? 'VERIFICATION_FAILED'
          : 'PROVIDER_ERROR';
      return {
        ok: false,
        provider: 'facebook',
        provider_post_id: null,
        live_url: null,
        published_at: null,
        verified: false,
        verified_at: null,
        error: message,
        error_code: code,
      };
    }
  }

  async publishToLinkedIn(postId: string, identity: ResolvedIdentity): Promise<ProviderPublishResult> {
    // Enforce: never silently fall back from org → personal
    if (identity.identity_type === 'linkedin_organization' && !identity.organization_id) {
      return {
        ok: false,
        provider: 'linkedin',
        provider_post_id: null,
        live_url: null,
        published_at: null,
        verified: false,
        verified_at: null,
        error: 'linkedin_organization requires a resolved organization_id',
        error_code: 'MISSING_ORGANIZATION',
      };
    }

    // Ensure post row carries identity fields before provider call
    await updatePost(postId, {
      linkedin_organization_id:
        identity.identity_type === 'linkedin_organization' ? identity.organization_id : null,
      linkedin_member_id:
        identity.identity_type === 'linkedin_person' ? identity.identity_id : null,
      linkedin_author_urn: identity.author_urn || null,
      metadata: {
        identity_type: identity.identity_type,
        identity_id: identity.identity_id,
        identity_name: identity.identity_name,
        linkedin_organization_id: identity.organization_id || null,
      },
    });

    const result = await publishLinkedInPost(postId);
    if (!result.ok || !result.postUrn) {
      return {
        ok: false,
        provider: 'linkedin',
        provider_post_id: null,
        live_url: null,
        published_at: null,
        verified: false,
        verified_at: null,
        error: result.reason || 'LinkedIn publish failed',
        error_code: 'PROVIDER_ERROR',
      };
    }

    // Guard against silent personal fallback when org was requested
    const admin = createSupabaseAdminClient();
    const { data: updated } = await admin
      .from('social_posts')
      .select('linkedin_author_urn, linkedin_organization_id, linkedin_post_urn')
      .eq('id', postId)
      .maybeSingle();

    if (identity.identity_type === 'linkedin_organization') {
      const author = updated?.linkedin_author_urn || '';
      if (author && author.includes('urn:li:person:')) {
        return {
          ok: false,
          provider: 'linkedin',
          provider_post_id: result.postUrn,
          live_url: null,
          published_at: null,
          verified: false,
          verified_at: null,
          error:
            'Refusing success: LinkedIn organization was requested but author URN resolved to a person',
          error_code: 'IDENTITY_FALLBACK_BLOCKED',
        };
      }
    }

    const publishedAt = new Date().toISOString();
    const liveUrl = buildLinkedInPermalink(result.postUrn);
    await updatePost(postId, {
      live_url: liveUrl,
      published_at: publishedAt,
    });

    return {
      ok: true,
      provider: 'linkedin',
      provider_post_id: result.postUrn,
      live_url: liveUrl,
      published_at: publishedAt,
      verified: true,
      verified_at: publishedAt,
      author_urn: updated?.linkedin_author_urn || identity.author_urn || null,
      organization_id: identity.organization_id || null,
      organization_name: identity.identity_name,
    };
  }

  async publishToProvider(
    postId: string,
    identity: ResolvedIdentity
  ): Promise<ProviderPublishResult> {
    if (identity.platform === 'facebook') return this.publishToFacebook(postId, identity);
    return this.publishToLinkedIn(postId, identity);
  }

  async verifyProviderPost(params: {
    tenantId: string;
    postId: string;
  }): Promise<ProviderPublishResult> {
    const admin = createSupabaseAdminClient();
    const { data: post, error } = await admin
      .from('social_posts')
      .select(
        'id, tenant_id, platforms, facebook_page_id, facebook_post_id, linkedin_post_urn, linkedin_author_urn, linkedin_organization_id, live_url, published_at, status'
      )
      .eq('id', params.postId)
      .eq('tenant_id', params.tenantId)
      .maybeSingle();

    if (error || !post) {
      return {
        ok: false,
        provider: 'facebook',
        provider_post_id: null,
        live_url: null,
        published_at: null,
        verified: false,
        verified_at: null,
        error: 'post_not_found',
        error_code: 'NOT_FOUND',
      };
    }

    const platforms = Array.isArray(post.platforms) ? post.platforms : [];
    if (platforms.includes('facebook') || post.facebook_post_id) {
      if (!post.facebook_post_id) {
        return {
          ok: false,
          provider: 'facebook',
          provider_post_id: null,
          live_url: null,
          published_at: post.published_at,
          verified: false,
          verified_at: null,
          error: 'No facebook_post_id on record — post was never accepted by Facebook',
          error_code: 'MISSING_PROVIDER_ID',
        };
      }
      const integration = await getFacebookIntegrationWithToken(admin, {
        tenantId: post.tenant_id,
        pageId: post.facebook_page_id || undefined,
      });
      if (!integration?.pageAccessToken) {
        return {
          ok: false,
          provider: 'facebook',
          provider_post_id: post.facebook_post_id,
          live_url: post.live_url || buildFacebookPostUrl(post.facebook_post_id, post.facebook_page_id),
          published_at: post.published_at,
          verified: false,
          verified_at: null,
          error: 'Cannot verify: Facebook page token unavailable',
          error_code: 'TOKEN_MISSING',
        };
      }
      try {
        const verified = await verifyFacebookPostExists({
          postId: post.facebook_post_id,
          pageAccessToken: integration.pageAccessToken,
          pageId: post.facebook_page_id,
        });
        return {
          ok: true,
          provider: 'facebook',
          provider_post_id: verified.postId,
          live_url: verified.postUrl,
          published_at: post.published_at,
          verified: true,
          verified_at: new Date().toISOString(),
        };
      } catch (err) {
        return {
          ok: false,
          provider: 'facebook',
          provider_post_id: post.facebook_post_id,
          live_url: post.live_url,
          published_at: post.published_at,
          verified: false,
          verified_at: null,
          error: err instanceof Error ? err.message : 'Verification failed',
          error_code: 'VERIFICATION_FAILED',
        };
      }
    }

    if (platforms.includes('linkedin') || post.linkedin_post_urn) {
      if (!post.linkedin_post_urn) {
        return {
          ok: false,
          provider: 'linkedin',
          provider_post_id: null,
          live_url: null,
          published_at: post.published_at,
          verified: false,
          verified_at: null,
          error: 'No linkedin_post_urn on record — post was never accepted by LinkedIn',
          error_code: 'MISSING_PROVIDER_ID',
        };
      }
      return {
        ok: true,
        provider: 'linkedin',
        provider_post_id: post.linkedin_post_urn,
        live_url: post.live_url || buildLinkedInPermalink(post.linkedin_post_urn),
        published_at: post.published_at,
        verified: true,
        verified_at: new Date().toISOString(),
        author_urn: post.linkedin_author_urn,
        organization_id: post.linkedin_organization_id,
      };
    }

    return {
      ok: false,
      provider: 'facebook',
      provider_post_id: null,
      live_url: null,
      published_at: null,
      verified: false,
      verified_at: null,
      error: 'No provider post id found',
      error_code: 'MISSING_PROVIDER_ID',
    };
  }

  createActionReceipt(params: {
    provider: 'facebook' | 'linkedin';
    providerReference: string | null;
    verified: boolean;
    verifiedAt: string | null;
    correlationId: string;
    liveUrl?: string | null;
  }): SocialActionReceipt {
    return {
      action_id: newId(),
      provider: params.provider,
      provider_reference: params.providerReference,
      verified: params.verified,
      verified_at: params.verifiedAt,
      correlation_id: params.correlationId,
      live_url: params.liveUrl || null,
    };
  }

  async updatePostRecord(postId: string, payload: Record<string, unknown>) {
    return updatePost(postId, { ...payload, updated_at: new Date().toISOString() });
  }

  /**
   * Canonical publish entrypoint.
   * publish_now=true → provider call + verification before ok=true.
   * Otherwise creates draft/scheduled and returns queued/scheduled (not published).
   */
  async publish(input: PublishSocialPostInput): Promise<PublishSocialPostResult> {
    const correlationId = input.correlationId || newId();
    const started = Date.now();

    try {
      if (!input.caption?.trim()) {
        return {
          ok: false,
          data: null,
          receipt: null,
          error: { code: 'VALIDATION_ERROR', message: 'caption is required' },
        };
      }

      // Identity
      const identity = await this.resolveIdentity({
        tenantId: input.tenantId,
        platform: input.platform,
        identityType: input.identityType,
        identityId: input.identityId,
      });
      await this.validateCapabilities(identity);

      // Media
      const media = await resolveMediaUrls({
        tenantId: input.tenantId,
        userId: input.userId,
        mediaAssetIds: input.mediaAssetIds,
        mediaUrls: input.mediaUrls,
      });

      const caption = applyTestCaptionPrefix(input.caption.trim());
      const publishNow = Boolean(input.publishNow) && !input.scheduledAt;
      const scheduledAt = input.scheduledAt || null;

      if (publishNow && !isSocialPublishEnabled()) {
        return {
          ok: false,
          data: null,
          receipt: null,
          error: { code: 'PUBLISH_DISABLED', message: 'Social publishing is disabled' },
        };
      }

      // Create record
      const initialStatus: SocialPostStatus = publishNow
        ? 'publishing'
        : scheduledAt
          ? 'scheduled'
          : 'draft';

      const record = await this.createPostRecord({
        tenantId: input.tenantId,
        userId: input.userId,
        identity,
        caption,
        mediaUrls: media.urls,
        mediaTypes: media.types,
        mediaAssetIds: media.assetIds,
        linkUrl: input.linkUrl,
        status: initialStatus,
        scheduledAt,
        idempotencyKey: input.idempotencyKey,
        correlationId,
        aiClient: input.aiClient,
      });

      // Idempotent replay / in-flight guard
      if (record.reused) {
        if (record.status === 'publishing') {
          return {
            ok: false,
            data: null,
            receipt: null,
            error: {
              code: 'PUBLISH_IN_PROGRESS',
              message: 'A publish with this idempotency_key is already in progress',
              retryable: true,
            },
          };
        }
        if (record.status === 'published' && record.hasProviderId) {
          const admin = createSupabaseAdminClient();
          const { data: existing } = await admin
            .from('social_posts')
            .select(
              'id, status, facebook_post_id, linkedin_post_urn, linkedin_author_urn, linkedin_organization_id, live_url, published_at, metadata'
            )
            .eq('id', record.id)
            .maybeSingle();
          if (existing) {
            const providerId = existing.facebook_post_id || existing.linkedin_post_urn;
            const receipt = this.createActionReceipt({
              provider: identity.platform,
              providerReference: providerId,
              verified: true,
              verifiedAt: existing.published_at,
              correlationId,
              liveUrl: existing.live_url,
            });
            return {
              ok: true,
              data: {
                social_post_id: existing.id,
                platform: identity.platform,
                identity_type: identity.identity_type,
                identity_id: identity.identity_id,
                identity_name: identity.identity_name,
                status: 'published',
                provider_post_id: providerId,
                live_url: existing.live_url,
                published_at: existing.published_at,
                media_asset_ids: media.assetIds,
                linkedin_post_urn: existing.linkedin_post_urn,
                linkedin_author_urn: existing.linkedin_author_urn,
                linkedin_organization_id: existing.linkedin_organization_id,
                organization_name:
                  identity.identity_type === 'linkedin_organization' ? identity.identity_name : null,
              },
              receipt,
              error: null,
            };
          }
        }
      }

      // Stamp internal identity linkage when columns exist
      await this.updatePostRecord(record.id, {
        identity_type: identity.identity_type,
        provider: identity.platform,
        provider_identity_id: identity.identity_id,
        connection_id: null,
      }).catch(() => undefined);

      if (!publishNow) {
        const status: SocialPostStatus = scheduledAt ? 'scheduled' : 'draft';
        logPublishEvent({
          event: 'social_post_created',
          correlation_id: correlationId,
          tenant_id: input.tenantId,
          social_post_id: record.id,
          status,
          duration_ms: Date.now() - started,
        });
        return {
          ok: true,
          data: {
            social_post_id: record.id,
            platform: identity.platform,
            identity_type: identity.identity_type,
            identity_id: identity.identity_id,
            identity_name: identity.identity_name,
            status,
            provider_post_id: null,
            live_url: null,
            published_at: null,
            media_asset_ids: media.assetIds,
            linkedin_organization_id: identity.organization_id || null,
            organization_name:
              identity.identity_type === 'linkedin_organization' ? identity.identity_name : null,
          },
          receipt: this.createActionReceipt({
            provider: identity.platform,
            providerReference: null,
            verified: false,
            verifiedAt: null,
            correlationId,
          }),
          error: null,
        };
      }

      // Immediate publish
      const providerResult = await this.publishToProvider(record.id, identity);

      if (!providerResult.ok || !providerResult.provider_post_id || !providerResult.verified) {
        const failStatus: SocialPostStatus =
          providerResult.error_code === 'VERIFICATION_FAILED'
            ? 'verification_failed'
            : 'failed';
        await this.updatePostRecord(record.id, {
          status: failStatus,
          error_message: providerResult.error || 'Provider publish failed',
          last_error: providerResult.error || 'Provider publish failed',
        });
        logPublishEvent({
          event: 'social_publish_failed',
          correlation_id: correlationId,
          tenant_id: input.tenantId,
          social_post_id: record.id,
          status: failStatus,
          error: providerResult.error,
          duration_ms: Date.now() - started,
        });
        return {
          ok: false,
          data: {
            social_post_id: record.id,
            platform: identity.platform,
            identity_type: identity.identity_type,
            identity_id: identity.identity_id,
            identity_name: identity.identity_name,
            status: failStatus,
            provider_post_id: providerResult.provider_post_id,
            live_url: providerResult.live_url,
            published_at: null,
            media_asset_ids: media.assetIds,
            linkedin_post_urn:
              identity.platform === 'linkedin' ? providerResult.provider_post_id : null,
            linkedin_author_urn: providerResult.author_urn || null,
            linkedin_organization_id: identity.organization_id || null,
            organization_name:
              identity.identity_type === 'linkedin_organization' ? identity.identity_name : null,
          },
          receipt: null,
          error: {
            code: providerResult.error_code || 'PROVIDER_ERROR',
            message: providerResult.error || 'Provider publish failed',
            retryable: providerResult.error_code !== 'IDENTITY_FALLBACK_BLOCKED',
          },
        };
      }

      // LinkedIn org must return required fields for ok=true
      if (identity.identity_type === 'linkedin_organization') {
        if (
          !providerResult.provider_post_id ||
          !providerResult.author_urn ||
          !providerResult.organization_id ||
          !providerResult.live_url ||
          !providerResult.published_at
        ) {
          await this.updatePostRecord(record.id, {
            status: 'verification_failed',
            error_message: 'LinkedIn organization publish missing required evidence fields',
          });
          return {
            ok: false,
            data: null,
            receipt: null,
            error: {
              code: 'INCOMPLETE_EVIDENCE',
              message:
                'LinkedIn organization publish did not return post URN, author URN, organization ID, live URL, and published_at',
            },
          };
        }
      }

      await this.updatePostRecord(record.id, {
        status: 'published',
        published_at: providerResult.published_at,
        error_message: null,
      });

      const receipt = this.createActionReceipt({
        provider: identity.platform,
        providerReference: providerResult.provider_post_id,
        verified: true,
        verifiedAt: providerResult.verified_at,
        correlationId,
        liveUrl: providerResult.live_url,
      });

      logPublishEvent({
        event: 'social_publish_success',
        correlation_id: correlationId,
        tenant_id: input.tenantId,
        user_id: input.userId,
        ai_client: input.aiClient,
        social_post_id: record.id,
        identity: identity.identity_id,
        provider_post_id: providerResult.provider_post_id,
        live_url: providerResult.live_url,
        duration_ms: Date.now() - started,
        final_status: 'published',
      });

      return {
        ok: true,
        data: {
          social_post_id: record.id,
          platform: identity.platform,
          identity_type: identity.identity_type,
          identity_id: identity.identity_id,
          identity_name: identity.identity_name,
          status: 'published',
          provider_post_id: providerResult.provider_post_id,
          live_url: providerResult.live_url,
          published_at: providerResult.published_at,
          media_asset_ids: media.assetIds,
          linkedin_post_urn:
            identity.platform === 'linkedin' ? providerResult.provider_post_id : null,
          linkedin_author_urn: providerResult.author_urn || identity.author_urn || null,
          linkedin_organization_id: identity.organization_id || null,
          organization_name:
            identity.identity_type === 'linkedin_organization' ? identity.identity_name : null,
        },
        receipt,
        error: null,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Publish failed';
      logPublishEvent({
        event: 'social_publish_exception',
        correlation_id: correlationId,
        tenant_id: input.tenantId,
        error: message,
        duration_ms: Date.now() - started,
      });
      return {
        ok: false,
        data: null,
        receipt: null,
        error: { code: 'PUBLISH_FAILED', message, retryable: true },
      };
    }
  }

  async retryFailedPost(params: {
    tenantId: string;
    postId: string;
    userId: string;
  }): Promise<PublishSocialPostResult> {
    const admin = createSupabaseAdminClient();
    const { data: post, error } = await admin
      .from('social_posts')
      .select('*')
      .eq('id', params.postId)
      .eq('tenant_id', params.tenantId)
      .maybeSingle();

    if (error || !post) {
      return {
        ok: false,
        data: null,
        receipt: null,
        error: { code: 'NOT_FOUND', message: 'Social post not found' },
      };
    }

    // Do not duplicate an already published provider post
    if (post.status === 'published' && (post.facebook_post_id || post.linkedin_post_urn)) {
      return {
        ok: true,
        data: {
          social_post_id: post.id,
          platform: (Array.isArray(post.platforms) ? post.platforms[0] : post.platform) || 'facebook',
          identity_type: post.metadata?.identity_type || 'facebook_page',
          identity_id:
            post.facebook_page_id ||
            post.linkedin_organization_id ||
            post.linkedin_member_id ||
            '',
          identity_name: post.metadata?.identity_name || '',
          status: 'published',
          provider_post_id: post.facebook_post_id || post.linkedin_post_urn,
          live_url: post.live_url || null,
          published_at: post.published_at,
          media_asset_ids: post.metadata?.media_asset_ids || [],
          linkedin_post_urn: post.linkedin_post_urn,
          linkedin_author_urn: post.linkedin_author_urn,
          linkedin_organization_id: post.linkedin_organization_id,
        },
        receipt: this.createActionReceipt({
          provider: post.facebook_post_id ? 'facebook' : 'linkedin',
          providerReference: post.facebook_post_id || post.linkedin_post_urn,
          verified: true,
          verifiedAt: post.published_at,
          correlationId: post.correlation_id || newId(),
          liveUrl: post.live_url,
        }),
        error: null,
      };
    }

    const platform = (Array.isArray(post.platforms) ? post.platforms[0] : post.platform) as
      | 'facebook'
      | 'linkedin';
    const identityType =
      (post.metadata?.identity_type as PublishSocialPostInput['identityType']) ||
      (platform === 'facebook'
        ? 'facebook_page'
        : post.linkedin_organization_id
          ? 'linkedin_organization'
          : 'linkedin_person');
    const identityId =
      post.facebook_page_id ||
      post.linkedin_organization_id ||
      post.linkedin_member_id ||
      post.metadata?.identity_id;

    if (!identityId) {
      return {
        ok: false,
        data: null,
        receipt: null,
        error: {
          code: 'MISSING_IDENTITY',
          message: 'Cannot retry: post has no destination identity',
        },
      };
    }

    const correlationId = post.correlation_id || newId();
    await this.updatePostRecord(post.id, {
      status: 'retrying',
      attempt_count: (post.attempt_count || 0) + 1,
    });

    try {
      const identity = await this.resolveIdentity({
        tenantId: params.tenantId,
        platform,
        identityType,
        identityId: String(identityId),
      });
      await this.validateCapabilities(identity);
      await this.updatePostRecord(post.id, { status: 'publishing' });
      const providerResult = await this.publishToProvider(post.id, identity);

      if (!providerResult.ok || !providerResult.provider_post_id || !providerResult.verified) {
        const failStatus: SocialPostStatus =
          providerResult.error_code === 'VERIFICATION_FAILED'
            ? 'verification_failed'
            : 'failed';
        await this.updatePostRecord(post.id, {
          status: failStatus,
          error_message: providerResult.error || 'Retry publish failed',
        });
        return {
          ok: false,
          data: {
            social_post_id: post.id,
            platform,
            identity_type: identity.identity_type,
            identity_id: identity.identity_id,
            identity_name: identity.identity_name,
            status: failStatus,
            provider_post_id: providerResult.provider_post_id,
            live_url: providerResult.live_url,
            published_at: null,
            media_asset_ids: post.metadata?.media_asset_ids || [],
          },
          receipt: null,
          error: {
            code: providerResult.error_code || 'PROVIDER_ERROR',
            message: providerResult.error || 'Retry publish failed',
            retryable: true,
          },
        };
      }

      await this.updatePostRecord(post.id, {
        status: 'published',
        published_at: providerResult.published_at,
        live_url: providerResult.live_url,
        error_message: null,
      });

      return {
        ok: true,
        data: {
          social_post_id: post.id,
          platform,
          identity_type: identity.identity_type,
          identity_id: identity.identity_id,
          identity_name: identity.identity_name,
          status: 'published',
          provider_post_id: providerResult.provider_post_id,
          live_url: providerResult.live_url,
          published_at: providerResult.published_at,
          media_asset_ids: post.metadata?.media_asset_ids || [],
          linkedin_post_urn:
            platform === 'linkedin' ? providerResult.provider_post_id : null,
          linkedin_author_urn: providerResult.author_urn || identity.author_urn || null,
          linkedin_organization_id: identity.organization_id || null,
          organization_name:
            identity.identity_type === 'linkedin_organization' ? identity.identity_name : null,
        },
        receipt: this.createActionReceipt({
          provider: platform,
          providerReference: providerResult.provider_post_id,
          verified: true,
          verifiedAt: providerResult.verified_at,
          correlationId,
          liveUrl: providerResult.live_url,
        }),
        error: null,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Retry failed';
      await this.updatePostRecord(post.id, { status: 'failed', error_message: message });
      return {
        ok: false,
        data: null,
        receipt: null,
        error: { code: 'RETRY_FAILED', message, retryable: true },
      };
    }
  }

  /**
   * Process due scheduled posts with claim locking.
   */
  async processDueScheduledPosts(limit = 25): Promise<{
    processed: number;
    published: number;
    failed: number;
    overdue: number;
    reclaimed: number;
    skipped_claim: number;
  }> {
    if (!isSocialPublishEnabled()) {
      return { processed: 0, published: 0, failed: 0, overdue: 0, reclaimed: 0, skipped_claim: 0 };
    }

    const admin = createSupabaseAdminClient();
    const nowIso = new Date().toISOString();
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const stuckCutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    // Reclaim posts stuck in publishing (worker crash / timeout) so they can run again.
    const { data: stuckPublishing } = await admin
      .from('social_posts')
      .select('id, tenant_id')
      .eq('status', 'publishing')
      .lt('updated_at', stuckCutoff)
      .limit(50);

    let reclaimed = 0;
    for (const row of stuckPublishing || []) {
      const { data: reclaimedRow } = await admin
        .from('social_posts')
        .update({
          status: 'scheduled',
          error_message: 'Reclaimed from stuck publishing — will retry on next cron tick',
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id)
        .eq('tenant_id', row.tenant_id)
        .eq('status', 'publishing')
        .select('id')
        .maybeSingle();
      if (reclaimedRow?.id) reclaimed += 1;
    }

    const { count: overdueCount } = await admin
      .from('social_posts')
      .select('id', { count: 'exact', head: true })
      .in('status', ['scheduled', 'queued'])
      .not('scheduled_at', 'is', null)
      .lte('scheduled_at', fiveMinAgo);

    if ((overdueCount || 0) > 0) {
      console.warn(
        `[SocialPublishingService] ALERT: ${overdueCount} scheduled posts overdue by >5 minutes (reclaimed=${reclaimed})`
      );
    }

    const { data: duePosts, error } = await admin
      .from('social_posts')
      .select(
        'id, tenant_id, user_id, platforms, platform, caption, media_urls, facebook_page_id, linkedin_organization_id, linkedin_member_id, metadata, idempotency_key, correlation_id, attempt_count'
      )
      .in('status', ['scheduled', 'queued'])
      .not('scheduled_at', 'is', null)
      .lte('scheduled_at', nowIso)
      .order('scheduled_at', { ascending: true })
      .limit(limit);

    if (error) throw error;

    let published = 0;
    let failed = 0;
    let skippedClaim = 0;

    for (const post of duePosts || []) {
      // Atomic claim: only one worker may move scheduled/queued → publishing
      const adminClaim = createSupabaseAdminClient();
      const claimedAt = new Date().toISOString();
      const { data: claimed, error: claimError } = await adminClaim
        .from('social_posts')
        .update({
          status: 'publishing',
          error_message: null,
          updated_at: claimedAt,
        })
        .eq('id', post.id)
        .in('status', ['scheduled', 'queued'])
        .select('id')
        .maybeSingle();
      if (claimError) {
        console.warn(
          `[SocialPublishingService] claim failed post=${post.id}:`,
          claimError.message
        );
        skippedClaim += 1;
        continue;
      }
      if (!claimed?.id) {
        skippedClaim += 1;
        continue;
      }

      const platform = (Array.isArray(post.platforms) ? post.platforms[0] : post.platform) as
        | 'facebook'
        | 'linkedin';
      const identityType =
        (post.metadata?.identity_type as PublishSocialPostInput['identityType']) ||
        (platform === 'facebook'
          ? 'facebook_page'
          : post.linkedin_organization_id
            ? 'linkedin_organization'
            : 'linkedin_person');
      const identityId =
        post.facebook_page_id ||
        post.linkedin_organization_id ||
        post.linkedin_member_id ||
        post.metadata?.identity_id;

      if (!identityId) {
        await updatePost(post.id, {
          status: 'failed',
          error_message: 'Scheduled post missing destination identity',
          last_error: 'MISSING_IDENTITY',
        });
        failed += 1;
        continue;
      }

      try {
        const identity = await this.resolveIdentity({
          tenantId: post.tenant_id,
          platform,
          identityType,
          identityId: String(identityId),
        });
        const result = await this.publishToProvider(post.id, identity);
        if (result.ok && result.verified && result.provider_post_id) {
          await updatePost(post.id, {
            status: 'published',
            published_at: result.published_at,
            live_url: result.live_url,
            error_message: null,
          });
          published += 1;
        } else {
          const attempts = (post.attempt_count || 0) + 1;
          const permanent =
            result.error_code === 'MISSING_IDENTITY' ||
            result.error_code === 'IDENTITY_FALLBACK_BLOCKED' ||
            result.error_code === 'TOKEN_MISSING';
          await updatePost(post.id, {
            status: permanent || attempts >= 5 ? 'failed' : 'scheduled',
            attempt_count: attempts,
            last_error: result.error,
            error_message: result.error,
            // Exponential backoff: push scheduled_at forward
            ...(permanent || attempts >= 5
              ? {}
              : {
                  scheduled_at: new Date(
                    Date.now() + Math.min(60, 2 ** attempts) * 60_000
                  ).toISOString(),
                }),
          });
          failed += 1;
        }
      } catch (err) {
        await updatePost(post.id, {
          status: 'failed',
          error_message: err instanceof Error ? err.message : 'Scheduled publish failed',
        });
        failed += 1;
      }
    }

    return {
      processed: (duePosts || []).length,
      published,
      failed,
      overdue: overdueCount || 0,
      reclaimed,
      skipped_claim: skippedClaim,
    };
  }

  /**
   * Mark a fake-success post based on provider evidence (no auto-republish).
   */
  async repairOrphanedPost(postId: string): Promise<{
    social_post_id: string;
    previous_status: string | null;
    new_status: SocialPostStatus;
    reason: string;
  }> {
    const admin = createSupabaseAdminClient();
    const { data: post } = await admin
      .from('social_posts')
      .select(
        'id, tenant_id, status, facebook_post_id, linkedin_post_urn, facebook_page_id, media_urls, published_at, error_message'
      )
      .eq('id', postId)
      .maybeSingle();

    if (!post) {
      return {
        social_post_id: postId,
        previous_status: null,
        new_status: 'failed',
        reason: 'Post not found',
      };
    }

    if (post.facebook_post_id || post.linkedin_post_urn) {
      // Has provider evidence — verify if possible
      const verified = await this.verifyProviderPost({
        tenantId: post.tenant_id,
        postId: post.id,
      });
      if (verified.ok && verified.verified) {
        await updatePost(post.id, {
          status: 'published',
          live_url: verified.live_url,
          published_at: post.published_at || new Date().toISOString(),
        });
        return {
          social_post_id: post.id,
          previous_status: post.status,
          new_status: 'published',
          reason: 'Provider post verified',
        };
      }
      await updatePost(post.id, {
        status: 'verification_failed',
        error_message: verified.error || 'Provider verification failed',
      });
      return {
        social_post_id: post.id,
        previous_status: post.status,
        new_status: 'verification_failed',
        reason: verified.error || 'Verification failed',
      };
    }

    // No provider ID — never actually published
    const mediaHadDataUri = Array.isArray(post.media_urls)
      ? post.media_urls.some((u: string) => String(u || '').startsWith('data:'))
      : false;
    await updatePost(post.id, {
      status: 'orphaned',
      error_message:
        'Marked orphaned: ok=true was returned after DB insert without calling Facebook/LinkedIn. No provider_post_id exists. Not auto-republished to avoid duplicates.',
      metadata: {
        repair: {
          repaired_at: new Date().toISOString(),
          reason: 'fake_success_no_provider_id',
          media_had_data_uri: mediaHadDataUri,
          facebook_page_id: post.facebook_page_id,
        },
      },
    });

    return {
      social_post_id: post.id,
      previous_status: post.status,
      new_status: 'orphaned',
      reason:
        'No Facebook/LinkedIn API call evidence and no provider post ID — marked orphaned without republishing',
    };
  }
}

let singleton: SocialPublishingService | null = null;

export function getSocialPublishingService(): SocialPublishingService {
  if (!singleton) singleton = new SocialPublishingService();
  return singleton;
}
