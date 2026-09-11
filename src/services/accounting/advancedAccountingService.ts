import { supabase } from '../../lib/supabase';
import { tenantService } from '../tenancy/TenantService';

export interface VendorBill {
    id: string;
    tenantId: string;
    vendorId?: string | null;
    companyId?: string | null;
    billNumber: string;
    reference?: string | null;
    issueDate: string;
    dueDate?: string | null;
    status: 'draft' | 'open' | 'partial' | 'paid' | 'void' | 'overdue';
    subtotal: number;
    taxAmount: number;
    discountAmount: number;
    total: number;
    amountPaid: number;
    balanceDue: number;
    currency: string;
    lineItems: any[];
    notes?: string | null;
    terms?: string | null;
    metadata: Record<string, any>;
    createdAt: string;
    updatedAt: string;
}

export interface BankAccount {
    id: string;
    tenantId: string;
    name: string;
    accountNumberLast4?: string | null;
    bankName?: string | null;
    accountType: 'checking' | 'savings' | 'credit_card' | 'loan' | 'investment' | 'other';
    currency: string;
    openingBalance: number;
    currentBalance: number;
    coaAccountId?: string | null;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface ReconciliationSession {
    id: string;
    tenantId: string;
    bankAccountId: string;
    statementStartDate: string;
    statementEndDate: string;
    statementEndingBalance: number;
    clearedBalance: number;
    discrepancyAmount: number;
    status: 'draft' | 'in_progress' | 'completed' | 'archived';
    notes?: string | null;
    completedAt?: string | null;
    createdAt: string;
    updatedAt: string;
}

export const advancedAccountingService = {
    getTenantId(): string {
        const tenantId = tenantService.getCurrentTenantId();
        if (!tenantId) throw new Error('No active tenant. Please select an organization.');
        return tenantId;
    },

    async getBills(filters?: {
        status?: VendorBill['status'];
        limit?: number;
    }): Promise<{ bills: VendorBill[]; error: string | null }> {
        try {
            const tenantId = this.getTenantId();
            let query = supabase
                .from('vendor_bills')
                .select('*')
                .eq('tenant_id', tenantId);

            if (filters?.status) query = query.eq('status', filters.status);

            const { data, error } = await query
                .order('issue_date', { ascending: false })
                .limit(filters?.limit || 100);

            if (error) throw error;
            return { bills: (data || []).map(this.mapBill), error: null };
        } catch (err: any) {
            console.error('Error fetching vendor bills:', err);
            return { bills: [], error: err.message };
        }
    },

    async createBill(input: Partial<VendorBill>): Promise<{ bill: VendorBill | null; error: string | null }> {
        try {
            const tenantId = this.getTenantId();
            const { data: billNumber, error: numError } = await supabase.rpc('generate_bill_number', {
                p_tenant_id: tenantId,
            });
            if (numError) throw numError;

            const { data, error } = await supabase
                .from('vendor_bills')
                .insert({
                    tenant_id: tenantId,
                    vendor_id: input.vendorId,
                    company_id: input.companyId,
                    bill_number: input.billNumber || billNumber,
                    reference: input.reference,
                    issue_date: input.issueDate,
                    due_date: input.dueDate,
                    status: input.status || 'draft',
                    subtotal: input.subtotal || 0,
                    tax_amount: input.taxAmount || 0,
                    discount_amount: input.discountAmount || 0,
                    total: input.total || 0,
                    amount_paid: input.amountPaid || 0,
                    currency: input.currency || 'USD',
                    line_items: input.lineItems || [],
                    notes: input.notes,
                    terms: input.terms,
                    metadata: input.metadata || {},
                })
                .select('*')
                .single();

            if (error) throw error;
            return { bill: this.mapBill(data), error: null };
        } catch (err: any) {
            console.error('Error creating vendor bill:', err);
            return { bill: null, error: err.message };
        }
    },

    async getBankAccounts(): Promise<{ accounts: BankAccount[]; error: string | null }> {
        try {
            const tenantId = this.getTenantId();
            const { data, error } = await supabase
                .from('bank_accounts')
                .select('*')
                .eq('tenant_id', tenantId)
                .order('name', { ascending: true });

            if (error) throw error;
            return { accounts: (data || []).map(this.mapBankAccount), error: null };
        } catch (err: any) {
            console.error('Error fetching bank accounts:', err);
            return { accounts: [], error: err.message };
        }
    },

    async createBankAccount(input: Partial<BankAccount>): Promise<{ account: BankAccount | null; error: string | null }> {
        try {
            const tenantId = this.getTenantId();
            const { data, error } = await supabase
                .from('bank_accounts')
                .insert({
                    tenant_id: tenantId,
                    name: input.name,
                    account_number_last4: input.accountNumberLast4,
                    bank_name: input.bankName,
                    account_type: input.accountType || 'checking',
                    currency: input.currency || 'USD',
                    opening_balance: input.openingBalance || 0,
                    current_balance: input.currentBalance ?? input.openingBalance ?? 0,
                    coa_account_id: input.coaAccountId,
                    is_active: input.isActive ?? true,
                })
                .select('*')
                .single();

            if (error) throw error;
            return { account: this.mapBankAccount(data), error: null };
        } catch (err: any) {
            console.error('Error creating bank account:', err);
            return { account: null, error: err.message };
        }
    },

    async createReconciliationSession(input: Partial<ReconciliationSession>): Promise<{ session: ReconciliationSession | null; error: string | null }> {
        try {
            const tenantId = this.getTenantId();
            const { data: userData } = await supabase.auth.getUser();
            const { data, error } = await supabase
                .from('reconciliation_sessions')
                .insert({
                    tenant_id: tenantId,
                    bank_account_id: input.bankAccountId,
                    statement_start_date: input.statementStartDate,
                    statement_end_date: input.statementEndDate,
                    statement_ending_balance: input.statementEndingBalance || 0,
                    cleared_balance: input.clearedBalance || 0,
                    status: input.status || 'draft',
                    notes: input.notes,
                    created_by: userData.user?.id,
                    completed_by: input.status === 'completed' ? userData.user?.id : null,
                    completed_at: input.status === 'completed' ? new Date().toISOString() : null,
                })
                .select('*')
                .single();

            if (error) throw error;
            return { session: this.mapReconciliationSession(data), error: null };
        } catch (err: any) {
            console.error('Error creating reconciliation session:', err);
            return { session: null, error: err.message };
        }
    },

    async getReconciliationSessions(limit = 25): Promise<{ sessions: ReconciliationSession[]; error: string | null }> {
        try {
            const tenantId = this.getTenantId();
            const { data, error } = await supabase
                .from('reconciliation_sessions')
                .select('*')
                .eq('tenant_id', tenantId)
                .order('statement_end_date', { ascending: false })
                .limit(limit);

            if (error) throw error;
            return { sessions: (data || []).map(this.mapReconciliationSession), error: null };
        } catch (err: any) {
            console.error('Error fetching reconciliation sessions:', err);
            return { sessions: [], error: err.message };
        }
    },

    async getAccountsReceivableAging(): Promise<{ aging: any[]; error: string | null }> {
        try {
            const tenantId = this.getTenantId();
            const { data, error } = await supabase.rpc('get_accounts_receivable_aging', {
                p_tenant_id: tenantId,
            });
            if (error) throw error;
            return { aging: data || [], error: null };
        } catch (err: any) {
            console.error('Error fetching AR aging:', err);
            return { aging: [], error: err.message };
        }
    },

    async getAccountsPayableAging(): Promise<{ aging: any[]; error: string | null }> {
        try {
            const tenantId = this.getTenantId();
            const { data, error } = await supabase.rpc('get_accounts_payable_aging', {
                p_tenant_id: tenantId,
            });
            if (error) throw error;
            return { aging: data || [], error: null };
        } catch (err: any) {
            console.error('Error fetching AP aging:', err);
            return { aging: [], error: err.message };
        }
    },

    async getOperatingSnapshot(): Promise<{ snapshot: any | null; error: string | null }> {
        try {
            const tenantId = this.getTenantId();
            const { data, error } = await supabase.rpc('get_finance_operating_snapshot', {
                p_tenant_id: tenantId,
            });
            if (error) throw error;
            return { snapshot: data || null, error: null };
        } catch (err: any) {
            console.error('Error fetching finance snapshot:', err);
            return { snapshot: null, error: err.message };
        }
    },

    mapBill(row: any): VendorBill {
        return {
            id: row.id,
            tenantId: row.tenant_id,
            vendorId: row.vendor_id,
            companyId: row.company_id,
            billNumber: row.bill_number,
            reference: row.reference,
            issueDate: row.issue_date,
            dueDate: row.due_date,
            status: row.status,
            subtotal: Number(row.subtotal || 0),
            taxAmount: Number(row.tax_amount || 0),
            discountAmount: Number(row.discount_amount || 0),
            total: Number(row.total || 0),
            amountPaid: Number(row.amount_paid || 0),
            balanceDue: Number(row.balance_due || 0),
            currency: row.currency || 'USD',
            lineItems: row.line_items || [],
            notes: row.notes,
            terms: row.terms,
            metadata: row.metadata || {},
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    },

    mapBankAccount(row: any): BankAccount {
        return {
            id: row.id,
            tenantId: row.tenant_id,
            name: row.name,
            accountNumberLast4: row.account_number_last4,
            bankName: row.bank_name,
            accountType: row.account_type,
            currency: row.currency || 'USD',
            openingBalance: Number(row.opening_balance || 0),
            currentBalance: Number(row.current_balance || 0),
            coaAccountId: row.coa_account_id,
            isActive: Boolean(row.is_active),
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    },

    mapReconciliationSession(row: any): ReconciliationSession {
        return {
            id: row.id,
            tenantId: row.tenant_id,
            bankAccountId: row.bank_account_id,
            statementStartDate: row.statement_start_date,
            statementEndDate: row.statement_end_date,
            statementEndingBalance: Number(row.statement_ending_balance || 0),
            clearedBalance: Number(row.cleared_balance || 0),
            discrepancyAmount: Number(row.discrepancy_amount || 0),
            status: row.status,
            notes: row.notes,
            completedAt: row.completed_at,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    },
};
