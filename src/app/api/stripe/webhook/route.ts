import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { supabase } from '@/lib/supabase';
import { headers } from 'next/headers';
import { emailProviderService } from '@/services/EmailProviderService';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

/**
 * Check if webhook event was already processed (idempotency)
 */
async function isEventProcessed(eventId: string): Promise<boolean> {
    const { data } = await supabase
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
    event: any,
    tenantId?: string,
    status: 'processed' | 'failed' = 'processed',
    error?: string
): Promise<void> {
    const session = event.data.object as any;

    await supabase.from('stripe_webhook_events').insert({
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
    await supabase.from('audit_logs').insert({
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
    paymentIntentId: string,
    tenantId: string,
    customerId: string,
    amountCents: number,
    currency: string = 'usd',
    status: string = 'succeeded',
    description?: string
): Promise<void> {
    await supabase.from('stripe_payments').insert({
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

    let event;

    // Step 1: Verify webhook signature
    try {
        if (!webhookSecret) {
            throw new Error('STRIPE_WEBHOOK_SECRET is missing');
        }
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err: any) {
        console.error(`Webhook signature verification failed: ${err.message}`);
        return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
    }

    // Step 2: Check idempotency - has this event been processed before?
    try {
        const alreadyProcessed = await isEventProcessed(event.id);
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
                tenantId = session.metadata?.tenantId;
                if (tenantId) {
                    const subscription = await stripe.subscriptions.retrieve(session.subscription);

                    // Update tenant subscription
                    await supabase
                        .from('tenants')
                        .update({
                            subscription_status: 'active',
                            stripe_customer_id: session.customer,
                            current_period_end: new Date((subscription as any).current_period_end * 1000).toISOString(),
                        })
                        .eq('id', tenantId);

                    // Record payment
                    if (session.amount_total) {
                        await recordPayment(
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
                    const { data: tenant } = await supabase
                        .from('tenants')
                        .select('admin_user_id, name')
                        .eq('id', tenantId)
                        .single();

                    if (tenant?.admin_user_id) {
                        const { data: user } = await supabase
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
                        await supabase
                            .from('tenants')
                            .update({
                                subscription_status: 'active',
                                current_period_end: new Date((subscription as any).current_period_end * 1000).toISOString(),
                            })
                            .eq('id', tenantId);

                        // Record payment for reconciliation
                        if (session.amount_paid) {
                            await recordPayment(
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
                        await supabase
                            .from('tenants')
                            .update({
                                subscription_status: 'past_due',
                            })
                            .eq('id', tenantId);

                        // Record failed payment
                        if (session.amount_due) {
                            await recordPayment(
                                session.payment_intent || session.id,
                                tenantId,
                                session.customer,
                                session.amount_due,
                                session.currency || 'usd',
                                'failed',
                                `Payment failed: ${session.id}`
                            );
                        }

                        // TODO: Send payment failed notification email
                        console.log(`Tenant ${tenantId} payment failed.`);
                    }
                }
                break;
            }

            case 'customer.subscription.deleted': {
                tenantId = session.metadata?.tenantId;
                if (tenantId) {
                    await supabase
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
                        'unpaid': 'suspended',
                        'trialing': 'trial',
                    };

                    await supabase
                        .from('tenants')
                        .update({
                            subscription_status: statusMap[session.status] || 'suspended',
                            current_period_end: new Date(session.current_period_end * 1000).toISOString(),
                        })
                        .eq('id', tenantId);

                    console.log(`Tenant ${tenantId} subscription updated to ${session.status}.`);
                }
                break;
            }

            case 'charge.refunded': {
                // Handle refunds
                const charge = session;
                if (charge.payment_intent) {
                    await supabase
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
        await recordWebhookEvent(event, tenantId, 'processed');

        return NextResponse.json({ received: true, status: 'processed' });
    } catch (err: any) {
        console.error('Webhook processing error:', err);

        // Record failed webhook processing
        try {
            await recordWebhookEvent(event, tenantId, 'failed', err.message);
        } catch (recordErr) {
            console.error('Failed to record webhook error:', recordErr);
        }

        // Return 500 so Stripe will retry
        return NextResponse.json({ error: 'Webhook processing failed', message: err.message }, { status: 500 });
    }
}
