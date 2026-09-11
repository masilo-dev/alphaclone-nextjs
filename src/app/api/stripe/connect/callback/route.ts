import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { stripe } from '@/lib/stripe';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { requireTenantRole, routeErrorResponse } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const tenantId = z.string().uuid().parse(req.nextUrl.searchParams.get('tenantId'));
    await requireTenantRole(tenantId, ['owner', 'admin', 'tenant_admin', 'super_admin']);
    const admin = createSupabaseAdminClient();
    const { data: tenant, error } = await admin.from('tenants')
      .select('stripe_connect_id').eq('id', tenantId).single();
    if (error || !tenant?.stripe_connect_id) {
      return NextResponse.json({ error: 'Stripe Connect account not found' }, { status: 404 });
    }
    const account = await stripe.accounts.retrieve(String(tenant.stripe_connect_id));
    const onboarded = !account.deleted && Boolean(account.details_submitted && account.charges_enabled);
    await admin.from('tenants').update({ stripe_connect_onboarded: onboarded }).eq('id', tenantId);
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin).replace(/\/$/, '');
    return NextResponse.redirect(`${appUrl}/dashboard/business/settings?tab=integrations&connect=${onboarded ? 'success' : 'incomplete'}`);
  } catch (error) {
    return routeErrorResponse(error, 'Stripe Connect status could not be confirmed', req);
  }
}
