import { sleep } from 'workflow';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

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

  // 2. Wait 24 hours to collect metrics
  await sleep('24h');
  await collectMetrics(postId, tenantId);

  // 3. Update CRM with Leads from Post
  await captureLeads(postId);
}

async function publishPost(postId: string, tenantId: string) {
  "use step";
  const supabase = createSupabaseAdminClient();
  await supabase.rpc('set_tenant_context', { tenant_id: tenantId });
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
}
