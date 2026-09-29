import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { sendEmailServer } from '@/lib/email/sendEmailServer';
import { escapeHtml } from '@/lib/email/escapeHtml';
import { getOrCreateClientPortalUrl } from '@/services/finance/clientFinancePortalService';

export async function POST(req: NextRequest, context: { params: Promise<{ clientId: string }> }) {
  try {
    const { clientId } = await context.params;
    const body = z.object({ tenantId: z.string().uuid() }).safeParse(await req.json().catch(() => ({})));
    if (!z.string().uuid().safeParse(clientId).success || !body.success) {
      return NextResponse.json({ error: 'Valid client and workspace are required' }, { status: 400 });
    }
    const tenantId = body.data.tenantId;
    const { admin } = await requireTenantAccess(tenantId, req);
    const { data: client, error } = await admin.from('business_clients')
      .select('id, name, company_name, email, client_portal_password_hash, is_active')
      .eq('tenant_id', tenantId).eq('id', clientId).maybeSingle();
    if (error) throw error;
    if (!client || client.is_active === false) return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    if (!client.email || !client.client_portal_password_hash) {
      return NextResponse.json({ error: 'Set the client email and portal access before sending an invitation' }, { status: 422 });
    }
    const portalUrl = await getOrCreateClientPortalUrl(admin, tenantId, clientId);
    const loginUrl = `${new URL(portalUrl).origin}/portal-login?next=${encodeURIComponent(new URL(portalUrl).pathname)}`;
    const { data: tenant } = await admin.from('tenants').select('name').eq('id', tenantId).maybeSingle();
    const business = tenant?.name || 'Your business';
    const sent = await sendEmailServer({
      tenantId, to: client.email, subject: `${business} shared a client workspace with you`,
      fromName: business, category: 'transactional', templateName: 'clientPortalInvitation',
      html: `<p>Hi ${escapeHtml(client.name || client.company_name || 'there')},</p><p>${escapeHtml(business)} has shared a client workspace with you. You can review projects, proposals, contracts and invoices, and message the business there.</p><p><a href="${escapeHtml(loginUrl)}">Open your client workspace</a></p><p>Sign in using this email and the password provided to you by the business. If you need access, contact the business directly.</p>`,
      text: `Hi ${client.name || 'there'},\n\n${business} has shared a client workspace with you. Open it at ${loginUrl}\n\nSign in using this email and the password provided by the business.`,
    });
    if (!sent.success) return NextResponse.json({ error: sent.error || 'Invitation could not be sent' }, { status: 502 });
    return NextResponse.json({ success: true, recipient: client.email });
  } catch (error) {
    return routeErrorResponse(error, 'Invitation could not be sent', req);
  }
}
