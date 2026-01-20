import { supabase } from '../lib/supabase';
import { tenantService } from './tenancy/TenantService';

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
            const validUntil = new Date();
            validUntil.setDate(validUntil.getDate() + (quoteData.validForDays || 30));

            const { data, error } = await supabase
                .from('quotes')
                .insert({
                    tenant_id: tenantId, // ← ASSIGN TO TENANT
                    name: quoteData.name,
                    contact_id: quoteData.contactId,
                    deal_id: quoteData.dealId,
                    template_id: quoteData.templateId,
                    currency: quoteData.currency || 'USD',
                    valid_until: validUntil.toISOString().split('T')[0],
                    notes: quoteData.notes,
                    terms_and_conditions: quoteData.termsAndConditions,
                    created_by: userId,
                })
                .select()
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
     * Update quote
     */
    async updateQuote(quoteId: string, updates: Partial<Quote>): Promise<{ quote: Quote | null; error: string | null }> {
        try {
            const updateData: any = {};

            if (updates.name !== undefined) updateData.name = updates.name;
            if (updates.status !== undefined) updateData.status = updates.status;
            if (updates.discountAmount !== undefined) updateData.discount_amount = updates.discountAmount;
            if (updates.discountPercent !== undefined) updateData.discount_percent = updates.discountPercent;
            if (updates.notes !== undefined) updateData.notes = updates.notes;
            if (updates.rejectionReason !== undefined) updateData.rejection_reason = updates.rejectionReason;
            if (updates.acceptedBy !== undefined) updateData.accepted_by = updates.acceptedBy;

            // Auto-set timestamps based on status changes
            if (updates.status === 'sent' && !updates.sentAt) {
                updateData.sent_at = new Date().toISOString();
            }
            if (updates.status === 'accepted' && !updates.acceptedAt) {
                updateData.accepted_at = new Date().toISOString();
            }
            if (updates.status === 'rejected' && !updates.rejectedAt) {
                updateData.rejected_at = new Date().toISOString();
            }

            const { data, error } = await supabase.from('quotes').update(updateData).eq('id', quoteId).select().single();

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
     * Delete quote
     */
    async deleteQuote(quoteId: string): Promise<{ success: boolean; error: string | null }> {
        try {
            const { error } = await supabase.from('quotes').delete().eq('id', quoteId).in('status', ['draft']);

            if (error) throw error;

            return { success: true, error: null };
        } catch (err) {
            return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Get quote items
     */
    async getQuoteItems(quoteId: string): Promise<{ items: QuoteItem[]; error: string | null }> {
        try {
            const { data, error } = await supabase
                .from('quote_items')
                .select('*')
                .eq('quote_id', quoteId)
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
            // Get current item count to set order
            const { data: existingItems } = await supabase.from('quote_items').select('id').eq('quote_id', quoteId);

            const { data, error } = await supabase
                .from('quote_items')
                .insert({
                    quote_id: quoteId,
                    product_name: itemData.productName,
                    description: itemData.description,
                    quantity: itemData.quantity,
                    unit_price: itemData.unitPrice,
                    discount_percent: itemData.discountPercent || 0,
                    tax_percent: itemData.taxPercent || 0,
                    item_order: itemData.itemOrder || (existingItems?.length || 0) + 1,
                })
                .select()
                .single();

            if (error) throw error;

            const item: QuoteItem = {
                id: data.id,
                quoteId: data.quote_id,
                itemOrder: data.item_order,
                productName: data.product_name,
                description: data.description,
                quantity: data.quantity,
                unitPrice: data.unit_price,
                discountPercent: data.discount_percent,
                taxPercent: data.tax_percent,
                lineTotal: data.line_total,
                metadata: data.metadata || {},
                createdAt: data.created_at,
            };

            return { item, error: null };
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
            const updateData: any = {};

            if (updates.productName !== undefined) updateData.product_name = updates.productName;
            if (updates.description !== undefined) updateData.description = updates.description;
            if (updates.quantity !== undefined) updateData.quantity = updates.quantity;
            if (updates.unitPrice !== undefined) updateData.unit_price = updates.unitPrice;
            if (updates.discountPercent !== undefined) updateData.discount_percent = updates.discountPercent;
            if (updates.taxPercent !== undefined) updateData.tax_percent = updates.taxPercent;

            const { data, error } = await supabase.from('quote_items').update(updateData).eq('id', itemId).select().single();

            if (error) throw error;

            const item: QuoteItem = {
                id: data.id,
                quoteId: data.quote_id,
                itemOrder: data.item_order,
                productName: data.product_name,
                description: data.description,
                quantity: data.quantity,
                unitPrice: data.unit_price,
                discountPercent: data.discount_percent,
                taxPercent: data.tax_percent,
                lineTotal: data.line_total,
                metadata: data.metadata || {},
                createdAt: data.created_at,
            };

            return { item, error: null };
        } catch (err) {
            return { item: null, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Delete quote item
     */
    async deleteQuoteItem(itemId: string): Promise<{ success: boolean; error: string | null }> {
        try {
            const { error } = await supabase.from('quote_items').delete().eq('id', itemId);

            if (error) throw error;

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
};
