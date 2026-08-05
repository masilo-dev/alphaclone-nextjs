import { supabase } from '../lib/supabase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { resolveInvoiceSenderName } from '@/lib/invoices/invoiceBranding';
import { tenantService } from './tenancy/TenantService';

function drawWrappedText(doc: any, text: string, x: number, y: number, maxWidth: number, options: { align?: 'left' | 'center' | 'right'; fontSize?: number; maxLines?: number } = {}): number {
    const lines = doc.splitTextToSize(String(text || '').trim(), maxWidth);
    const safeLines = Array.isArray(lines) ? lines : [String(lines || '')];
    const displayLines = options.maxLines ? safeLines.slice(0, options.maxLines) : safeLines;
    if (options.fontSize) doc.setFontSize(options.fontSize);
    doc.text(displayLines.length ? displayLines : [''], x, y, { align: options.align || 'left' });
    return Math.max(displayLines.length, 1);
}

export interface InvoiceLineItem { description: string; quantity: number; rate: number; amount: number }
export interface BusinessInvoice {
    id: string;
    tenantId: string;
    clientId?: string;
    projectId?: string;
    invoiceNumber: string;
    issueDate: string;
    dueDate: string;
    status: 'draft' | 'sent' | 'viewed' | 'partially_paid' | 'paid' | 'overdue' | 'disputed' | 'void' | 'cancelled';
    subtotal: number;
    taxRate: number;
    tax: number;
    discountAmount: number;
    total: number;
    amountPaid?: number;
    balanceDue?: number;
    autoFollowupEnabled?: boolean;
    lineItems: InvoiceLineItem[];
    notes?: string;
    isPublic: boolean;
    senderName?: string;
    bankDetails?: string;
    mobilePaymentDetails?: string;
    signature?: { type: 'draw' | 'type'; data: string };
    createdAt: string;
    updatedAt: string;
}

function mapInvoice(row: any): BusinessInvoice {
    const lineRows = row.invoice_line_items || row.line_items || [];
    return {
        id: row.id, tenantId: row.tenant_id, clientId: row.client_id, projectId: row.project_id,
        invoiceNumber: row.invoice_number, issueDate: row.issue_date, dueDate: row.due_date, status: row.status,
        subtotal: Number(row.subtotal || 0), taxRate: Number(row.tax_rate || 0), tax: Number(row.tax || 0),
        discountAmount: Number(row.discount_amount || 0), total: Number(row.total || 0), amountPaid: Number(row.amount_paid || 0),
        balanceDue: Number(row.balance_due ?? Number(row.total || 0) - Number(row.amount_paid || 0)), autoFollowupEnabled: row.auto_followup_enabled !== false,
        lineItems: lineRows.map((item: any) => ({ description: item.description, quantity: Number(item.quantity || 0), rate: Number(item.rate ?? item.unit_price ?? 0), amount: Number(item.amount ?? Number(item.quantity || 0) * Number(item.rate ?? item.unit_price ?? 0)) })),
        notes: row.notes, isPublic: Boolean(row.is_public), senderName: row.sender_name, bankDetails: row.bank_details,
        mobilePaymentDetails: row.mobile_payment_details, signature: row.signature, createdAt: row.created_at, updatedAt: row.updated_at,
    };
}

