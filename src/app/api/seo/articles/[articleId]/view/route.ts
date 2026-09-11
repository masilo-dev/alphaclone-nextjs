import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';

export async function POST(req: NextRequest, context: { params: Promise<{ articleId: string }> }) {
  try {
    const parsed = z.string().uuid().safeParse((await context.params).articleId);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid article' }, { status: 400 });
    const admin = createSupabaseAdminClient();
    const { error } = await admin.rpc('increment_published_seo_article_view', { p_article_id: parsed.data });
    if (error) throw error;
    return new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return clientErrorResponse(error, { request: req, scope: 'seo/articles/view.POST' });
  }
}
