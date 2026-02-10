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
    async getTrialBalance(asOfDate?: string): Promise<{ trialBalance: TrialBalance | null; error: string | null }> {
        try {
            const tenantId = this.getTenantId();

            // Get all active accounts
            const { data: accounts, error: accountsError } = await supabase
                .from('chart_of_accounts')
                .select('id, account_code, account_name, account_type, normal_balance')
                .eq('tenant_id', tenantId)
                .eq('is_active', true)
                .is('deleted_at', null)
                .order('account_code', { ascending: true });

            if (accountsError) throw accountsError;

            // Get balances for each account
            const accountBalances = await Promise.all(
                (accounts || []).map(async (account: any) => {
                    const { balance } = await this.getAccountBalance(account.id, asOfDate);

                    const debitBalance = account.normal_balance === 'debit' && balance > 0 ? balance : 0;
                    const creditBalance = account.normal_balance === 'credit' && balance > 0 ? balance : 0;

                    return {
                        accountCode: account.account_code,
                        accountName: account.account_name,
                        accountType: account.account_type,
                        debitBalance,
                        creditBalance,
                    };
                })
            );

            // Calculate totals
            const totalDebits = accountBalances.reduce((sum, acc) => sum + acc.debitBalance, 0);
            const totalCredits = accountBalances.reduce((sum, acc) => sum + acc.creditBalance, 0);

            const trialBalance: TrialBalance = {
                accounts: accountBalances.filter(acc => acc.debitBalance > 0 || acc.creditBalance > 0),
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

            // Get all accounts with balances
            const { data: accounts, error: accountsError } = await supabase
                .from('chart_of_accounts')
                .select('id, account_code, account_name, account_type, normal_balance')
                .eq('tenant_id', tenantId)
                .eq('is_active', true)
                .is('deleted_at', null)
                .order('account_code', { ascending: true });

            if (accountsError) throw accountsError;

            // Get balances
            const accountBalances = await Promise.all(
                (accounts || []).map(async (account: any) => {
                    const { balance } = await this.getAccountBalance(account.id, asOfDate);

                    const debitTotal = balance > 0 && account.normal_balance === 'debit' ? balance : 0;
                    const creditTotal = balance > 0 && account.normal_balance === 'credit' ? balance : 0;

                    return {
                        accountId: account.id,
                        accountCode: account.account_code,
                        accountName: account.account_name,
                        accountType: account.account_type,
                        normalBalance: account.normal_balance,
                        debitTotal,
                        creditTotal,
                        balance,
                    };
                })
            );

            // Group by account type
            const assets = accountBalances.filter(acc => acc.accountType === 'asset');
            const liabilities = accountBalances.filter(acc => acc.accountType === 'liability');
            const equity = accountBalances.filter(acc => acc.accountType === 'equity');
            const revenue = accountBalances.filter(acc => acc.accountType === 'revenue');
            const expenses = accountBalances.filter(acc => acc.accountType === 'expense');
            const otherIncome = accountBalances.filter(acc => acc.accountType === 'other_income');
            const otherExpense = accountBalances.filter(acc => acc.accountType === 'other_expense');

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
            // For P&L, we need entries within the period
            const { entries, error } = await this.getEntriesForPeriod(startDate, endDate);

            if (error) return { statement: null, error };

            // Group by account
            const accountTotals = new Map<string, {
                accountId: string;
                accountCode: string;
                accountName: string;
                accountType: AccountType;
                debitTotal: number;
                creditTotal: number;
            }>();

            entries.forEach(entry => {
                const key = entry.accountId;
                const existing = accountTotals.get(key) || {
                    accountId: entry.accountId,
                    accountCode: entry.accountCode,
                    accountName: entry.accountName,
                    accountType: entry.accountType,
                    debitTotal: 0,
                    creditTotal: 0,
                };

                existing.debitTotal += entry.debitAmount;
                existing.creditTotal += entry.creditAmount;

                accountTotals.set(key, existing);
            });

            // Calculate balances based on normal balance
            const balances: AccountBalance[] = Array.from(accountTotals.values()).map(acc => {
                // Revenue and other income have credit normal balance
                const isCredit = acc.accountType === 'revenue' || acc.accountType === 'other_income';
                const balance = isCredit
                    ? acc.creditTotal - acc.debitTotal
                    : acc.debitTotal - acc.creditTotal;

                return {
                    ...acc,
                    normalBalance: isCredit ? ('credit' as const) : ('debit' as const),
                    balance,
                };
            });

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
