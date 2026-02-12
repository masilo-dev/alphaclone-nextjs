import { createAdminClient } from '@/lib/supabaseServer';

export const invoiceServerService = {
    /**
     * Mark invoice as paid securely from server
     */
    async markAsPaid(invoiceId: string): Promise<{ success: boolean; error: string | null }> {
        const supabaseAdmin = createAdminClient();

        try {
            // 1. Get invoice details including total and tenant
            const { data: invoice, error: fetchError } = await supabaseAdmin
                .from('business_invoices')
                .select('*')
                .eq('id', invoiceId)
                .single();

            if (fetchError || !invoice) throw new Error('Invoice not found');

            if (invoice.status === 'paid') return { success: true, error: null };

            // 2. Update status
            const { error: updateError } = await supabaseAdmin
                .from('business_invoices')
                .update({
                    status: 'paid',
                    updated_at: new Date().toISOString()
                })
                .eq('id', invoiceId);

            if (updateError) throw updateError;

            // 3. Post to General Ledger (DR Cash, CR AR)
            await this.postPaymentToGL(invoiceId, invoice);

            return { success: true, error: null };
        } catch (err: any) {
            console.error('Server markAsPaid error:', err);
            return { success: false, error: err.message };
        }
    },

    /**
     * Post payment to General Ledger
     * Uses RPC if available, or direct inserts
     */
    async postPaymentToGL(invoiceId: string, invoice: any): Promise<void> {
        const supabaseAdmin = createAdminClient();

        try {
            const tenantId = invoice.tenant_id;
            const total = parseFloat(invoice.total || 0);
            const invoiceNumber = invoice.invoice_number;

            // 1. Get accounts (Cash 1000, AR 1100)
            const { data: cashAccount } = await supabaseAdmin
                .from('chart_of_accounts')
                .select('id')
                .eq('tenant_id', tenantId)
                .eq('account_code', '1000')
                .single();

            const { data: arAccount } = await supabaseAdmin
                .from('chart_of_accounts')
                .select('id')
                .eq('tenant_id', tenantId)
                .eq('account_code', '1100')
                .single();

            if (!cashAccount || !arAccount) {
                console.warn(`Accounting accounts not found for tenant ${tenantId}. Skipping GL post.`);
                return;
            }

            // 2. Generate entry number via RPC
            const { data: entryNumber } = await supabaseAdmin.rpc('generate_entry_number', {
                p_tenant_id: tenantId,
            });

            // 3. Create journal entry
            const { data: entry, error: entryError } = await supabaseAdmin
                .from('journal_entries')
                .insert({
                    tenant_id: tenantId,
                    entry_number: entryNumber || `JE-${Date.now()}`,
                    entry_date: new Date().toISOString().split('T')[0],
                    description: `Payment received for Invoice ${invoiceNumber}`,
                    reference: invoiceNumber,
                    source_type: 'payment',
                    source_id: invoiceId,
                    status: 'posted', // Auto-post from webhook
                    total_debits: total,
                    total_credits: total,
                    currency: 'USD',
                    posted_at: new Date().toISOString()
                })
                .select()
                .single();

            if (entryError) throw entryError;

            // 4. Create lines
            await supabaseAdmin.from('journal_entry_lines').insert([
                {
                    tenant_id: tenantId,
                    entry_id: entry.id,
                    line_number: 1,
                    account_id: cashAccount.id,
                    debit_amount: total,
                    credit_amount: 0,
                    description: `Cash received - Invoice ${invoiceNumber}`,
                    entity_type: 'invoice',
                    entity_id: invoiceId
                },
                {
                    tenant_id: tenantId,
                    entry_id: entry.id,
                    line_number: 2,
                    account_id: arAccount.id,
                    debit_amount: 0,
                    credit_amount: total,
                    description: `AR collected - Invoice ${invoiceNumber}`,
                    entity_type: 'invoice',
                    entity_id: invoiceId
                }
            ]);

            // 5. Update account balances via RPC if exists
            await supabaseAdmin.rpc('update_account_balances', {
                p_entry_id: entry.id
            });

        } catch (err) {
            console.error('Failed to post payment to GL:', err);
            // Don't throw - we want the webhook to succeed even if GL post fails (manual reconciliation possible)
        }
    }
};
