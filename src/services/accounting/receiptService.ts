import { tenantService } from '../tenancy/TenantService';

export type ReceiptStatus = 'pending' | 'paid' | 'void';

export interface BusinessReceipt {
    id: string;
    tenantId: string;
    receiptDate: string;
    description: string;
    amount: number;
    category?: string;
    vendor?: string;
    status: ReceiptStatus;
    paymentMethod?: string;
    paidAt?: string;
    journalEntryId?: string;
    accountId?: string;
    assetAccountId?: string;
    imageUrl?: string;
    rawAiData?: any;
    createdAt: string;
    updatedAt: string;
}

export interface CreateSalesReceiptInput {
    receiptNumber: string;
    receiptDate: string;
    clientName: string;
    clientEmail?: string;
    paymentMethod: string;
    items: Array<{ description: string; quantity: number; unitPrice: number }>;
    discountAmount?: number;
    taxRate?: number;
    currency?: string;
    notes?: string;
    receivedBy?: string;
}

export const receiptService = {
    getTenantId(): string {
        const tenantId = tenantService.getCurrentTenantId();
        if (!tenantId) throw new Error('No active tenant');
        return tenantId;
    },

    async getReceipts(): Promise<{ receipts: BusinessReceipt[]; error: string | null }> {
        try {
            const tenantId = this.getTenantId();
            const response = await fetch(`/api/accounting/receipts?tenantId=${encodeURIComponent(tenantId)}`);
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.error || 'Expense receipts could not be loaded');
            return { receipts: (payload.receipts || []).map(this.mapReceipt), error: null };
        } catch (err: any) {
            console.error('Error fetching receipts:', err);
            return { receipts: [], error: err.message };
        }
    },

    async createReceipt(receipt: Partial<BusinessReceipt>): Promise<{ receipt: BusinessReceipt | null; error: string | null }> {
        try {
            const tenantId = this.getTenantId();
            const response = await fetch('/api/accounting/receipts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenantId, receiptDate: receipt.receiptDate || new Date().toISOString().slice(0, 10), description: receipt.description, amount: receipt.amount, category: receipt.category, vendor: receipt.vendor, status: receipt.status || 'pending', paymentMethod: receipt.paymentMethod, accountId: receipt.accountId, assetAccountId: receipt.assetAccountId, imageUrl: receipt.imageUrl, rawAiData: receipt.rawAiData || {} }) });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || !payload.receipt) throw new Error(payload.error || 'Receipt could not be created');
            return { receipt: this.mapReceipt(payload.receipt), error: null };
        } catch (err: any) {
            console.error('Error creating receipt:', err);
            return { receipt: null, error: err.message };
        }
    },

    async createSalesReceipt(input: CreateSalesReceiptInput): Promise<{ receipt: any | null; error: string | null }> {
        try {
            const tenantId = this.getTenantId();
            const response = await fetch('/api/accounting/sales-receipts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tenantId, ...input }),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || !payload.receipt) throw new Error(payload.error || 'Sales receipt could not be finalized');
            return { receipt: payload.receipt, error: null };
        } catch (error) {
            return { receipt: null, error: error instanceof Error ? error.message : 'Sales receipt could not be finalized' };
        }
    },

    async markAsPaid(receiptId: string, assetAccountId: string): Promise<{ success: boolean; error: string | null }> {
        try {
            const tenantId = this.getTenantId();
            const response = await fetch(`/api/accounting/receipts/${encodeURIComponent(receiptId)}`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tenantId, action: 'pay', assetAccountId }),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || !payload.receipt) throw new Error(payload.error || 'Expense receipt could not be paid');
            return { success: true, error: null };
        } catch (err: any) {
            console.error('Error marking receipt as paid:', err);
            return { success: false, error: err.message };
        }
    },

    async getReceiptById(id: string): Promise<{ receipt: BusinessReceipt | null; error: string | null }> {
        try {
            const tenantId = this.getTenantId();
            const response = await fetch(`/api/accounting/receipts/${encodeURIComponent(id)}?tenantId=${encodeURIComponent(tenantId)}`);
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || !payload.receipt) throw new Error(payload.error || 'Expense receipt could not be loaded');
            return { receipt: this.mapReceipt(payload.receipt), error: null };
        } catch (err: any) {
            return { receipt: null, error: err.message };
        }
    },

    mapReceipt(data: any): BusinessReceipt {
        return {
            id: data.id,
            tenantId: data.tenant_id,
            receiptDate: data.receipt_date,
            description: data.description,
            amount: parseFloat(data.amount || '0'),
            category: data.category,
            vendor: data.vendor,
            status: data.status,
            paymentMethod: data.payment_method,
            paidAt: data.paid_at,
            journalEntryId: data.journal_entry_id,
            accountId: data.account_id,
            assetAccountId: data.asset_account_id,
            imageUrl: data.image_url,
            rawAiData: data.raw_ai_data,
            createdAt: data.created_at,
            updatedAt: data.updated_at
        };
    }
};
