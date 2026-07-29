import { NextRequest, NextResponse } from 'next/server';
import { denyIfCronUnauthorized } from '@/lib/cronAuth';
<<<<<<< HEAD
import { guardCronTenantRow } from '@/lib/tenant/cronTenantGuard';
=======
>>>>>>> origin/main
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { updateSocialPostLinkedInUrnWithRetry } from '@/lib/social/linkedinPublishHelpers';

export const dynamic = 'force-dynamic';

/**
 * Retries persisting external LinkedIn/Facebook IDs onto social_posts when the initial update failed after a successful publish.
<<<<<<< HEAD
 * Auth: Railway Cron or Authorization: Bearer ${CRON_SECRET}.
=======
 * Auth: Vercel Cron or Authorization: Bearer ${CRON_SECRET}.
>>>>>>> origin/main
 */
export async function GET(req: NextRequest) {
  const denied = denyIfCronUnauthorized(req);
  if (denied) return denied;

  const admin = createSupabaseAdminClient();
  const { data: rows, error } = await admin
    .from('social_post_sync_queue')
    .select('id, social_post_id, tenant_id, platform, external_id, attempts, last_error')
    .is('processed_at', null)
    .order('created_at', { ascending: true })
    .limit(40);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results: Array<{ id: string; ok: boolean; detail?: string }> = [];

  for (const row of rows ?? []) {
<<<<<<< HEAD
    const guard = await guardCronTenantRow(row, 'social_post_sync_queue', {
      platform: row.platform,
    });
    if (!guard.ok) {
      await admin
        .from('social_post_sync_queue')
        .update({
          processed_at: new Date().toISOString(),
          last_error: 'missing tenant_id — quarantined',
          attempts: (row.attempts ?? 0) + 1,
        })
        .eq('id', row.id);
      results.push({ id: row.id, ok: false, detail: 'quarantined' });
      continue;
    }

=======
>>>>>>> origin/main
    if (!row.external_id || !row.social_post_id) {
      await admin
        .from('social_post_sync_queue')
        .update({
          processed_at: new Date().toISOString(),
          last_error: 'missing external_id or social_post_id',
          attempts: (row.attempts ?? 0) + 1,
        })
        .eq('id', row.id);
      results.push({ id: row.id, ok: false, detail: 'skipped' });
      continue;
    }

    const patch: Record<string, unknown> =
      row.platform === 'linkedin'
        ? {
            linkedin_post_urn: row.external_id,
            analytics: { linkedin_post_urn: row.external_id },
          }
        : { facebook_post_id: row.external_id };

    const applied = await updateSocialPostLinkedInUrnWithRetry(admin, row.social_post_id, patch);
    const nextAttempts = (row.attempts ?? 0) + 1;

    if (applied.ok) {
      await admin
        .from('social_post_sync_queue')
        .update({ processed_at: new Date().toISOString(), attempts: nextAttempts })
        .eq('id', row.id);
      results.push({ id: row.id, ok: true });
    } else {
      await admin
        .from('social_post_sync_queue')
        .update({
          attempts: nextAttempts,
          last_error: applied.error ?? 'update failed',
          processed_at: nextAttempts >= 12 ? new Date().toISOString() : null,
        })
        .eq('id', row.id);
      results.push({ id: row.id, ok: false, detail: applied.error });
    }
  }

  return NextResponse.json({
    processed: results.length,
    results,
  });
}
