import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { stripe } from '@/lib/stripe';
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
    const account = await stripe.accounts.retrieve(String(tenant.stripe_connect_id));
    if (account.deleted) return NextResponse.json({ connected: false, chargesEnabled: false, payoutsEnabled: false, requirements: [] });
    const connected = Boolean(account.details_submitted && account.charges_enabled);
    await admin.from('tenants').update({ stripe_connect_onboarded: connected }).eq('id', tenantId);
    return NextResponse.json({
      connected,
      accountId: account.id,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      requirements: account.requirements?.currently_due || [],
    });
  } catch (error) {
    return routeErrorResponse(error, 'Stripe Connect status could not be loaded', req);
  }
}
