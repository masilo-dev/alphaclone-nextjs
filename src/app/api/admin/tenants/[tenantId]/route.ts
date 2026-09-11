import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { requirePlatformSuperAdmin, routeErrorResponse } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ tenantId: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    await requirePlatformSuperAdmin();
    const { tenantId } = await params;
    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId required' }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const { data: tenant, error: tenantError } = await admin
      .from('tenants')
      .select('id, name, status, created_at, subscription_tier, subscription_status, settings')
      .eq('id', tenantId)
      .single();

    if (tenantError) throw tenantError;

    const { data: users, error: usersError } = await admin
      .from('tenant_users')
      .select(`
        id,
        role,
        created_at,
        user_id,
        user:user_id (
          id,
          email,
          name,
          avatar
        )
      `)
      .eq('tenant_id', tenantId);

    if (usersError) throw usersError;

    return NextResponse.json({
      success: true,
      tenant: {
        ...tenant,
        users: users || [],
      },
    });
  } catch (err) {
    return routeErrorResponse(err);
  }
}
