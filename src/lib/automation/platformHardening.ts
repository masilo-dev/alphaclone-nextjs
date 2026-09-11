import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { sendEmailServer } from '@/lib/email/sendEmailServer';
import { normalizeCaptionForDedupe } from '@/lib/social/linkedinPublishHelpers';

const STUCK_PUBLISHING_MS = 15 * 60 * 1000;

export async function resolveStuckSocialPosts(tenantId?: string) {
  const admin = createSupabaseAdminClient();
  const cutoff = new Date(Date.now() - STUCK_PUBLISHING_MS).toISOString();

  let query = admin
    .from('social_posts')
    .select('id, tenant_id, status, caption, platforms, linkedin_post_urn, facebook_post_id, published_at, updated_at, metadata, retry_count')
    .eq('status', 'publishing')
    .lt('updated_at', cutoff)
    .limit(40);

  if (tenantId) query = query.eq('tenant_id', tenantId);

  const { data: stuck, error } = await query;
  if (error) throw new Error(error.message);

  const results: Array<{ id: string; action: string; detail?: string }> = [];

  for (const post of stuck || []) {
    if (post.linkedin_post_urn || post.facebook_post_id || post.published_at) {
      await admin
        .from('social_posts')
        .update({
          status: 'published',
          published_at: post.published_at || new Date().toISOString(),
          error_message: null,
        })
        .eq('id', post.id);
      results.push({ id: post.id, action: 'marked_published', detail: 'external id existed' });
      continue;
    }

    const retryCount = Number(post.metadata?.auto_retry_count || 0);
    if (retryCount < 1) {
      await admin
        .from('social_posts')
        .update({
          status: 'scheduled',
          error_message: 'Recovered from stuck publishing — queued for retry',
          metadata: { ...(post.metadata || {}), auto_retry_count: retryCount + 1 },
          updated_at: new Date().toISOString(),
        })
        .eq('id', post.id);
      results.push({ id: post.id, action: 'retry_scheduled' });
      continue;
    }

    await admin
      .from('social_posts')
      .update({
        status: 'failed',
        error_message: 'Publishing timed out after retry — manual review required',
        updated_at: new Date().toISOString(),
      })
      .eq('id', post.id);
    results.push({ id: post.id, action: 'marked_failed' });
  }

  return { resolved: results.length, results };
}

export async function findDuplicateScheduledCaption(
  tenantId: string,
  caption: string,
  lookback = 10
): Promise<{ id: string; similarity: string } | null> {
  const admin = createSupabaseAdminClient();
  const normalized = normalizeCaptionForDedupe(caption);
  if (normalized.length < 20) return null;

  const { data } = await admin
    .from('social_posts')
    .select('id, caption')
    .eq('tenant_id', tenantId)
    .in('status', ['published', 'scheduled', 'queued', 'publishing'])
    .order('created_at', { ascending: false })
    .limit(lookback);

  for (const row of data || []) {
    const other = normalizeCaptionForDedupe(String(row.caption || ''));
    if (!other) continue;
    if (other === normalized) return { id: row.id, similarity: 'exact' };
    if (other.length > 40 && normalized.length > 40) {
      const shorter = other.length < normalized.length ? other : normalized;
      const longer = other.length < normalized.length ? normalized : other;
      if (longer.includes(shorter.slice(0, Math.floor(shorter.length * 0.85)))) {
        return { id: row.id, similarity: 'near_duplicate' };
      }
    }
  }
  return null;
}

export async function notifyTenantOwner(
  tenantId: string,
  params: {
    title: string;
    message: string;
    link?: string;
    sendEmail?: boolean;
  }
) {
  const admin = createSupabaseAdminClient();
  const { data: owner } = await admin
    .from('tenant_users')
    .select('user_id')
    .eq('tenant_id', tenantId)
    .in('role', ['owner', 'admin'])
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!owner?.user_id) return { notified: false, reason: 'no_owner' };

  const row: Record<string, unknown> = {
    user_id: owner.user_id,
    tenant_id: tenantId,
    title: params.title,
    message: params.message,
    type: 'system',
    read: false,
  };
  if (params.link) {
    row.link = params.link;
    row.action_url = params.link;
  }

  let { error: notifyErr } = await admin.from('notifications').insert(row);
  if (notifyErr?.message?.includes("'link'")) {
    const fallback = { ...row };
    delete fallback.link;
    ({ error: notifyErr } = await admin.from('notifications').insert(fallback));
  }

  let emailSent = false;
  if (params.sendEmail !== false) {
    const { data: profile } = await admin.auth.admin.getUserById(owner.user_id);
    const email = profile?.user?.email;
    if (email) {
      const emailResult = await sendEmailServer({
        tenantId,
        userId: owner.user_id,
        to: email,
        subject: `[AlphaClone] ${params.title}`,
        text: `${params.message}${params.link ? `\n\n${params.link}` : ''}`,
        isPlatformNotification: true,
        templateName: 'systemAlert',
        skipFooter: true,
      });
      emailSent = emailResult.success;
    }
  }

  return {
    notified: !notifyErr,
    emailSent,
    userId: owner.user_id,
    error: notifyErr?.message,
  };
}
