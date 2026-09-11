import { NextRequest, NextResponse } from 'next/server';
import { denyIfCronUnauthorized } from '@/lib/cronAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { syncSocialPostAnalyticsCron } from '@/lib/social/syncSocialPostAnalytics';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Pulls Facebook/LinkedIn engagement metrics into social_post_analytics for published posts.
 * Auth: Railway Cron or Authorization: Bearer ${CRON_SECRET}.
 */
export async function GET(req: NextRequest) {
  const denied = denyIfCronUnauthorized(req);
  if (denied) return denied;

  const admin = createSupabaseAdminClient();
  const result = await syncSocialPostAnalyticsCron(admin);

  return NextResponse.json({
    success: true,
    ...result,
  });
}
