import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { headers } from 'next/headers';
import { emailProviderService } from '@/services/EmailProviderService';
import { invoiceServerService } from '@/services/server/invoiceServerService';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

/**
 * Check if webhook event was already processed (idempotency)
 */
async function isEventProcessed(supabaseAdmin: any, eventId: string): Promise<boolean> {
    const { data } = await supabaseAdmin
        .from('stripe_webhook_events')
        .select('id')
        .eq('stripe_event_id', eventId)
        .eq('status', 'processed')
        .single();

    return !!data;
}

/**
 * Record webhook event for idempotency and auditing
 */
async function recordWebhookEvent(
    supabaseAdmin: any,
    event: any,
    tenantId?: string,
    status: 'processed' | 'failed' = 'processed',
    error?: string
): Promise<void> {
    const session = event.data.object as any;

    await supabaseAdmin.from('stripe_webhook_events').insert({
        stripe_event_id: event.id,
        event_type: event.type,
        api_version: event.api_version,
        created_at_stripe: new Date(event.created * 1000).toISOString(),
        event_data: event,
        status,
        tenant_id: tenantId,
        customer_id: session.customer || null,
        subscription_id: session.subscription || session.id || null,
        processing_attempts: 1,
        last_error: error || null,
    });

    // Also log to audit_logs for tracking
    await supabaseAdmin.from('audit_logs').insert({
        action: `stripe_webhook_${event.type}`,
        resource_type: 'payment',
        resource_id: event.id,
        metadata: {
            event_type: event.type,
            tenant_id: tenantId,
            status,
            error: error || null,
        },
        created_at: new Date().toISOString(),
    });
}

/**
 * Record payment for reconciliation
 */
async function recordPayment(
    supabaseAdmin: any,
    paymentIntentId: string,
    tenantId: string,
    customerId: string,
    amountCents: number,
    currency: string = 'usd',
    status: string = 'succeeded',
    description?: string
): Promise<void> {
    await supabaseAdmin.from('stripe_payments').insert({
        stripe_payment_intent_id: paymentIntentId,
        tenant_id: tenantId,
        customer_id: customerId,
        amount_cents: amountCents,
        currency: currency.toUpperCase(),
        status,
        description,
        paid_at: status === 'succeeded' ? new Date().toISOString() : null,
    });
}

