import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { resolveSupabaseAdminClient } from '@/lib/supabase-admin';
import { requireClientPortalAccessDoubleGuarded } from '@/lib/auth/clientPortalAuth';
import { resolveClientByPortalToken } from '@/services/finance/clientFinancePortalService';
import { notifyProjectTeamClientPortalMessage } from '@/lib/projects/projectClientNotification';
import { sendEmailServer } from '@/lib/email/sendEmailServer';
import { loadClientProjects } from '@/lib/clientPortal/projects';
import { persistPortalMessage } from '@/lib/clientPortal/messages';
import { escapeHtml } from '@/lib/email/escapeHtml';

export const dynamic = 'force-dynamic';

const messageSchema = z.object({
  token: z.string().uuid(),
  requestId: z.string().uuid().optional(),
  projectId: z.string().uuid().nullable().optional(),
  content: z.string().trim().min(1).max(10_000),
});

function mapAuthError(code: string): { status: number; message: string } {
  switch (code) {
    case 'NO_SESSION':
    case 'BAD_TOKEN':
    case 'SALT_ROTATED':
    case 'SESSION_REVOKED':
      return { status: 401, message: 'Session expired or invalid. Please log in again.' };
    case 'CLIENT_INACTIVE':
      return { status: 403, message: 'This portal account is not active.' };
    case 'TOKEN_MISMATCH':
      return { status: 403, message: 'Session does not match this portal.' };
    case 'BAD_PORTAL_TOKEN':
      return { status: 404, message: 'Portal not found.' };
    case 'INTERNAL_ERROR':
      return { status: 500, message: 'Server error.' };
    default:
      return { status: 403, message: 'Access denied.' };
  }
}

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get('token')?.trim();
    if (!token) return NextResponse.json({ error: 'token is required' }, { status: 400 });

    const admin = await resolveSupabaseAdminClient();
    const guarded = await requireClientPortalAccessDoubleGuarded(admin, token, resolveClientByPortalToken);
    if (!guarded.ok) {
      const { status, message } = mapAuthError(guarded.error.code);
      return NextResponse.json({ error: message, code: guarded.error.code }, { status });
    }
    const client = guarded.resolvedClient;

    const projects = await loadClientProjects(admin, client.tenant_id, client.id);
    const ids = (projects || []).map((project: any) => project.id);
    const names = new Map((projects || []).map((project: any) => [project.id, project.name]));
    const projectMessages = ids.length ? await admin.from('project_comments')
      .select('id, project_id, author_name, author_email, content, is_client, created_at')
      .eq('tenant_id', client.tenant_id).in('project_id', ids)
      .order('created_at', { ascending: false }).limit(100) : { data: [], error: null };
    const generalMessages = await admin.from('client_portal_events')
      .select('id, created_at, metadata')
      .eq('tenant_id', client.tenant_id).eq('client_id', client.id)
      .eq('event_type', 'portal_message_sent').contains('metadata', { kind: 'general_message' })
      .order('created_at', { ascending: false }).limit(100);
    if (projectMessages.error) throw projectMessages.error;
    if (generalMessages.error) throw generalMessages.error;
    const messages = [
      ...(projectMessages.data || []).map((item: any) => ({ ...item, projectName: names.get(item.project_id) || 'Project' })),
      ...(generalMessages.data || []).map((item: any) => ({
        id: item.id, project_id: null, projectName: 'General',
        author_name: String(item.metadata?.author_name || 'Business'),
        content: String(item.metadata?.content || ''), is_client: item.metadata?.is_client === true,
        created_at: item.created_at,
      })),
    ].sort((a, b) => a.created_at.localeCompare(b.created_at));
    return NextResponse.json({ success: true, messages }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('[client-finance/messages GET]', error);
    return NextResponse.json({ error: 'Messages could not be loaded' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (req.headers.get('origin') && req.headers.get('origin') !== req.nextUrl.origin) return NextResponse.json({error:'Cross-origin requests are not allowed'},{status:403});
    const parsed = messageSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: 'Valid message details are required' }, { status: 400 });

    const admin = await resolveSupabaseAdminClient();
    const guarded = await requireClientPortalAccessDoubleGuarded(admin, parsed.data.token, resolveClientByPortalToken);
    if (!guarded.ok) {
      const { status, message } = mapAuthError(guarded.error.code);
      return NextResponse.json({ error: message, code: guarded.error.code }, { status });
    }
    const client = guarded.resolvedClient;

    if (!parsed.data.projectId) {
      const { data: recipient, error: recipientError } = await admin.from('business_clients')
        .select('name, company_name, email').eq('tenant_id', client.tenant_id).eq('id', client.id).maybeSingle();
      if (recipientError) throw recipientError;
      const authorName = recipient?.name || recipient?.company_name || 'Client';
      const saved = await persistPortalMessage(admin, {id:parsed.data.requestId || crypto.randomUUID(),tenantId:client.tenant_id,clientId:client.id,content:parsed.data.content,authorName,isClient:true});
      const data = saved.message;
      if (saved.replayed) return NextResponse.json({success:true,message:data,replayed:true,persistence:'confirmed'}, {status:200});
      const { data: tenant } = await admin.from('tenants').select('owner_id, name').eq('id', client.tenant_id).maybeSingle();
      const { data: owner } = tenant?.owner_id ? await admin.from('profiles').select('email').eq('id', tenant.owner_id).maybeSingle() : { data: null };
      const notification = owner?.email ? await sendEmailServer({
        tenantId: client.tenant_id, to: owner.email, category: 'transactional',
        templateName: 'clientConversationOwner', fromName: tenant?.name || 'AlphaClone',
        idempotencyKey: `client-message:${data.id}:owner`,
        subject: `New client message: ${authorName}`,
        html: `<p>${escapeHtml(authorName)} sent you a message:</p><blockquote>${escapeHtml(parsed.data.content)}</blockquote><p><a href="${req.nextUrl.origin}/dashboard/clients?contactId=${client.id}&amp;clientTab=messages">Open client conversation</a></p>`,
        text: `${authorName} sent you a message:\n\n${parsed.data.content}\n\nOpen client conversation: ${req.nextUrl.origin}/dashboard/clients?contactId=${client.id}&clientTab=messages`,
      }).catch((cause) => ({ success: false, error: String(cause) })) : { success: false, error: 'no_owner_email' };
      return NextResponse.json({ success: true, message: data, notification: { sent: notification.success, error: notification.error } }, { status: 201 });
    }

    const projects = await loadClientProjects(admin,client.tenant_id,client.id);
    const project = projects.find(item=>item.id === parsed.data.projectId);
    if (!project) return NextResponse.json({error:'Project not found'},{status:404});
    const {data:recipient,error:recipientError} = await admin.from('business_clients').select('name,email').eq('tenant_id',client.tenant_id).eq('id',client.id).maybeSingle();
    if (recipientError) throw recipientError;
    const saved = await persistPortalMessage(admin,{id:parsed.data.requestId || crypto.randomUUID(),tenantId:client.tenant_id,clientId:client.id,projectId:project.id,content:parsed.data.content,authorName:recipient?.name || 'Client',authorEmail:recipient?.email,isClient:true});
    const data = saved.message;
    if (saved.replayed) return NextResponse.json({success:true,message:data,replayed:true,persistence:'confirmed'});
    await notifyProjectTeamClientPortalMessage({
      admin, projectId: project.id, tenantId: client.tenant_id,
      projectName: project.name || 'Project', authorName: recipient?.name || 'Client',
      content: parsed.data.content, origin: req.nextUrl.origin,
    }).catch((notificationError) => console.error('[client-finance/message notification]', notificationError));
    return NextResponse.json({ success: true, message: data, persistence: 'confirmed' }, { status: 201 });
  } catch (error) {
    console.error('[client-finance/messages POST]', error);
    return NextResponse.json({ error: 'Message could not be confirmed. Retry with the same request reference.', code: 'MESSAGE_UNCONFIRMED' }, { status: (error as any)?.status || 500 });
  }
}
