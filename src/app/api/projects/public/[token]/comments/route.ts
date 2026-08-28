import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import {
  loadPublicPortalContext,
  readPortalPassword,
} from '@/lib/projects/portalPublicHandlers';

const postSchema = z.object({
  authorName: z.string().trim().min(1).max(200),
  authorEmail: z.string().trim().email().optional().or(z.literal('')),
  content: z.string().trim().min(1).max(10_000),
  isClient: z.boolean().optional(),
  password: z.string().optional(),
});

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    if (!token?.trim()) {
      return NextResponse.json({ error: 'Token required' }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const password = readPortalPassword(req);
    const access = await loadPublicPortalContext(admin, token.trim(), password);

    if (!access.ok) {
      return NextResponse.json(access.body, { status: access.status });
    }

    const { data, error } = await admin
      .from('project_comments')
      .select('id, author_name, author_email, content, is_client, created_at')
      .eq('project_id', access.project.id)
      .order('created_at', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ success: true, comments: data || [] });
  } catch (error) {
    console.error('[projects/public/comments GET]', error);
    return NextResponse.json({ error: 'Failed to load comments' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    if (!token?.trim()) {
      return NextResponse.json({ error: 'Token required' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const parsed = postSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Name and message are required' }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const password = readPortalPassword(req, parsed.data.password);
    const access = await loadPublicPortalContext(admin, token.trim(), password);

    if (!access.ok) {
      return NextResponse.json(access.body, { status: access.status });
    }

    const { data, error } = await admin
      .from('project_comments')
      .insert({
        tenant_id: access.project.tenant_id,
        project_id: access.project.id,
        author_name: parsed.data.authorName,
        author_email: parsed.data.authorEmail || null,
        content: parsed.data.content,
        is_client: parsed.data.isClient !== false,
      })
      .select('id, author_name, author_email, content, is_client, created_at')
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, comment: data }, { status: 201 });
  } catch (error) {
    console.error('[projects/public/comments POST]', error);
    return NextResponse.json({ error: 'Failed to post comment' }, { status: 500 });
  }
}
