import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { resolveSupabaseAdminClient } from '@/lib/supabase-admin';
import { resolveClientByPortalToken } from '@/services/finance/clientFinancePortalService';
import { notifyProjectTeamClientPortalMessage } from '@/lib/projects/projectClientNotification';

export const dynamic = 'force-dynamic';

const messageSchema = z.object({
  token: z.string().uuid(),
  projectId: z.string().uuid(),
  content: z.string().trim().min(1).max(10_000),
});

async function resolvePortal(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')?.trim();
  if (!token) return null;
  const admin = await resolveSupabaseAdminClient();
  const client = await resolveClientByPortalToken(admin, token);
  return client ? { admin, client } : null;
}

export async function GET(req: NextRequest) {
  try {
    const portal = await resolvePortal(req);
    if (!portal) return NextResponse.json({ error: 'Portal not found' }, { status: 404 });
    const { data: projects, error: projectError } = await portal.admin
      .from('projects').select('id, name').eq('tenant_id', portal.client.tenant_id).eq('client_id', portal.client.id);
    if (projectError) throw projectError;
    const ids = (projects || []).map((project: any) => project.id);
    if (!ids.length) return NextResponse.json({ success: true, messages: [] });
    const names = new Map((projects || []).map((project: any) => [project.id, project.name]));
    const { data, error } = await portal.admin
      .from('project_comments')
      .select('id, project_id, author_name, author_email, content, is_client, created_at')
      .eq('tenant_id', portal.client.tenant_id).in('project_id', ids)
      .order('created_at', { ascending: true }).limit(200);
    if (error) throw error;
    return NextResponse.json({ success: true, messages: (data || []).map((message: any) => ({ ...message, projectName: names.get(message.project_id) || 'Project' })) });
  } catch (error) {
    console.error('[client-finance/messages GET]', error);
    return NextResponse.json({ error: 'Messages could not be loaded' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const parsed = messageSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: 'Valid message details are required' }, { status: 400 });
    const admin = await resolveSupabaseAdminClient();
    const client = await resolveClientByPortalToken(admin, parsed.data.token);
    if (!client) return NextResponse.json({ error: 'Portal not found' }, { status: 404 });
    const { data: project, error: projectError } = await admin
      .from('projects').select('id, name').eq('tenant_id', client.tenant_id).eq('client_id', client.id).eq('id', parsed.data.projectId).maybeSingle();
    if (projectError) throw projectError;
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    const { data, error } = await admin.from('project_comments').insert({
      tenant_id: client.tenant_id, project_id: project.id, author_name: client.name,
      author_email: client.email || null, content: parsed.data.content, is_client: true,
    }).select('id, project_id, author_name, author_email, content, is_client, created_at').single();
    if (error) throw error;
    // Persistence is the source of truth. Email is only a best-effort alert;
    // the team can always reply in the real-time project conversation.
    await notifyProjectTeamClientPortalMessage({
      admin, projectId: project.id, tenantId: client.tenant_id,
      projectName: project.name || 'Project', authorName: client.name,
      content: parsed.data.content, origin: req.nextUrl.origin,
    }).catch((notificationError) => console.error('[client-finance/message notification]', notificationError));
    return NextResponse.json({ success: true, message: data }, { status: 201 });
  } catch (error) {
    console.error('[client-finance/messages POST]', error);
    return NextResponse.json({ error: 'Message could not be sent' }, { status: 500 });
  }
}
