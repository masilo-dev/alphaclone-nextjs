import { NextResponse } from 'next/server';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import { stripe } from '@/lib/stripe';
import { supabase } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';
import { ENV } from '@/config/env';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const { tenantId, returnUrl, refreshUrl } = await req.json();

        if (!tenantId) {
            return NextResponse.json({ error: 'Missing tenantId' }, { status: 400 });
        }

        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 });
        }
        const token = authHeader.replace('Bearer ', '');

        // Use regular client for auth verification
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Create a service client to bypass RLS and fetch details
        const serviceClient = createClient(
            ENV.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
            process.env.SUPABASE_SERVICE_ROLE_KEY || ''
        );

        // Fetch user profile to check for super admin role
        const { data: profile } = await serviceClient
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        const isSuperAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';

        // Check if user belongs to this tenant in tenant_users table
        const { data: tenantUser } = await serviceClient
            .from('tenant_users')
            .select('id')
            .eq('tenant_id', tenantId)
            .eq('user_id', user.id)
            .maybeSingle();

        const belongsToTenant = !!tenantUser;

        // 1. Get tenant details
        const { data: tenant, error: tenantError } = await serviceClient
            .from('tenants')
            .select('*')
            .eq('id', tenantId)
            .single();

        if (tenantError || !tenant) {
            return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
        }

        // Allow access if user is Super Admin OR belongs to the tenant
        if (!isSuperAdmin && !belongsToTenant) {
            return NextResponse.json({ error: 'Forbidden: Must be part of the business' }, { status: 403 });
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

    } catch (error: unknown) {
        console.error('Stripe Connect onboarding error:', error);
        const internal = error instanceof Error ? error.message : '';
        if (internal.includes('responsibilities of managing losses')) {
            return NextResponse.json(
                {
                    error: 'Compliance required: open your Stripe Dashboard (Settings, Connect, Platform profile) and acknowledge platform responsibilities for connected accounts.',
                    code: 'STRIPE_CONNECT_COMPLIANCE',
                },
                { status: 400 }
            );
        }
        return clientErrorResponse(error, { request: req, scope: 'stripe/connect/onboarding.POST' });
    }
}
