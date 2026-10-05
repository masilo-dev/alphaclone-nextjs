/**
 * Marketing week planning helpers — reuses social_posts / analytics only.
 * Does not invent metrics.
 */

import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export type MarketingWeekInsight = {
  recommended_posts_this_week: number;
  top_platforms: Array<{ platform: string; published_count: number }>;
  recent_themes: string[];
  suggestion: string;
  evidence_window_days: number;
};

export async function deriveMarketingWeekInsight(
  tenantId: string,
  windowDays = 28
): Promise<MarketingWeekInsight> {
  const admin = createSupabaseAdminClient();
  const since = new Date(Date.now() - windowDays * 86400_000).toISOString();

  const { data: posts } = await admin
    .from('social_posts')
    .select('id, platforms, platform, caption, status, published_at, created_at')
    .eq('tenant_id', tenantId)
    .gte('created_at', since)
    .limit(100);

  const published = (posts || []).filter((p) => String(p.status) === 'published');
  const platformCounts = new Map<string, number>();
  for (const post of published) {
    const platforms = Array.isArray(post.platforms)
      ? post.platforms
      : [post.platform].filter(Boolean);
    for (const platform of platforms) {
      const key = String(platform);
      platformCounts.set(key, (platformCounts.get(key) || 0) + 1);
    }
  }

  const top_platforms = [...platformCounts.entries()]
    .map(([platform, published_count]) => ({ platform, published_count }))
    .sort((a, b) => b.published_count - a.published_count);

  const recent_themes = published
    .map((p) => String(p.caption || '').trim().slice(0, 80))
    .filter(Boolean)
    .slice(0, 5);

  const avgPerWeek = Math.max(1, Math.round((published.length / Math.max(1, windowDays)) * 7));
  const suggestion =
    published.length === 0
      ? 'No published posts in the evidence window. Prepare 2–3 approved posts for LinkedIn/Facebook using connected identities.'
      : `Based on ${published.length} published post(s) in the last ${windowDays} days, aim for ~${avgPerWeek} post(s) this week on ${top_platforms[0]?.platform || 'your best channel'}.`;

  return {
    recommended_posts_this_week: avgPerWeek,
    top_platforms,
    recent_themes,
    suggestion,
    evidence_window_days: windowDays,
  };
}
