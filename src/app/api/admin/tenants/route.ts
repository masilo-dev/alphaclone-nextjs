import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { requirePlatformSuperAdmin, routeErrorResponse } from '@/lib/apiAuth';
import { logPlatformAdminAction } from '@/lib/security/adminAuditLog';

export const dynamic = 'force-dynamic';

const deleteSchema = z.object({
  tenantId: z.string().uuid(),
});

const patchSchema = z.object({
  tenantId: z.string().uuid(),
  status: z.enum(['active', 'suspended', 'inactive', 'trial']),
});

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

async function listTenants(admin: ReturnType<typeof createSupabaseAdminClient>) {
  // Prefer status when present; fall back if production schema lacks tenants.status
  const withStatus = await admin
    .from('tenants')
    .select(`
      id,
      name,
      status,
      created_at,
      subscription_tier,
      subscription_status,
      settings,
      tenant_users (count)
    `)
    .is('deletion_pending_at', null)
    .order('created_at', { ascending: false });

  if (!isMissingColumnError(withStatus.error)) {
    return withStatus;
  }

  return admin
    .from('tenants')
    .select(`
      id,
      name,
      created_at,
      subscription_tier,
      subscription_status,
      settings,
      tenant_users (count)
    `)
    .is('deletion_pending_at', null)
    .order('created_at', { ascending: false });
}

export async function GET() {
  try {
    await requirePlatformSuperAdmin();
    const admin = createSupabaseAdminClient();

    const { data, error } = await listTenants(admin);
    if (error) throw error;

    const tenants = (data || []).map((tenant: Record<string, unknown>) => ({
      id: tenant.id,
      name: tenant.name,
      status: mapSubscriptionToStatus(tenant.subscription_status, tenant.status),
      createdAt: tenant.created_at,
      userCount: (tenant.tenant_users as { count: number }[])?.[0]?.count || 0,
      subscription: tenant.subscription_tier || 'free',
      settings: tenant.settings,
    }));

    return NextResponse.json({ success: true, tenants });
  } catch (err) {
    return routeErrorResponse(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { user } = await requirePlatformSuperAdmin();
    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const subscriptionStatus =
      parsed.data.status === 'suspended'
        ? 'suspended'
        : parsed.data.status === 'trial'
          ? 'trialing'
          : parsed.data.status === 'inactive'
            ? 'inactive'
            : 'active';

    // Write both status (when present) and subscription_status (canonical billing field)
    let { error } = await admin
      .from('tenants')
      .update({
        status: parsed.data.status,
        subscription_status: subscriptionStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', parsed.data.tenantId);

    if (isMissingColumnError(error)) {
      ({ error } = await admin
        .from('tenants')
        .update({
          subscription_status: subscriptionStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', parsed.data.tenantId));
    }

    if (error) throw error;

    await logPlatformAdminAction({
      adminUserId: user.id,
      tenantId: parsed.data.tenantId,
      eventType: 'PLATFORM_ADMIN_TENANT_STATUS_UPDATE',
      eventDetails: { status: parsed.data.status, subscription_status: subscriptionStatus },
      severity: parsed.data.status === 'suspended' ? 'warning' : 'info',
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return routeErrorResponse(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { user } = await requirePlatformSuperAdmin();
    const body = await req.json();
    const parsed = deleteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    let { error } = await admin
      .from('tenants')
      .update({
        deletion_pending_at: new Date().toISOString(),
        subscription_status: 'suspended',
        status: 'suspended',
        updated_at: new Date().toISOString(),
      })
      .eq('id', parsed.data.tenantId);

    if (isMissingColumnError(error)) {
      ({ error } = await admin
        .from('tenants')
        .update({
          deletion_pending_at: new Date().toISOString(),
          subscription_status: 'suspended',
          updated_at: new Date().toISOString(),
        })
        .eq('id', parsed.data.tenantId));
    }

    if (error) throw error;

    await logPlatformAdminAction({
      adminUserId: user.id,
      tenantId: parsed.data.tenantId,
      eventType: 'PLATFORM_ADMIN_TENANT_DELETE_SCHEDULED',
      severity: 'critical',
      eventDetails: { tenantId: parsed.data.tenantId },
    });

    return NextResponse.json({ success: true, message: 'Tenant scheduled for deletion' });
  } catch (err) {
    return routeErrorResponse(err);
  }
}
