import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { logInvoiceEvent } from '@/lib/audit/invoiceAuditLogger';

export const invoiceServerService = {
    async markAsPaid(input: {
        invoiceId: string;
        tenantId: string;
        idempotencyKey: string;
        externalReference?: string | null;
    }): Promise<{ success: boolean; error: string | null }> {
        const admin = createSupabaseAdminClient();
        try {
            const { data: invoice, error: fetchError } = await admin
                .from('business_invoices')
                .select('id,tenant_id,invoice_number,total,amount_paid,status,currency')
                .eq('id', input.invoiceId)
                .eq('tenant_id', input.tenantId)
                .maybeSingle();
            if (fetchError) throw fetchError;
            if (!invoice) throw new Error('Invoice not found');
            if (invoice.status === 'paid') return { success: true, error: null };

            const amount = Math.max(0, Number(invoice.total || 0) - Number(invoice.amount_paid || 0));
            if (!Number.isFinite(amount) || amount <= 0) throw new Error('Invoice has no payable balance');

            const { data: rows, error: paymentError } = await admin.rpc('record_business_invoice_payment', {
                p_tenant_id: input.tenantId,
                p_invoice_id: input.invoiceId,
                p_amount: amount,
                p_idempotency_key: input.idempotencyKey,
                p_source: 'stripe',
                p_external_reference: input.externalReference || null,
                p_actor_user_id: null,
            });
            if (paymentError) throw paymentError;
            const paidInvoice = Array.isArray(rows) ? rows[0] : rows;
            if (!paidInvoice) throw new Error('Payment was not recorded');

            await logInvoiceEvent({
                    invoiceId: input.invoiceId,
                    tenantId: input.tenantId,
                    eventType: 'payment_received',
                    eventData: {
                        amount,
                        amountPaid: paidInvoice.amount_paid,
                        currency: invoice.currency,
                        externalReference: input.externalReference || null,
                    },
                    performedBy: 'system',
                }).catch((auditError) => console.error('[invoice-payment] audit failed', auditError));

            return { success: true, error: null };
        } catch (error) {
            console.error('[invoice-payment] Stripe payment recording failed', error);
            return { success: false, error: error instanceof Error ? error.message : 'Payment could not be recorded' };
        }
    },
};
