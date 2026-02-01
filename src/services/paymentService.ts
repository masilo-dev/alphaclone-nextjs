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
    user_id: string;
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
    amount: number;
    currency: string;
    status: 'pending' | 'succeeded' | 'failed' | 'refunded';
    created_at: string;
}

export const paymentService = {
    /**
     * Create a new invoice
     */
    async createInvoice(invoice: Omit<Invoice, 'id' | 'created_at' | 'status'>) {
        // Check if tenant has payment processing enabled
        const tenantId = tenantService.getCurrentTenantId();
        const { data: tenant } = await supabase.from('tenants').select('subscription_plan').eq('id', tenantId).single();
        const { PLAN_PRICING } = await import('./tenancy/types');
        const plan = (tenant?.subscription_plan as any) || 'free';
        if (!PLAN_PRICING[plan as keyof typeof PLAN_PRICING].features.paymentProcessing) {
            return { invoice: null, error: new Error('Payment processing is not enabled for your current plan. Please upgrade to use this feature.') };
        }

        const { data, error } = await supabase
            .from('invoices')
            .insert({
                ...invoice,
                status: 'draft',
                tenant_id: tenantId,
            })
            .select()
            .single();

        // Log activity and audit
        if (!error && data) {
            activityService.logActivity(invoice.user_id, 'Invoice Created', {
                invoiceId: data.id,
                amount: invoice.amount,
                currency: invoice.currency,
                projectId: invoice.project_id
            }).catch(err => console.error('Failed to log activity:', err));

            // Audit log
            auditLoggingService.logAction(
                'invoice_created',
                'invoice',
                data.id,
                undefined,
                data
            ).catch(err => console.error('Failed to log audit:', err));
        }

        return { invoice: data, error };
    },

    /**
     * Get user invoices
     */
    async getUserInvoices(userId: string, limit: number = 50) {
        const { data, error } = await supabase
            .from('invoices')
            .select(`
        *,
        project:project_id (name)
      `)
            .eq('user_id', userId)
            .eq('tenant_id', tenantService.getCurrentTenantId())
            .order('created_at', { ascending: false })
            .limit(limit);

        return { invoices: data, error };
    },

    /**
     * Get all invoices (Admin/Tenant Admin)
     * Super Admin (role='admin') sees ALL invoices across ALL tenants
     * Tenant Admin (role='tenant_admin') sees invoices within their tenant only
     */
    async getAllInvoices(role?: string, limit: number = 50) {
        let query = supabase
            .from('invoices')
            .select(`
        *,
        project:project_id (name),
        user:user_id (name, email)
      `);

        // Only apply tenant filtering for tenant_admin, NOT for super admin
        if (role !== 'admin') {
            const tenantId = tenantService.getCurrentTenantId();
            if (tenantId) {
                query = query.eq('tenant_id', tenantId);
            }
        }

        const { data, error } = await query
            .order('created_at', { ascending: false })
            .limit(limit);

        return { invoices: data, error };
    },

    /**
     * Generate PDF for an invoice (Internal)
     */
    generateInvoicePDF(invoice: Invoice) {
        const doc = new jsPDF();

        // Header
        doc.setFontSize(22);
        doc.setTextColor(40, 40, 40);
        doc.text('INVOICE', 20, 20);

        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text(`Invoice ID: ${invoice.id.toUpperCase()}`, 20, 30);
        doc.text(`Date: ${new Date(invoice.created_at).toLocaleDateString()}`, 20, 35);
        doc.text(`Due Date: ${new Date(invoice.due_date).toLocaleDateString()}`, 20, 40);

        // Issuer Details (Right Side)
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

        // Status
        doc.setFontSize(14);
        if (invoice.status === 'paid') {
            doc.setTextColor(0, 128, 0);
            doc.text('PAID', 160, 25);
        } else {
            doc.setTextColor(200, 0, 0);
            doc.text(invoice.status.toUpperCase(), 160, 25);
        }

        // Details
        let yPos = 60;
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(12);

        doc.text(`Project: ${invoice.project?.name || 'General Service'}`, 20, yPos);
        yPos += 10;
        doc.text(`Description: ${invoice.description}`, 20, yPos);
        yPos += 20;

        // Line Items Table Header
        doc.setFillColor(240, 240, 240);
        doc.rect(20, yPos, 170, 10, 'F');
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Description', 25, yPos + 7);
        doc.text('Amount', 160, yPos + 7);
        yPos += 15;

        // Items (Placeholder if items array is missing)
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

        // Total
        yPos += 10;
        doc.setLineWidth(0.5);
        doc.line(20, yPos, 190, yPos);
        yPos += 10;
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Total:', 120, yPos);
        doc.text(`$${invoice.amount.toLocaleString()} ${invoice.currency.toUpperCase()}`, 160, yPos);

        // Manual Payment Instructions
        if (invoice.payment_method && invoice.payment_method !== 'stripe' && invoice.manual_payment_instructions) {
            yPos += 20;
            doc.setFontSize(10);
            doc.setTextColor(15, 118, 110); // Teal-700
            doc.text('PAYMENT INSTRUCTIONS:', 20, yPos);
            yPos += 7;
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(60, 60, 60);

            const splitText = doc.splitTextToSize(invoice.manual_payment_instructions, 150);
            doc.text(splitText, 20, yPos);
        }

        // Legal Footer & Tax Disclaimer
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        const footerY = 280;
        doc.text('TAX DISCLAIMER:', 20, footerY);
        doc.text('Tax calculation and reporting responsibility lies solely with the issuer. AlphaClone Systems provides software', 20, footerY + 4);
        doc.text('only and does not collect or remit taxes on behalf of users.', 20, footerY + 8);

        return doc;
    },

    async downloadInvoicePDF(invoiceId: string) {
        // Fetch full invoice details
        const { data: invoice, error } = await supabase
            .from('invoices')
            .select(`
                *, 
                project:project_id(name),
                tenant:tenant_id(name, email, address)
            `)
            .eq('id', invoiceId)
            .single();

        if (error || !invoice) {
            console.error('Failed to fetch invoice for PDF:', error);
            throw new Error('Invoice not found');
        }

        // Ensure items is an array if null
        const fullInvoice = { ...invoice, items: invoice.items || [] } as Invoice;

        const doc = this.generateInvoicePDF(fullInvoice);
        doc.save(`Invoice_${invoice.id.substring(0, 8)}.pdf`);
    },

    /**
     * Create payment intent (Stripe) with retry logic
     */
    async createPaymentIntent(invoiceId: string, retryCount: number = 0): Promise<{ clientSecret: string | null; error: any }> {
        try {
            // Get invoice details first
            const { data: invoice, error: invoiceError } = await supabase
                .from('invoices')
                .select('*')
                .eq('id', invoiceId)
                .eq('tenant_id', tenantService.getCurrentTenantId())
                .single();

            if (invoiceError || !invoice) {
                throw new Error('Invoice not found');
            }

            // Call backend API to create Stripe PaymentIntent
            const response = await fetch('/api/stripe/create-payment-intent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    invoiceId,
                    amount: invoice.amount,
                    currency: invoice.currency || 'usd',
                    description: invoice.description
                }),
            });

            if (!response.ok) {
                // Retry logic for network failures
                if (retryCount < 3) {
                    await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
                    return this.createPaymentIntent(invoiceId, retryCount + 1);
                }
                throw new Error('Failed to create payment intent after retries');
            }

            const { clientSecret } = await response.json();

            // Audit log
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

            // Audit log failure
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

    /**
     * Process payment with Stripe Elements
     */
    async processPayment(
        invoiceId: string,
        paymentMethodId: string
    ): Promise<{ success: boolean; error?: string }> {
        try {
            // Create payment intent
            const { clientSecret, error: intentError } = await this.createPaymentIntent(invoiceId);

            if (intentError || !clientSecret) {
                return { success: false, error: 'Failed to initialize payment' };
            }

            const stripe = await stripePromise;
            if (!stripe) {
                return { success: false, error: 'Stripe not loaded' };
            }

            // Confirm payment
            const { error: confirmError, paymentIntent } = await stripe.confirmCardPayment(
                clientSecret,
                {
                    payment_method: paymentMethodId,
                }
            );

            if (confirmError) {
                // Audit log failure
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
                // Mark invoice as paid
                await this.markInvoicePaid(invoiceId, paymentIntent.id);
                return { success: true };
            }

            return { success: false, error: 'Payment not completed' };
        } catch (error) {
            console.error('Payment processing error:', error);
            return { success: false, error: String(error) };
        }
    },

    /**
     * Mark invoice as paid (after successful Stripe payment)
     */
    async markInvoicePaid(invoiceId: string, paymentIntentId: string) {
        const { data: oldInvoice } = await supabase
            .from('invoices')
            .select('*')
            .eq('id', invoiceId)
            .eq('tenant_id', tenantService.getCurrentTenantId())
            .single();

        const { data, error } = await supabase
            .from('invoices')
            .update({
                status: 'paid',
                paid_at: new Date().toISOString(),
                metadata: { stripe_payment_intent: paymentIntentId }
            })
            .eq('id', invoiceId)
            .eq('tenant_id', tenantService.getCurrentTenantId())
            .select()
            .single();

        if (!error && data) {
            activityService.logActivity(data.user_id, 'Invoice Paid', {
                invoiceId: data.id,
                amount: data.amount,
                currency: data.currency,
                paymentIntentId: paymentIntentId
            }).catch(err => console.error('Failed to log activity:', err));

            // Audit log
            auditLoggingService.logAction(
                'invoice_paid',
                'invoice',
                invoiceId,
                oldInvoice,
                data
            ).catch(err => console.error('Failed to log audit:', err));

            // Trigger Payment Confirmation Email (Fetch profile for email if not in data)
            const { userService } = await import('./userService');
            const { user: profile } = await userService.getUser(data.user_id);
            if (profile?.email) {
                import('./emailCampaignService').then(({ emailCampaignService }) => {
                    emailCampaignService.sendTransactionalEmail(profile.email, 'Payment Confirmation', {
                        name: profile.name,
                        amount: data.amount,
                        currency: data.currency,
                        projectName: data.project?.name || 'Project',
                        invoiceId: data.id
                    }).catch(err => console.error('Failed to trigger payment email:', err));
                });
            }
        }

        return { invoice: data, error };
    },

    /**
     * Reconcile payment status with Stripe (for missed webhooks)
     */
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

    /**
     * Get payment history
     */
    async getPaymentHistory(userId: string) {
        const { data, error } = await supabase
            .from('payments')
            .select('*')
            .eq('user_id', userId)
            .eq('tenant_id', tenantService.getCurrentTenantId())
            .order('created_at', { ascending: false });

        return { payments: data, error };
    },

    /**
     * Send payment receipt email
     */
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

    /**
     * Process recurring billing for all tenants
     * Called by daily cron job
     */
    async processRecurringBilling(): Promise<{ processed: number; errors: number }> {
        try {
            console.log('Starting recurring billing process...');
            const today = new Date();

            // Find tenants due for billing (active subscription, period ends today or earlier)
            // Note: This relies on the 'tenants' table having subscription columns. 
            // If they don't exist, this query will fail, but it's the correct logical step for autonomy.
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
                    // Create invoice for next period
                    // In a real system, you'd lookup price from plan ID
                    const planName = tenant.subscription_plan || 'starter';
                    const amount = planName === 'pro' ? 8900 :
                        planName === 'enterprise' ? 20000 : 2500; // Updated to match PLAN_PRICING ($25, $89, $200)

                    await this.createInvoice({
                        user_id: tenant.admin_user_id, // Invoice the admin
                        amount: amount,
                        currency: 'usd',
                        description: `Subscription renewal: ${planName} plan`,
                        due_date: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                    } as any);

                    // Update tenant period (naive extension)
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

export const ALPHACLONE_BANK_DETAILS = {
    bankName: "Alpha Global Bank",
    accountNumber: "001-9922881-01",
    accountName: "Alphaclone Systems Ltd",
    swiftCode: "ALPHUS66",
    instructions: "Please use your Tenant ID as the reference."
};

