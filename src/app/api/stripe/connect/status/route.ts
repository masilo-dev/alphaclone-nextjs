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
      .select('stripe_connect_id, stripe_connect_pending_id, stripe_connect_pending_previous_id').eq('id', tenantId).single();
    if (error) throw error;
    if (tenant?.stripe_connect_pending_id) {
      try {
        const pending = await readConnectedAccount(String(tenant.stripe_connect_pending_id));
        if (!pending.closed && pending.chargesEnabled) {
          const { error: promoteError } = await admin.from('tenants').update({
            stripe_connect_id: pending.id,
            stripe_connect_onboarded: true,
            stripe_connect_pending_id: null,
            stripe_connect_pending_previous_id: null,
          }).eq('id', tenantId).eq('stripe_connect_pending_id', pending.id);
          if (promoteError) throw promoteError;
          return NextResponse.json({
            connected: true, accountId: pending.id,
            accountDisplayName: (pending.account as any).display_name || null,
            country: (pending.account as any).identity?.country || null,
            chargesEnabled: pending.chargesEnabled, payoutsEnabled: pending.payoutsEnabled,
            requirements: pending.requirements, replacementActivated: true,
          });
        }
      } catch (pendingError) {
        if (!isMissingStripeAccount(pendingError)) throw pendingError;
        await admin.from('tenants').update({ stripe_connect_pending_id: null, stripe_connect_pending_previous_id: null }).eq('id', tenantId);
      }
    }
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
    return NextResponse.json({
      connected: state.chargesEnabled,
      accountId: state.id,
      accountDisplayName: (state.account as any).display_name || null,
      country: (state.account as any).identity?.country || null,
      dashboardType: state.dashboard || null,
      reconnectRequired: state.closed,
      chargesEnabled: state.chargesEnabled,
      payoutsEnabled: state.payoutsEnabled,
      requirements: state.requirements,
      replacementPending: Boolean(tenant.stripe_connect_pending_id),
    });
  } catch (error) {
    return routeErrorResponse(error, 'Stripe Connect status could not be loaded', req);
  }
}
