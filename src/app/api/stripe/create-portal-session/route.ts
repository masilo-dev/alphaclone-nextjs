import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { requireTenantRole, routeErrorResponse } from '@/lib/apiAuth';
import { z } from 'zod';

export async function POST(req: Request) {
    try {
        const { tenantId, returnUrl } = z.object({ tenantId: z.string().uuid(), returnUrl: z.string().url().optional() }).parse(await req.json());
        await requireTenantRole(tenantId, ['owner', 'admin', 'tenant_admin', 'super_admin']);

        // Get the tenant to find the Stripe Customer ID
        // Note: We need to store stripe_customer_id in our DB. 
        // Let's check if it exists or add it.
        const admin = createSupabaseAdminClient();
        const { data: tenant } = await admin
            .from('tenants')
            .select('stripe_customer_id')
            .eq('id', tenantId)
            .single();

        if (!tenant?.stripe_customer_id) {
            return NextResponse.json({ error: 'No Stripe customer found for this tenant' }, { status: 404 });
        }

        const session = await stripe.billingPortal.sessions.create({
            customer: tenant.stripe_customer_id,
            return_url: returnUrl && new URL(returnUrl).origin === new URL(req.url).origin
                ? returnUrl
                : `${new URL(req.url).origin}/dashboard/settings`,
        });

        return NextResponse.json({ url: session.url });
    } catch (err: any) {
        console.error('Stripe Portal Error:', err);
        return routeErrorResponse(err, 'Stripe billing portal is unavailable', req);
    }
}