export async function POST(req: Request) {
    const body = await req.text();
    const headerList = await headers();
    const signature = headerList.get('stripe-signature') as string;
    
    // Initialize Supabase Admin Lazily inside the handler
    const supabaseAdmin = createSupabaseAdminClient();

    let event;


    // Step 1: Verify webhook signature
    try {
        if (!webhookSecret) {
            throw new Error('STRIPE_WEBHOOK_SECRET is missing');
        }
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err: unknown) {
        console.error('Webhook signature verification failed:', err);
        return NextResponse.json({ error: 'Webhook signature verification failed', code: 'STRIPE_WEBHOOK_SIGNATURE' }, { status: 400 });
    }

    // Step 2: Check idempotency - has this event been processed before?
    try {
        const alreadyProcessed = await isEventProcessed(supabaseAdmin, event.id);
        if (alreadyProcessed) {
            console.log(`Event ${event.id} already processed, skipping (idempotent)`);
            return NextResponse.json({ received: true, status: 'already_processed' });
        }
    } catch (err: any) {
        console.error('Idempotency check failed:', err);
        // Continue processing if idempotency check fails (fail open)
    }

    const session = event.data.object as any;
    let tenantId: string | undefined;

    // Step 3: Process webhook event
    try {
        switch (event.type) {
            case 'checkout.session.completed': {
                if (session.metadata?.type === 'business_invoice') {
                    const invoiceId = session.metadata.invoiceId;
                    if (invoiceId) {
                        const { success, error } = await invoiceServerService.markAsPaid(invoiceId);
                        if (!success) {
                            console.error(`Failed to mark invoice ${invoiceId} as paid: ${error}`);
                            throw new Error(error || 'Failed to process invoice payment');
                        }
                        console.log(`Invoice ${invoiceId} marked as paid via webhook.`);
                    }
                    break;
                }

                tenantId = session.metadata?.tenantId;
                if (tenantId) {
                    const subscription = await stripe.subscriptions.retrieve(session.subscription);

                    // Update tenant subscription
                    // Update tenant subscription
                    await supabaseAdmin
                        .from('tenants')
                        .update({
                            subscription_status: 'active',
                            subscription_plan: session.metadata?.plan || 'starter', // Default to starter if metadata missing
                            stripe_customer_id: session.customer,
                            current_period_end: new Date((subscription as any).current_period_end * 1000).toISOString(),
                            trial_ends_at: null, // Clear trial once paid
                        })
                        .eq('id', tenantId);

                    // Record payment
                    if (session.amount_total) {
                        await recordPayment(
                            supabaseAdmin,
                            session.payment_intent || session.id,
                            tenantId,
                            session.customer,
                            session.amount_total,
                            session.currency,
                            'succeeded',
                            `Subscription activated: ${subscription.id}`
                        );
                    }

                    // Send Card Verified Email
                    const { data: tenant } = await supabaseAdmin
                        .from('tenants')
                        .select('admin_user_id, name')
                        .eq('id', tenantId)
                        .single();

                    if (tenant?.admin_user_id) {
                        const { data: user } = await supabaseAdmin
                            .from('profiles')
                            .select('email, name')
                            .eq('id', tenant.admin_user_id)
                            .single();

                        if (user?.email) {
                            await emailProviderService.sendEmail({
                                to: user.email,
                                subject: 'Payment Card Verified - AlphaClone',
                                html: `
                                    <div style="font-family: sans-serif; color: #333;">
                                        <h2>Payment Card Verified</h2>
                                        <p>Hello ${user.name || 'there'},</p>
                                        <p>Your payment card has been successfully verified for <strong>${tenant.name}</strong> on the AlphaClone platform.</p>
                                        <p>Your subscription is now active. You can manage your billing details at any time from your dashboard.</p>
                                        <hr />
                                        <p style="font-size: 0.8em; color: #666;">This is an automated notification. Please do not reply to this email.</p>
                                    </div>
                                `
                            });
                        }
                    }

                    console.log(`Tenant ${tenantId} subscription activated and email sent.`);
                }
                break;
            }

            case 'invoice.paid': {
                const subscriptionId = session.subscription;
                if (subscriptionId) {
                    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
                    tenantId = subscription.metadata?.tenantId;

                    if (tenantId) {
                        // Update tenant subscription
                        await supabaseAdmin
                            .from('tenants')
                            .update({
                                subscription_status: 'active',
                                subscription_plan: subscription.metadata?.plan || 'starter',
                                current_period_end: new Date((subscription as any).current_period_end * 1000).toISOString(),
                                trial_ends_at: null,
                            })
                            .eq('id', tenantId);

                        // Record payment for reconciliation
                        if (session.amount_paid) {
                            await recordPayment(
                                supabaseAdmin,
                                session.payment_intent || session.id,
                                tenantId,
                                session.customer,
                                session.amount_paid,
                                session.currency || 'usd',
                                'succeeded',
                                `Invoice paid: ${session.id}`
                            );
                        }

                        console.log(`Tenant ${tenantId} subscription renewed.`);
                    }
                }
                break;
            }

            case 'invoice.payment_failed': {
                const subscriptionId = session.subscription;
                if (subscriptionId) {
                    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
                    tenantId = subscription.metadata?.tenantId;

                    if (tenantId) {
                        // Mark subscription as past_due
                        // Mark subscription as past_due
                        await supabaseAdmin
                            .from('tenants')
                            .update({
                                subscription_status: 'past_due',
                            })
                            .eq('id', tenantId);

                        // Record failed payment
                        if (session.amount_due) {
                            await recordPayment(
                                supabaseAdmin,
                                session.payment_intent || session.id,
                                tenantId,
                                session.customer,
                                session.amount_due,
                                session.currency || 'usd',
                                'failed',
                                `Payment failed: ${session.id}`
                            );
                        }

                        // Send payment failed notification email
                        // Send payment failed notification email
                        const { data: tenantData } = await supabaseAdmin
                            .from('tenants')
                            .select('admin_user_id, name')
                            .eq('id', tenantId)
                            .single();

                        if (tenantData?.admin_user_id) {
                            const { data: user } = await supabaseAdmin
                                .from('profiles')
                                .select('email, name')
                                .eq('id', tenantData.admin_user_id)
                                .single();

                            if (user?.email) {
                                await emailProviderService.sendEmail({
                                    to: user.email,
                                    subject: 'Payment Failed - Action Required - AlphaClone',
                                    html: `
                                        <div style="font-family: sans-serif; color: #333;">
                                            <h2>Payment Failed</h2>
                                            <p>Hello ${user.name || 'there'},</p>
                                            <p>We attempted to process your subscription payment for <strong>${tenantData.name}</strong> on the AlphaClone platform, but the payment failed.</p>
                                            <p>Your subscription is now past due. Please update your billing details from your dashboard to avoid any service interruption.</p>
                                            <hr />
                                            <p style="font-size: 0.8em; color: #666;">This is an automated notification. Please do not reply to this email.</p>
                                        </div>
                                    `
                                });
                            }
                        }
                        console.log(`Tenant ${tenantId} payment failed.`);
                    }
                }
                break;
            }

            case 'customer.subscription.deleted': {
                tenantId = session.metadata?.tenantId;
                if (tenantId) {
                    await supabaseAdmin
                        .from('tenants')
                        .update({
                            subscription_status: 'cancelled',
                        })
                        .eq('id', tenantId);

                    console.log(`Tenant ${tenantId} subscription cancelled.`);
                }
                break;
            }

            case 'customer.subscription.updated': {
                tenantId = session.metadata?.tenantId;
                if (tenantId) {
                    // Map Stripe subscription status to our status
                    const statusMap: Record<string, string> = {
                        'active': 'active',
                        'past_due': 'past_due',
                        'canceled': 'cancelled',
                        'unpaid': 'past_due',
                        'trialing': 'trial',
                        'incomplete': 'past_due',
                        'incomplete_expired': 'cancelled',
                        'paused': 'suspended',
                    };
                    await supabaseAdmin
                        .from('tenants')
                        .update({
                            subscription_status: statusMap[session.status] || 'suspended',
                            subscription_plan: session.metadata?.plan || 'starter',
                            current_period_end: new Date(session.current_period_end * 1000).toISOString(),
                            trial_ends_at: session.status === 'trialing' ? new Date(session.trial_end * 1000).toISOString() : null,
                        })
                        .eq('id', tenantId);

                    console.log(`Tenant ${tenantId} subscription updated to ${session.status}.`);
                }
                break;
            }

            case 'account.updated': {
                const account = session;
                const tenantId = account.metadata?.tenantId;

                if (tenantId && account.details_submitted) {
                    await supabaseAdmin
                        .from('tenants')
                        .update({
                            stripe_connect_onboarded: true,
                        })
                        .eq('id', tenantId);

                    console.log(`Tenant ${tenantId} Stripe Connect account verified.`);
                }
                break;
            }

            case 'capability.updated': {
                const capability = session;
                // You could handle specific capability updates like card_payments here
                break;
            }

            case 'charge.refunded': {
                // Handle refunds
                const charge = session;
                if (charge.payment_intent) {
                    await supabaseAdmin
                        .from('stripe_payments')
                        .update({
                            status: 'refunded',
                            refund_amount_cents: charge.amount_refunded,
                            refunded_at: new Date().toISOString(),
                        })
                        .eq('stripe_payment_intent_id', charge.payment_intent);

                    console.log(`Payment ${charge.payment_intent} refunded.`);
                }
                break;
            }

            default:
                console.log(`Unhandled event type ${event.type}`);
        }

        // Step 4: Record successful webhook processing
        await recordWebhookEvent(supabaseAdmin, event, tenantId, 'processed');

        return NextResponse.json({ received: true, status: 'processed' });
    } catch (err: unknown) {
        console.error('Webhook processing error:', err);
        const internalNote = err instanceof Error ? err.message : String(err);

        // Record failed webhook processing
        try {
            await recordWebhookEvent(supabaseAdmin, event, tenantId, 'failed', internalNote);
        } catch (recordErr) {
            console.error('Failed to record webhook error:', recordErr);
        }

        // Return 500 so Stripe will retry
        return NextResponse.json({ error: 'Webhook processing failed', code: 'STRIPE_WEBHOOK_PROCESSING' }, { status: 500 });
    }
}
