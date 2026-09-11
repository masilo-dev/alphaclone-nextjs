import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { requirePlatformSuperAdmin, routeErrorResponse } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ tenantId: string }> };

function mapSubscriptionToStatus(subscriptionStatus: unknown, status: unknown): string {
  if (typeof status === 'string' && status.trim()) return status;
  const sub = String(subscriptionStatus || '').toLowerCase();
  if (sub === 'suspended' || sub === 'cancelled' || sub === 'canceled') return 'suspended';
  if (sub === 'trialing' || sub === 'trial') return 'trial';
  if (sub === 'inactive' || sub === 'paused') return 'inactive';
  return 'active';
}

function isMissingColumnError(error: { message?: string; code?: string } | null | undefined): boolean {
  return (
    !!error &&
    (error.code === '42703' ||
      error.code === 'PGRST204' ||
      /column|does not exist/i.test(error.message || ''))
  );
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    await requirePlatformSuperAdmin();
    const { tenantId } = await params;
    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId required' }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    let tenantResult = await admin
      .from('tenants')
      .select('id, name, status, created_at, subscription_tier, subscription_status, settings')
      .eq('id', tenantId)
      .single();

    if (isMissingColumnError(tenantResult.error)) {
      tenantResult = await admin
        .from('tenants')
        .select('id, name, created_at, subscription_tier, subscription_status, settings')
        .eq('id', tenantId)
        .single();
    }

    if (tenantResult.error) throw tenantResult.error;
    const tenant = tenantResult.data;

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
        status: mapSubscriptionToStatus(tenant.subscription_status, (tenant as { status?: string }).status),
        users: users || [],
      },
    });
  } catch (err) {
    return routeErrorResponse(err);
  }
}
