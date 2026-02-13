import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const { tenantId } = await req.json();

        if (!tenantId) {
            return NextResponse.json({ error: 'Missing tenantId' }, { status: 400 });
        }

        const { data: tenant, error: tenantError } = await supabase
            .from('tenants')
            .select('stripe_connect_id')
            .eq('id', tenantId)
            .single();

        if (tenantError || !tenant?.stripe_connect_id) {
            return NextResponse.json({ error: 'Connect account not found' }, { status: 404 });
        }

        const loginLink = await stripe.accounts.createLoginLink(tenant.stripe_connect_id);

        return NextResponse.json({ url: loginLink.url });

    } catch (error: any) {
        console.error('Stripe Connect login error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}
