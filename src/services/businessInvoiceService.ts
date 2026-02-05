import { supabase } from '../lib/supabase';
import { jsPDF } from 'jspdf';

export interface BusinessInvoice {
    id: string;
    tenantId: string;
    clientId?: string;
    projectId?: string;
    invoiceNumber: string;
    issueDate: string;
    dueDate: string;
    status: 'draft' | 'sent' | 'paid' | 'overdue';
    subtotal: number;
    taxRate: number;
    tax: number;
    discountAmount: number;
    total: number;
    lineItems: InvoiceLineItem[];
    notes?: string;
    isPublic: boolean;
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
                projectId: inv.project_id,
                invoiceNumber: inv.invoice_number,
                issueDate: inv.issue_date,
                dueDate: inv.due_date,
                status: inv.status,
                subtotal: parseFloat(inv.subtotal || 0),
                taxRate: parseFloat(inv.tax_rate || 0),
                tax: parseFloat(inv.tax || 0),
                discountAmount: parseFloat(inv.discount_amount || 0),
                total: parseFloat(inv.total || 0),
                lineItems: inv.line_items || [],
                notes: inv.notes,
                isPublic: inv.is_public || false,
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
                    project_id: invoice.projectId,
                    invoice_number: invoiceNumber,
                    issue_date: invoice.issueDate || new Date().toISOString().split('T')[0],
                    due_date: invoice.dueDate,
                    status: invoice.status || 'draft',
                    subtotal: invoice.subtotal || 0,
                    tax_rate: invoice.taxRate || 0,
                    tax: invoice.tax || 0,
                    discount_amount: invoice.discountAmount || 0,
                    total: invoice.total || 0,
                    line_items: invoice.lineItems || [],
                    notes: invoice.notes,
                    is_public: invoice.isPublic || false
                })
                .select()
                .single();

            if (error) throw error;

            const newInvoice: BusinessInvoice = {
                id: data.id,
                tenantId: data.tenant_id,
                clientId: data.client_id,
                projectId: data.project_id,
                invoiceNumber: data.invoice_number,
                issueDate: data.issue_date,
                dueDate: data.due_date,
                status: data.status,
                subtotal: parseFloat(data.subtotal || 0),
                taxRate: parseFloat(data.tax_rate || 0),
                tax: parseFloat(data.tax || 0),
                discountAmount: parseFloat(data.discount_amount || 0),
                total: parseFloat(data.total || 0),
                lineItems: data.line_items || [],
                notes: data.notes,
                isPublic: data.is_public || false,
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
            if (updates.projectId !== undefined) updateData.project_id = updates.projectId;
            if (updates.issueDate !== undefined) updateData.issue_date = updates.issueDate;
            if (updates.dueDate !== undefined) updateData.due_date = updates.dueDate;
            if (updates.status !== undefined) updateData.status = updates.status;
            if (updates.subtotal !== undefined) updateData.subtotal = updates.subtotal;
            if (updates.taxRate !== undefined) updateData.tax_rate = updates.taxRate;
            if (updates.tax !== undefined) updateData.tax = updates.tax;
            if (updates.discountAmount !== undefined) updateData.discount_amount = updates.discountAmount;
            if (updates.total !== undefined) updateData.total = updates.total;
            if (updates.lineItems !== undefined) updateData.line_items = updates.lineItems;
            if (updates.notes !== undefined) updateData.notes = updates.notes;
            if (updates.isPublic !== undefined) updateData.is_public = updates.isPublic;

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
    calculateTotals(lineItems: InvoiceLineItem[], taxRate: number = 0, discountAmount: number = 0): { subtotal: number; tax: number; total: number } {
        const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
        const tax = (subtotal - discountAmount) * (taxRate / 100);
        const total = (subtotal - discountAmount) + tax;

        return {
            subtotal: Math.round(subtotal * 100) / 100,
            tax: Math.round(tax * 100) / 100,
            total: Math.round(total * 100) / 100
        };
    },

    /**
     * Get an invoice with its related tenant and client details
     */
    async getInvoiceWithDetails(invoiceId: string): Promise<{ invoice: any | null; error: string | null }> {
        try {
            const { data, error } = await supabase
                .from('business_invoices')
                .select(`
                    *,
                    tenant:tenant_id (
                        id,
                        name,
                        slug
                    ),
                    client:client_id (
                        id,
                        name,
                        email,
                        company,
                        phone
                    ),
                    project:project_id (
                        id,
                        name
                    )
                `)
                .eq('id', invoiceId)
                .single();

            if (error) throw error;

            return { invoice: data, error: null };
        } catch (err: any) {
            console.error('Error fetching invoice details:', err);
            return { invoice: null, error: err.message };
        }
    },

    /**
     * Mark invoice as paid
     */
    async markAsPaid(invoiceId: string): Promise<{ error: string | null }> {
        try {
            const { error } = await supabase
                .from('business_invoices')
                .update({ status: 'paid', updated_at: new Date().toISOString() })
                .eq('id', invoiceId);

            if (error) throw error;
            return { error: null };
        } catch (err: any) {
            console.error('Error marking invoice as paid:', err);
            return { error: err.message };
        }
    },

    /**
     * Generate a professional PDF for a business invoice
     */
    generatePDF(invoice: any, tenant: any, client: any) {
        const doc = new jsPDF();
        const primaryColor = '#14b8a6'; // Teal-500

        // Header - Company Info
        doc.setFillColor(248, 250, 252); // slate-50
        doc.rect(0, 0, 210, 60, 'F');

        // Logo Integration
        const logoUrl = tenant.logo_url || tenant.settings?.branding?.logo;
        if (logoUrl) {
            try {
                // Approximate position for logo
                doc.addImage(logoUrl, 'PNG', 20, 10, 25, 25);
                doc.setFontSize(24);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(15, 23, 42); // slate-900
                doc.text(tenant.name || 'Company Name', 50, 28);
            } catch (e) {
                console.error('Failed to add logo to PDF:', e);
                doc.setFontSize(24);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(15, 23, 42); // slate-900
                doc.text(tenant.name || 'Company Name', 20, 30);
            }
        } else {
            doc.setFontSize(24);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(15, 23, 42); // slate-900
            doc.text(tenant.name || 'Company Name', 20, 30);
        }

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 116, 139); // slate-500
        doc.text('Business Professional Services', logoUrl ? 50 : 20, logoUrl ? 36 : 38);

        // Right side - Invoice Label
        doc.setFontSize(32);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(primaryColor);
        doc.text('INVOICE', 140, 35);

        // Invoice Metadata
        doc.setFontSize(10);
        doc.setTextColor(71, 85, 105); // slate-600
        doc.text(`Invoice Number:`, 140, 45);
        doc.setFont('helvetica', 'bold');
        doc.text(invoice.invoice_number || invoice.invoiceNumber, 175, 45);

        doc.setFont('helvetica', 'normal');
        doc.text(`Issue Date:`, 140, 50);
        doc.text(invoice.issue_date || invoice.issueDate, 175, 50);

        doc.text(`Due Date:`, 140, 55);
        doc.setTextColor(225, 29, 72); // rose-600 for due date
        doc.text(invoice.due_date || invoice.dueDate, 175, 55);

        // Billing Details
        doc.setTextColor(15, 23, 42); // slate-900
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('BILL TO:', 20, 80);

        if (client && client.name) {
            doc.setFontSize(11);
            doc.text(client.name || 'Client Name', 20, 88);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(71, 85, 105); // slate-600
            if (client.company) doc.text(client.company, 20, 93);
            if (client.email) doc.text(client.email, 20, 98);
            if (client.phone) doc.text(client.phone, 20, 103);
        } else {
            doc.setFontSize(11);
            doc.setFont('helvetica', 'italic');
            doc.setTextColor(148, 163, 184); // slate-400
            doc.text('Individual Standalone Client', 20, 88);
        }

        // Project Info
        if (invoice.project) {
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(15, 23, 42);
            doc.text('PROJECT:', 120, 80);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(71, 85, 105);
            doc.text(invoice.project.name || 'Project Name', 120, 88);
        }

        // Table Header
        let y = 120;
        doc.setFillColor(15, 23, 42); // slate-900
        doc.rect(20, y, 170, 10, 'F');

        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 255, 255);
        doc.text('DESCRIPTION', 25, y + 6.5);
        doc.text('QTY', 120, y + 6.5);
        doc.text('RATE', 145, y + 6.5);
        doc.text('AMOUNT', 170, y + 6.5);

        // Items
        y += 18;
        doc.setTextColor(15, 23, 42);
        doc.setFont('helvetica', 'normal');
        const items = invoice.line_items || invoice.lineItems || [];

        items.forEach((item: any, idx: number) => {
            doc.text(item.description, 25, y);
            doc.text(item.quantity.toString(), 120, y);
            doc.text(`$${item.rate.toFixed(2)}`, 145, y);
            doc.text(`$${item.amount.toFixed(2)}`, 170, y);
            y += 10;

            // Subtle line
            doc.setDrawColor(241, 245, 249); // slate-100
            doc.line(20, y - 6, 190, y - 6);
        });

        // Totals
        y += 10;
        const subtotal = invoice.subtotal;
        const discount = invoice.discountAmount || invoice.discount_amount || 0;
        const taxRate = invoice.taxRate || invoice.tax_rate || 0;
        const tax = invoice.tax || 0;
        const total = invoice.total;

        doc.setFont('helvetica', 'normal');
        doc.text('Subtotal:', 140, y);
        doc.text(`$${subtotal.toFixed(2)}`, 170, y);

        if (discount > 0) {
            y += 8;
            doc.setTextColor(239, 68, 68); // Red for discount
            doc.text('Discount:', 140, y);
            doc.text(`-$${discount.toFixed(2)}`, 170, y);
            doc.setTextColor(15, 23, 42); // Reset color
        }

        y += 8;
        doc.text(`Tax (${taxRate}%):`, 140, y);
        doc.text(`$${tax.toFixed(2)}`, 170, y);

        y += 12;
        doc.setFillColor(248, 250, 252);
        doc.rect(135, y - 8, 55, 12, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(primaryColor);
        doc.text('TOTAL:', 140, y);
        doc.text(`$${total.toFixed(2)}`, 165, y);

        // Footer
        const pageHeight = doc.internal.pageSize.height;
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184); // slate-400
        doc.text('Thank you for your business!', 105, pageHeight - 30, { align: 'center' });
        doc.text('This invoice was generated electronically by AlphaClone Finance Engine.', 105, pageHeight - 25, { align: 'center' });
        doc.text(`© ${new Date().getFullYear()} ${tenant.name}. All Rights Reserved.`, 105, pageHeight - 20, { align: 'center' });

        return doc;
    }
};
