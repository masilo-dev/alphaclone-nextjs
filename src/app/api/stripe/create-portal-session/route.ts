import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
    try {
        const { tenantId, returnUrl } = await req.json();

        if (!tenantId) {
            return NextResponse.json({ error: 'Missing tenantId' }, { status: 400 });
        }

        // Get the tenant to find the Stripe Customer ID
        // Note: We need to store stripe_customer_id in our DB. 
        // Let's check if it exists or add it.
        const { data: tenant } = await supabase
            .from('tenants')
            .select('stripe_customer_id')
            .eq('id', tenantId)
            .single();

        if (!tenant?.stripe_customer_id) {
            return NextResponse.json({ error: 'No Stripe customer found for this tenant' }, { status: 404 });
        }

        const session = await stripe.billingPortal.sessions.create({
            customer: tenant.stripe_customer_id,
            return_url: returnUrl || `${req.headers.get('origin')}/dashboard/settings`,
        });

        return NextResponse.json({ url: session.url });
    } catch (err: any) {
        console.error('Stripe Portal Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
