import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { loadMessageProject, notifyPortalProjectMessage } from '@/lib/clientPortal/notifications';
import { persistPortalMessage } from '@/lib/clientPortal/messages';

const schema = z.object({ requestId:z.string().uuid().optional(), content: z.string().trim().min(1).max(10000) });

export async function POST(req: NextRequest, context: { params: Promise<{ tenantId: string; projectId: string }> }) {
  try {
    const { tenantId, projectId } = await context.params;
    const { user } = await requireTenantAccess(tenantId, req);
    if (!z.string().uuid().safeParse(projectId).success) return NextResponse.json({ error: 'Valid projectId required' }, { status: 400 });
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: 'Comment is required' }, { status: 400 });
    const admin = createSupabaseAdminClient();
    const project = await loadMessageProject(admin,tenantId,projectId);
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    const { data: profile } = await admin.from('profiles').select('full_name, name').eq('id', user.id).maybeSingle();
    const authorName = profile?.full_name || profile?.name || user.email || 'Workspace member';
    const saved = await persistPortalMessage(admin,{id:parsed.data.requestId || crypto.randomUUID(),tenantId,clientId:project.client_id || '',projectId,authorName,authorEmail:user.email,content:parsed.data.content,isClient:false});
    const data=saved.message;
    if(saved.replayed) return NextResponse.json({comment:data,replayed:true,persistence:'confirmed'});
    await admin.from('business_automation_events').insert({ tenant_id: tenantId, event_type: 'project_comment_created', payload: { projectId, commentId: data.id, actorUserId: user.id } });
    // The portal gets the live update; email makes sure the client sees it
    // even when they are not currently signed in.
    const notification = await notifyPortalProjectMessage({admin,projectId,tenantId,messageId:data.id,content:parsed.data.content,authorName,direction:'to_client'}).catch(()=>({sent:false,error:'notification_unavailable'}));
    return NextResponse.json({ comment: data, notification, persistence:'confirmed' }, { status: 201 });
  } catch (error) { return routeErrorResponse(error, 'Project comment could not be saved', req); }
}
