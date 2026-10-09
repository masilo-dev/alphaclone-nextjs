import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { sendEmailServer } from '@/lib/email/sendEmailServer';
import { persistPortalMessage } from '@/lib/clientPortal/messages';
import { escapeHtml } from '@/lib/email/escapeHtml';
import { getOrCreateClientPortalUrl } from '@/services/finance/clientFinancePortalService';

const schema = z.object({ requestId:z.string().uuid().optional(), content: z.string().trim().min(1).max(10_000) });
type Context = { params: Promise<{ tenantId: string; clientId: string }> };

export async function GET(req: NextRequest, context: Context) {
  try {
    const { tenantId, clientId } = await context.params;
    const { admin } = await requireTenantAccess(tenantId, req);
    if (!z.string().uuid().safeParse(clientId).success) return NextResponse.json({ error: 'Invalid client' }, { status: 400 });
    const { data: client } = await admin.from('business_clients').select('id').eq('tenant_id', tenantId).eq('id', clientId).maybeSingle();
    if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    const { data, error } = await admin.from('client_portal_events').select('id, created_at, metadata')
      .eq('tenant_id', tenantId).eq('client_id', clientId).eq('event_type', 'portal_message_sent')
      .contains('metadata', { kind: 'general_message' }).order('created_at', { ascending: false }).limit(100);
    if (error) throw error;
    return NextResponse.json({ messages: (data || []).reverse().map((item: any) => ({
      id: item.id, created_at: item.created_at, author_name: String(item.metadata?.author_name || 'Client'),
      content: String(item.metadata?.content || ''), is_client: item.metadata?.is_client === true,
    })) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return routeErrorResponse(error, 'Client messages could not be loaded', req); }
}

export async function POST(req: NextRequest, context: Context) {
  try {
    const { tenantId, clientId } = await context.params;
    const { user, admin } = await requireTenantAccess(tenantId, req);
    if (!z.string().uuid().safeParse(clientId).success) return NextResponse.json({ error: 'Invalid client' }, { status: 400 });
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: 'Enter a message of up to 10,000 characters' }, { status: 400 });
    const { data: client, error: clientError } = await admin.from('business_clients')
      .select('id, name, email, client_portal_password_hash, is_active')
      .eq('tenant_id', tenantId).eq('id', clientId).maybeSingle();
    if (clientError) throw clientError;
    if (!client || client.is_active === false) return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    const { data: profile } = await admin.from('profiles').select('full_name, name').eq('id', user.id).maybeSingle();
    const authorName = profile?.full_name || profile?.name || user.email || 'Business';
    const saved = await persistPortalMessage(admin,{id:parsed.data.requestId || crypto.randomUUID(),tenantId,clientId,content:parsed.data.content,authorName,isClient:false});
    const data = saved.message;
    if (saved.replayed) return NextResponse.json({message:data,replayed:true,persistence:'confirmed'});
    let notification: { sent: boolean; error?: string } = { sent: false, error: 'no_client_email' };
    if (client.email) {
      let loginUrl: string | null = null;
      if (client.client_portal_password_hash) {
        const portalUrl = await getOrCreateClientPortalUrl(admin, tenantId, clientId);
        loginUrl = `${new URL(portalUrl).origin}/portal-login?next=${encodeURIComponent(new URL(portalUrl).pathname)}`;
      }
      const sent = await sendEmailServer({
        tenantId, to: client.email, category: 'transactional', templateName: 'clientConversationReply',
        idempotencyKey: `client-message:${data.id}:client`, fromName: authorName,
        subject: `A message from ${authorName}`,
        html: `<p>Hi ${escapeHtml(client.name || 'there')},</p><p>${escapeHtml(authorName)} sent you a message:</p><blockquote>${escapeHtml(parsed.data.content)}</blockquote>${loginUrl ? `<p><a href="${escapeHtml(loginUrl)}">Open your client workspace to reply</a></p>` : '<p>Contact the business to access your client workspace and reply.</p>'}`,
        text: `Hi ${client.name || 'there'},\n\n${authorName} sent you a message:\n\n${parsed.data.content}${loginUrl ? `\n\nOpen your client workspace to reply: ${loginUrl}` : '\n\nContact the business to access your client workspace and reply.'}`,
      }).catch((cause) => ({ success: false, error: String(cause) }));
      notification = { sent: sent.success, error: sent.error };
    }
    return NextResponse.json({ message: data, notification }, { status: 201 });
  } catch (error) { return routeErrorResponse(error, 'Client message could not be sent', req); }
}
