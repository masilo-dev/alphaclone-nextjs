import { supabase } from '../../lib/supabase';
import { tenantService } from '../tenancy/TenantService';
import { AccountType } from './chartOfAccountsService';

export interface GeneralLedgerEntry {
    tenantId: string;
    accountId: string;
    accountCode: string;
    accountName: string;
    accountType: AccountType;
    entryNumber: string;
    entryDate: string;
    periodId?: string;
    entryDescription: string;
    lineDescription?: string;
    debitAmount: number;
    creditAmount: number;
    sourceType?: string;
    sourceId?: string;
    reference?: string;
    entityType?: string;
    entityId?: string;
    createdAt: string;
    postedAt?: string;
}

export interface AccountBalance {
    accountId: string;
    accountCode: string;
    accountName: string;
    accountType: AccountType;
    normalBalance: 'debit' | 'credit';
    debitTotal: number;
    creditTotal: number;
    balance: number;
}

export interface TrialBalance {
    accounts: Array<{
        accountCode: string;
        accountName: string;
        accountType: AccountType;
        debitBalance: number;
        creditBalance: number;
    }>;
    totalDebits: number;
    totalCredits: number;
    isBalanced: boolean;
}

export interface FinancialStatement {
    assets: AccountBalance[];
    liabilities: AccountBalance[];
    equity: AccountBalance[];
    revenue: AccountBalance[];
    expenses: AccountBalance[];
    otherIncome: AccountBalance[];
    otherExpense: AccountBalance[];
    totalAssets: number;
    totalLiabilities: number;
    totalEquity: number;
    totalRevenue: number;
    totalExpenses: number;
    netIncome: number;
}

