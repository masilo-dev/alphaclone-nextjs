import { supabase } from '../../lib/supabase';
import { tenantService } from '../tenancy/TenantService';
import { journalEntryService } from './journalEntryService';

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

export const receiptService = {
    getTenantId(): string {
        const tenantId = tenantService.getCurrentTenantId();
        if (!tenantId) throw new Error('No active tenant');
        return tenantId;
    },

    async getReceipts(): Promise<{ receipts: BusinessReceipt[]; error: string | null }> {
        try {
            const tenantId = this.getTenantId();
            const { data, error } = await supabase
                .from('business_receipts')
                .select('*')
                .eq('tenant_id', tenantId)
                .order('receipt_date', { ascending: false });

            if (error) throw error;

            return { receipts: (data || []).map(this.mapReceipt), error: null };
        } catch (err: any) {
            console.error('Error fetching receipts:', err);
            return { receipts: [], error: err.message };
        }
    },

    async createReceipt(receipt: Partial<BusinessReceipt>): Promise<{ receipt: BusinessReceipt | null; error: string | null }> {
        try {
            const tenantId = this.getTenantId();
            const { data, error } = await supabase
                .from('business_receipts')
                .insert({
                    tenant_id: tenantId,
                    receipt_date: receipt.receiptDate || new Date().toISOString().split('T')[0],
                    description: receipt.description,
                    amount: receipt.amount,
                    category: receipt.category,
                    vendor: receipt.vendor,
                    status: receipt.status || 'pending',
                    payment_method: receipt.paymentMethod,
                    account_id: receipt.accountId,
                    asset_account_id: receipt.assetAccountId,
                    image_url: receipt.imageUrl,
                    raw_ai_data: receipt.rawAiData
                })
                .select()
                .single();

            if (error) throw error;

            return { receipt: this.mapReceipt(data), error: null };
        } catch (err: any) {
            console.error('Error creating receipt:', err);
            return { receipt: null, error: err.message };
        }
    },

    async updateReceipt(id: string, updates: Partial<BusinessReceipt>): Promise<{ receipt: BusinessReceipt | null; error: string | null }> {
        try {
            const { data, error } = await supabase
                .from('business_receipts')
                .update({
                    ...updates,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;

            return { receipt: this.mapReceipt(data), error: null };
        } catch (err: any) {
            console.error('Error updating receipt:', err);
            return { receipt: null, error: err.message };
        }
    },

    async markAsPaid(receiptId: string, assetAccountId: string): Promise<{ success: boolean; error: string | null }> {
        try {
            const { receipt, error: fetchError } = await this.getReceiptById(receiptId);
            if (fetchError || !receipt) throw new Error(fetchError || 'Receipt not found');

            if (receipt.status === 'paid') return { success: true, error: null };

            // Create journal entry
            const { entry, error: jeError } = await journalEntryService.createEntry({
                entryDate: receipt.receiptDate,
                description: `Paid: ${receipt.description}`,
                reference: receipt.vendor || 'Receipt',
                lines: [
                    { 
                        accountId: receipt.accountId || '', // Expense account
                        debitAmount: receipt.amount, 
                        creditAmount: 0, 
                        description: receipt.description 
                    },
                    { 
                        accountId: assetAccountId, // Cash/Bank account
                        debitAmount: 0, 
                        creditAmount: receipt.amount, 
                        description: 'Payment for receipt' 
                    }
                ]
            });

            if (jeError) throw new Error(jeError);

            if (entry) {
                await journalEntryService.postEntry(entry.id);
                
                // Update receipt
                await this.updateReceipt(receiptId, {
                    status: 'paid',
                    paidAt: new Date().toISOString(),
                    journalEntryId: entry.id,
                    assetAccountId: assetAccountId
                });
            }

            return { success: true, error: null };
        } catch (err: any) {
            console.error('Error marking receipt as paid:', err);
            return { success: false, error: err.message };
        }
    },

    async getReceiptById(id: string): Promise<{ receipt: BusinessReceipt | null; error: string | null }> {
        try {
            const { data, error } = await supabase
                .from('business_receipts')
                .select('*')
                .eq('id', id)
                .single();

            if (error) throw error;
            return { receipt: this.mapReceipt(data), error: null };
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
