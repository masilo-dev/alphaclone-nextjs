import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';

type Context = { params: Promise<{ tenantId: string }> };
export async function GET(req: NextRequest, context: Context) {
  try {
    const { tenantId } = await context.params;
    await requireTenantAccess(tenantId);
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.from('subscription_addons').select('id, addon_type, addon_name, quantity, billing_cycle, status, activated_at')
      .eq('tenant_id', tenantId).eq('status', 'active').order('activated_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ addons: data || [] });
  } catch (error) {
    return routeErrorResponse(error, 'Add-ons could not be loaded', req);
  }
}