export const generalLedgerService = {
    /**
     * Get tenant ID (required for all operations)
     */
    getTenantId(): string {
        const tenantId = tenantService.getCurrentTenantId();
        if (!tenantId) throw new Error('No active tenant. Please select an organization.');
        return tenantId;
    },

    /**
     * Get general ledger entries for an account
     */
    async getAccountEntries(
        accountId: string,
        filters?: {
            startDate?: string;
            endDate?: string;
            limit?: number;
        }
    ): Promise<{ entries: GeneralLedgerEntry[]; error: string | null }> {
        try {
            const tenantId = this.getTenantId();

            let query = supabase
                .from('general_ledger')
                .select('*')
                .eq('tenant_id', tenantId)
                .eq('account_id', accountId);

            if (filters?.startDate) {
                query = query.gte('entry_date', filters.startDate);
            }
            if (filters?.endDate) {
                query = query.lte('entry_date', filters.endDate);
            }

            const { data, error } = await query
                .order('entry_date', { ascending: true })
                .order('entry_number', { ascending: true })
                .limit(filters?.limit || 1000);

            if (error) throw error;

            const entries = (data || []).map(this.mapGLEntry);

            return { entries, error: null };
        } catch (err: any) {
            console.error('Error fetching GL entries:', err);
            return { entries: [], error: err.message };
        }
    },

    /**
     * Get all GL entries for a period
     */
    async getEntriesForPeriod(
        startDate: string,
        endDate: string,
        filters?: {
            accountType?: AccountType;
            sourceType?: string;
        }
    ): Promise<{ entries: GeneralLedgerEntry[]; error: string | null }> {
        try {
            const tenantId = this.getTenantId();

            let query = supabase
                .from('general_ledger')
                .select('*')
                .eq('tenant_id', tenantId)
                .gte('entry_date', startDate)
                .lte('entry_date', endDate);

            if (filters?.accountType) {
                query = query.eq('account_type', filters.accountType);
            }
            if (filters?.sourceType) {
                query = query.eq('source_type', filters.sourceType);
            }

            const { data, error } = await query.order('entry_date', { ascending: true });

            if (error) throw error;

            const entries = (data || []).map(this.mapGLEntry);

            return { entries, error: null };
        } catch (err: any) {
            console.error('Error fetching GL entries for period:', err);
            return { entries: [], error: err.message };
        }
    },

    /**
     * Get account balance
     */
    async getAccountBalance(
        accountId: string,
        asOfDate?: string
    ): Promise<{ balance: number; error: string | null }> {
        try {
            const { data, error } = await supabase.rpc('get_account_balance', {
                p_account_id: accountId,
                p_as_of_date: asOfDate || null,
            });

            if (error) throw error;

            return { balance: parseFloat(data || '0'), error: null };
        } catch (err: any) {
            console.error('Error getting account balance:', err);
            return { balance: 0, error: err.message };
        }
    },

    /**
     * Get trial balance
     * Shows all accounts with their debit and credit balances
     */
    /**
     * Get trial balance
     * Optimized to use single RPC call
     */
    async getTrialBalance(asOfDate?: string): Promise<{ trialBalance: TrialBalance | null; error: string | null }> {
        try {
            const tenantId = this.getTenantId();

            // Use the new RPC to get all balances in one go
            const { data: accountBalances, error } = await supabase.rpc('get_account_balances', {
                p_tenant_id: tenantId,
                p_start_date: null, // From beginning
                p_end_date: asOfDate || null
            });

            if (error) throw error;

            // Map RPC result to internal structure
            const accounts = (accountBalances || []).map((acc: any) => ({
                accountCode: acc.account_code,
                accountName: acc.account_name,
                accountType: acc.account_type,
                debitBalance: acc.debit_total,
                creditBalance: acc.credit_total
            }));

            // Filter for non-zero balances
            const activeAccounts = accounts.filter((acc: any) => acc.debitBalance > 0 || acc.creditBalance > 0);

            // Calculate totals
            const totalDebits = activeAccounts.reduce((sum: number, acc: any) => sum + acc.debitBalance, 0);
            const totalCredits = activeAccounts.reduce((sum: number, acc: any) => sum + acc.creditBalance, 0);

            const trialBalance: TrialBalance = {
                accounts: activeAccounts,
                totalDebits,
                totalCredits,
                isBalanced: Math.abs(totalDebits - totalCredits) < 0.01,
            };

            return { trialBalance, error: null };
        } catch (err: any) {
            console.error('Error calculating trial balance:', err);
            return { trialBalance: null, error: err.message };
        }
    },

    /**
     * Get balance sheet data
     * Assets = Liabilities + Equity
     */
    async getBalanceSheetData(asOfDate?: string): Promise<{ statement: FinancialStatement | null; error: string | null }> {
        try {
            const tenantId = this.getTenantId();

            // Use RPC
            const { data: accountBalances, error } = await supabase.rpc('get_account_balances', {
                p_tenant_id: tenantId,
                p_start_date: null,
                p_end_date: asOfDate || null
            });

            if (error) throw error;

            // Map to AccountBalance interface
            const balances: AccountBalance[] = (accountBalances || []).map((acc: any) => ({
                accountId: acc.account_id,
                accountCode: acc.account_code,
                accountName: acc.account_name,
                accountType: acc.account_type,
                normalBalance: acc.normal_balance,
                debitTotal: acc.debit_total,
                creditTotal: acc.credit_total,
                balance: acc.balance
            }));

            // Group by account type
            const assets = balances.filter(acc => acc.accountType === 'asset');
            const liabilities = balances.filter(acc => acc.accountType === 'liability');
            const equity = balances.filter(acc => acc.accountType === 'equity');
            const revenue = balances.filter(acc => acc.accountType === 'revenue');
            const expenses = balances.filter(acc => acc.accountType === 'expense');
            const otherIncome = balances.filter(acc => acc.accountType === 'other_income');
            const otherExpense = balances.filter(acc => acc.accountType === 'other_expense');

            // Calculate totals
            const totalAssets = assets.reduce((sum, acc) => sum + acc.balance, 0);
            const totalLiabilities = liabilities.reduce((sum, acc) => sum + acc.balance, 0);
            const totalEquity = equity.reduce((sum, acc) => sum + acc.balance, 0);
            const totalRevenue = revenue.reduce((sum, acc) => sum + acc.balance, 0) +
                otherIncome.reduce((sum, acc) => sum + acc.balance, 0);
            const totalExpenses = expenses.reduce((sum, acc) => sum + acc.balance, 0) +
                otherExpense.reduce((sum, acc) => sum + acc.balance, 0);
            const netIncome = totalRevenue - totalExpenses;

            const statement: FinancialStatement = {
                assets,
                liabilities,
                equity,
                revenue,
                expenses,
                otherIncome,
                otherExpense,
                totalAssets,
                totalLiabilities,
                totalEquity: totalEquity + netIncome, // Equity includes net income
                totalRevenue,
                totalExpenses,
                netIncome,
            };

            return { statement, error: null };
        } catch (err: any) {
            console.error('Error calculating balance sheet:', err);
            return { statement: null, error: err.message };
        }
    },

    /**
     * Get profit & loss (income statement) data
     * Revenue - Expenses = Net Income
     */
    async getProfitLossData(
        startDate: string,
        endDate: string
    ): Promise<{ statement: FinancialStatement | null; error: string | null }> {
        try {
            const tenantId = this.getTenantId();

            // Use RPC with date range
            const { data: accountBalances, error } = await supabase.rpc('get_account_balances', {
                p_tenant_id: tenantId,
                p_start_date: startDate,
                p_end_date: endDate
            });

            if (error) throw error;

            // Map to AccountBalance interface
            const balances: AccountBalance[] = (accountBalances || []).map((acc: any) => ({
                accountId: acc.account_id,
                accountCode: acc.account_code,
                accountName: acc.account_name,
                accountType: acc.account_type,
                normalBalance: acc.normal_balance,
                debitTotal: acc.debit_total,
                creditTotal: acc.credit_total,
                balance: acc.balance
            }));

            // Group by type
            const revenue = balances.filter(acc => acc.accountType === 'revenue');
            const expenses = balances.filter(acc => acc.accountType === 'expense');
            const otherIncome = balances.filter(acc => acc.accountType === 'other_income');
            const otherExpense = balances.filter(acc => acc.accountType === 'other_expense');

            const totalRevenue = revenue.reduce((sum, acc) => sum + acc.balance, 0) +
                otherIncome.reduce((sum, acc) => sum + acc.balance, 0);
            const totalExpenses = expenses.reduce((sum, acc) => sum + acc.balance, 0) +
                otherExpense.reduce((sum, acc) => sum + acc.balance, 0);
            const netIncome = totalRevenue - totalExpenses;

            const statement: FinancialStatement = {
                assets: [],
                liabilities: [],
                equity: [],
                revenue,
                expenses,
                otherIncome,
                otherExpense,
                totalAssets: 0,
                totalLiabilities: 0,
                totalEquity: 0,
                totalRevenue,
                totalExpenses,
                netIncome,
            };

            return { statement, error: null };
        } catch (err: any) {
            console.error('Error calculating profit & loss:', err);
            return { statement: null, error: err.message };
        }
    },

    /**
     * Refresh general ledger materialized view
     */
    async refreshGeneralLedger(): Promise<{ success: boolean; error: string | null }> {
        try {
            const { error } = await supabase.rpc('refresh_general_ledger');

            if (error) throw error;

            return { success: true, error: null };
        } catch (err: any) {
            console.error('Error refreshing GL:', err);
            return { success: false, error: err.message };
        }
    },

    /**
     * Map database record to GeneralLedgerEntry interface
     */
    mapGLEntry(data: any): GeneralLedgerEntry {
        return {
            tenantId: data.tenant_id,
            accountId: data.account_id,
            accountCode: data.account_code,
            accountName: data.account_name,
            accountType: data.account_type,
            entryNumber: data.entry_number,
            entryDate: data.entry_date,
            periodId: data.period_id,
            entryDescription: data.entry_description,
            lineDescription: data.line_description,
            debitAmount: parseFloat(data.debit_amount || '0'),
            creditAmount: parseFloat(data.credit_amount || '0'),
            sourceType: data.source_type,
            sourceId: data.source_id,
            reference: data.reference,
            entityType: data.entity_type,
            entityId: data.entity_id,
            createdAt: data.created_at,
            postedAt: data.posted_at,
        };
    },
};
