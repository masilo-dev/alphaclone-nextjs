import { stripeAmountToInvoice } from '@/lib/stripeInvoiceCurrency';
import { verifyStripePlatformIdentity } from '@/lib/stripePlatformIdentity';
import { redactStripeEvent } from '@/lib/stripePaymentPolicy';
import { readConnectedAccount } from '@/lib/stripeConnectAccount';
import { reconcileInvoiceStripePayment } from '@/lib/stripeInvoiceExecution';
import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { resolveVerifiedWebhookTenant } from '@/lib/events/webhookTenant';



async function claimWebhookEvent(supabaseAdmin: any, event: any): Promise<boolean> {
    const session = event.data.object as any;
    const row = {
        stripe_event_id: event.id,
        event_type: event.type,
        api_version: event.api_version,
        created_at_stripe: new Date(event.created * 1000).toISOString(),
        event_data: redactStripeEvent(event),
        status: 'retrying',
        customer_id: session.customer || null,
        subscription_id: session.subscription || session.id || null,
        processing_attempts: 1,
    };
    const inserted = await supabaseAdmin.from('stripe_webhook_events').insert(row).select('id').maybeSingle();
    if (!inserted.error && inserted.data) return true;
    if (inserted.error?.code !== '23505') throw inserted.error;

    const staleBefore = new Date(Date.now() - 15 * 60_000).toISOString();
    const retried = await supabaseAdmin
        .from('stripe_webhook_events')
        .update({ status: 'retrying', last_error: null, updated_at: new Date().toISOString() })
        .eq('stripe_event_id', event.id)
        .or(`status.eq.failed,and(status.eq.retrying,updated_at.lt.${staleBefore})`)
        .select('id, processing_attempts')
        .maybeSingle();
    if (retried.error) throw retried.error;
    if (!retried.data) return false;
    await supabaseAdmin.from('stripe_webhook_events').update({ processing_attempts: Number(retried.data.processing_attempts || 1) + 1 }).eq('id', retried.data.id);
    return true;
}

async function finishWebhookEvent(
    supabaseAdmin: any,
    event: any,
    tenantId?: string,
    status: 'processed' | 'failed' = 'processed',
    error?: string
): Promise<void> {
    const { error: updateError } = await supabaseAdmin.from('stripe_webhook_events').update({
        status,
        tenant_id: tenantId,
        last_error: error || null,
        processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    }).eq('stripe_event_id', event.id);
    if (updateError) throw updateError;

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
    const { error } = await supabaseAdmin.from('stripe_payments').upsert({
        stripe_payment_intent_id: paymentIntentId,
        tenant_id: tenantId,
        customer_id: customerId,
        amount_cents: amountCents,
        currency: currency.toUpperCase(),
        status,
        description,
        paid_at: status === 'succeeded' ? new Date().toISOString() : null,
    }, { onConflict: 'stripe_payment_intent_id', ignoreDuplicates: true });
    if (error) throw error;
}

