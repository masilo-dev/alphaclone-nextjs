import { supabase } from '../lib/supabase';
import { loadStripe } from '@stripe/stripe-js';
import { jsPDF } from 'jspdf';
import { ENV } from '@/config/env';
import { tenantService } from './tenancy/TenantService';
import { activityService } from './activityService';
import { auditLoggingService } from './auditLoggingService';

const STRIPE_PUBLIC_KEY = ENV.VITE_STRIPE_PUBLIC_KEY;
export const stripePromise = STRIPE_PUBLIC_KEY ? loadStripe(STRIPE_PUBLIC_KEY) : Promise.resolve(null);

export interface Invoice {
    id: string;
    user_id?: string;
    project_id?: string;
    amount: number;
    currency: string;
    status: 'draft' | 'sent' | 'paid' | 'void' | 'uncollectible';
    due_date: string;
    paid_at?: string;
    description: string;
    items?: InvoiceItem[];
    created_at: string;
    metadata?: any;
    payment_method?: 'stripe' | 'bank' | 'mobile_money';
    manual_payment_instructions?: string;
    project?: { name: string };
    user?: { name: string; email: string };
    tenant?: {
        name: string;
        email?: string;
        address?: string;
        registration_number?: string;
    };
}

export interface InvoiceItem {
    description: string;
    quantity: number;
    unit_price: number;
    amount: number;
}

export interface Payment {
    id: string;
    stripe_payment_intent_id: string;
    tenant_id?: string;
    customer_id?: string;
    amount: number;
    amount_cents: number;
    currency: string;
    status: 'pending' | 'succeeded' | 'failed' | 'refunded';
    description?: string;
    paid_at?: string;
    created_at: string;
}

function mapBusinessInvoiceRow(row: any): Invoice {
    return {
        id: row.id,
        user_id: row.client_id,
        project_id: row.project_id,
        amount: Number(row.total ?? 0),
        currency: String(row.currency || row.currency_code || 'USD'),
        status: row.status,
        due_date: row.due_date,
        paid_at: row.paid_at,
        description: row.notes || row.invoice_number || 'Invoice',
        items: (row.invoice_line_items || row.line_items || []).map((item: any) => ({
            description: item.description,
            quantity: Number(item.quantity || 0),
            unit_price: Number(item.unit_price ?? item.rate ?? 0),
            amount: Number(item.amount ?? Number(item.quantity || 0) * Number(item.unit_price ?? item.rate ?? 0)),
        })),
        created_at: row.created_at,
        metadata: row.metadata,
        project: row.project,
        user: row.business_clients,
    };
}

