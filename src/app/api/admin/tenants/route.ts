import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { requirePlatformSuperAdmin, routeErrorResponse } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

const deleteSchema = z.object({
  tenantId: z.string().uuid(),
});

export async function GET() {
  try {
    await requirePlatformSuperAdmin();
    const admin = createSupabaseAdminClient();

    const { data, error } = await admin
      .from('tenants')
      .select(`
        id,
        name,
        status,
        created_at,
        subscription_tier,
        settings,
        tenant_users (count)
      `)
      .is('deletion_pending_at', null)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const tenants = (data || []).map((tenant: Record<string, unknown>) => ({
      id: tenant.id,
      name: tenant.name,
      status: tenant.status || 'active',
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

export async function DELETE(req: NextRequest) {
  try {
    await requirePlatformSuperAdmin();
    const body = await req.json();
    const parsed = deleteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const { error } = await admin
      .from('tenants')
      .update({
        deletion_pending_at: new Date().toISOString(),
        subscription_status: 'suspended',
        updated_at: new Date().toISOString(),
      })
      .eq('id', parsed.data.tenantId);

    if (error) throw error;
    return NextResponse.json({ success: true, message: 'Tenant scheduled for deletion' });
  } catch (err) {
    return routeErrorResponse(err);
  }
}
