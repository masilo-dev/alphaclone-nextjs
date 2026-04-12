import { NextResponse } from 'next/server';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import { stripe } from '@/lib/stripe';
import { supabase } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';
import { ENV } from '@/config/env';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const { tenantId } = await req.json();

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

        const isSuperAdmin = profile?.role === 'admin';

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
            .select('stripe_connect_id, admin_user_id')
            .eq('id', tenantId)
            .single();

        if (tenantError || !tenant?.stripe_connect_id) {
            return NextResponse.json({ error: 'Connect account not found' }, { status: 404 });
        }

        // Allow access if user is Super Admin OR belongs to the tenant
        if (!isSuperAdmin && !belongsToTenant) {
            return NextResponse.json({ error: 'Forbidden: Must be part of the business' }, { status: 403 });
        }

        const loginLink = await stripe.accounts.createLoginLink(tenant.stripe_connect_id);

        return NextResponse.json({ url: loginLink.url });

    } catch (error: any) {
        console.error('Stripe Connect login error:', error);
        return clientErrorResponse(error, { request: req, scope: 'stripe/connect/login' });
    }
}