export const paymentService = {
    async createInvoice(invoice: Omit<Invoice, 'id' | 'created_at' | 'status'>) {
        const tenantId = tenantService.getCurrentTenantId();
        if (!tenantId) {
            return { invoice: null, error: new Error('No active organization selected.') };
        }
        const { data: tenant } = await supabase.from('tenants').select('subscription_plan').eq('id', tenantId).single();
        const { PLAN_PRICING } = await import('./tenancy/types');
        const plan = (tenant?.subscription_plan as any) || 'free';
        if (!PLAN_PRICING[plan as keyof typeof PLAN_PRICING].features.paymentProcessing) {
            return { invoice: null, error: new Error('Payment processing is not enabled for your current plan. Please upgrade to use this feature.') };
        }

        const currency = String(invoice.currency || 'USD').toUpperCase();
        const { data, error } = await supabase
            .from('business_invoices')
            .insert({
                tenant_id: tenantId,
                client_id: invoice.user_id || null,
                project_id: invoice.project_id || null,
                invoice_number: `SUB-${Date.now()}`,
                issue_date: new Date().toISOString().slice(0, 10),
                due_date: invoice.due_date?.slice?.(0, 10) || invoice.due_date,
                status: 'draft',
                subtotal: invoice.amount,
                tax: 0,
                tax_rate: 0,
                discount_amount: 0,
                total: invoice.amount,
                amount_paid: 0,
                currency,
                currency_code: currency,
                notes: invoice.description,
                line_items: invoice.items?.map((item) => ({
                    description: item.description,
                    quantity: item.quantity,
                    unit_price: item.unit_price,
                })) || [],
                is_public: false,
                metadata: invoice.metadata || {},
            })
            .select('*')
            .single();

        if (!error && data) {
            if (invoice.user_id) {
                activityService.logActivity(invoice.user_id, 'Invoice Created', {
                    invoiceId: data.id,
                    amount: invoice.amount,
                    currency,
                    projectId: invoice.project_id
                }, tenantId).catch(err => console.error('Failed to log activity:', err));
            }

            auditLoggingService.logAction(
                'invoice_created',
                'invoice',
                data.id,
                undefined,
                data
            ).catch(err => console.error('Failed to log audit:', err));

            const { requestBusinessEvent } = await import('../lib/automation/request-event');
            await requestBusinessEvent(tenantId, 'invoice_created', {
                invoiceId: data.id,
                amount: invoice.amount,
                currency,
                status: data.status,
                dueDate: data.due_date
            }).catch(err => console.error('Failed to emit invoice_created event:', err));
        }

        return { invoice: data ? mapBusinessInvoiceRow(data) : null, error };
    },

    async getUserInvoices(userId: string, limit: number = 50) {
        const tenantId = tenantService.getCurrentTenantId();
        let query = supabase
            .from('business_invoices')
            .select(`
        *,
        project:project_id (name),
        business_clients:client_id (name, email)
      `)
            .eq('client_id', userId);

        if (tenantId) {
            query = query.eq('tenant_id', tenantId);
        }

        const { data, error } = await query
            .order('created_at', { ascending: false })
            .limit(limit);

        return { invoices: (data || []).map(mapBusinessInvoiceRow), error };
    },

    async getAllInvoices(role?: string, limit: number = 50) {
        let query = supabase
            .from('business_invoices')
            .select(`
        *,
        project:project_id (name),
        business_clients:client_id (name, email)
      `);

        if (role !== 'admin') {
            const tenantId = tenantService.getCurrentTenantId();
            if (tenantId) {
                query = query.eq('tenant_id', tenantId);
            }
        }

        const { data, error } = await query
            .order('created_at', { ascending: false })
            .limit(limit);

        return { invoices: (data || []).map(mapBusinessInvoiceRow), error };
    },

    generateInvoicePDF(invoice: Invoice) {
        const doc = new jsPDF();

        doc.setFontSize(22);
        doc.setTextColor(40, 40, 40);
        doc.text('INVOICE', 20, 20);

        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text(`Invoice ID: ${invoice.id.toUpperCase()}`, 20, 30);
        doc.text(`Date: ${new Date(invoice.created_at).toLocaleDateString()}`, 20, 35);
        doc.text(`Due Date: ${new Date(invoice.due_date).toLocaleDateString()}`, 20, 40);

        const issuer = invoice.tenant || { name: 'AlphaClone Systems' };
        doc.setTextColor(40, 40, 40);
        doc.setFont('helvetica', 'bold');
        doc.text('ISSUER:', 120, 30);
        doc.setFont('helvetica', 'normal');
        doc.text(issuer.name, 120, 35);
        if (issuer.address) {
            const splitAddress = doc.splitTextToSize(issuer.address, 70);
            doc.text(splitAddress, 120, 40);
        }
        if (issuer.email) doc.text(`Email: ${issuer.email}`, 120, 55);

        doc.setFontSize(14);
        if (invoice.status === 'paid') {
            doc.setTextColor(0, 128, 0);
            doc.text('PAID', 160, 25);
        } else {
            doc.setTextColor(200, 0, 0);
            doc.text(invoice.status.toUpperCase(), 160, 25);
        }

        let yPos = 60;
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(12);

        doc.text(`Project: ${invoice.project?.name || 'General Service'}`, 20, yPos);
        yPos += 10;
        doc.text(`Description: ${invoice.description}`, 20, yPos);
        yPos += 20;

        doc.setFillColor(240, 240, 240);
        doc.rect(20, yPos, 170, 10, 'F');
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Description', 25, yPos + 7);
        doc.text('Amount', 160, yPos + 7);
        yPos += 15;

        doc.setFont('helvetica', 'normal');
        if (invoice.items && invoice.items.length > 0) {
            invoice.items.forEach(item => {
                doc.text(item.description, 25, yPos);
                doc.text(`$${item.amount.toLocaleString()}`, 160, yPos);
                yPos += 10;
            });
        } else {
            doc.text(invoice.description, 25, yPos);
            doc.text(`$${invoice.amount.toLocaleString()}`, 160, yPos);
            yPos += 10;
        }

        yPos += 10;
        doc.setLineWidth(0.5);
        doc.line(20, yPos, 190, yPos);
        yPos += 10;
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Total:', 120, yPos);
        doc.text(`$${invoice.amount.toLocaleString()} ${invoice.currency.toUpperCase()}`, 160, yPos);

        if (invoice.payment_method && invoice.payment_method !== 'stripe' && invoice.manual_payment_instructions) {
            yPos += 20;
            doc.setFontSize(10);
            doc.setTextColor(15, 118, 110);
            doc.text('PAYMENT INSTRUCTIONS:', 20, yPos);
            yPos += 7;
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(60, 60, 60);

            const splitText = doc.splitTextToSize(invoice.manual_payment_instructions, 150);
            doc.text(splitText, 20, yPos);
        }

        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        const footerY = 280;
        doc.text('TAX DISCLAIMER:', 20, footerY);
        doc.text('Tax calculation and reporting responsibility lies solely with the issuer. AlphaClone Systems provides software', 20, footerY + 4);
        doc.text('only and does not collect or remit taxes on behalf of users.', 20, footerY + 8);

        return doc;
    },

    async downloadInvoicePDF(invoiceId: string) {
        const { data: invoice, error } = await supabase
            .from('business_invoices')
            .select(`
                *,
                project:project_id(name),
                tenant:tenant_id(name, email, address),
                invoice_line_items(*)
            `)
            .eq('id', invoiceId)
            .single();

        if (error || !invoice) {
            console.error('Failed to fetch invoice for PDF:', error);
            throw new Error('Invoice not found');
        }

        const fullInvoice = mapBusinessInvoiceRow({ ...invoice, items: invoice.invoice_line_items || invoice.line_items || [] });
        const doc = this.generateInvoicePDF(fullInvoice);
        doc.save(`Invoice_${invoice.id.substring(0, 8)}.pdf`);
    },

    async createPaymentIntent(invoiceId: string, retryCount: number = 0): Promise<{ clientSecret: string | null; error: any }> {
        try {
            const { data: invoice, error: invoiceError } = await supabase
                .from('business_invoices')
                .select('id,total,amount_paid,currency,notes,invoice_number')
                .eq('id', invoiceId)
                .eq('tenant_id', tenantService.getCurrentTenantId())
                .single();

            if (invoiceError || !invoice) {
                throw new Error('Invoice not found');
            }

            const remaining = Math.max(0, Number(invoice.total || 0) - Number(invoice.amount_paid || 0));
            const amount = remaining > 0 ? remaining : Number(invoice.total || 0);

            const response = await fetch('/api/stripe/create-payment-intent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    invoiceId,
                    amount,
                    currency: invoice.currency || 'usd',
                    description: invoice.notes || invoice.invoice_number || `Invoice ${invoiceId}`,
                }),
            });

            if (!response.ok) {
                if (retryCount < 3) {
                    await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
                    return this.createPaymentIntent(invoiceId, retryCount + 1);
                }
                throw new Error('Failed to create payment intent after retries');
            }

            const { clientSecret } = await response.json();

            auditLoggingService.logAction(
                'payment_intent_created',
                'invoice',
                invoiceId,
                undefined,
                { clientSecret: clientSecret.substring(0, 20) + '...' }
            ).catch(err => console.error('Failed to log audit:', err));

            return { clientSecret, error: null };
        } catch (error) {
            console.error('Payment intent error:', error);

            auditLoggingService.logAction(
                'payment_intent_failed',
                'invoice',
                invoiceId,
                undefined,
                { error: String(error) }
            ).catch(err => console.error('Failed to log audit:', err));

            return { clientSecret: null, error };
        }
    },

    async processPayment(
        invoiceId: string,
        paymentMethodId: string
    ): Promise<{ success: boolean; error?: string }> {
        try {
            const { clientSecret, error: intentError } = await this.createPaymentIntent(invoiceId);

            if (intentError || !clientSecret) {
                return { success: false, error: 'Failed to initialize payment' };
            }

            const stripe = await stripePromise;
            if (!stripe) {
                return { success: false, error: 'Stripe not loaded' };
            }

            const { error: confirmError, paymentIntent } = await stripe.confirmCardPayment(
                clientSecret,
                {
                    payment_method: paymentMethodId,
                }
            );

            if (confirmError) {
                auditLoggingService.logAction(
                    'payment_failed',
                    'invoice',
                    invoiceId,
                    undefined,
                    { error: confirmError.message }
                ).catch(err => console.error('Failed to log audit:', err));

                return { success: false, error: confirmError.message };
            }

            if (paymentIntent?.status === 'succeeded') {
                await this.markInvoicePaid(invoiceId, paymentIntent.id);
                return { success: true };
            }

            return { success: false, error: 'Payment not completed' };
        } catch (error) {
            console.error('Payment processing error:', error);
            return { success: false, error: String(error) };
        }
    },

    async markInvoicePaid(invoiceId: string, paymentIntentId: string) {
        const tenantId = tenantService.getCurrentTenantId();
        const { data: oldInvoice } = await supabase
            .from('business_invoices')
            .select('*')
            .eq('id', invoiceId)
            .eq('tenant_id', tenantId)
            .single();

        const remaining = Math.max(0, Number(oldInvoice?.total || 0) - Number(oldInvoice?.amount_paid || 0));
        const payAmount = remaining > 0 ? remaining : Number(oldInvoice?.total || 0);

        const response = await fetch(`/api/invoices/${encodeURIComponent(invoiceId)}/payment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                tenantId,
                amount: payAmount,
                idempotencyKey: `stripe:${paymentIntentId}`,
            }),
        });
        const payload = await response.json().catch(() => ({}));
        const data = payload.invoice;
        const error = response.ok ? null : new Error(payload.error || 'Payment could not be recorded');

        if (!error && data) {
            activityService.logActivity(data.client_id, 'Invoice Paid', {
                invoiceId: data.id,
                amount: payAmount,
                currency: data.currency,
                paymentIntentId,
            }, data.tenant_id).catch(err => console.error('Failed to log activity:', err));

            auditLoggingService.logAction(
                'invoice_paid',
                'invoice',
                invoiceId,
                oldInvoice,
                data
            ).catch(err => console.error('Failed to log audit:', err));

            const { userService } = await import('./userService');
            const { tenantService: tenantSvc } = await import('./tenancy/TenantService');

            let recipientEmail = null;
            let recipientName = 'Customer';

            if (data.tenant_id) {
                const tenant = await tenantSvc.getTenant(data.tenant_id);
                if (tenant && tenant.settings?.billing_email) {
                    recipientEmail = tenant.settings.billing_email;
                    recipientName = tenant.name;
                }
            }

            if (!recipientEmail && data.client_id) {
                const { data: client } = await supabase.from('business_clients').select('email,name').eq('id', data.client_id).maybeSingle();
                if (client?.email) {
                    recipientEmail = client.email;
                    recipientName = client.name || recipientName;
                }
            }

            if (recipientEmail) {
                import('./emailCampaignService').then(({ emailCampaignService }) => {
                    emailCampaignService.sendTransactionalEmail(recipientEmail!, 'Payment Confirmation', {
                        name: recipientName,
                        amount: payAmount,
                        currency: data.currency,
                        projectName: 'Project',
                        invoiceId: data.id
                    }).catch(err => console.error('Failed to trigger payment email:', err));
                });
            }
        }

        return { invoice: data ? mapBusinessInvoiceRow(data) : null, error };
    },

    async reconcilePayment(invoiceId: string): Promise<{ reconciled: boolean; error?: string }> {
        try {
            const response = await fetch(`/api/stripe/reconcile-payment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ invoiceId }),
            });

            if (!response.ok) {
                throw new Error('Reconciliation failed');
            }

            const { status, paymentIntentId } = await response.json();

            if (status === 'succeeded' && paymentIntentId) {
                await this.markInvoicePaid(invoiceId, paymentIntentId);
                return { reconciled: true };
            }

            return { reconciled: false, error: 'Payment not found or not succeeded' };
        } catch (error) {
            console.error('Payment reconciliation error:', error);
            return { reconciled: false, error: String(error) };
        }
    },

    async getPaymentHistory(userId: string) {
        const tenantId = tenantService.getCurrentTenantId();
        if (!tenantId) return { payments: [], error: null };

        const { data, error } = await supabase
            .from('stripe_payments')
            .select('*')
            .eq('tenant_id', tenantId)
            .order('paid_at', { ascending: false });

        if (error) return { payments: [], error };

        const payments: Payment[] = (data || []).map((row: any) => ({
            id: row.id,
            stripe_payment_intent_id: row.stripe_payment_intent_id,
            tenant_id: row.tenant_id,
            customer_id: row.customer_id,
            amount_cents: row.amount_cents,
            amount: (row.amount_cents ?? 0) / 100,
            currency: row.currency ?? 'USD',
            status: row.status,
            description: row.description,
            paid_at: row.paid_at,
            created_at: row.paid_at ?? row.created_at,
        }));

        return { payments, error: null };
    },

    async sendPaymentReceipt(invoiceId: string): Promise<{ sent: boolean; error?: string }> {
        try {
            const response = await fetch('/api/stripe/send-receipt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ invoiceId }),
            });

            if (!response.ok) {
                throw new Error('Failed to send receipt');
            }

            return { sent: true };
        } catch (error) {
            console.error('Receipt send error:', error);
            return { sent: false, error: String(error) };
        }
    },

    async processRecurringBilling(): Promise<{ processed: number; errors: number }> {
        try {
            console.log('Starting recurring billing process...');
            const today = new Date();

            const { data: tenantsDue, error } = await supabase
                .from('tenants')
                .select('*')
                .eq('subscription_status', 'active')
                .is('deletion_pending_at', null)
                .lte('current_period_end', today.toISOString());

            if (error) {
                console.error('Error fetching billing candidates:', error);
                return { processed: 0, errors: 1 };
            }

            if (!tenantsDue || tenantsDue.length === 0) {
                return { processed: 0, errors: 0 };
            }

            let processed = 0;
            let errors = 0;

            for (const tenant of tenantsDue) {
                try {
                    const planName = tenant.subscription_plan || 'starter';
                    const amount = planName === 'pro' ? 8900 :
                        planName === 'enterprise' ? 20000 : 2500;

                    await this.createInvoice({
                        user_id: tenant.admin_user_id,
                        amount,
                        currency: 'usd',
                        description: `Subscription renewal: ${planName} plan`,
                        due_date: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                    } as any);

                    const nextPeriod = new Date(tenant.current_period_end);
                    nextPeriod.setMonth(nextPeriod.getMonth() + 1);

                    await supabase
                        .from('tenants')
                        .update({ current_period_end: nextPeriod.toISOString() })
                        .eq('id', tenant.id);

                    processed++;
                } catch (err) {
                    console.error(`Failed to process billing for tenant ${tenant.id}:`, err);
                    errors++;
                }
            }

            return { processed, errors };
        } catch (err) {
            console.error('Critical error in recurring billing:', err);
            return { processed: 0, errors: 1 };
        }
    }
};
