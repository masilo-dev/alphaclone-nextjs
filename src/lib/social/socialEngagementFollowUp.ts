/**
 * Bonnie timer hook after scheduled social publish (engagement sync window).
 */

import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { createTimer } from '@/lib/bonnie/runtime/timerService';
import { syncSocialPostAnalyticsForPost } from '@/lib/social/syncSocialPostAnalytics';

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export async function scheduleSocialEngagementCheck(params: {
  tenantId: string;
  postId: string;
  runId?: string;
}): Promise<void> {
  await createTimer({
    tenantId: params.tenantId,
    runId: params.runId || null,
    executeAt: new Date(Date.now() + TWENTY_FOUR_HOURS_MS).toISOString(),
    timerType: 'social.engagement_check',
    payload: {
      post_id: params.postId,
      tenant_id: params.tenantId,
    },
  });
}

export async function handleSocialEngagementTimer(timer: {
  tenant_id: string;
  payload?: Record<string, unknown> | null;
}): Promise<void> {
  const payload = (timer.payload || {}) as Record<string, unknown>;
  const postId = String(payload.post_id || '');
  const tenantId = String(payload.tenant_id || timer.tenant_id);
  if (!postId || !tenantId) return;

  const admin = createSupabaseAdminClient();
  const { data: post } = await admin
    .from('social_posts')
    .select('id, tenant_id, user_id, status, platforms, facebook_post_id, facebook_page_id, linkedin_post_urn')
    .eq('id', postId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (!post || post.status !== 'published') return;

  await syncSocialPostAnalyticsForPost(
    admin,
    post as unknown as Parameters<typeof syncSocialPostAnalyticsForPost>[1]
  ).catch(
    () => undefined
  );
}
