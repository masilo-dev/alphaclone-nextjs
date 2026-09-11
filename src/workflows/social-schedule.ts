import { sleep } from 'workflow';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { publishSocialPost } from '@/lib/social/cronPublish';

/**
 * Social Schedule Workflow
 * Handles publication and post-publish engagement tracking.
 */
export async function socialScheduleWorkflow({ postId, tenantId }: { postId: string; tenantId: string }) {
  "use workflow";
  
  const supabase = createSupabaseAdminClient();
  await supabase.rpc('set_tenant_context', { tenant_id: tenantId });

  // 1. Publish Post
  await publishPost(postId, tenantId);

  // 2. Allow provider webhooks and engagement sync jobs to collect verified metrics.
  await sleep('24h');

}

async function publishPost(postId: string, tenantId: string) {
  "use step";
  const supabase = createSupabaseAdminClient();
  await supabase.rpc('set_tenant_context', { tenant_id: tenantId });
  const { data: post, error: readError } = await supabase.from('social_posts').select('id').eq('id', postId).eq('tenant_id', tenantId).maybeSingle();
  if (readError) throw readError;
  if (!post) throw new Error('Scheduled social post was not found');
  await publishSocialPost(postId);
  const { data: published, error } = await supabase.from('social_posts').select('status, published_at, error_message').eq('id', postId).eq('tenant_id', tenantId).maybeSingle();
  if (error) throw error;
  if (published?.status !== 'published' || !published.published_at) throw new Error(published?.error_message || 'Connected social providers did not publish the post');
}
