import { NextResponse } from 'next/server';
import { z } from 'zod';
import { stripe } from '@/lib/stripe';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { requireTenantRole, routeErrorResponse } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { tenantId } = z.object({ tenantId: z.string().uuid() }).parse(await req.json());
    await requireTenantRole(tenantId, ['owner', 'admin', 'tenant_admin', 'super_admin']);
    const admin = createSupabaseAdminClient();
    const { data: tenant, error } = await admin.from('tenants')
      .select('stripe_connect_id').eq('id', tenantId).single();
    if (error || !tenant?.stripe_connect_id) {
      return NextResponse.json({ error: 'Stripe Connect account not found' }, { status: 404 });
    }
    const loginLink = await stripe.accounts.createLoginLink(String(tenant.stripe_connect_id));
    return NextResponse.json({ url: loginLink.url });
  } catch (error) {
    return routeErrorResponse(error, 'Stripe dashboard could not be opened', req);
  }
}
