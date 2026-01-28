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
    project?: { name: string };
    user?: { name: string; email: string };
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
        const { data, error } = await supabase
            .from('invoices')
            .insert({
                ...invoice,
                status: 'draft',
                tenant_id: tenantService.getCurrentTenantId(),
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
     * Get all invoices (Admin)
     */
    async getAllInvoices(limit: number = 50) {
        const { data, error } = await supabase
            .from('invoices')
            .select(`
        *,
        project:project_id (name),
        user:user_id (name, email)
      `)
            .eq('tenant_id', tenantService.getCurrentTenantId())
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

        return doc;
    },

    async downloadInvoicePDF(invoiceId: string) {
        // Fetch full invoice details
        const { data: invoice, error } = await supabase
            .from('invoices')
            .select(`*, project:project_id(name)`)
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
    }
};

