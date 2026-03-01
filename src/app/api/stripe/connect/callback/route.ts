import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { supabase } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';
import { ENV } from '@/config/env';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const tenantId = searchParams.get('tenantId');

        if (!tenantId) {
            return NextResponse.json({ error: 'Missing tenantId parameter' }, { status: 400 });
        }

        // Create a service client to bypass RLS and fetch the tenant details
        const serviceClient = createClient(
            ENV.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
            process.env.SUPABASE_SERVICE_ROLE_KEY || ''
        );

        // 1. Get tenant details
        const { data: tenant, error: tenantError } = await serviceClient
            .from('tenants')
            .select('*')
            .eq('id', tenantId)
            .single();

        if (tenantError || !tenant) {
            return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
        }

        if (!tenant.stripe_connect_id) {
            return NextResponse.json({ error: 'Tenant does not have a Stripe Connect account ID' }, { status: 400 });
        }

        // 2. Retrieve the connect account status
        const account = await stripe.accounts.retrieve(tenant.stripe_connect_id);

        // 3. Check if onboarding is complete (details submitted and charges enabled)
        const isOnboarded = account.details_submitted && account.charges_enabled;

        // 4. Update the tenant record
        await serviceClient
            .from('tenants')
            .update({ stripe_connect_onboarded: isOnboarded })
            .eq('id', tenantId);

        // 5. Redirect back to settings
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
        return NextResponse.redirect(`${appUrl}/dashboard?tab=billing&connect=${isOnboarded ? 'success' : 'incomplete'}`);

    } catch (error: any) {
        console.error('Stripe Connect callback error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}