export async function POST(req: Request) {
    const body = await req.text();
    const signature = req.headers.get('stripe-signature') || '';
    

    let event;


    // Step 1: Verify webhook signature
    try {
        const secrets = [process.env.STRIPE_WEBHOOK_SECRET, process.env.STRIPE_CONNECT_WEBHOOK_SECRET].filter(Boolean) as string[];
        if (!secrets.length) {
            throw new Error('STRIPE_WEBHOOK_SECRET is missing');
        }
        for (const secret of secrets) {
            try { event = stripe.webhooks.constructEvent(body, signature, secret); break; } catch { /* Try the other endpoint signing secret. */ }
        }
        if (!event) throw new Error('Invalid signature');
        if (process.env.NODE_ENV === 'production' && !event.livemode) throw new Error('Test events are not accepted in production');
    } catch (err: unknown) {
        console.error('Webhook signature verification failed');
        return NextResponse.json({ error: 'Webhook signature verification failed', code: 'STRIPE_WEBHOOK_SIGNATURE' }, { status: 400 });
    }

    const supabaseAdmin = createSupabaseAdminClient();

    // Step 2: Atomically claim this event before performing side effects.
    try {
        const claimed = await claimWebhookEvent(supabaseAdmin, event);
        if (!claimed) {
            console.log(`Event ${event.id} is already processed or in progress, skipping.`);
            const { data: existing } = await supabaseAdmin.from('stripe_webhook_events').select('status').eq('stripe_event_id', event.id).single();
            return NextResponse.json({ received: true, status: existing?.status === 'processed' ? 'already_processed' : 'in_progress' },
                { status: existing?.status === 'processed' ? 200 : 503 });
        }
    } catch (err) {
        console.error('Webhook claim failed:', err);
        return NextResponse.json({ error: 'Webhook idempotency unavailable', code: 'STRIPE_WEBHOOK_CLAIM' }, { status: 503 });
    }

    const session = event.data.object as any;
    let tenantId: string | undefined;

    // Step 3: Process webhook event
    try {
        await verifyStripePlatformIdentity();
        if (event.account) {
            const { data: tenant, error: mappingError } = await supabaseAdmin.from('tenants').select('id')
                .eq('stripe_connect_id', event.account).maybeSingle();
            if (mappingError || !tenant) throw mappingError || new Error('Unknown connected Stripe account');
            tenantId = tenant.id;
            if (session.metadata?.tenantId && session.metadata.tenantId !== tenantId) throw new Error('Connected event tenant mismatch');
            await processConnectEvent(supabaseAdmin, event, tenant.id);
            await finishWebhookEvent(supabaseAdmin, event, tenantId, 'processed');
            return NextResponse.json({ received: true, status: 'processed' });
        }
        if (['checkout.session.completed', 'checkout.session.async_payment_succeeded', 'invoice.paid', 'invoice.payment_failed',
            'customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted'].includes(event.type)) {
            const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
            if (!customerId) throw new Error('Platform event has no customer mapping');
            const { data: tenant, error: mappingError } = await supabaseAdmin.from('tenants').select('id')
                .eq('stripe_customer_id', customerId).maybeSingle();
            if (mappingError || !tenant) throw mappingError || new Error('Unknown platform billing customer');
            tenantId = tenant.id;
            if (session.metadata?.tenantId && session.metadata.tenantId !== tenantId) throw new Error('Platform event tenant mismatch');
            session.metadata = { ...session.metadata, tenantId };
        }
        switch (event.type) {
            case 'checkout.session.async_payment_succeeded':
            case 'checkout.session.completed': {
                if (session.payment_status !== 'paid' && session.payment_status !== 'no_payment_required') break;
                if (session.metadata?.type === 'addon') {
                    const claimedTenantId = session.metadata.tenantId;
                    const { data: tenant } = await supabaseAdmin.from('tenants').select('id').eq('id', claimedTenantId).maybeSingle();
                    tenantId = resolveVerifiedWebhookTenant({
                        mappedTenantId: tenant?.id,
                        claimedTenantId,
                        provider: 'stripe',
                    });
                    const addonType = session.metadata.addonType;
                    if (!tenantId || !addonType || session.payment_status === 'unpaid') throw new Error('Add-on checkout metadata is incomplete');
                    const { error: addonError } = await supabaseAdmin.from('subscription_addons').upsert({
                        tenant_id: tenantId,
                        addon_type: addonType,
                        addon_name: session.metadata.addonName,
                        quantity: Number(session.metadata.quantity),
                        price_cents: Number(session.metadata.priceCents),
                        billing_cycle: session.metadata.billingCycle,
                        status: 'active',
                        stripe_checkout_session_id: session.id,
                        stripe_subscription_id: session.subscription || null,
                        activated_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    }, { onConflict: 'tenant_id,addon_type' });
                    if (addonError) throw addonError;
                    await supabaseAdmin.from('business_automation_events').insert({
                        tenant_id: tenantId, event_type: 'subscription_addon_activated', payload: { addonType, stripeSessionId: session.id },
                    });
                    break;
                }
                if (['legacy_invoice', 'business_invoice'].includes(session.metadata?.type)) throw new Error('Tenant invoice events require a connected account');

                tenantId = session.metadata?.tenantId;
                if (tenantId) {
                    if (session.metadata?.type !== 'platform_subscription') throw new Error('Unknown platform checkout type');
                    const subscription = await stripe.subscriptions.retrieve(session.subscription);
                    if (subscription.metadata.tenantId !== tenantId || subscription.metadata.type !== 'platform_subscription') throw new Error('Subscription mapping mismatch');

                    // Update tenant subscription
                    const { error: tenantUpdateError } = await supabaseAdmin
                        .from('tenants')
                        .update({
                            subscription_status: 'active',
                            subscription_plan: session.metadata?.plan || 'starter', // Default to starter if metadata missing
                            stripe_customer_id: session.customer,
                            stripe_subscription_id: session.subscription || null,
                            current_period_end: stripePeriodEnd(subscription),
                            trial_ends_at: null, // Clear trial once paid
                        })
                        .eq('id', tenantId);
                    if (tenantUpdateError) throw tenantUpdateError;

                }
                break;
            }

            case 'invoice.paid': {
                const subscriptionId = session.subscription || session.parent?.subscription_details?.subscription;
                if (subscriptionId) {
                    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
                    if (subscription.metadata?.tenantId !== tenantId) throw new Error('Subscription tenant mapping mismatch');
                    tenantId = subscription.metadata?.tenantId;

                    if (tenantId) {
                        if (subscription.metadata?.type === 'addon') {
                            await supabaseAdmin.from('subscription_addons').update({ status: 'active', updated_at: new Date().toISOString() })
                                .eq('tenant_id', tenantId).eq('addon_type', subscription.metadata.addonType);
                            if (session.amount_paid) await recordPayment(supabaseAdmin, session.payment_intent || session.id, tenantId, session.customer, session.amount_paid, session.currency || 'usd', 'succeeded', `Add-on invoice paid: ${session.id}`);
                            break;
                        }
                        // Update tenant subscription
                        const { error: tenantUpdateError } = await supabaseAdmin
                            .from('tenants')
                            .update({
                                subscription_status: 'active',
                                subscription_plan: subscription.metadata?.plan || 'starter',
                                current_period_end: stripePeriodEnd(subscription),
                                trial_ends_at: null,
                            })
                            .eq('id', tenantId);
                        if (tenantUpdateError) throw tenantUpdateError;

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
                const subscriptionId = session.subscription || session.parent?.subscription_details?.subscription;
                if (subscriptionId) {
                    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
                    if (subscription.metadata?.tenantId !== tenantId) throw new Error('Subscription tenant mapping mismatch');
                    tenantId = subscription.metadata?.tenantId;

                    if (tenantId) {
                        if (subscription.metadata?.type === 'addon') {
                            await supabaseAdmin.from('subscription_addons').update({ status: 'cancelled', updated_at: new Date().toISOString() })
                                .eq('tenant_id', tenantId).eq('addon_type', subscription.metadata.addonType);
                            if (session.amount_due) await recordPayment(supabaseAdmin, session.payment_intent || session.id, tenantId, session.customer, session.amount_due, session.currency || 'usd', 'failed', `Add-on payment failed: ${session.id}`);
                            break;
                        }
                        // Mark subscription as past_due
                        // Mark subscription as past_due
                        const { error: tenantUpdateError } = await supabaseAdmin
                            .from('tenants')
                            .update({
                                subscription_status: 'past_due',
                            })
                            .eq('id', tenantId);
                        if (tenantUpdateError) throw tenantUpdateError;

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

                    }
                }
                break;
            }

            case 'customer.subscription.deleted': {
                tenantId = session.metadata?.tenantId;
                if (tenantId) {
                    if (session.metadata?.type === 'addon') {
                        await supabaseAdmin.from('subscription_addons').update({ status: 'cancelled', updated_at: new Date().toISOString() })
                            .eq('tenant_id', tenantId).eq('addon_type', session.metadata.addonType);
                        break;
                    }
                    const { error: tenantUpdateError } = await supabaseAdmin
                        .from('tenants')
                        .update({
                            subscription_status: 'cancelled',
                        })
                        .eq('id', tenantId);
                    if (tenantUpdateError) throw tenantUpdateError;

                    console.log(`Tenant ${tenantId} subscription cancelled.`);
                }
                break;
            }

            case 'customer.subscription.created':
            case 'customer.subscription.updated': {
                tenantId = session.metadata?.tenantId;

                // Fallback tenant lookup by customer ID if metadata isn't present
                if (!tenantId && session.customer) {
                    const { data: tenantLookup } = await supabaseAdmin
                        .from('tenants')
                        .select('id')
                        .eq('stripe_customer_id', session.customer)
                        .maybeSingle();
                    tenantId = tenantLookup?.id;
                }

                if (tenantId) {
                    if (session.metadata?.type === 'addon') {
                        const addonActive = ['active', 'trialing'].includes(session.status);
                        await supabaseAdmin.from('subscription_addons').update({ status: addonActive ? 'active' : 'cancelled', updated_at: new Date().toISOString() })
                            .eq('tenant_id', tenantId).eq('addon_type', session.metadata.addonType);
                        break;
                    }

                    // Resolve plan by metadata or price ID lookup
                    let detectedPlan = session.metadata?.plan || session.metadata?.planId;
                    if (!detectedPlan && session.items?.data?.[0]?.price?.id) {
                        const priceId = session.items.data[0].price.id;
                        if (priceId === process.env.STRIPE_ENTERPRISE_MONTHLY_PRICE_ID || priceId === process.env.STRIPE_ENTERPRISE_ANNUAL_PRICE_ID) {
                            detectedPlan = 'enterprise';
                        } else if (priceId === process.env.STRIPE_PRO_MONTHLY_PRICE_ID || priceId === process.env.STRIPE_PRO_ANNUAL_PRICE_ID) {
                            detectedPlan = 'pro';
                        } else if (priceId === process.env.STRIPE_STARTER_MONTHLY_PRICE_ID || priceId === process.env.STRIPE_STARTER_ANNUAL_PRICE_ID) {
                            detectedPlan = 'starter';
                        }
                    }

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

                    const updateData: any = {
                        subscription_status: statusMap[session.status] || 'suspended',
                        stripe_subscription_id: session.id,
                        stripe_customer_id: session.customer,
                        cancel_at_period_end: Boolean(session.cancel_at_period_end),
                        current_period_end: stripePeriodEnd(session),
                        trial_ends_at: session.status === 'trialing' ? new Date(session.trial_end * 1000).toISOString() : null,
                        updated_at: new Date().toISOString(),
                    };

                    if (detectedPlan) {
                        updateData.subscription_plan = detectedPlan;
                    }

                    const { error: tenantUpdateError } = await supabaseAdmin
                        .from('tenants')
                        .update(updateData)
                        .eq('id', tenantId);
                    if (tenantUpdateError) throw tenantUpdateError;

                    console.log(`Tenant ${tenantId} subscription updated to ${session.status} (${detectedPlan || 'unchanged'}).`);
                }
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
        await finishWebhookEvent(supabaseAdmin, event, tenantId, 'processed');

        return NextResponse.json({ received: true, status: 'processed' });
    } catch (err: unknown) {
        console.error('Webhook processing failed');
        const internalNote = err instanceof Error ? err.message : String(err);

        // Record failed webhook processing
        try {
            await finishWebhookEvent(supabaseAdmin, event, tenantId, 'failed', internalNote);
        } catch (recordErr) {
            console.error('Failed to record webhook error:', recordErr);
        }

        // Return 500 so Stripe will retry
        return NextResponse.json({ error: 'Webhook processing failed', code: 'STRIPE_WEBHOOK_PROCESSING' }, { status: 500 });
    }
}

function stripePeriodEnd(subscription: any): string | null {
    const timestamp = subscription.current_period_end || subscription.items?.data?.[0]?.current_period_end;
    return timestamp ? new Date(timestamp * 1000).toISOString() : null;
}

async function processConnectEvent(admin: any, event: any, tenantId: string) {
    const object = event.data.object;
    if (event.type === 'account.updated') {
        if (object.id !== event.account) throw new Error('Account update scope mismatch');
        const { error } = await admin.from('tenants').update({ stripe_connect_onboarded: (await readConnectedAccount(event.account)).chargesEnabled })
            .eq('id', tenantId).eq('stripe_connect_id', event.account);
        if (error) throw error;
        return;
    }
    if (['checkout.session.completed', 'checkout.session.async_payment_succeeded', 'payment_intent.succeeded'].includes(event.type)) {
        const isCheckout = event.type.startsWith('checkout.');
        if (isCheckout && object.payment_status !== 'paid') return;
        if (object.metadata?.type !== 'business_invoice') return; // Connected subscriptions never grant AlphaClone entitlements.
        const paymentIntentId = isCheckout ? (typeof object.payment_intent === 'string' ? object.payment_intent : object.payment_intent?.id) : object.id;
        if (!paymentIntentId || !object.metadata.invoiceId) throw new Error('Invoice payment identifiers missing');
        await reconcileInvoiceStripePayment(admin, tenantId, object.metadata.invoiceId, paymentIntentId, event.account);
        return;
    }
    if (event.type === 'charge.refunded' || event.type.startsWith('charge.dispute.')) {
        const paymentIntentId = typeof object.payment_intent === 'string' ? object.payment_intent : object.payment_intent?.id;
        if (!paymentIntentId) return; // Charges outside this integration are not native invoices.
        const intent = await stripe.paymentIntents.retrieve(paymentIntentId, { stripeAccount: event.account });
        if (intent.metadata.type !== 'business_invoice') return;
        if (intent.metadata.tenantId !== tenantId) throw new Error('Refund/dispute tenant ownership mismatch');
        const { data: payment, error } = await admin.from('stripe_payments').select('id,metadata')
            .eq('stripe_payment_intent_id', paymentIntentId).eq('tenant_id', tenantId).single();
        if (error || payment?.metadata?.stripe_account_id !== event.account) throw error || new Error('Refund/dispute account mapping mismatch');
        if (event.type === 'charge.refunded') {
            // Retrieve current provider state: delayed events must not overwrite a newer refund total.
            const charge = await stripe.charges.retrieve(object.id, { stripeAccount: event.account });
            const chargeIntent = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;
            if (chargeIntent !== paymentIntentId) throw new Error('Refund charge ownership mismatch');
            const { error: refundError } = await admin.rpc('reconcile_stripe_invoice_refund', {
                p_tenant_id: tenantId, p_invoice_id: payment.metadata.invoice_id,
                p_payment_intent_id: paymentIntentId, p_account_id: event.account,
                p_refunded_amount: charge.amount_refunded ? stripeAmountToInvoice(charge.amount_refunded, charge.currency) : 0,
            });
            if (refundError) throw refundError;
            Object.assign(object, { amount_refunded: charge.amount_refunded, amount: charge.amount, refunds: charge.refunds });
        }
        const metadata = { ...payment.metadata, ...(event.type === 'charge.refunded'
            ? { refunds: object.refunds?.data || [], refund_status: object.amount_refunded === object.amount ? 'full' : 'partial' }
            : { dispute_id: object.id, dispute_status: object.status, dispute_amount: object.amount }) };
        const { error: updateError } = await admin.from('stripe_payments').update({ metadata,
            ...(event.type === 'charge.refunded'
                ? { status: object.amount_refunded === object.amount ? 'refunded' : 'succeeded', refund_amount_cents: object.amount_refunded, refunded_at: new Date().toISOString() }
                : { status: object.status === 'won' ? 'succeeded' : 'disputed' }),
        }).eq('id', payment.id).eq('tenant_id', tenantId);
        if (updateError) throw updateError;
    }
}
