import { readConnectedAccount, isMissingStripeAccount } from '@/lib/stripeConnectAccount';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const tenantId = z.string().uuid().parse(req.nextUrl.searchParams.get('tenantId'));
    const { admin } = await requireTenantAccess(tenantId);
    const { data: tenant, error } = await admin.from('tenants')
      .select('stripe_connect_id').eq('id', tenantId).single();
    if (error) throw error;
    if (!tenant?.stripe_connect_id) {
      return NextResponse.json({ connected: false, chargesEnabled: false, payoutsEnabled: false, requirements: [] });
    }
    let state;
    try { state = await readConnectedAccount(String(tenant.stripe_connect_id)); }
    catch (error) {
      if (!isMissingStripeAccount(error)) throw error;
      return NextResponse.json({ connected: false, reconnectRequired: true, chargesEnabled: false, payoutsEnabled: false, requirements: [] });
    }
    const { error: updateError } = await admin.from('tenants').update({ stripe_connect_onboarded: state.chargesEnabled }).eq('id', tenantId);
    if (updateError) throw updateError;
    return NextResponse.json({ connected: state.chargesEnabled, accountId: state.id,
      reconnectRequired: state.closed, chargesEnabled: state.chargesEnabled, payoutsEnabled: state.payoutsEnabled, requirements: state.requirements });
  } catch (error) {
    return routeErrorResponse(error, 'Stripe Connect status could not be loaded', req);
  }
}
