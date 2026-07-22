import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedUser, requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { sendEmailServer } from '@/lib/email/sendEmailServer';

type BroadcastBody = {
  tenantId?: string;
  title?: string;
  message?: string;
  link?: string;
  email?: boolean;
  userIds?: string[];
};

/**
 * Fan-out a platform announcement to all (or selected) workspace members:
 * in-app notification row + optional marketing email per recipient.
 */
export async function POST(req: NextRequest) {
  try {
    const { user } = await requireAuthenticatedUser();
    const body = (await req.json()) as BroadcastBody;

    const tenantId = String(body.tenantId || '').trim();
    const title = String(body.title || '').trim();
    const message = String(body.message || title).trim();
    const link = body.link ? String(body.link).trim() : undefined;
    const shouldEmail = body.email !== false;

    if (!tenantId || !title) {
      return NextResponse.json({ error: 'tenantId and title are required' }, { status: 400 });
    }

    const { admin } = await requireTenantAccess(tenantId);

    const { data: membership } = await admin
      .from('tenant_users')
      .select('role')
      .eq('tenant_id', tenantId)
      .eq('user_id', user.id)
      .maybeSingle();

    const role = String(membership?.role || '').toLowerCase();
    if (!['owner', 'admin'].includes(role)) {
      return NextResponse.json({ error: 'Only workspace owners or admins can broadcast notifications' }, { status: 403 });
    }

    let recipientQuery = admin
      .from('tenant_users')
      .select('user_id')
      .eq('tenant_id', tenantId);

    const explicitIds = Array.isArray(body.userIds)
      ? body.userIds.map((id) => String(id).trim()).filter(Boolean)
      : [];

    if (explicitIds.length > 0) {
      recipientQuery = recipientQuery.in('user_id', explicitIds);
    }

    const { data: members, error: membersError } = await recipientQuery;
    if (membersError) throw membersError;

    const userIds = (members || []).map((m: { user_id: string }) => m.user_id).filter(Boolean);
    if (userIds.length === 0) {
      return NextResponse.json({ error: 'No recipients found for this workspace' }, { status: 400 });
    }

    const { data: profiles } = await admin
      .from('profiles')
      .select('id, email, name')
      .in('id', userIds);

    const profileById = new Map((profiles || []).map((p: { id: string; email?: string; name?: string }) => [p.id, p]));
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || '';

    let inApp = 0;
    let emailed = 0;

    for (const recipientId of userIds) {
      await admin.from('notifications').insert({
        user_id: recipientId,
        tenant_id: tenantId,
        type: 'system',
        title,
        message,
        action_url: link || null,
        read: false,
      });
      inApp += 1;

      if (!shouldEmail) continue;

      const profile = profileById.get(recipientId) as { id: string; email?: string; name?: string } | undefined;
      if (!profile?.email) continue;

      try {
        const result = await sendEmailServer({
          tenantId,
          to: profile.email,
          subject: title,
          html: `
            <div style="font-family: sans-serif; padding: 20px; color: #333;">
              <h2 style="color: #0d9488;">${title}</h2>
              ${message ? `<p>${message}</p>` : ''}
              ${link ? `<a href="${baseUrl}${link}" style="display:inline-block;padding:10px 20px;background:#0d9488;color:#fff;text-decoration:none;border-radius:6px;">Open AlphaClone</a>` : ''}
              <hr style="border:none;border-top:1px solid #eee;margin:20px 0;" />
              <small style="color:#666;">Platform announcement from your AlphaClone workspace.</small>
            </div>
          `,
          isPlatformNotification: true,
        });
        if (result.success) emailed += 1;
      } catch (err) {
        console.error('[Notifications Broadcast] Email failed for', recipientId, err);
      }
    }

    return NextResponse.json({ success: true, recipients: userIds.length, inApp, emailed });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to broadcast notification', req);
  }
}
