import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { supabase } from '@/lib/supabase';
import { headers } from 'next/headers';
import { emailProviderService } from '@/services/EmailProviderService';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(req: Request) {
    const body = await req.text();
    const headerList = await headers();
    const signature = headerList.get('stripe-signature') as string;

    let event;

    try {
        if (!webhookSecret) {
            throw new Error('STRIPE_WEBHOOK_SECRET is missing');
        }
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err: any) {
        console.error(`Webhook signature verification failed: ${err.message}`);
        return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
    }

    const session = event.data.object as any;

    try {
        switch (event.type) {
            case 'checkout.session.completed': {
                const tenantId = session.metadata?.tenantId;
                if (tenantId) {
                    const subscription = await stripe.subscriptions.retrieve(session.subscription);

                    await supabase
                        .from('tenants')
                        .update({
                            subscription_status: 'active',
                            stripe_customer_id: session.customer,
                            current_period_end: new Date((subscription as any).current_period_end * 1000).toISOString(),
                        })
                        .eq('id', tenantId);

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
                    const tenantId = subscription.metadata?.tenantId;

                    if (tenantId) {
                        await supabase
                            .from('tenants')
                            .update({
                                subscription_status: 'active',
                                current_period_end: new Date((subscription as any).current_period_end * 1000).toISOString(),
                            })
                            .eq('id', tenantId);

                        console.log(`Tenant ${tenantId} subscription renewed.`);
                    }
                }
                break;
            }

            case 'customer.subscription.deleted': {
                const tenantId = session.metadata?.tenantId;
                if (tenantId) {
                    await supabase
                        .from('tenants')
                        .update({
                            subscription_status: 'suspended',
                        })
                        .eq('id', tenantId);

                    console.log(`Tenant ${tenantId} subscription cancelled.`);
                }
                break;
            }

            case 'customer.subscription.updated': {
                const tenantId = session.metadata?.tenantId;
                if (tenantId) {
                    await supabase
                        .from('tenants')
                        .update({
                            subscription_status: session.status === 'active' ? 'active' : 'suspended',
                            current_period_end: new Date(session.current_period_end * 1000).toISOString(),
                        })
                        .eq('id', tenantId);
                }
                break;
            }

            default:
                console.log(`Unhandled event type ${event.type}`);
        }

        return NextResponse.json({ received: true });
    } catch (err: any) {
        console.error('Webhook processing error:', err);
        return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
    }
}
