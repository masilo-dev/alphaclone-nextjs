import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { supabase } from '@/lib/supabase';
import { tenantService } from '@/services/tenancy/TenantService';

export async function POST(req: Request) {
    try {
        const { tenantId, action } = await req.json();

        if (!tenantId || !action) {
            return NextResponse.json({ error: 'Missing tenantId or action' }, { status: 400 });
        }

        // Get tenant to find Stripe Customer ID
        const tenant = await tenantService.getTenant(tenantId);

        if (!tenant || !tenant.stripe_customer_id) {
            return NextResponse.json({ error: 'Tenant not found or no Stripe customer linked' }, { status: 404 });
        }

        // Find active subscription
        const subscriptions = await stripe.subscriptions.list({
            customer: tenant.stripe_customer_id,
            status: 'active',
            limit: 1,
        });

        if (subscriptions.data.length === 0) {
            return NextResponse.json({ error: 'No active subscription found' }, { status: 404 });
        }

        const subscription = subscriptions.data[0];

        if (action === 'cancel_at_period_end') {
            // Update Stripe Subscription to cancel at period end
            const updatedSub = await stripe.subscriptions.update(subscription.id, {
                cancel_at_period_end: true,
            });

            // Update Database (redundant if webhook handles it, but good for immediate UI feedback)
            await tenantService.toggleCancelAtPeriodEnd(tenantId, true);

            return NextResponse.json({
                status: 'success',
                cancel_at_period_end: true,
                current_period_end: new Date((updatedSub as any).current_period_end * 1000).toISOString()
            });
        }

        if (action === 'resume') {
            // Resume subscription (turn off cancel at period end)
            const updatedSub = await stripe.subscriptions.update(subscription.id, {
                cancel_at_period_end: false,
            });

            await tenantService.toggleCancelAtPeriodEnd(tenantId, false);

            return NextResponse.json({
                status: 'success',
                cancel_at_period_end: false
            });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error: any) {
        console.error('Manage Subscription Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
