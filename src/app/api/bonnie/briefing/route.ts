import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { getTodayBriefForUser } from '@/services/bonnieMorningBriefService';

export async function GET(req: NextRequest) {
  try {
    const authClient = await createSupabaseServerClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const tenantId = req.nextUrl.searchParams.get('tenantId');
    if (!tenantId) return NextResponse.json({ error: 'tenantId required' }, { status: 400 });

    await requireTenantAccess(tenantId);

    const brief = await getTodayBriefForUser(tenantId, user.id);
    return NextResponse.json({ success: true, brief });
  } catch (err: unknown) {
    return routeErrorResponse(err, 'Failed to load briefing', req);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const authClient = await createSupabaseServerClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const tenantId = body.tenantId as string | undefined;
    const notificationId = body.notificationId as string | undefined;
    if (!tenantId || !notificationId) {
      return NextResponse.json({ error: 'tenantId and notificationId required' }, { status: 400 });
    }

    await requireTenantAccess(tenantId);

    const admin = createSupabaseAdminClient();
    const { error } = await admin
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId)
      .eq('tenant_id', tenantId)
      .eq('user_id', user.id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return routeErrorResponse(err, 'Failed to mark briefing read', req);
  }
}
