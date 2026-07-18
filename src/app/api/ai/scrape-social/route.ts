import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { assertSafeExternalHttpUrl } from '@/lib/security/externalUrl';
import { aiService } from '@/services/ai/aiService';

async function fetchPublicPage(initial: URL): Promise<string> {
  let current = initial;
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(current, {
      redirect: 'manual', signal: AbortSignal.timeout(15_000),
      headers: { 'User-Agent': 'AlphaClone-Social-Monitor/1.0', Accept: 'text/html,application/xhtml+xml' },
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) throw new Error('Social page returned an invalid redirect');
      current = await assertSafeExternalHttpUrl(new URL(location, current).toString());
      continue;
    }
    if (!response.ok) throw new Error(`Social page returned HTTP ${response.status}`);
    return (await response.text()).slice(0, 250_000);
  }
  throw new Error('Social page redirected too many times');
}

export async function POST(req: NextRequest) {
  try {
    const { tenantId, itemId } = z.object({ tenantId: z.string().uuid(), itemId: z.string().uuid() }).parse(await req.json());
    await requireTenantAccess(tenantId);
    const admin = createSupabaseAdminClient();
    const { data: item, error } = await admin.from('social_watchlist').select('id, url, name, platform')
      .eq('id', itemId).eq('tenant_id', tenantId).maybeSingle();
    if (error) throw error;
    if (!item) return NextResponse.json({ error: 'Watchlist target not found' }, { status: 404 });
    const safeUrl = await assertSafeExternalHttpUrl(String(item.url));
    const html = await fetchPublicPage(safeUrl);
    const text = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 30_000);
    if (text.length < 80) throw new Error('The provider did not expose readable public content');
    const completion = await aiService.complete({
      prompt: `Summarize only the newest concrete public update visible in this ${item.platform || 'social'} page content for ${item.name}. If no dated update is visible, say that no new public post could be verified.\n\nPAGE CONTENT:\n${text}`,
      systemPrompt: 'You are a factual social monitoring analyst. Never invent posts, dates, metrics, or events. Return at most two sentences.',
      provider: 'auto', temperature: 0,
    });
    const summary = String(completion.content || '').trim();
    if (!summary) throw new Error('AI analysis returned no result');
    const { error: updateError } = await admin.from('social_watchlist').update({
      last_checked_at: new Date().toISOString(), last_post_summary: summary,
    }).eq('id', itemId).eq('tenant_id', tenantId);
    if (updateError) throw updateError;
    return NextResponse.json({ success: true, summary });
  } catch (error) {
    return routeErrorResponse(error, 'Public social update could not be verified', req);
  }
}
