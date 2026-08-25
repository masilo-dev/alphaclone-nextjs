import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import {
  loadPublicPortalContext,
  readPortalPassword,
} from '@/lib/projects/portalPublicHandlers';

type RouteContext = { params: Promise<{ token: string }> };

const commentSchema = z.object({
  authorName: z.string().min(1).max(200),
  authorEmail: z.string().email().optional().or(z.literal('')),
  content: z.string().min(1).max(8000),
  isClient: z.boolean().optional(),
  password: z.string().optional(),
});

export async function GET(req: NextRequest, context: RouteContext) {
  const { token } = await context.params;
  if (!token?.trim()) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const password = readPortalPassword(req);
  const ctx = await loadPublicPortalContext(admin, token.trim(), password);
  if (!ctx.ok) {
    return NextResponse.json(ctx.body, { status: ctx.status });
  }

  const { data, error } = await admin
    .from('project_comments')
    .select('id, author_name, author_email, content, is_client, created_at')
    .eq('project_id', ctx.project.id)
    .eq('tenant_id', ctx.project.tenant_id)
    .order('created_at', { ascending: true })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, comments: data || [] });
}

export async function POST(req: NextRequest, context: RouteContext) {
  const { token } = await context.params;
  if (!token?.trim()) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = commentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid comment', details: parsed.error.flatten() }, { status: 422 });
  }

  const admin = createSupabaseAdminClient();
  const password = readPortalPassword(req, parsed.data.password);
  const ctx = await loadPublicPortalContext(admin, token.trim(), password);
  if (!ctx.ok) {
    return NextResponse.json(ctx.body, { status: ctx.status });
  }

  const { data, error } = await admin
    .from('project_comments')
    .insert({
      tenant_id: ctx.project.tenant_id,
      project_id: ctx.project.id,
      author_name: parsed.data.authorName.trim(),
      author_email: parsed.data.authorEmail?.trim() || null,
      content: parsed.data.content.trim(),
      is_client: parsed.data.isClient !== false,
    })
    .select('id, author_name, author_email, content, is_client, created_at')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await admin.from('client_portal_events').insert({
    tenant_id: ctx.project.tenant_id,
    project_id: ctx.project.id,
    event_type: 'portal_message_sent',
    metadata: {
      comment_id: data.id,
      author_name: data.author_name,
      from_client: true,
    },
  });

  if (parsed.data.isClient !== false) {
    try {
      const { notifyProjectTeamClientPortalMessage } = await import('@/lib/projects/projectClientNotification');
      await notifyProjectTeamClientPortalMessage({
        admin,
        projectId: ctx.project.id,
        tenantId: ctx.project.tenant_id,
        projectName: ctx.project.name,
        authorName: data.author_name,
        content: data.content,
        origin: req.nextUrl.origin,
      });
    } catch (notifyErr) {
      console.warn('[portal/comments] team notify failed:', notifyErr);
    }
  }

  return NextResponse.json({ success: true, comment: data });
}
