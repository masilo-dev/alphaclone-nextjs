import { supabase } from '../lib/supabase';
import jsPDF from 'jspdf';
import { journalEntryService } from './accounting/journalEntryService';
import { chartOfAccountsService } from './accounting/chartOfAccountsService';
import { activityService } from './activityService';
import { quotaService } from './quotaService';

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
    lineItems: InvoiceLineItem[];
    notes?: string;
    isPublic: boolean;
    senderName?: string;
    bankDetails?: string;
    mobilePaymentDetails?: string;
    signature?: { type: 'draw' | 'type', data: string };
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
    normalizeLineItems(lineItems: InvoiceLineItem[] | undefined): InvoiceLineItem[] {
        const items = Array.isArray(lineItems) ? lineItems : [];
        return items.map((item) => {
            const quantity = Number(item?.quantity || 0);
            const rate = Number(item?.rate || 0);
            const amount = Math.round(quantity * rate * 100) / 100;
            return {
                description: item?.description || '',
                quantity,
                rate,
                amount,
            };
        });
    },

    /**
     * Parse receipt metadata from notes field
     */
    parseMetadata(notes: string | undefined): any {
        if (!notes) return null;
        try {
            const match = notes.match(/---METADATA---([\s\S]*?)---METADATA---/);
            if (match && match[1]) {
                return JSON.parse(match[1]);
            }
        } catch (e) {
            console.error('Error parsing metadata:', e);
        }
        return null;
    },

    /**
     * Get all invoices for a tenant
     */
    async getInvoices(tenantId: string): Promise<{ invoices: BusinessInvoice[]; error: string | null }> {
        try {
            const { data, error } = await supabase
                .from('business_invoices')
                .select(`
                    *,
                    invoice_line_items(*)
                `)
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
                lineItems: (inv.invoice_line_items || []).map((li: any) => ({
                    description: li.description,
                    quantity: parseFloat(li.quantity),
                    rate: parseFloat(li.unit_price),
                    amount: parseFloat(li.amount)
                })),
                notes: inv.notes,
                isPublic: inv.is_public || false,
                senderName: inv.sender_name,
                bankDetails: inv.bank_details,
                mobilePaymentDetails: inv.mobile_payment_details,
                signature: inv.signature,
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
            // Check quota limits
            if (invoice.status !== 'draft') {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) throw new Error('Authentication required');

                const quotaCheck = await quotaService.checkQuota('invoices', user.id);
                if (!quotaCheck.allowed) {
                    return { invoice: null, error: quotaCheck.message };
                }
            }

            // Generate invoice number if not provided
            const invoiceNumber = invoice.invoiceNumber || await this.generateInvoiceNumber(tenantId);

            // Calculate default due date (14 days from issue date or today)
            const issueDateObj = invoice.issueDate ? new Date(invoice.issueDate) : new Date();
            const defaultDueDate = new Date(issueDateObj.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

            const payload = {
                tenant_id: tenantId,
                client_id: invoice.clientId || null,
                project_id: invoice.projectId || null,
                invoice_number: invoiceNumber,
                issue_date: invoice.issueDate || new Date().toISOString().split('T')[0],
                due_date: invoice.dueDate || defaultDueDate, // Fix: Use default instead of null
                status: invoice.status || 'draft',
                subtotal: invoice.subtotal || 0,
                tax_rate: invoice.taxRate || 0,
                tax: invoice.tax || 0,
                discount_amount: invoice.discountAmount || 0,
                total: invoice.total || 0,
                line_items: invoice.lineItems || [],
                notes: invoice.notes,
                is_public: invoice.isPublic || false,
                sender_name: invoice.senderName,
                bank_details: invoice.bankDetails,
                mobile_payment_details: invoice.mobilePaymentDetails,
                signature: invoice.signature || null
            };

            // Debug logging
            console.log('Creating invoice with payload:', payload);

            let insertError;
            let retryCount = 0;
            const maxRetries = 2;
            let currentPayload = { ...payload };
            let finalData;

            while (retryCount <= maxRetries) {
                const { data, error } = await supabase
                    .from('business_invoices')
                    .insert(currentPayload)
                    .select()
                    .single();

                if (!error) {
                    finalData = data;
                    break;
                }

                insertError = error;
                // Check for duplicate key violation (PostgreSQL error code 23505)
                if (error.code === '23505' && error.message?.includes('invoice_number')) {
                    console.warn(`Duplicate invoice number detected. Retry ${retryCount + 1}/${maxRetries}...`);
                    const nextInvoiceNumber = await this.generateInvoiceNumber(tenantId);
                    currentPayload.invoice_number = nextInvoiceNumber;
                    retryCount++;
                } else {
                    // Not a duplicate key error we can handle by retrying
                    break;
                }
            }

            if (!finalData) {
                console.error('Final attempt to create invoice failed:', insertError);
                throw insertError;
            }

            const data = finalData;

            // NEW: Insert line items into relational table
            if (invoice.lineItems && invoice.lineItems.length > 0) {
                const lineItemsPayload = invoice.lineItems.map(item => ({
                    invoice_id: data.id,
                    tenant_id: tenantId,
                    description: item.description,
                    quantity: item.quantity,
                    unit_price: item.rate
                }));

                const { error: lineItemsError } = await supabase
                    .from('invoice_line_items')
                    .insert(lineItemsPayload);

                if (lineItemsError) {
                    console.error('Error inserting relational line items:', lineItemsError);
                    // We don't throw here to avoid failing the whole invoice creation,
                    // but ideally we should use a transaction.
                }
            }

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
                senderName: data.sender_name,
                bankDetails: data.bank_details,
                mobilePaymentDetails: data.mobile_payment_details,
                signature: data.signature,
                createdAt: data.created_at,
                updatedAt: data.updated_at
            };

            if (newInvoice.id) {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    await activityService.logAudit({
                        userId: user.id,
                        tenantId: newInvoice.tenantId,
                        action: 'INVOICE_CREATE',
                        resourceType: 'business_invoices',
                        resourceId: newInvoice.id,
                        oldValues: null,
                        newValues: {
                            status: newInvoice.status,
                            total: newInvoice.total,
                            clientId: newInvoice.clientId,
                            invoiceNumber: newInvoice.invoiceNumber
                        },
                        metadata: {
                            invoiceNumber: newInvoice.invoiceNumber,
                            amount: newInvoice.total
                        }
                    });
                }

                // Increment quota usage if invoice is not draft
                if (newInvoice.status !== 'draft') {
                    const { data: { user } } = await supabase.auth.getUser();
                    if (user) {
                        const { success: quotaSuccess, error: quotaError } = await quotaService.incrementQuota('invoices', user.id);
                        if (!quotaSuccess) {
                            console.warn('Failed to increment invoice quota:', quotaError);
                        }
                    }
                }
            }

            return { invoice: newInvoice, error: null };
        } catch (err: any) {
            console.error('Error creating invoice:', err);
            // Enhanced logging for non-enumerable properties (like Error objects)
            if (typeof err === 'object' && err !== null) {
                console.error('Error details (JSON):', JSON.stringify(err, Object.getOwnPropertyNames(err)));
            }
            return { invoice: null, error: err.message || 'Unknown error occurred during invoice creation' };
        }
    },

    /**
     * Update an invoice
     */
    async updateInvoice(invoiceId: string, updates: Partial<BusinessInvoice>): Promise<{ error: string | null }> {
        try {
            // Get current invoice data to detect status changes
            const { data: currentInvoice, error: fetchError } = await supabase
                .from('business_invoices')
                .select('*')
                .eq('id', invoiceId)
                .single();

            if (fetchError) throw fetchError;

            const updateData: Record<string, any> = {};

            if (updates.clientId !== undefined) updateData.client_id = updates.clientId || null;
            if (updates.projectId !== undefined) updateData.project_id = updates.projectId || null;
            if (updates.issueDate !== undefined) updateData.issue_date = updates.issueDate;

            // Fix: due_date is NOT NULL, so fallback to calculated date if cleared
            if (updates.dueDate !== undefined) {
                const baseDate = updates.issueDate ? new Date(updates.issueDate) : new Date();
                const defaultDue = new Date(baseDate.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                updateData.due_date = updates.dueDate || defaultDue;
            }

            if (updates.status !== undefined) updateData.status = updates.status;
            if (updates.subtotal !== undefined) updateData.subtotal = updates.subtotal;
            if (updates.taxRate !== undefined) updateData.tax_rate = updates.taxRate;
            if (updates.tax !== undefined) updateData.tax = updates.tax;
            if (updates.discountAmount !== undefined) updateData.discount_amount = updates.discountAmount;
            if (updates.total !== undefined) updateData.total = updates.total;
            if (updates.lineItems !== undefined) updateData.line_items = updates.lineItems;
            if (updates.notes !== undefined) updateData.notes = updates.notes;
            if (updates.isPublic !== undefined) updateData.is_public = updates.isPublic;
            if (updates.senderName !== undefined) updateData.sender_name = updates.senderName;
            if (updates.bankDetails !== undefined) updateData.bank_details = updates.bankDetails;
            if (updates.mobilePaymentDetails !== undefined) updateData.mobile_payment_details = updates.mobilePaymentDetails;
            if (updates.signature !== undefined) updateData.signature = updates.signature;

            updateData.updated_at = new Date().toISOString();

            const { error } = await supabase
                .from('business_invoices')
                .update(updateData)
                .eq('id', invoiceId);

            if (error) throw error;

            // NEW: Update relational line items
            if (updates.lineItems !== undefined) {
                // Delete existing items
                await supabase
                    .from('invoice_line_items')
                    .delete()
                    .eq('invoice_id', invoiceId);

                // Insert new ones
                if (updates.lineItems.length > 0) {
                    const lineItemsPayload = updates.lineItems.map(item => ({
                        invoice_id: invoiceId,
                        tenant_id: currentInvoice.tenant_id,
                        description: item.description,
                        quantity: item.quantity,
                        unit_price: item.rate
                    }));

                    const { error: lineItemsError } = await supabase
                        .from('invoice_line_items')
                        .insert(lineItemsPayload);

                    if (lineItemsError) {
                        console.error('Error updating relational line items:', lineItemsError);
                    }
                }
            }

            // Log activity with diff
            const { data: { user } } = await supabase.auth.getUser();
            if (user && currentInvoice) {
                const diffBefore: Record<string, any> = {};
                const diffAfter: Record<string, any> = {};

                // Map field names for consistent audit diffs (camelCase)
                const fieldMapping: Record<string, string> = {
                    client_id: 'clientId',
                    project_id: 'projectId',
                    issue_date: 'issueDate',
                    due_date: 'dueDate',
                    status: 'status',
                    subtotal: 'subtotal',
                    tax_rate: 'taxRate',
                    tax: 'tax',
                    discount_amount: 'discountAmount',
                    total: 'total',
                    line_items: 'lineItems',
                    notes: 'notes',
                    is_public: 'isPublic',
                    sender_name: 'senderName',
                    bank_details: 'bankDetails',
                    mobile_payment_details: 'mobilePaymentDetails',
                    signature: 'signature'
                };

                // Only include changed fields in the audit diff
                Object.keys(updateData).forEach(dbKey => {
                    if (dbKey === 'updated_at') return;
                    const oldVal = currentInvoice[dbKey];
                    const newVal = updateData[dbKey];
                    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
                        const label = fieldMapping[dbKey] || dbKey;
                        diffBefore[label] = oldVal;
                        diffAfter[label] = newVal;
                    }
                });

                if (Object.keys(diffAfter).length > 0) {
                    await activityService.logAudit({
                        userId: user.id,
                        tenantId: currentInvoice.tenant_id,
                        action: 'INVOICE_UPDATE',
                        resourceType: 'business_invoices',
                        resourceId: invoiceId,
                        oldValues: diffBefore,
                        newValues: diffAfter,
                        metadata: {
                            invoiceNumber: currentInvoice.invoice_number
                        }
                    });
                }
            }

            // GL INTEGRATION: Post to accounting when status changes
            if (updates.status && currentInvoice) {
                const oldStatus = currentInvoice.status;
                const newStatus = updates.status;

                // Revenue recognition policy: recognize on payment receipt, not on send.
                if (newStatus === 'paid' && oldStatus !== 'paid') {
                    await this.postRevenueOnPayment(invoiceId, currentInvoice);
                    // Fire and forget receipt automation
                    this.triggerReceiptAutomation(invoiceId, currentInvoice.tenant_id).catch(console.error);
                }
            }

            return { error: null };
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
            // CRITICAL: Check invoice status before deletion
            const { data: existing, error: fetchError } = await supabase
                .from('business_invoices')
                .select('status, invoice_number')
                .eq('id', invoiceId)
                .single();

            if (fetchError) {
                return { error: fetchError.message };
            }

            // ACCOUNTING PROTECTION: Prevent deletion of posted invoices
            if (existing?.status !== 'draft') {
                return {
                    error: `Cannot delete ${existing?.status} invoice ${existing?.invoice_number}. Posted invoices must be voided/cancelled to maintain audit trail.`
                };
            }

            // Only draft invoices can be permanently deleted
            const { error } = await supabase
                .from('business_invoices')
                .delete()
                .eq('id', invoiceId);

            if (error) throw error;

            // Log audit
            const { data: { user } } = await supabase.auth.getUser();
            if (user && existing) {
                await activityService.logAudit({
                    userId: user.id,
                    tenantId: null as any, // Tenant ID unknown at this point or should be fetched
                    action: 'INVOICE_DELETE',
                    resourceType: 'business_invoices',
                    resourceId: invoiceId,
                    oldValues: { invoiceNumber: existing.invoice_number, status: existing.status },
                    newValues: null,
                    severity: 'warning',
                    metadata: {
                        invoiceNumber: existing.invoice_number
                    }
                });
            }

            return { error: null };
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
     * IMPROVED: Using a more robust approach to avoid race conditions
     */
    async generateInvoiceNumber(tenantId: string): Promise<string> {
        try {
            // Fetch the highest invoice number for this tenant
            // Sorting by invoice_number descending instead of created_at
            const { data, error } = await supabase
                .from('business_invoices')
                .select('invoice_number')
                .eq('tenant_id', tenantId)
                .order('invoice_number', { ascending: false })
                .limit(1);

            if (error) throw error;

            if (data && data.length > 0) {
                const lastNumber = data[0].invoice_number;
                // Regular expression to find the numeric part (handling variations like INV-0001 or INV1001)
                const match = lastNumber.match(/\d+/g);
                if (match && match.length > 0) {
                    // Take the last match (useful if the prefix has numbers)
                    const lastNumericPart = match[match.length - 1];
                    const nextNum = parseInt(lastNumericPart) + 1;

                    // Maintain original padding if it was numeric lead
                    const padding = lastNumericPart.length;
                    const nextNumString = nextNum.toString().padStart(padding, '0');

                    // Reconstruct with original prefix
                    const prefixMatch = lastNumber.match(/^[A-Z-]+/i);
                    const prefix = prefixMatch ? prefixMatch[0] : 'INV-';

                    return `${prefix}${nextNumString}`;
                }
            }

            // Default fallback
            return 'INV-1001';
        } catch (err) {
            console.error('Error generating invoice number:', err);
            // Unique enough to avoid collision but clearly a fallback
            return `INV-${Date.now().toString().slice(-6)}`;
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
                        company,
                        phone
                    ),
                    project:project_id (
                        id,
                        name
                    )
                `)
                .eq('id', invoiceId);

            if (tenantId) {
                query = query.eq('tenant_id', tenantId);
            }

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
            // Get invoice data first for GL posting
            const { data: invoice, error: fetchError } = await supabase
                .from('business_invoices')
                .select('*')
                .eq('id', invoiceId)
                .single();

            if (fetchError) throw fetchError;

            const { error } = await supabase
                .from('business_invoices')
                .update({ status: 'paid', updated_at: new Date().toISOString() })
                .eq('id', invoiceId);

            if (error) throw error;

            // GL INTEGRATION: Revenue is recognized on payment receipt
            await this.postRevenueOnPayment(invoiceId, invoice);

            // Fire and forget receipt automation
            this.triggerReceiptAutomation(invoiceId, invoice.tenant_id).catch(console.error);

            // Log audit
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                await activityService.logAudit({
                    userId: user.id,
                    tenantId: invoice.tenant_id,
                    action: 'INVOICE_PAID',
                    resourceType: 'business_invoices',
                    resourceId: invoiceId,
                    oldValues: { status: invoice.status },
                    newValues: { status: 'paid' },
                    metadata: {
                        invoiceNumber: invoice.invoice_number,
                        amount: invoice.total
                    }
                });
            }

            return { error: null };
        } catch (err: any) {
            console.error('Error marking invoice as paid:', err);
            return { error: err.message };
        }
    },

    /**
     * Generate a professional PDF for a business invoice
     */
    generatePDF(invoice: any, tenant: any, client: any, signature?: { type: 'draw' | 'type', data: string }) {
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
        const senderName = invoice.senderName || tenant?.name || 'AlphaClone Partner';

        // Logo
        if (logoUrl) {
            try {
                // Add logo with error handling
                doc.addImage(logoUrl, 'PNG', margin, 10, 25, 25, undefined, 'FAST');
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(20);
                doc.setTextColor(colors.white);
                doc.text(senderName, margin + 28, 22);

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
                doc.text(senderName, margin, 25);
            }
        } else {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(24);
            doc.setTextColor(colors.white);
            doc.text(senderName, margin, 25);
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
        doc.text(senderName, margin + 5, currentY + 16);
        
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
        doc.text(clientName, margin + colWidth + 10, currentY + 16);
        
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
     * Post invoice to General Ledger when sent
     * DR Accounts Receivable (1100)
     *   CR Revenue (4100)
     */
    async postInvoiceToGL(invoiceId: string, invoiceData: any): Promise<{ error: string | null }> {
        try {
            // Get account IDs for AR and Revenue
            let { account: arAccount } = await chartOfAccountsService.getAccountByCode('1100');
            let { account: revenueAccount } = await chartOfAccountsService.getAccountByCode('4100');

            if (!arAccount || !revenueAccount) {
                console.warn('Accounts Receivable (1100) or Service Revenue (4100) not found. Attempting to initialize default accounts...');
                await chartOfAccountsService.initializeDefaultAccounts();

                // Retry fetching accounts
                const arRetry = await chartOfAccountsService.getAccountByCode('1100');
                const revRetry = await chartOfAccountsService.getAccountByCode('4100');

                arAccount = arRetry.account;
                revenueAccount = revRetry.account;

                if (!arAccount || !revenueAccount) {
                    console.error('Failed to initialize or retrieve required accounts (1100, 4100). Skipping GL post.');
                    return { error: 'Required accounts not found and could not be initialized in Chart of Accounts' };
                }
            }

            const total = parseFloat(invoiceData.total || '0');
            const issueDate = invoiceData.issue_date || invoiceData.issueDate || new Date().toISOString().split('T')[0];
            const invoiceNumber = invoiceData.invoice_number || invoiceData.invoiceNumber;

            // Create journal entry
            const { entry, error } = await journalEntryService.createEntry({
                entryDate: issueDate,
                description: `Invoice ${invoiceNumber} - Service Revenue`,
                reference: invoiceNumber,
                sourceType: 'invoice',
                sourceId: invoiceId,
                lines: [
                    {
                        accountId: arAccount.id,
                        debitAmount: total,
                        creditAmount: 0,
                        description: `AR - Invoice ${invoiceNumber}`,
                        entityType: 'invoice',
                        entityId: invoiceId,
                    },
                    {
                        accountId: revenueAccount.id,
                        debitAmount: 0,
                        creditAmount: total,
                        description: `Revenue - Invoice ${invoiceNumber}`,
                        entityType: 'invoice',
                        entityId: invoiceId,
                    },
                ],
            });

            if (error) {
                console.error('Failed to create journal entry for invoice:', error);
                return { error };
            }

            // Auto-post the entry
            if (entry) {
                await journalEntryService.postEntry(entry.id);
            }

            return { error: null };
        } catch (err: any) {
            console.error('Error posting invoice to GL:', err);
            return { error: err.message };
        }
    },

    /**
     * Post payment to General Ledger when invoice is paid
     * DR Cash (1000)
     *   CR Accounts Receivable (1100)
     */
    async postPaymentToGL(invoiceId: string, invoiceData: any): Promise<{ error: string | null }> {
        try {
            // Get account IDs for Cash and AR
            let { account: cashAccount } = await chartOfAccountsService.getAccountByCode('1000');
            let { account: arAccount } = await chartOfAccountsService.getAccountByCode('1100');

            if (!cashAccount || !arAccount) {
                console.warn('Cash (1000) or Accounts Receivable (1100) not found. Attempting to initialize default accounts...');
                await chartOfAccountsService.initializeDefaultAccounts();

                // Retry fetching accounts
                const cashRetry = await chartOfAccountsService.getAccountByCode('1000');
                const arRetry = await chartOfAccountsService.getAccountByCode('1100');

                cashAccount = cashRetry.account;
                arAccount = arRetry.account;

                if (!cashAccount || !arAccount) {
                    console.error('Failed to initialize or retrieve required accounts (1000, 1100). Skipping GL post.');
                    return { error: 'Required accounts not found and could not be initialized in Chart of Accounts' };
                }
            }

            const total = parseFloat(invoiceData.total || '0');
            const paymentDate = new Date().toISOString().split('T')[0];
            const invoiceNumber = invoiceData.invoice_number || invoiceData.invoiceNumber;

            // Create journal entry
            const { entry, error } = await journalEntryService.createEntry({
                entryDate: paymentDate,
                description: `Payment received for Invoice ${invoiceNumber}`,
                reference: invoiceNumber,
                sourceType: 'payment',
                sourceId: invoiceId,
                lines: [
                    {
                        accountId: cashAccount.id,
                        debitAmount: total,
                        creditAmount: 0,
                        description: `Cash received - Invoice ${invoiceNumber}`,
                        entityType: 'invoice',
                        entityId: invoiceId,
                    },
                    {
                        accountId: arAccount.id,
                        debitAmount: 0,
                        creditAmount: total,
                        description: `AR collected - Invoice ${invoiceNumber}`,
                        entityType: 'invoice',
                        entityId: invoiceId,
                    },
                ],
            });

            if (error) {
                console.error('Failed to create journal entry for payment:', error);
                return { error };
            }

            // Auto-post the entry
            if (entry) {
                await journalEntryService.postEntry(entry.id);
            }

            return { error: null };
        } catch (err: any) {
            console.error('Error posting payment to GL:', err);
            return { error: err.message };
        }
    },

    /**
     * Recognize revenue when payment is received.
     * DR Cash (1000)
     *   CR Service Revenue (4100) for net amount
     *   CR Sales Tax Payable (2100) for tax amount
     */
    async postRevenueOnPayment(invoiceId: string, invoiceData: any): Promise<{ error: string | null }> {
        try {
            let { account: cashAccount } = await chartOfAccountsService.getAccountByCode('1000');
            let { account: revenueAccount } = await chartOfAccountsService.getAccountByCode('4100');
            let { account: taxPayableAccount } = await chartOfAccountsService.getAccountByCode('2100');

            if (!cashAccount || !revenueAccount) {
                await chartOfAccountsService.initializeDefaultAccounts();
                const cashRetry = await chartOfAccountsService.getAccountByCode('1000');
                const revRetry = await chartOfAccountsService.getAccountByCode('4100');
                const taxRetry = await chartOfAccountsService.getAccountByCode('2100');
                cashAccount = cashRetry.account;
                revenueAccount = revRetry.account;
                taxPayableAccount = taxRetry.account || taxPayableAccount;
            }

            if (!cashAccount || !revenueAccount) {
                return { error: 'Required accounts (1000, 4100) not found' };
            }

            const total = Number(invoiceData.total || 0);
            const tax = Number(invoiceData.tax || 0);
            const netRevenue = Math.max(0, total - tax);
            const paymentDate = new Date().toISOString().split('T')[0];
            const invoiceNumber = invoiceData.invoice_number || invoiceData.invoiceNumber || invoiceId;
            const lines: Array<{
                accountId: string;
                debitAmount: number;
                creditAmount: number;
                description: string;
                entityType: 'invoice';
                entityId: string;
            }> = [
                {
                    accountId: cashAccount.id,
                    debitAmount: total,
                    creditAmount: 0,
                    description: `Cash received - Invoice ${invoiceNumber}`,
                    entityType: 'invoice',
                    entityId: invoiceId,
                },
                {
                    accountId: revenueAccount.id,
                    debitAmount: 0,
                    creditAmount: netRevenue,
                    description: `Revenue recognized - Invoice ${invoiceNumber}`,
                    entityType: 'invoice',
                    entityId: invoiceId,
                },
            ];

            if (tax > 0 && taxPayableAccount?.id) {
                lines.push({
                    accountId: taxPayableAccount.id,
                    debitAmount: 0,
                    creditAmount: tax,
                    description: `Tax payable - Invoice ${invoiceNumber}`,
                    entityType: 'invoice',
                    entityId: invoiceId,
                });
            }

            const { entry, error } = await journalEntryService.createEntry({
                entryDate: paymentDate,
                description: `Payment received for Invoice ${invoiceNumber}`,
                reference: invoiceNumber,
                sourceType: 'payment',
                sourceId: invoiceId,
                lines,
            });

            if (error) return { error };
            if (entry) await journalEntryService.postEntry(entry.id);
            return { error: null };
        } catch (err: any) {
            console.error('Error recognizing revenue on payment:', err);
            return { error: err.message };
        }
    },

    /**
     * Trigger Receipt Automation via MCP tool
     */
    async triggerReceiptAutomation(invoiceId: string, tenantId: string) {
        try {
            // Call the MCP send_receipt tool
            const response = await fetch('/api/mcp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: crypto.randomUUID(),
                    method: 'tools/call',
                    params: {
                        name: 'send_receipt',
                        arguments: {
                            invoice_id: invoiceId,
                            tenant_id: tenantId
                        }
                    }
                })
            });

            const result = await response.json();
            
            if (result.result && !result.error) {
                // Successful transmission, append to audit trail in notes
                const timestamp = new Date().toLocaleString();
                const auditNote = `\n[System] Receipt sent automatically on ${timestamp}`;
                
                // Get current notes
                const { data: current } = await supabase
                    .from('business_invoices')
                    .select('notes')
                    .eq('id', invoiceId)
                    .single();
                
                const newNotes = (current?.notes || '') + auditNote;
                
                await supabase
                    .from('business_invoices')
                    .update({ notes: newNotes })
                    .eq('id', invoiceId);
                
                console.log(`Receipt audit trail updated for ${invoiceId}`);
            } else {
                console.error('MCP Receipt Error:', result.error);
            }
        } catch (err) {
            console.error('Failed to trigger receipt automation:', err);
        }
    },

    /**
     * Convert an accepted quote to a business invoice (server/admin path).
     */
    async convertQuoteToInvoice(
        quoteId: string,
        tenantId: string,
        options?: { autoSend?: boolean; origin?: string }
    ): Promise<{ invoiceId: string | null; publicToken: string | null; error: string | null }> {
        const { createSupabaseAdminClient } = await import('@/lib/supabase-admin');
        const { sendEmailServer } = await import('@/lib/email/sendEmailServer');
        const crypto = await import('crypto');
        const admin = createSupabaseAdminClient();

        const { data: quote, error: quoteError } = await admin
            .from('quotes')
            .select('*, tenant:tenants(name, settings)')
            .eq('id', quoteId)
            .eq('tenant_id', tenantId)
            .single();

        if (quoteError || !quote) {
            return { invoiceId: null, publicToken: null, error: 'Quote not found' };
        }
        if (quote.status === 'converted') {
            const meta = quote.metadata as Record<string, string> | null;
            return {
                invoiceId: meta?.converted_invoice_id || null,
                publicToken: meta?.invoice_public_token || null,
                error: null,
            };
        }

        const { data: items } = await admin
            .from('quote_items')
            .select('*')
            .eq('quote_id', quoteId)
            .order('item_order', { ascending: true });

        const metadata = (quote.metadata || {}) as Record<string, unknown>;
        const clientEmail =
            (quote as { client_email?: string }).client_email ||
            (metadata.client_email as string | undefined);

        const publicToken = crypto.randomUUID();
        const invoiceNum = `INV-${Date.now().toString(36).toUpperCase()}`;
        const total = Number(quote.total_amount || 0);
        const subtotal = Number(quote.subtotal || total);
        const origin = options?.origin || process.env.NEXT_PUBLIC_APP_URL || 'https://alphaclonesystems.com';

        const { data: inv, error: invError } = await admin
            .from('business_invoices')
            .insert({
                tenant_id: tenantId,
                invoice_number: invoiceNum,
                client_name: quote.name,
                client_email: clientEmail || null,
                issue_date: new Date().toISOString(),
                due_date: quote.valid_until || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                status: 'sent',
                subtotal,
                tax_rate: Number(quote.tax_percent || 0),
                tax: Number(quote.tax_amount || 0),
                discount_amount: Number(quote.discount_amount || 0),
                total,
                notes: `Generated from accepted quote ${quote.quote_number}`,
                is_public: true,
                metadata: {
                    converted_from_quote_id: quoteId,
                    public_token: publicToken,
                },
            })
            .select('id')
            .single();

        if (invError || !inv) {
            return { invoiceId: null, publicToken: null, error: invError?.message || 'Failed to create invoice' };
        }

        if (items && items.length > 0) {
            await admin.from('invoice_line_items').insert(
                items.map((item: Record<string, unknown>, idx: number) => ({
                    invoice_id: inv.id,
                    tenant_id: tenantId,
                    description: item.product_name || item.description || 'Item',
                    quantity: Number(item.quantity || 1),
                    unit_price: Number(item.unit_price || 0),
                    amount: Number(item.line_total || 0),
                    sort_order: idx,
                }))
            );
        } else if (total > 0) {
            await admin.from('invoice_line_items').insert({
                invoice_id: inv.id,
                tenant_id: tenantId,
                description: quote.name || 'Quote total',
                quantity: 1,
                unit_price: total,
                amount: total,
                sort_order: 0,
            });
        }

        await admin
            .from('quotes')
            .update({
                status: 'converted',
                metadata: {
                    ...metadata,
                    converted_invoice_id: inv.id,
                    invoice_public_token: publicToken,
                    converted_at: new Date().toISOString(),
                },
            })
            .eq('id', quoteId);

        const payUrl = `${origin.replace(/\/$/, '')}/invoice/${inv.id}?token=${publicToken}`;

        if (options?.autoSend !== false && clientEmail) {
            const tenantName = (quote.tenant as { name?: string } | null)?.name || 'Your provider';
            await sendEmailServer({
                tenantId,
                to: clientEmail,
                subject: `Invoice ${invoiceNum} from ${tenantName}`,
                html: `
              <p>Hi ${quote.name || 'there'},</p>
              <p>Thank you for accepting quote <strong>${quote.quote_number}</strong>. Your invoice is ready.</p>
              <p><a href="${payUrl}">View & Pay Invoice</a></p>
              <p>Or copy this link: ${payUrl}</p>
            `,
                templateName: 'quote_accepted_invoice',
            }).catch((err) => console.error('[convertQuoteToInvoice] email failed:', err));
        }

        return { invoiceId: inv.id, publicToken, error: null };
    },
};
