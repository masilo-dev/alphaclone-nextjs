import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

const schema = z.object({ content: z.string().trim().min(1).max(10000) });

export async function POST(req: NextRequest, context: { params: Promise<{ tenantId: string; projectId: string }> }) {
  try {
    const { tenantId, projectId } = await context.params;
    const { user } = await requireTenantAccess(tenantId, req);
    if (!z.string().uuid().safeParse(projectId).success) return NextResponse.json({ error: 'Valid projectId required' }, { status: 400 });
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: 'Comment is required' }, { status: 400 });
    const admin = createSupabaseAdminClient();
    const { data: project, error: projectError } = await admin.from('projects').select('id').eq('tenant_id', tenantId).eq('id', projectId).maybeSingle();
    if (projectError) throw projectError;
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    const { data: profile } = await admin.from('profiles').select('full_name, name').eq('id', user.id).maybeSingle();
    const authorName = profile?.full_name || profile?.name || user.email || 'Workspace member';
    const { data, error } = await admin.from('project_comments').insert({ tenant_id: tenantId, project_id: projectId, author_name: authorName, author_email: user.email || null, content: parsed.data.content, is_client: false }).select('id, author_name, author_email, content, is_client, created_at').single();
    if (error) throw error;
    await admin.from('business_automation_events').insert({ tenant_id: tenantId, event_type: 'project_comment_created', payload: { projectId, commentId: data.id, actorUserId: user.id } });
    return NextResponse.json({ comment: data }, { status: 201 });
  } catch (error) { return routeErrorResponse(error, 'Project comment could not be saved', req); }
}
