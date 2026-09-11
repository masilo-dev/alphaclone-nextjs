import { supabase } from '../lib/supabase';
import { tenantService } from './tenancy/TenantService';
import { fileUploadService } from './fileUploadService';

export type QuoteStatus = 'draft' | 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired' | 'converted';

export interface QuoteTemplate {
    id: string;
    name: string;
    description?: string;
    templateHtml: string;
    templateSections?: any[];
    termsAndConditions?: string;
    validForDays: number;
    createdBy?: string;
    isDefault: boolean;
    metadata?: any;
    createdAt: string;
    updatedAt: string;
}

export interface Quote {
    id: string;
    quoteNumber: string;
    name: string;
    contactId?: string;
    dealId?: string;
    templateId?: string;
    status: QuoteStatus;
    subtotal: number;
    discountAmount: number;
    discountPercent: number;
    taxAmount: number;
    taxPercent: number;
    totalAmount: number;
    currency: string;
    validUntil?: string;
    sentAt?: string;
    viewedAt?: string;
    viewCount: number;
    acceptedAt?: string;
    acceptedBy?: string;
    rejectedAt?: string;
    rejectionReason?: string;
    notes?: string;
    termsAndConditions?: string;
    signatureUrl?: string;
    pdfUrl?: string;
    createdBy?: string;
    metadata?: any;
    createdAt: string;
    updatedAt: string;
}

export interface QuoteItem {
    id: string;
    quoteId: string;
    itemOrder: number;
    productName: string;
    description?: string;
    quantity: number;
    unitPrice: number;
    discountPercent: number;
    taxPercent: number;
    lineTotal: number;
    metadata?: any;
    createdAt: string;
}

export interface QuoteView {
    id: string;
    quoteId: string;
    viewedByEmail?: string;
    ipAddress?: string;
    userAgent?: string;
    durationSeconds?: number;
    viewedAt: string;
}

