import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { requireTenantRole, routeErrorResponse } from '@/lib/apiAuth';
import { sendWithProviderSdk } from '@/lib/email/providerSdk';

type Context = { params: Promise<{ tenantId: string }> };
const adminRoles = ['owner', 'admin', 'tenant_admin', 'super_admin'];

export async function POST(req: NextRequest, context: Context) {
  try {
    const { tenantId } = await context.params;
    const { user } = await requireTenantRole(tenantId, adminRoles);
    const { email, role } = z.object({
      email: z.string().trim().email().max(320),
      role: z.enum(['admin', 'member', 'guest', 'client']).default('member'),
    }).parse(await req.json());
    const normalizedEmail = email.toLowerCase();
    const admin = createSupabaseAdminClient();

    const { data: tenant, error: tenantError } = await admin.from('tenants').select('name').eq('id', tenantId).single();
    if (tenantError) throw tenantError;
    const { data: existingUser } = await admin.from('profiles').select('id').ilike('email', normalizedEmail).maybeSingle();
    if (existingUser?.id) {
      const { data: membership } = await admin.from('tenant_users').select('user_id').eq('tenant_id', tenantId).eq('user_id', existingUser.id).maybeSingle();
      if (membership) return NextResponse.json({ error: 'This person is already a workspace member' }, { status: 409 });
    }

    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: invitation, error } = await admin.from('tenant_invitations').upsert({
      tenant_id: tenantId,
      email: normalizedEmail,
      role,
      invited_by: user.id,
      token,
      status: 'pending',
      accepted_at: null,
      revoked_at: null,
      expires_at: expiresAt,
    }, { onConflict: 'tenant_id,email' }).select('id, token, expires_at').single();
    if (error) throw error;

    const apiKey = process.env.BREVO_PLATFORM_API_KEY || process.env.BREVO_API_KEY || process.env.SENDINBLUE_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'Invitation email delivery is unavailable' }, { status: 503 });
    const appUrl = process.env.NEXT_PUBLIC_APP_URL!.replace(/\/$/, '');
    const inviteUrl = `${appUrl}/invite/${encodeURIComponent(invitation.token)}`;
    const sent = await sendWithProviderSdk('brevo', {
      apiKey,
      fromEmail: process.env.BREVO_PLATFORM_FROM_EMAIL || process.env.BREVO_FROM_EMAIL || 'noreply@alphaclonesystems.com',
      fromName: 'AlphaClone Systems',
      to: normalizedEmail,
      subject: `You are invited to ${tenant.name} on AlphaClone`,
      text: `You have been invited to join ${tenant.name}. Accept before ${new Date(expiresAt).toLocaleDateString()}: ${inviteUrl}`,
      html: `<p>You have been invited to join <strong>${tenant.name.replace(/[<>&]/g, '')}</strong> on AlphaClone.</p><p><a href="${inviteUrl}">Accept invitation</a></p><p>This invitation expires in 7 days.</p>`,
    });
    if (!sent.ok) {
      await admin.from('tenant_invitations').update({ revoked_at: new Date().toISOString(), status: 'expired' }).eq('id', invitation.id);
      return NextResponse.json({ error: 'Invitation email could not be sent' }, { status: 502 });
    }

    await admin.from('business_automation_events').insert({ tenant_id: tenantId, event_type: 'tenant_invitation_sent', payload: { actorUserId: user.id, invitationId: invitation.id, role } });
    return NextResponse.json({ success: true, invitation: { id: invitation.id, expiresAt: invitation.expires_at } });
  } catch (error) {
    return routeErrorResponse(error, 'Invitation could not be sent', req);
  }
}

