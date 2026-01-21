import { supabase } from '../lib/supabase';

export interface BusinessInvoice {
    id: string;
    tenantId: string;
    clientId?: string;
    invoiceNumber: string;
    issueDate: string;
    dueDate: string;
    status: 'draft' | 'sent' | 'paid' | 'overdue';
    subtotal: number;
    tax: number;
    total: number;
    lineItems: InvoiceLineItem[];
    notes?: string;
    createdAt: string;
    updatedAt: string;
}

export interface InvoiceLineItem {
    description: string;
    quantity: number;
    rate: number;
    amount: number;
}

export const businessInvoiceService = {
    /**
     * Get all invoices for a tenant
     */
    async getInvoices(tenantId: string): Promise<{ invoices: BusinessInvoice[]; error: string | null }> {
        try {
            const { data, error } = await supabase
                .from('business_invoices')
                .select('*')
                .eq('tenant_id', tenantId)
                .order('created_at', { ascending: false });

            if (error) throw error;

            const invoices = (data || []).map((inv: any) => ({
                id: inv.id,
                tenantId: inv.tenant_id,
                clientId: inv.client_id,
                invoiceNumber: inv.invoice_number,
                issueDate: inv.issue_date,
                dueDate: inv.due_date,
                status: inv.status,
                subtotal: parseFloat(inv.subtotal || 0),
                tax: parseFloat(inv.tax || 0),
                total: parseFloat(inv.total || 0),
                lineItems: inv.line_items || [],
                notes: inv.notes,
                createdAt: inv.created_at,
                updatedAt: inv.updated_at
            }));

            return { invoices, error: null };
        } catch (err: any) {
            console.error('Error fetching invoices:', err);
            return { invoices: [], error: err.message };
        }
    },

    /**
     * Create a new invoice
     */
    async createInvoice(tenantId: string, invoice: Partial<BusinessInvoice>): Promise<{ invoice: BusinessInvoice | null; error: string | null }> {
        try {
            // Generate invoice number if not provided
            const invoiceNumber = invoice.invoiceNumber || await this.generateInvoiceNumber(tenantId);

            const { data, error } = await supabase
                .from('business_invoices')
                .insert({
                    tenant_id: tenantId,
                    client_id: invoice.clientId,
                    invoice_number: invoiceNumber,
                    issue_date: invoice.issueDate || new Date().toISOString().split('T')[0],
                    due_date: invoice.dueDate,
                    status: invoice.status || 'draft',
                    subtotal: invoice.subtotal || 0,
                    tax: invoice.tax || 0,
                    total: invoice.total || 0,
                    line_items: invoice.lineItems || [],
                    notes: invoice.notes
                })
                .select()
                .single();

            if (error) throw error;

            const newInvoice: BusinessInvoice = {
                id: data.id,
                tenantId: data.tenant_id,
                clientId: data.client_id,
                invoiceNumber: data.invoice_number,
                issueDate: data.issue_date,
                dueDate: data.due_date,
                status: data.status,
                subtotal: parseFloat(data.subtotal || 0),
                tax: parseFloat(data.tax || 0),
                total: parseFloat(data.total || 0),
                lineItems: data.line_items || [],
                notes: data.notes,
                createdAt: data.created_at,
                updatedAt: data.updated_at
            };

            return { invoice: newInvoice, error: null };
        } catch (err: any) {
            console.error('Error creating invoice:', err);
            return { invoice: null, error: err.message };
        }
    },

    /**
     * Update an invoice
     */
    async updateInvoice(invoiceId: string, updates: Partial<BusinessInvoice>): Promise<{ error: string | null }> {
        try {
            const updateData: Record<string, any> = {};

            if (updates.clientId !== undefined) updateData.client_id = updates.clientId;
            if (updates.issueDate !== undefined) updateData.issue_date = updates.issueDate;
            if (updates.dueDate !== undefined) updateData.due_date = updates.dueDate;
            if (updates.status !== undefined) updateData.status = updates.status;
            if (updates.subtotal !== undefined) updateData.subtotal = updates.subtotal;
            if (updates.tax !== undefined) updateData.tax = updates.tax;
            if (updates.total !== undefined) updateData.total = updates.total;
            if (updates.lineItems !== undefined) updateData.line_items = updates.lineItems;
            if (updates.notes !== undefined) updateData.notes = updates.notes;

            updateData.updated_at = new Date().toISOString();

            const { error } = await supabase
                .from('business_invoices')
                .update(updateData)
                .eq('id', invoiceId);

            if (error) throw error;

            return { error: null };
        } catch (err: any) {
            console.error('Error updating invoice:', err);
            return { error: err.message };
        }
    },

    /**
     * Delete an invoice
     */
    async deleteInvoice(invoiceId: string): Promise<{ error: string | null }> {
        try {
            const { error } = await supabase
                .from('business_invoices')
                .delete()
                .eq('id', invoiceId);

            if (error) throw error;

            return { error: null };
        } catch (err: any) {
            console.error('Error deleting invoice:', err);
            return { error: err.message };
        }
    },

    /**
     * Generate next invoice number
     */
    async generateInvoiceNumber(tenantId: string): Promise<string> {
        try {
            const { data } = await supabase
                .from('business_invoices')
                .select('invoice_number')
                .eq('tenant_id', tenantId)
                .order('created_at', { ascending: false })
                .limit(1);

            if (data && data.length > 0) {
                const lastNumber = data[0].invoice_number;
                const match = lastNumber.match(/\d+$/);
                if (match) {
                    const nextNum = parseInt(match[0]) + 1;
                    return `INV-${nextNum.toString().padStart(4, '0')}`;
                }
            }

            return 'INV-0001';
        } catch (err) {
            console.error('Error generating invoice number:', err);
            return `INV-${Date.now()}`;
        }
    },

    /**
     * Calculate invoice totals
     */
    calculateTotals(lineItems: InvoiceLineItem[], taxRate: number = 0): { subtotal: number; tax: number; total: number } {
        const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
        const tax = subtotal * (taxRate / 100);
        const total = subtotal + tax;

        return {
            subtotal: Math.round(subtotal * 100) / 100,
            tax: Math.round(tax * 100) / 100,
            total: Math.round(total * 100) / 100
        };
    }
};