export const businessInvoiceService = {
    normalizeLineItems(lineItems: InvoiceLineItem[] | undefined): InvoiceLineItem[] {
        return (lineItems || []).map((item) => { const quantity = Number(item.quantity || 0); const rate = Number(item.rate || 0); return { description: item.description || '', quantity, rate, amount: Math.round(quantity * rate * 100) / 100 }; });
    },

    parseMetadata(notes: string | undefined): any {
        if (!notes) return null;
        try { const match = notes.match(/---METADATA---([\s\S]*?)---METADATA---/); return match?.[1] ? JSON.parse(match[1]) : null; }
        catch { return null; }
    },

    async getInvoices(tenantId: string): Promise<{ invoices: BusinessInvoice[]; error: string | null }> {
        try {
            const { data, error } = await supabase.from('business_invoices').select('*, invoice_line_items(*)').eq('tenant_id', tenantId).order('created_at', { ascending: false });
            if (error) throw error;
            return { invoices: (data || []).map(mapInvoice), error: null };
        } catch (error) { return { invoices: [], error: error instanceof Error ? error.message : 'Invoices could not be loaded' }; }
    },

    async createInvoice(tenantId: string, invoice: Partial<BusinessInvoice>): Promise<{ invoice: BusinessInvoice | null; error: string | null }> {
        try {
            const lineItems = this.normalizeLineItems(invoice.lineItems);
            const response = await fetch('/api/invoices', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenantId, ...invoice, lineItems }) });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || !payload.invoice) throw new Error(payload.error || 'Invoice could not be created');
            return { invoice: mapInvoice({ ...payload.invoice, line_items: lineItems }), error: null };
        } catch (error) { return { invoice: null, error: error instanceof Error ? error.message : 'Invoice could not be created' }; }
    },

    /**
     * Update an invoice
     */
    async updateInvoice(invoiceId: string, updates: Partial<BusinessInvoice>): Promise<{ error: string | null }> {
        try {
            const tenantId = tenantService.getCurrentTenantId();
            if (!tenantId) return { error: 'Select a workspace before updating an invoice' };
            const body: Record<string, unknown> = { tenantId };
            const mapping: Record<string, string> = { clientId: 'client_id', projectId: 'project_id', issueDate: 'issue_date', dueDate: 'due_date', taxRate: 'tax_rate', discountAmount: 'discount_amount', lineItems: 'line_items', isPublic: 'is_public', senderName: 'sender_name', bankDetails: 'bank_details', mobilePaymentDetails: 'mobile_payment_details' };
            for (const [key, value] of Object.entries(updates)) {
                if (value === undefined || ['id', 'tenantId', 'invoiceNumber', 'createdAt', 'updatedAt'].includes(key)) continue;
                body[mapping[key] || key] = key === 'lineItems' && Array.isArray(value)
                    ? value.map((item: any) => ({ description: item.description, quantity: Number(item.quantity), unit_price: Number(item.rate ?? item.unit_price) }))
                    : value;
            }
            const response = await fetch(`/api/invoices/${encodeURIComponent(invoiceId)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            const payload = await response.json().catch(() => ({}));
            return { error: response.ok ? null : payload.error || 'Invoice could not be updated' };
        } catch (err: any) {
            console.error('Error updating invoice:', err);
            return { error: err.message };
        }
    },

    /**
     * Delete an invoice
     * ACCOUNTING COMPLIANCE: Only draft invoices can be deleted
     * Posted invoices (sent/paid/overdue) must be voided, not deleted
     */
    async deleteInvoice(invoiceId: string): Promise<{ error: string | null }> {
        try {
            const tenantId = tenantService.getCurrentTenantId();
            if (!tenantId) return { error: 'Select a workspace before deleting an invoice' };
            const response = await fetch(`/api/invoices/${encodeURIComponent(invoiceId)}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenantId }) });
            const payload = await response.json().catch(() => ({}));
            return { error: response.ok ? null : payload.error || 'Invoice could not be deleted' };
        } catch (err: any) {
            console.error('Error deleting invoice:', err);
            return { error: err.message };
        }
    },

    async bulkDeleteInvoices(invoiceIds: string[]): Promise<{ error: string | null; count: number; skipped: number }> {
        if (!invoiceIds.length) return { error: null, count: 0, skipped: 0 };
        const uniqueIds = [...new Set(invoiceIds)];
        let count = 0;
        let skipped = 0;
        for (const id of uniqueIds) {
            const { error } = await this.deleteInvoice(id);
            if (error) skipped += 1;
            else count += 1;
        }
        return { error: null, count, skipped };
    },

    /**
     * Generate next invoice number
     * Uses recent invoices and picks the highest numeric suffix to avoid lexicographic collisions.
     */
    async generateInvoiceNumber(tenantId: string): Promise<string> {
        try {
            const { data, error } = await supabase
                .from('business_invoices')
                .select('invoice_number')
                .eq('tenant_id', tenantId)
                .order('created_at', { ascending: false })
                .limit(100);

            if (error) throw error;

            let maxNum = 1000;
            let prefix = 'INV-';

            for (const row of data || []) {
                const lastNumber = row.invoice_number || '';
                const match = lastNumber.match(/\d+/g);
                if (!match?.length) continue;

                const numeric = parseInt(match[match.length - 1], 10);
                if (Number.isNaN(numeric) || numeric < maxNum) continue;

                maxNum = numeric;
                const prefixMatch = lastNumber.match(/^[A-Za-z-]+/);
                if (prefixMatch?.[0]) {
                    prefix = prefixMatch[0];
                }
            }

            const nextNum = maxNum + 1;
            const padding = Math.max(4, String(maxNum).length);
            return `${prefix}${nextNum.toString().padStart(padding, '0')}`;
        } catch (err) {
            console.error('Error generating invoice number:', err);
            return `INV-${Date.now().toString().slice(-8)}`;
        }
    },

    /**
     * Calculate invoice totals
     */
    calculateTotals(lineItems: InvoiceLineItem[], taxRate: number = 0, discountAmount: number = 0): { subtotal: number; tax: number; total: number } {
        const normalized = this.normalizeLineItems(lineItems);
        const subtotal = normalized.reduce((sum, item) => sum + item.amount, 0);
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
    async getInvoiceWithDetails(invoiceId: string, tenantId?: string): Promise<{ invoice: any | null; error: string | null }> {
        try {
            const activeTenantId = tenantId || tenantService.getCurrentTenantId();
            if (!activeTenantId) throw new Error('Select a workspace before loading invoice details');
            let query = supabase
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
                        phone
                    ),
                    project:project_id (
                        id,
                        name
                    )
                `)
                .eq('id', invoiceId);

            query = query.eq('tenant_id', activeTenantId);

            const { data, error } = await query.single();

            if (error) throw error;

            return { invoice: data, error: null };
        } catch (err: any) {
            // Ignore AbortError (common during navigation)
            if (err.name === 'AbortError' || err.message?.includes('AbortError')) {
                return { invoice: null, error: null }; // Return null error to suppress UI alerts
            }
            console.error('Error fetching invoice details:', err);
            return { invoice: null, error: err.message };
        }
    },

    /**
     * Mark invoice as paid
     */
    async markAsPaid(invoiceId: string): Promise<{ error: string | null }> {
        try {
            const tenantId = tenantService.getCurrentTenantId();
            if (!tenantId) throw new Error('Select a workspace before recording payment');
            const { data: invoice, error } = await supabase.from('business_invoices').select('total,amount_paid').eq('tenant_id', tenantId).eq('id', invoiceId).maybeSingle();
            if (error) throw error;
            if (!invoice) throw new Error('Invoice not found');
            const remaining = Math.max(0, Number(invoice.total || 0) - Number(invoice.amount_paid || 0));
            if (!remaining) return { error: null };
            const result = await this.recordPayment(invoiceId, remaining);
            return { error: result.error };
        } catch (err: any) {
            console.error('Error marking invoice as paid:', err);
            return { error: err.message };
        }
    },

    /**
     * Record a payment against an invoice (supports deposits / partials).
     * Updates `amount_paid` and moves status to `partially_paid` or `paid`.
     */
    async recordPayment(
        invoiceId: string,
        amount: number
    ): Promise<{ error: string | null; status?: BusinessInvoice['status']; amountPaid?: number }> {
        try {
            const paymentAmount = Number(amount || 0);
            if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
                return { error: 'Payment amount must be greater than zero.' };
            }
            const tenantId = tenantService.getCurrentTenantId();
            if (!tenantId) throw new Error('Select a workspace before recording payment');
            const response = await fetch(`/api/invoices/${encodeURIComponent(invoiceId)}/payment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tenantId, amount: paymentAmount, idempotencyKey: crypto.randomUUID() }),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || !payload.invoice) throw new Error(payload.error || 'Payment could not be recorded');
            return { error: null, status: payload.invoice.status, amountPaid: Number(payload.invoice.amount_paid || 0) };
        } catch (err: any) {
            console.error('Error recording invoice payment:', err);
            return { error: err.message || 'Failed to record payment' };
        }
    },

    /**
     * Generate a professional PDF for a business invoice
     */
    generatePDF(invoice: any, tenant: any, client: any, signature?: { type: 'draw' | 'type', data: string }, businessSettings?: { trading_name?: string | null; business_name?: string | null }) {
        const metadata = this.parseMetadata(invoice.notes);
        const isReceipt = metadata?.type === 'receipt' || (invoice.invoice_number || invoice.invoiceNumber || '').startsWith('REC-');
        
        const doc = new jsPDF({
            orientation: 'p',
            unit: 'mm',
            format: 'a4'
        });

        // Design Tokens - Refined for "Premium" look
        const colors = {
            primary: '#1e293b',    // Slate-800
            accent: metadata?.accentColor || '#0ea5e9',     // Sky-500
            success: '#10b981',    // Emerald-500
            danger: '#ef4444',     // Red-500
            dark: '#0f172a',       // Slate-900
            light: '#f8fafc',      // Slate-50
            border: '#e2e8f0',     // Slate-200
            text: '#475569',       // Slate-600
            white: '#ffffff',
            muted: '#94a3b8'       // Slate-400
        };

        const margin = 20;
        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;
        const contentWidth = pageWidth - (margin * 2);

        // --- BACKGROUND / ACCENT ---
        doc.setFillColor(colors.primary);
        doc.rect(0, 0, pageWidth, 45, 'F');

        // --- HEADER SECTION ---
        const logoUrl = tenant?.logo_url || tenant?.settings?.branding?.logo;
        const senderName = resolveInvoiceSenderName(
            { senderName: invoice.senderName },
            tenant,
            businessSettings
        );

        // Logo
        if (logoUrl) {
            try {
                // Add logo with error handling
                doc.addImage(logoUrl, 'PNG', margin, 10, 25, 25, undefined, 'FAST');
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(20);
                doc.setTextColor(colors.white);
                drawWrappedText(doc, senderName, margin + 28, 18, 80, { fontSize: 20, maxLines: 2 });

                doc.setFont('helvetica', 'normal');
                doc.setFontSize(9);
                doc.setTextColor(colors.muted);
                doc.text("OFFICIAL FINANCIAL DOCUMENT", margin + 28, 28);
            } catch (e) {
                console.warn('Failed to add logo to PDF:', e);
                // Fallback to text only
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(24);
                doc.setTextColor(colors.white);
                drawWrappedText(doc, senderName, margin, 21, 90, { fontSize: 24, maxLines: 2 });
            }
        } else {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(24);
            doc.setTextColor(colors.white);
            drawWrappedText(doc, senderName, margin, 21, 90, { fontSize: 24, maxLines: 2 });
        }

        // Invoice Label & Number (Right Aligned in header)
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(colors.muted);
        doc.text(isReceipt ? 'RECEIPT NO.' : 'INVOICE NO.', pageWidth - margin, 18, { align: 'right' });

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(colors.white);
        doc.text(invoice.invoice_number || invoice.invoiceNumber, pageWidth - margin, 25, { align: 'right' });

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(colors.muted);
        doc.text(`ISSUED: ${invoice.issue_date || invoice.issueDate}`, pageWidth - margin, 31, { align: 'right' });

        // --- INFO BOXES ---
        let currentY = 55;
        const colWidth = (contentWidth - 10) / 3;

        // 1. FROM (Tenant) Box
        doc.setFillColor(colors.light);
        doc.roundedRect(margin, currentY, colWidth, 55, 2, 2, 'F');
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(colors.accent);
        doc.text('FROM', margin + 5, currentY + 8);
        
        doc.setFontSize(10);
        doc.setTextColor(colors.dark);
        drawWrappedText(doc, senderName, margin + 5, currentY + 16, colWidth - 10, { fontSize: 10, maxLines: 2 });
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(colors.text);
        let fromY = currentY + 22;
        const tenantAddress = tenant?.address || tenant?.settings?.profile?.address;
        const tenantPhone = tenant?.phone || tenant?.settings?.profile?.phone;
        const tenantTaxId = tenant?.vat_number || tenant?.tax_id || tenant?.settings?.profile?.tax_id || tenant?.settings?.profile?.vat_number || tenant?.settings?.profile?.taxId;
        
        if (tenantAddress) {
            const addrText = doc.splitTextToSize(tenantAddress, colWidth - 10);
            doc.text(addrText, margin + 5, fromY);
            fromY += (addrText.length * 4);
        }
        if (tenantPhone) {
            doc.text(`Tel: ${tenantPhone}`, margin + 5, fromY);
            fromY += 4;
        }
        if (tenantTaxId) {
            doc.text(`Tax ID: ${tenantTaxId}`, margin + 5, fromY);
        }

        // 2. CLIENT / BILL TO Box
        doc.setFillColor(colors.light);
        doc.roundedRect(margin + colWidth + 5, currentY, colWidth, 55, 2, 2, 'F');
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(colors.accent);
        doc.text('CLIENT / BILL TO', margin + colWidth + 10, currentY + 8);
        
        doc.setFontSize(10);
        doc.setTextColor(colors.dark);
        const clientName = client?.name || invoice.client?.name || 'Valued Client';
        drawWrappedText(doc, clientName, margin + colWidth + 10, currentY + 16, colWidth - 10, { fontSize: 10, maxLines: 2 });
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(colors.text);
        let detailY = currentY + 22;
        const clientEmail = client?.email || invoice.client?.email;
        const clientCompany = client?.company || invoice.client?.company;
        const clientAddress = client?.address || invoice.client?.address;
        const clientPhone = client?.phone || invoice.client?.phone;
        const clientTaxId = client?.tax_id || invoice.client?.tax_id || client?.vat_number;

        if (clientCompany) {
            doc.text(clientCompany, margin + colWidth + 10, detailY);
            detailY += 4;
        }
        if (clientEmail) {
            doc.text(clientEmail, margin + colWidth + 10, detailY);
            detailY += 4;
        }
        if (clientAddress) {
            const addrText = doc.splitTextToSize(clientAddress, colWidth - 10);
            doc.text(addrText, margin + colWidth + 10, detailY);
            detailY += (addrText.length * 4);
        }
        if (clientPhone) {
            doc.text(`Tel: ${clientPhone}`, margin + colWidth + 10, detailY);
            detailY += 4;
        }
        if (clientTaxId) {
            doc.text(`Tax ID: ${clientTaxId}`, margin + colWidth + 10, detailY);
        }

        // 3. DOCUMENT DETAILS Box
        const status = invoice.status?.toUpperCase() || 'DRAFT';
        const isPaid = status === 'PAID';

        doc.setFillColor(colors.light);
        doc.roundedRect(margin + (colWidth * 2) + 10, currentY, colWidth, 55, 2, 2, 'F');
        
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(colors.accent);
        doc.text('DOCUMENT DETAILS', margin + (colWidth * 2) + 15, currentY + 8);
        
        doc.setFontSize(9);
        doc.setTextColor(colors.text);
        doc.setFont('helvetica', 'normal');
        doc.text('Due Date:', margin + (colWidth * 2) + 15, currentY + 18);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(colors.dark);
        doc.text(invoice.due_date || invoice.dueDate, margin + (colWidth * 2) + 15, currentY + 24);
        
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(colors.text);
        doc.text('Status:', margin + (colWidth * 2) + 15, currentY + 34);
        
        // Status Badge
        const badgeColor = isPaid ? colors.success : (status === 'OVERDUE' ? colors.danger : colors.primary);
        doc.setFillColor(badgeColor);
        doc.roundedRect(margin + (colWidth * 2) + 15, currentY + 38, 25, 6, 1, 1, 'F');
        doc.setFontSize(7);
        doc.setTextColor(colors.white);
        doc.setFont('helvetica', 'bold');
        doc.text(status, margin + (colWidth * 2) + 27.5, currentY + 42.5, { align: 'center' });

        // --- LINE ITEMS TABLE ---
        currentY = 120;

        doc.setFillColor(colors.primary);
        doc.roundedRect(margin, currentY, contentWidth, 10, 1, 1, 'F');

        doc.setFontSize(8);
        doc.setTextColor(colors.white);
        doc.text('DESCRIPTION', margin + 5, currentY + 6.5);
        doc.text('QTY', margin + 100, currentY + 6.5, { align: 'right' });
        doc.text('RATE', margin + 130, currentY + 6.5, { align: 'right' });
        doc.text('AMOUNT', margin + 165, currentY + 6.5, { align: 'right' });

        currentY += 10;
        const items = this.normalizeLineItems(invoice.line_items || invoice.lineItems || []);

        items.forEach((item: any, index: number) => {
            if (index % 2 === 1) {
                doc.setFillColor(252, 252, 253);
                doc.rect(margin, currentY, contentWidth, 10, 'F');
            }

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.setTextColor(colors.text);

            const desc = item.description.length > 55 ? item.description.substring(0, 52) + '...' : item.description;
            doc.text(desc, margin + 5, currentY + 6.5);
            doc.text(item.quantity.toString(), margin + 100, currentY + 6.5, { align: 'right' });
            doc.text(`$${item.rate.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, margin + 130, currentY + 6.5, { align: 'right' });
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(colors.dark);
            doc.text(`$${item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, margin + 165, currentY + 6.5, { align: 'right' });

            doc.setDrawColor(colors.border);
            doc.setLineWidth(0.1);
            doc.line(margin, currentY + 10, margin + contentWidth, currentY + 10);

            currentY += 10;
        });

        // --- TOTALS ---
        currentY += 10;
        const totalsX = pageWidth - margin - 60;
        const subtotalFromItems = Math.round(items.reduce((sum, item) => sum + item.amount, 0) * 100) / 100;
        const discount = Number(invoice.discountAmount || invoice.discount_amount || 0);
        const resolvedTaxRate = Number(invoice.taxRate ?? invoice.tax_rate ?? 0);
        const computedTax = Math.round(Math.max(0, subtotalFromItems - discount) * (resolvedTaxRate / 100) * 100) / 100;
        const subtotal = Number.isFinite(Number(invoice.subtotal)) ? Number(invoice.subtotal) : subtotalFromItems;
        const tax = Number.isFinite(Number(invoice.tax)) ? Number(invoice.tax) : computedTax;
        const total = Number.isFinite(Number(invoice.total))
            ? Number(invoice.total)
            : Math.round(((subtotalFromItems - discount) + computedTax) * 100) / 100;

        doc.setFontSize(9);
        doc.setTextColor(colors.text);
        doc.setFont('helvetica', 'normal');
        doc.text('Subtotal:', totalsX, currentY);
        doc.text(`$${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, pageWidth - margin, currentY, { align: 'right' });

        if (tax > 0) {
            currentY += 6;
            doc.text(`Tax (${resolvedTaxRate}%):`, totalsX, currentY);
            doc.text(`$${tax.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, pageWidth - margin, currentY, { align: 'right' });
        }

        if (discount > 0) {
            currentY += 6;
            doc.text('Discount:', totalsX, currentY);
            doc.text(`-$${discount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, pageWidth - margin, currentY, { align: 'right' });
        }

        currentY += 10;
        doc.setFillColor(colors.primary);
        doc.roundedRect(totalsX - 5, currentY - 7, 70, 12, 1, 1, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(colors.white);
        doc.text('TOTAL AMOUNT:', totalsX, currentY);
        doc.text(`$${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, pageWidth - margin, currentY, { align: 'right' });

        // --- PAYMENT & NOTES ---
        currentY += 30;
        if (invoice.bankDetails || invoice.notes) {
            doc.setFontSize(9);
            doc.setTextColor(colors.accent);
            doc.text('POLICIES & PAYMENT', margin, currentY);

            doc.setDrawColor(colors.accent);
            doc.setLineWidth(0.5);
            doc.line(margin, currentY + 2, margin + 40, currentY + 2);

            currentY += 10;
            doc.setFontSize(8);
            doc.setTextColor(colors.text);
            doc.setFont('helvetica', 'normal');

            if (invoice.bankDetails) {
                const bText = doc.splitTextToSize(`Bank: ${invoice.bankDetails}`, 90);
                doc.text(bText, margin, currentY);
                currentY += (bText.length * 4) + 5;
            }

            if (invoice.notes) {
                // If it's a receipt with metadata, strip the metadata from the displayed notes
                let displayNotes = invoice.notes;
                if (isReceipt && metadata) {
                    displayNotes = displayNotes.replace(/---METADATA---[\s\S]*?---METADATA---\s*/, '');
                }
                
                if (displayNotes.trim()) {
                    const nText = doc.splitTextToSize(`Notes: ${displayNotes}`, 150);
                    doc.text(nText, margin, currentY);
                }
            }
        }

        // --- SIGNATURE ---
        if (signature) {
            const sigY = pageHeight - 50;
            doc.setDrawColor(colors.border);
            doc.line(pageWidth - margin - 60, sigY + 10, pageWidth - margin, sigY + 10);
            doc.setFontSize(8);
            doc.text('AUTHORIZED SIGNATURE', pageWidth - margin - 60, sigY + 15);

            if (signature.type === 'draw' && signature.data) {
                try {
                    const cleanSigData = signature.data.includes(',') ? signature.data.split(',')[1] : signature.data;
                    doc.addImage(cleanSigData, 'PNG', pageWidth - margin - 55, sigY - 15, 50, 20);
                } catch (e) { }
            } else if (signature.type === 'type' && signature.data) {
                doc.setFont('times', 'italic');
                doc.setFontSize(14);
                doc.text(signature.data, pageWidth - margin - 60, sigY + 5);
            }
        }

        // --- FOOTER ---
        doc.setFontSize(8);
        doc.setTextColor(colors.muted);
        doc.text(`Page 1 of 1 | Generated via AlphaClone OS Compliance v2026.1`, pageWidth / 2, pageHeight - 10, { align: 'center' });

        return doc;
    },

    /**
     * Stages a 1-click payment reminder notification for an overdue invoice.
     * Marks the invoice lifecycle_status as 'reminder_sent' and returns the staged email body.
     */
    async sendPaymentReminder(invoiceId: string, clientName: string, balanceDue: number, dueDate: string): Promise<{ success: boolean; message: string; error: string | null }> {
        try {
            const tenantId = tenantService.getCurrentTenantId();
            if (!tenantId) throw new Error('Select a workspace before sending a reminder');

            // Stage the lifecycle status update so the team knows a reminder was triggered
            await supabase
                .from('business_invoices')
                .update({ lifecycle_status: 'reminder_sent' })
                .eq('tenant_id', tenantId)
                .eq('id', invoiceId);

            const message = `Dear ${clientName},\n\nThis is a friendly reminder that your invoice of $${balanceDue.toFixed(2)} was due on ${dueDate} and remains outstanding.\n\nPlease arrange payment at your earliest convenience.\n\nThank you for your prompt attention.\n\nAlphaClone Billing Team`;

            return { success: true, message, error: null };
        } catch (err: any) {
            console.error('[businessInvoiceService] sendPaymentReminder error:', err);
            return { success: false, message: '', error: err.message || 'Failed to stage payment reminder' };
        }
    },

};