export const quoteService = {
    /**
     * Get tenant ID (required for all operations)
     */
    getTenantId(): string {
        const tenantId = tenantService.getCurrentTenantId();
        if (!tenantId) throw new Error('No active tenant. Please select an organization.');
        return tenantId;
    },

    /**
     * Get all quote templates
     */
    async getTemplates(): Promise<{ templates: QuoteTemplate[]; error: string | null }> {
        try {
            const tenantId = this.getTenantId();

            const { data, error } = await supabase
                .from('quote_templates')
                .select('*')
                .eq('tenant_id', tenantId) // ← TENANT FILTER
                .order('is_default', { ascending: false })
                .order('created_at', { ascending: false });

            if (error) throw error;

            const templates: QuoteTemplate[] = (data || []).map((t: any) => ({
                id: t.id,
                name: t.name,
                description: t.description,
                templateHtml: t.template_html,
                templateSections: t.template_sections || [],
                termsAndConditions: t.terms_and_conditions,
                validForDays: t.valid_for_days,
                createdBy: t.created_by,
                isDefault: t.is_default,
                metadata: t.metadata || {},
                createdAt: t.created_at,
                updatedAt: t.updated_at,
            }));

            return { templates, error: null };
        } catch (err) {
            return { templates: [], error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Create quote template
     */
    async createTemplate(
        userId: string,
        templateData: {
            name: string;
            description?: string;
            templateHtml: string;
            termsAndConditions?: string;
            validForDays?: number;
            isDefault?: boolean;
        }
    ): Promise<{ template: QuoteTemplate | null; error: string | null }> {
        try {
            const tenantId = this.getTenantId();

            const { data, error } = await supabase
                .from('quote_templates')
                .insert({
                    tenant_id: tenantId, // ← ASSIGN TO TENANT
                    name: templateData.name,
                    description: templateData.description,
                    template_html: templateData.templateHtml,
                    terms_and_conditions: templateData.termsAndConditions,
                    valid_for_days: templateData.validForDays || 30,
                    is_default: templateData.isDefault || false,
                    created_by: userId,
                })
                .select()
                .single();

            if (error) throw error;

            const template: QuoteTemplate = {
                id: data.id,
                name: data.name,
                description: data.description,
                templateHtml: data.template_html,
                templateSections: data.template_sections || [],
                termsAndConditions: data.terms_and_conditions,
                validForDays: data.valid_for_days,
                createdBy: data.created_by,
                isDefault: data.is_default,
                metadata: data.metadata || {},
                createdAt: data.created_at,
                updatedAt: data.updated_at,
            };

            return { template, error: null };
        } catch (err) {
            return { template: null, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Get all quotes
     */
    async getQuotes(filters?: {
        contactId?: string;
        dealId?: string;
        status?: QuoteStatus;
        limit?: number;
    }): Promise<{ quotes: Quote[]; error: string | null }> {
        try {
            const tenantId = this.getTenantId();

            let query = supabase
                .from('quotes')
                .select('*')
                .eq('tenant_id', tenantId); // ← TENANT FILTER

            if (filters?.contactId) {
                query = query.eq('contact_id', filters.contactId);
            }
            if (filters?.dealId) {
                query = query.eq('deal_id', filters.dealId);
            }
            if (filters?.status) {
                query = query.eq('status', filters.status);
            }

            const { data, error } = await query.order('created_at', { ascending: false }).limit(filters?.limit || 100);

            if (error) throw error;

            const quotes: Quote[] = (data || []).map((q: any) => ({
                id: q.id,
                quoteNumber: q.quote_number,
                name: q.name,
                contactId: q.contact_id,
                dealId: q.deal_id,
                templateId: q.template_id,
                status: q.status,
                subtotal: q.subtotal,
                discountAmount: q.discount_amount,
                discountPercent: q.discount_percent,
                taxAmount: q.tax_amount,
                taxPercent: q.tax_percent,
                totalAmount: q.total_amount,
                currency: q.currency,
                validUntil: q.valid_until,
                sentAt: q.sent_at,
                viewedAt: q.viewed_at,
                viewCount: q.view_count,
                acceptedAt: q.accepted_at,
                acceptedBy: q.accepted_by,
                rejectedAt: q.rejected_at,
                rejectionReason: q.rejection_reason,
                notes: q.notes,
                termsAndConditions: q.terms_and_conditions,
                signatureUrl: q.signature_url,
                pdfUrl: q.pdf_url,
                createdBy: q.created_by,
                metadata: q.metadata || {},
                createdAt: q.created_at,
                updatedAt: q.updated_at,
            }));

            return { quotes, error: null };
        } catch (err) {
            return { quotes: [], error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Get quote by ID
     */
    async getQuoteById(quoteId: string): Promise<{ quote: Quote | null; error: string | null }> {
        try {
            const tenantId = this.getTenantId();

            const { data, error } = await supabase
                .from('quotes')
                .select('*')
                .eq('id', quoteId)
                .eq('tenant_id', tenantId) // ← VERIFY TENANT OWNERSHIP
                .single();

            if (error) throw error;

            const quote: Quote = {
                id: data.id,
                quoteNumber: data.quote_number,
                name: data.name,
                contactId: data.contact_id,
                dealId: data.deal_id,
                templateId: data.template_id,
                status: data.status,
                subtotal: data.subtotal,
                discountAmount: data.discount_amount,
                discountPercent: data.discount_percent,
                taxAmount: data.tax_amount,
                taxPercent: data.tax_percent,
                totalAmount: data.total_amount,
                currency: data.currency,
                validUntil: data.valid_until,
                sentAt: data.sent_at,
                viewedAt: data.viewed_at,
                viewCount: data.view_count,
                acceptedAt: data.accepted_at,
                acceptedBy: data.accepted_by,
                rejectedAt: data.rejected_at,
                rejectionReason: data.rejection_reason,
                notes: data.notes,
                termsAndConditions: data.terms_and_conditions,
                signatureUrl: data.signature_url,
                pdfUrl: data.pdf_url,
                createdBy: data.created_by,
                metadata: data.metadata || {},
                createdAt: data.created_at,
                updatedAt: data.updated_at,
            };

            return { quote, error: null };
        } catch (err) {
            return { quote: null, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Create quote
     */
    async createQuote(
        userId: string,
        quoteData: {
            name: string;
            contactId?: string;
            dealId?: string;
            templateId?: string;
            currency?: string;
            validForDays?: number;
            notes?: string;
            termsAndConditions?: string;
        }
    ): Promise<{ quote: Quote | null; error: string | null }> {
        try {
            const tenantId = this.getTenantId();
            const response = await fetch(`/api/tenant/${tenantId}/quotes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(quoteData) });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || !payload.quote) throw new Error(payload.error || 'Quote could not be created');
            const apiRow = payload.quote;
            const mappedQuote: Quote = {
                id: apiRow.id, quoteNumber: apiRow.quote_number, name: apiRow.name, contactId: apiRow.contact_id, dealId: apiRow.deal_id, templateId: apiRow.template_id,
                status: apiRow.status, subtotal: apiRow.subtotal, discountAmount: apiRow.discount_amount, discountPercent: apiRow.discount_percent,
                taxAmount: apiRow.tax_amount, taxPercent: apiRow.tax_percent, totalAmount: apiRow.total_amount, currency: apiRow.currency, validUntil: apiRow.valid_until,
                sentAt: apiRow.sent_at, viewedAt: apiRow.viewed_at, viewCount: apiRow.view_count, acceptedAt: apiRow.accepted_at, acceptedBy: apiRow.accepted_by,
                rejectedAt: apiRow.rejected_at, rejectionReason: apiRow.rejection_reason, notes: apiRow.notes, termsAndConditions: apiRow.terms_and_conditions,
                signatureUrl: apiRow.signature_url, pdfUrl: apiRow.pdf_url, createdBy: apiRow.created_by, metadata: apiRow.metadata || {}, createdAt: apiRow.created_at, updatedAt: apiRow.updated_at,
            };
            return { quote: mappedQuote, error: null };
        } catch (err) {
            return { quote: null, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Update quote
     */
    async updateQuote(quoteId: string, updates: Partial<Quote>): Promise<{ quote: Quote | null; error: string | null }> {
        try {
            const tenantId = this.getTenantId();
            const [{ quote: current, error: currentError }, { items, error: itemsError }] = await Promise.all([this.getQuoteById(quoteId), this.getQuoteItems(quoteId)]);
            if (currentError || !current) throw new Error(currentError || 'Quote not found');
            if (itemsError) throw new Error(itemsError);
            const merged = { ...current, ...updates };
            const response = await fetch(`/api/tenant/${tenantId}/quotes`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quoteId, name: merged.name, status: merged.status, validUntil: merged.validUntil || null, notes: merged.notes || '', termsAndConditions: merged.termsAndConditions || '', currency: merged.currency, items: items.map((item) => ({ id: item.id, productName: item.productName, description: item.description || '', quantity: item.quantity, unitPrice: item.unitPrice, discountPercent: item.discountPercent, taxPercent: item.taxPercent })) }) });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.error || 'Quote could not be updated');
            return this.getQuoteById(quoteId);
        } catch (err) {
            return { quote: null, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    async recalculateQuoteTotals(quoteId: string): Promise<{ quote: Quote | null; error: string | null }> {
        try {
            const tenantId = this.getTenantId();
            const { error: quoteError } = await supabase
                .from('quotes')
                .select('*')
                .eq('id', quoteId)
                .eq('tenant_id', tenantId)
                .single();
            if (quoteError) throw quoteError;

            const { data: items, error: itemsError } = await supabase
                .from('quote_items')
                .select('*')
                .eq('quote_id', quoteId)
                .order('item_order', { ascending: true });
            if (itemsError) throw itemsError;

            const itemRows = Array.isArray(items) ? items : [];
            const subtotal = itemRows.reduce((sum: number, item: any) => {
                const quantity = Number(item.quantity || 0);
                const unitPrice = Number(item.unit_price || 0);
                return sum + (quantity * unitPrice);
            }, 0);
            const discountAmount = itemRows.reduce((sum: number, item: any) => {
                const quantity = Number(item.quantity || 0);
                const unitPrice = Number(item.unit_price || 0);
                const discountPercent = Number(item.discount_percent || 0);
                return sum + (quantity * unitPrice * (discountPercent / 100));
            }, 0);
            const taxAmount = itemRows.reduce((sum: number, item: any) => {
                const quantity = Number(item.quantity || 0);
                const unitPrice = Number(item.unit_price || 0);
                const discountPercent = Number(item.discount_percent || 0);
                const taxPercent = Number(item.tax_percent || 0);
                const taxableBase = quantity * unitPrice * (1 - discountPercent / 100);
                return sum + (taxableBase * (taxPercent / 100));
            }, 0);
            const totalAmount = subtotal - discountAmount + taxAmount;

            const { data, error } = await supabase
                .from('quotes')
                .update({
                    subtotal,
                    discount_amount: discountAmount,
                    tax_amount: taxAmount,
                    total_amount: totalAmount,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', quoteId)
                .eq('tenant_id', tenantId)
                .select('*')
                .single();
            if (error) throw error;

            return {
                quote: {
                    id: data.id,
                    quoteNumber: data.quote_number,
                    name: data.name,
                    contactId: data.contact_id,
                    dealId: data.deal_id,
                    templateId: data.template_id,
                    status: data.status,
                    subtotal: data.subtotal,
                    discountAmount: data.discount_amount,
                    discountPercent: data.discount_percent,
                    taxAmount: data.tax_amount,
                    taxPercent: data.tax_percent,
                    totalAmount: data.total_amount,
                    currency: data.currency,
                    validUntil: data.valid_until,
                    sentAt: data.sent_at,
                    viewedAt: data.viewed_at,
                    viewCount: data.view_count,
                    acceptedAt: data.accepted_at,
                    acceptedBy: data.accepted_by,
                    rejectedAt: data.rejected_at,
                    rejectionReason: data.rejection_reason,
                    notes: data.notes,
                    termsAndConditions: data.terms_and_conditions,
                    signatureUrl: data.signature_url,
                    pdfUrl: data.pdf_url,
                    createdBy: data.created_by,
                    metadata: data.metadata || {},
                    createdAt: data.created_at,
                    updatedAt: data.updated_at,
                },
                error: null,
            };
        } catch (err) {
            return { quote: null, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Delete quote
     */
    async deleteQuote(quoteId: string): Promise<{ success: boolean; error: string | null }> {
        try {
            const tenantId = this.getTenantId();

            const response = await fetch(`/api/tenant/${tenantId}/quotes?quoteId=${encodeURIComponent(quoteId)}`, { method: 'DELETE' });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.error || 'Quote could not be deleted');
            await fileUploadService.deleteFileByEntity('quote', quoteId);
            return { success: true, error: null };
        } catch (err) {
            return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    async getQuoteItems(quoteId: string): Promise<{ items: QuoteItem[]; error: string | null }> {
        try {
            const tenantId = this.getTenantId();
            const { data, error } = await supabase
                .from('quote_items')
                .select('*')
                .eq('quote_id', quoteId)
                .eq('tenant_id', tenantId)
                .order('item_order', { ascending: true });

            if (error) throw error;

            const items: QuoteItem[] = (data || []).map((i: any) => ({
                id: i.id,
                quoteId: i.quote_id,
                itemOrder: i.item_order,
                productName: i.product_name,
                description: i.description,
                quantity: i.quantity,
                unitPrice: i.unit_price,
                discountPercent: i.discount_percent,
                taxPercent: i.tax_percent,
                lineTotal: i.line_total,
                metadata: i.metadata || {},
                createdAt: i.created_at,
            }));

            return { items, error: null };
        } catch (err) {
            return { items: [], error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Add item to quote
     */
    async addQuoteItem(
        quoteId: string,
        itemData: {
            productName: string;
            description?: string;
            quantity: number;
            unitPrice: number;
            discountPercent?: number;
            taxPercent?: number;
            itemOrder?: number;
        }
    ): Promise<{ item: QuoteItem | null; error: string | null }> {
        try {
            const tenantId = this.getTenantId();
            const response = await fetch(`/api/tenant/${tenantId}/quotes/${encodeURIComponent(quoteId)}/items`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(itemData) });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || !payload.item) throw new Error(payload.error || 'Quote item could not be added');
            const apiItem = payload.item;
            return { item: { id: apiItem.id, quoteId, itemOrder: apiItem.item_order, productName: apiItem.product_name, description: apiItem.description, quantity: apiItem.quantity, unitPrice: apiItem.unit_price, discountPercent: apiItem.discount_percent, taxPercent: apiItem.tax_percent, lineTotal: apiItem.line_total, metadata: apiItem.metadata || {}, createdAt: apiItem.created_at || new Date().toISOString() }, error: null };
        } catch (err) {
            return { item: null, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Update quote item
     */
    async updateQuoteItem(
        itemId: string,
        updates: Partial<QuoteItem>
    ): Promise<{ item: QuoteItem | null; error: string | null }> {
        try {
            const tenantId = this.getTenantId();
            const { data: currentItem, error: currentError } = await supabase.from('quote_items').select('quote_id').eq('id', itemId).eq('tenant_id', tenantId).maybeSingle();
            if (currentError || !currentItem) throw new Error(currentError?.message || 'Quote item not found');
            const response = await fetch(`/api/tenant/${tenantId}/quotes/${encodeURIComponent(currentItem.quote_id)}/items`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ itemId, ...updates }) });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || !payload.item) throw new Error(payload.error || 'Quote item could not be updated');
            const apiItem = payload.item;
            return { item: { id: apiItem.id, quoteId: currentItem.quote_id, itemOrder: apiItem.item_order, productName: apiItem.product_name, description: apiItem.description, quantity: apiItem.quantity, unitPrice: apiItem.unit_price, discountPercent: apiItem.discount_percent, taxPercent: apiItem.tax_percent, lineTotal: apiItem.line_total, metadata: {}, createdAt: new Date().toISOString() }, error: null };
        } catch (err) {
            return { item: null, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Delete quote item
     */
    async deleteQuoteItem(itemId: string): Promise<{ success: boolean; error: string | null }> {
        try {
            const tenantId = this.getTenantId();
            const { data: currentItem, error: currentError } = await supabase.from('quote_items').select('quote_id').eq('id', itemId).eq('tenant_id', tenantId).maybeSingle();
            if (currentError || !currentItem) throw new Error(currentError?.message || 'Quote item not found');
            const response = await fetch(`/api/tenant/${tenantId}/quotes/${encodeURIComponent(currentItem.quote_id)}/items?itemId=${encodeURIComponent(itemId)}`, { method: 'DELETE' });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.error || 'Quote item could not be deleted');
            return { success: true, error: null };
        } catch (err) {
            return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Track quote view
     */
    async trackQuoteView(
        quoteId: string,
        viewData: {
            viewedByEmail?: string;
            ipAddress?: string;
            userAgent?: string;
        }
    ): Promise<{ view: QuoteView | null; error: string | null }> {
        try {
            const { data, error } = await supabase
                .from('quote_views')
                .insert({
                    quote_id: quoteId,
                    viewed_by_email: viewData.viewedByEmail,
                    ip_address: viewData.ipAddress,
                    user_agent: viewData.userAgent,
                })
                .select()
                .single();

            if (error) throw error;

            // Update quote view count and viewed_at
            await supabase.rpc('increment_quote_view_count', { quote_id: quoteId });

            const view: QuoteView = {
                id: data.id,
                quoteId: data.quote_id,
                viewedByEmail: data.viewed_by_email,
                ipAddress: data.ip_address,
                userAgent: data.user_agent,
                durationSeconds: data.duration_seconds,
                viewedAt: data.viewed_at,
            };

            return { view, error: null };
        } catch (err) {
            return { view: null, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Get quote views
     */
    async getQuoteViews(quoteId: string): Promise<{ views: QuoteView[]; error: string | null }> {
        try {
            const { data, error } = await supabase
                .from('quote_views')
                .select('*')
                .eq('quote_id', quoteId)
                .order('viewed_at', { ascending: false });

            if (error) throw error;

            const views: QuoteView[] = (data || []).map((v: any) => ({
                id: v.id,
                quoteId: v.quote_id,
                viewedByEmail: v.viewed_by_email,
                ipAddress: v.ip_address,
                userAgent: v.user_agent,
                durationSeconds: v.duration_seconds,
                viewedAt: v.viewed_at,
            }));

            return { views, error: null };
        } catch (err) {
            return { views: [], error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * 1-Click Quote → Invoice Conversion.
     * Takes an accepted quote and creates a matching business invoice with all line items pre-filled.
     */
    async convertToInvoice(quoteId: string): Promise<{ invoiceId: string | null; error: string | null }> {
        try {
            const tenantId = this.getTenantId();

            const [{ quote, error: qErr }, { items, error: iErr }] = await Promise.all([
                this.getQuoteById(quoteId),
                this.getQuoteItems(quoteId),
            ]);

            if (qErr || !quote) throw new Error(qErr || 'Quote not found');
            if (iErr) throw new Error(iErr);

            if (quote.status !== 'accepted') {
                throw new Error('Only accepted quotes can be converted to invoices');
            }

            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + 30);

            const invoicePayload = {
                tenantId,
                clientId: quote.contactId,
                issueDate: new Date().toISOString().split('T')[0],
                dueDate: dueDate.toISOString().split('T')[0],
                notes: `Converted from Quote #${quote.quoteNumber}`,
                lineItems: items.map(i => ({
                    description: `${i.productName}${i.description ? `: ${i.description}` : ''}`,
                    quantity: i.quantity,
                    rate: i.unitPrice,
                    amount: i.lineTotal,
                })),
                subtotal: quote.subtotal,
                taxRate: quote.taxPercent,
                tax: quote.taxAmount,
                discountAmount: quote.discountAmount,
                total: quote.totalAmount,
            };

            const response = await fetch('/api/invoices', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(invoicePayload),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || !payload.invoice) throw new Error(payload.error || 'Invoice could not be created from quote');

            // Mark quote as converted
            await supabase
                .from('quotes')
                .update({ status: 'converted', updated_at: new Date().toISOString() })
                .eq('id', quoteId)
                .eq('tenant_id', tenantId);

            return { invoiceId: payload.invoice.id, error: null };
        } catch (err) {
            console.error('[quoteService] convertToInvoice error:', err);
            return { invoiceId: null, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Deal Products → Quote Items Sync.
     * Creates a new quote for a deal and auto-populates its line items from the deal's products.
     */
    async createFromDealProducts(
        userId: string,
        dealId: string,
        dealName: string,
        contactId?: string
    ): Promise<{ quote: Quote | null; itemsAdded: number; error: string | null }> {
        try {
            // Create the quote shell
            const { quote, error: quoteErr } = await this.createQuote(userId, {
                name: `Quote for ${dealName}`,
                contactId,
                dealId,
                validForDays: 30,
                notes: `Auto-generated from Deal: ${dealName}`,
            });
            if (quoteErr || !quote) throw new Error(quoteErr || 'Quote could not be created');

            // Fetch deal products via dealService (lazy import to avoid circular deps)
            const { dealService } = await import('./dealService');
            const { products, error: prodErr } = await dealService.getDealProducts(dealId);
            if (prodErr) throw new Error(prodErr);

            let itemsAdded = 0;
            for (const product of products) {
                const { error: itemErr } = await this.addQuoteItem(quote.id, {
                    productName: product.productName,
                    description: product.description,
                    quantity: product.quantity,
                    unitPrice: product.unitPrice,
                    discountPercent: product.discountPercent,
                    taxPercent: product.taxPercent,
                });
                if (!itemErr) itemsAdded++;
            }

            // Recalculate totals after inserting all items
            if (itemsAdded > 0) await this.recalculateQuoteTotals(quote.id);

            const { quote: refreshed } = await this.getQuoteById(quote.id);
            return { quote: refreshed, itemsAdded, error: null };
        } catch (err) {
            console.error('[quoteService] createFromDealProducts error:', err);
            return { quote: null, itemsAdded: 0, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },
};
