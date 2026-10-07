import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { requireTenantRole, routeErrorResponse } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';
const adminRoles = ['owner', 'admin', 'tenant_admin', 'super_admin'];

export async function POST(req: Request) {
  try {
    const { tenantId } = z.object({ tenantId: z.string().uuid() }).parse(await req.json());
    const { user } = await requireTenantRole(tenantId, adminRoles);
    const admin = createSupabaseAdminClient();
    const { data: tenant, error } = await admin.from('tenants')
      .select('stripe_connect_id, stripe_connect_pending_id').eq('id', tenantId).single();
    if (error) throw error;
    const accountId = tenant?.stripe_connect_id ? String(tenant.stripe_connect_id) : '';
    if (!accountId && !tenant?.stripe_connect_pending_id) return NextResponse.json({ disconnected: true });

    // Detach AlphaClone from this account. Do not delete/close the Stripe account:
    // it belongs to the tenant and historical provider objects must remain intact.
    const { error: updateError } = await admin.from('tenants')
      .update({ stripe_connect_id: null, stripe_connect_onboarded: false, stripe_connect_pending_id: null, stripe_connect_pending_previous_id: null })
      .eq('id', tenantId);
    if (updateError) throw updateError;

    await admin.from('business_automation_events').insert({
      tenant_id: tenantId,
      event_type: 'stripe_connect_disconnected',
      payload: { actorUserId: user.id, accountId, disconnectedAt: new Date().toISOString() },
    });
    return NextResponse.json({ disconnected: true });
  } catch (error) {
    return routeErrorResponse(error, 'Stripe account could not be disconnected', req);
  }
}
