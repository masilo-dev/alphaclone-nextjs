import type { SupabaseClient } from '@supabase/supabase-js';
import { getFacebookIntegrationWithToken } from '@/services/facebook/facebookIntegrationService';
import {
  extractLinkedInOrganizationIdFromAuthorUrn,
  getLinkedInIntegrationWithToken,
} from '@/services/linkedin/linkedinIntegrationService';

export type SocialPostMetricSnapshot = {
  impressions: number;
  reactions: number;
  comments: number;
  clicks: number;
  shares: number;
};

export type SocialPostSyncResult = {
  postId: string;
  platform: 'facebook' | 'linkedin' | 'skipped';
  ok: boolean;
  metrics?: SocialPostMetricSnapshot;
  error?: string;
};

type PublishedSocialPost = {
  id: string;
  tenant_id: string;
  user_id?: string | null;
  platforms: string[] | null;
  facebook_post_id: string | null;
  facebook_page_id: string | null;
  linkedin_post_urn: string | null;
  linkedin_organization_id: string | null;
  linkedin_author_urn: string | null;
  metadata: Record<string, unknown> | null;
  published_at: string | null;
};

function insightValue(rows: { name?: string; values?: { value?: number }[] }[] | undefined, name: string): number {
  const row = rows?.find((item) => item.name === name);
  const raw = row?.values?.[0]?.value;
  return Number(raw) || 0;
}

export function resolveLinkedInOrganizationId(post: PublishedSocialPost): string | null {
  const metadata =
    post.metadata && typeof post.metadata === 'object' ? post.metadata : null;
  return (
    (typeof post.linkedin_organization_id === 'string' && post.linkedin_organization_id.trim()
      ? post.linkedin_organization_id.trim()
      : null) ||
    (typeof metadata?.linkedin_organization_id === 'string' &&
    String(metadata.linkedin_organization_id).trim()
      ? String(metadata.linkedin_organization_id).trim()
      : null) ||
    extractLinkedInOrganizationIdFromAuthorUrn(String(post.linkedin_author_urn || '')) ||
    extractLinkedInOrganizationIdFromAuthorUrn(String(metadata?.linkedin_author_urn || ''))
  );
}

export async function fetchFacebookPostMetrics(
  pageAccessToken: string,
  facebookPostId: string
): Promise<SocialPostMetricSnapshot> {
  const metrics = [
    'post_impressions',
    'post_engaged_users',
    'post_clicks',
    'post_reactions_by_type_total',
  ].join(',');

  const [insightsRes, summaryRes] = await Promise.all([
    fetch(
      `https://graph.facebook.com/v21.0/${encodeURIComponent(facebookPostId)}/insights?metric=${metrics}&access_token=${encodeURIComponent(pageAccessToken)}`
    ),
    fetch(
      `https://graph.facebook.com/v21.0/${encodeURIComponent(facebookPostId)}?fields=comments.limit(0).summary(true),reactions.limit(0).summary(true),shares&access_token=${encodeURIComponent(pageAccessToken)}`
    ),
  ]);

  const insightsBody = (await insightsRes.json().catch(() => ({}))) as {
    data?: { name?: string; values?: { value?: number }[] }[];
    error?: { message?: string };
  };
  const summaryBody = (await summaryRes.json().catch(() => ({}))) as {
    comments?: { summary?: { total_count?: number } };
    reactions?: { summary?: { total_count?: number } };
    shares?: { count?: number };
    error?: { message?: string };
  };

  if (!insightsRes.ok && !summaryRes.ok) {
    throw new Error(
      insightsBody.error?.message || summaryBody.error?.message || 'Facebook insights unavailable'
    );
  }

  const impressions = insightValue(insightsBody.data, 'post_impressions');
  const engagedUsers = insightValue(insightsBody.data, 'post_engaged_users');
  const clicks = insightValue(insightsBody.data, 'post_clicks');
  const reactionsFromInsights = insightValue(insightsBody.data, 'post_reactions_by_type_total');
  const reactionsFromSummary = Number(summaryBody.reactions?.summary?.total_count || 0);
  const comments = Number(summaryBody.comments?.summary?.total_count || 0);
  const shares = Number(summaryBody.shares?.count || 0);

  return {
    impressions,
    reactions: reactionsFromSummary || reactionsFromInsights || engagedUsers,
    comments,
    clicks,
    shares,
  };
}

