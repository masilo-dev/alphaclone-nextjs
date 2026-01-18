import { supabase } from '../lib/supabase';
import { loadStripe } from '@stripe/stripe-js';
import { tenantService } from './tenancy/TenantService';
import { activityService } from './activityService';
import { auditLoggingService } from './auditLoggingService';

const STRIPE_PUBLIC_KEY = import.meta.env.VITE_STRIPE_PUBLIC_KEY;
export const stripePromise = loadStripe(STRIPE_PUBLIC_KEY || '');

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
    items: InvoiceItem[];
    created_at: string;
    metadata?: any;
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

