import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const { tenantId, returnUrl, refreshUrl } = await req.json();

        if (!tenantId) {
            return NextResponse.json({ error: 'Missing tenantId' }, { status: 400 });
        }

        // 1. Get tenant details and check permissions
        const { data: tenant, error: tenantError } = await supabase
            .from('tenants')
            .select('*')
            .eq('id', tenantId)
            .single();

        if (tenantError || !tenant) {
            return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
        }

        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 });
        }
        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (tenant.admin_user_id !== user.id) {
            return NextResponse.json({ error: 'Forbidden: Must be tenant admin' }, { status: 403 });
        }

        let stripeAccountId = tenant.stripe_connect_id;
        const country = tenant.country_code || 'US';

        // 2. Create Stripe account if it doesn't exist
        if (!stripeAccountId) {
            const account = await stripe.accounts.create({
                type: 'express',
                country,
                email: tenant.billing_email || undefined,
                capabilities: {
                    card_payments: { requested: true },
                    transfers: { requested: true },
                },
                metadata: {
                    tenantId,
                    type: 'business_connect'
                }
            });

            stripeAccountId = account.id;

            // Update tenant with the new Stripe account ID
            await supabase
                .from('tenants')
                .update({ stripe_connect_id: stripeAccountId })
                .eq('id', tenantId);
        }

        // 3. Create Account Link for onboarding
        const accountLink = await stripe.accountLinks.create({
            account: stripeAccountId,
            refresh_url: refreshUrl || `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?section=billing&connect=refresh`,
            return_url: returnUrl || `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?section=billing&connect=success`,
            type: 'account_onboarding',
        });

        return NextResponse.json({ url: accountLink.url });

    } catch (error: any) {
        console.error('Stripe Connect onboarding error:', error);
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: 500 }
        );
    }
}
