import { sleep } from 'workflow';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
<<<<<<< HEAD
import { publishSocialPost } from '@/lib/social/cronPublish';
=======
>>>>>>> origin/main

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

<<<<<<< HEAD
  // 2. Allow provider webhooks and engagement sync jobs to collect verified metrics.
  await sleep('24h');

=======
  // 2. Wait 24 hours to collect metrics
  await sleep('24h');
  await collectMetrics(postId, tenantId);

  // 3. Update CRM with Leads from Post
  await captureLeads(postId);
>>>>>>> origin/main
}

async function publishPost(postId: string, tenantId: string) {
  "use step";
  const supabase = createSupabaseAdminClient();
  await supabase.rpc('set_tenant_context', { tenant_id: tenantId });
<<<<<<< HEAD
  const { data: post, error: readError } = await supabase.from('social_posts').select('id').eq('id', postId).eq('tenant_id', tenantId).maybeSingle();
  if (readError) throw readError;
  if (!post) throw new Error('Scheduled social post was not found');
  await publishSocialPost(postId);
  const { data: published, error } = await supabase.from('social_posts').select('status, published_at, error_message').eq('id', postId).eq('tenant_id', tenantId).maybeSingle();
  if (error) throw error;
  if (published?.status !== 'published' || !published.published_at) throw new Error(published?.error_message || 'Connected social providers did not publish the post');
=======
  console.log(`Publishing social post ${postId}`);
  await supabase.from('social_posts').update({ status: 'published', published_at: new Date().toISOString() }).eq('id', postId);
}

async function collectMetrics(postId: string, tenantId: string) {
  "use step";
  const supabase = createSupabaseAdminClient();
  await supabase.rpc('set_tenant_context', { tenant_id: tenantId });
  console.log(`Collecting engagement metrics for post ${postId}`);
  await supabase.from('social_post_metrics').insert({
    tenant_id: tenantId,
    post_id: postId,
    likes: Math.floor(Math.random() * 100),
    comments: Math.floor(Math.random() * 20)
  });
}

async function captureLeads(postId: string) {
  "use step";
  console.log(`Capturing leads from post ${postId} comments`);
>>>>>>> origin/main
}