export async function fetchLinkedInPostMetrics(
  accessToken: string,
  postUrn: string,
  linkedinOrganizationId: string | null
): Promise<SocialPostMetricSnapshot & { linkedinStats: Record<string, unknown> }> {
  const socialRes = await fetch(
    `https://api.linkedin.com/v2/socialActions/${encodeURIComponent(postUrn)}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
    }
  );
  const socialPayload = (await socialRes.json().catch(() => ({}))) as Record<string, unknown>;
  if (!socialRes.ok) {
    throw new Error(
      String((socialPayload as { message?: string }).message || 'LinkedIn social action unavailable')
    );
  }

  const likesSummary = socialPayload.likesSummary as Record<string, unknown> | undefined;
  const commentsSummary = socialPayload.commentsSummary as Record<string, unknown> | undefined;
  const reactions =
    Number(likesSummary?.totalLikes) ||
    Number(likesSummary?.count) ||
    Number(socialPayload.totalLikes) ||
    0;
  const comments =
    Number(commentsSummary?.totalComments) ||
    Number(commentsSummary?.count) ||
    Number(socialPayload.totalComments) ||
    0;

  let impressions = 0;
  let clicks = 0;
  let shares = 0;
  let organizationStatsAvailable = false;

  if (linkedinOrganizationId) {
    const orgUrn = `urn:li:organization:${linkedinOrganizationId}`;
    const statsUrl = new URL('https://api.linkedin.com/v2/organizationalEntityShareStatistics');
    statsUrl.searchParams.set('q', 'organizationalEntity');
    statsUrl.searchParams.set('organizationalEntity', orgUrn);
    statsUrl.searchParams.set('shares[0]', postUrn);
    const statsRes = await fetch(statsUrl.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0',
      },
    });
    if (statsRes.ok) {
      const statsPayload = (await statsRes.json().catch(() => ({}))) as Record<string, unknown>;
      const first = Array.isArray(statsPayload.elements) ? statsPayload.elements[0] : null;
      const aggregate = ((first as { totalShareStatistics?: Record<string, unknown> } | null)
        ?.totalShareStatistics ||
        (first as { shareStatistics?: Record<string, unknown> } | null)?.shareStatistics ||
        {}) as Record<string, unknown>;
      impressions = Number(aggregate.impressionCount || aggregate.impressions || 0) || 0;
      clicks = Number(aggregate.clickCount || aggregate.clicks || 0) || 0;
      shares = Number(aggregate.shareCount || aggregate.shares || 0) || 0;
      organizationStatsAvailable = true;
    }
  }

  const nowIso = new Date().toISOString();
  const linkedinStats = {
    likes: reactions,
    reactions,
    comments,
    impressions,
    clicks,
    shares,
    organization_stats_available: organizationStatsAvailable,
    synced_at: nowIso,
  };

  return {
    impressions,
    reactions,
    comments,
    clicks,
    shares,
    linkedinStats,
  };
}

async function upsertSocialPostAnalytics(
  admin: SupabaseClient,
  params: {
    postId: string;
    tenantId: string;
    platform: 'facebook' | 'linkedin';
    metrics: SocialPostMetricSnapshot;
  }
): Promise<void> {
  const syncedAt = new Date().toISOString();
  const payload = {
    post_id: params.postId,
    tenant_id: params.tenantId,
    platform: params.platform,
    impressions: params.metrics.impressions,
    clicks: params.metrics.clicks,
    reactions: params.metrics.reactions,
    comments: params.metrics.comments,
    shares: params.metrics.shares,
    synced_at: syncedAt,
    updated_at: syncedAt,
  };

  const { data: existing } = await admin
    .from('social_post_analytics')
    .select('id')
    .eq('post_id', params.postId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await admin.from('social_post_analytics').update(payload).eq('id', existing.id);
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await admin.from('social_post_analytics').insert(payload);
  if (error) throw new Error(error.message);
}

export async function syncSocialPostAnalyticsForPost(
  admin: SupabaseClient,
  post: PublishedSocialPost,
  options?: { userId?: string | null }
): Promise<SocialPostSyncResult> {
  const platforms = Array.isArray(post.platforms) ? post.platforms : [];

  if (post.facebook_post_id) {
    try {
      const integration = await getFacebookIntegrationWithToken(admin, {
        tenantId: post.tenant_id,
        pageId: post.facebook_page_id || undefined,
        userId: options?.userId || post.user_id || undefined,
      });
      if (!integration?.pageAccessToken) {
        return {
          postId: post.id,
          platform: 'facebook',
          ok: false,
          error: 'Facebook page token unavailable',
        };
      }
      const metrics = await fetchFacebookPostMetrics(
        integration.pageAccessToken,
        post.facebook_post_id
      );
      await upsertSocialPostAnalytics(admin, {
        postId: post.id,
        tenantId: post.tenant_id,
        platform: 'facebook',
        metrics,
      });
      await admin
        .from('social_posts')
        .update({
          analytics: metrics,
          last_engagement_sync_at: new Date().toISOString(),
        })
        .eq('id', post.id)
        .eq('tenant_id', post.tenant_id);
      return { postId: post.id, platform: 'facebook', ok: true, metrics };
    } catch (error: unknown) {
      return {
        postId: post.id,
        platform: 'facebook',
        ok: false,
        error: error instanceof Error ? error.message : 'Facebook sync failed',
      };
    }
  }

  if (post.linkedin_post_urn && platforms.includes('linkedin')) {
    try {
      const { data: integrationRow } = await admin
        .from('linkedin_integrations')
        .select('user_id')
        .eq('tenant_id', post.tenant_id)
        .eq('is_active', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const userId = options?.userId || integrationRow?.user_id || post.user_id || null;
      if (!userId) {
        return {
          postId: post.id,
          platform: 'linkedin',
          ok: false,
          error: 'LinkedIn integration user unavailable',
        };
      }

      const integration = await getLinkedInIntegrationWithToken(admin, {
        tenantId: post.tenant_id,
        userId,
      });
      if (!integration?.accessToken) {
        return {
          postId: post.id,
          platform: 'linkedin',
          ok: false,
          error: 'LinkedIn token unavailable',
        };
      }

      const orgId = resolveLinkedInOrganizationId(post);
      const { linkedinStats, ...metrics } = await fetchLinkedInPostMetrics(
        integration.accessToken,
        post.linkedin_post_urn,
        orgId
      );
      const nowIso = new Date().toISOString();

      await upsertSocialPostAnalytics(admin, {
        postId: post.id,
        tenantId: post.tenant_id,
        platform: 'linkedin',
        metrics,
      });
      await admin
        .from('social_posts')
        .update({
          analytics: linkedinStats,
          linkedin_stats: linkedinStats,
          linkedin_stats_synced_at: nowIso,
          last_engagement_sync_at: nowIso,
        })
        .eq('id', post.id)
        .eq('tenant_id', post.tenant_id);

      return { postId: post.id, platform: 'linkedin', ok: true, metrics };
    } catch (error: unknown) {
      return {
        postId: post.id,
        platform: 'linkedin',
        ok: false,
        error: error instanceof Error ? error.message : 'LinkedIn sync failed',
      };
    }
  }

  return { postId: post.id, platform: 'skipped', ok: false, error: 'No provider post id' };
}

export async function syncSocialPostAnalyticsForTenant(
  admin: SupabaseClient,
  tenantId: string,
  options?: { limit?: number; userId?: string | null; days?: number }
): Promise<{ synced: number; failed: number; results: SocialPostSyncResult[] }> {
  const limit = Math.min(Math.max(options?.limit ?? 40, 1), 100);
  const days = Math.min(Math.max(options?.days ?? 90, 1), 180);
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  const { data: posts, error } = await admin
    .from('social_posts')
    .select(
      'id, tenant_id, user_id, platforms, facebook_post_id, facebook_page_id, linkedin_post_urn, linkedin_organization_id, linkedin_author_urn, metadata, published_at'
    )
    .eq('tenant_id', tenantId)
    .eq('status', 'published')
    .gte('published_at', since)
    .order('published_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  const results: SocialPostSyncResult[] = [];
  for (const post of (posts || []) as PublishedSocialPost[]) {
    results.push(await syncSocialPostAnalyticsForPost(admin, post, { userId: options?.userId }));
  }

  return {
    synced: results.filter((item) => item.ok).length,
    failed: results.filter((item) => !item.ok && item.platform !== 'skipped').length,
    results,
  };
}

export async function syncSocialPostAnalyticsCron(
  admin: SupabaseClient,
  options?: { tenantLimit?: number; postsPerTenant?: number }
): Promise<{ tenants: number; synced: number; failed: number }> {
  const tenantLimit = Math.min(Math.max(options?.tenantLimit ?? 25, 1), 100);
  const postsPerTenant = Math.min(Math.max(options?.postsPerTenant ?? 20, 1), 50);
  const since = new Date(Date.now() - 90 * 86_400_000).toISOString();

  const { data: tenantRows, error } = await admin
    .from('social_posts')
    .select('tenant_id')
    .eq('status', 'published')
    .gte('published_at', since)
    .not('tenant_id', 'is', null)
    .order('published_at', { ascending: false })
    .limit(500);

  if (error) throw new Error(error.message);

  const tenantIds = [...new Set((tenantRows || []).map((row) => String(row.tenant_id)).filter(Boolean))].slice(
    0,
    tenantLimit
  );

  let synced = 0;
  let failed = 0;
  for (const tenantId of tenantIds) {
    const batch = await syncSocialPostAnalyticsForTenant(admin, tenantId, {
      limit: postsPerTenant,
      days: 90,
    });
    synced += batch.synced;
    failed += batch.failed;
  }

  return { tenants: tenantIds.length, synced, failed };
}
