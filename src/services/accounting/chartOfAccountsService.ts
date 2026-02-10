import { supabase } from '../../lib/supabase';
import { tenantService } from '../tenancy/TenantService';

export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense' | 'other_income' | 'other_expense';

export type AccountSubtype =
    | 'current_asset' | 'fixed_asset' | 'other_asset'
    | 'current_liability' | 'long_term_liability'
    | 'equity' | 'retained_earnings'
    | 'operating_revenue' | 'non_operating_revenue'
    | 'cost_of_goods_sold' | 'operating_expense' | 'non_operating_expense';

export interface ChartOfAccount {
    id: string;
    tenantId: string;
    accountCode: string;
    accountName: string;
    accountType: AccountType;
    accountSubtype?: AccountSubtype;
    parentAccountId?: string;
    description?: string;
    isActive: boolean;
    isSystemAccount: boolean;
    normalBalance: 'debit' | 'credit';
    currentBalance: number;
    currency: string;
    allowManualEntries: boolean;
    createdAt: string;
    createdBy?: string;
    updatedAt: string;
    updatedBy?: string;
    deletedAt?: string;
}

export interface AccountHierarchy extends ChartOfAccount {
    subAccounts?: AccountHierarchy[];
    parentAccount?: {
        id: string;
        accountCode: string;
        accountName: string;
    };
}

export const chartOfAccountsService = {
    /**
     * Get tenant ID (required for all operations)
     */
    getTenantId(): string {
        const tenantId = tenantService.getCurrentTenantId();
        if (!tenantId) throw new Error('No active tenant. Please select an organization.');
        return tenantId;
    },

    /**
     * Get all accounts for tenant
     */
    async getAccounts(filters?: {
        accountType?: AccountType;
        isActive?: boolean;
        search?: string;
    }): Promise<{ accounts: ChartOfAccount[]; error: string | null }> {
        try {
            const tenantId = this.getTenantId();

            let query = supabase
                .from('chart_of_accounts')
                .select('*')
                .eq('tenant_id', tenantId)
                .is('deleted_at', null);

            if (filters?.accountType) {
                query = query.eq('account_type', filters.accountType);
            }
            if (filters?.isActive !== undefined) {
                query = query.eq('is_active', filters.isActive);
            }
            if (filters?.search) {
                query = query.or(`account_code.ilike.%${filters.search}%,account_name.ilike.%${filters.search}%`);
            }

            const { data, error } = await query.order('account_code', { ascending: true });

            if (error) throw error;

            const accounts = (data || []).map(this.mapAccount);

            return { accounts, error: null };
        } catch (err: any) {
            console.error('Error fetching accounts:', err);
            return { accounts: [], error: err.message };
        }
    },

    /**
     * Get accounts in hierarchical structure
     */
    async getAccountHierarchy(): Promise<{ hierarchy: AccountHierarchy[]; error: string | null }> {
        try {
            const { accounts, error } = await this.getAccounts({ isActive: true });

            if (error) return { hierarchy: [], error };

            // Build hierarchy
            const accountMap = new Map<string, AccountHierarchy>();
            const rootAccounts: AccountHierarchy[] = [];

            // First pass: create map
            accounts.forEach(account => {
                accountMap.set(account.id, { ...account, subAccounts: [] });
            });

            // Second pass: build hierarchy
            accounts.forEach(account => {
                const hierarchyAccount = accountMap.get(account.id)!;

                if (account.parentAccountId) {
                    const parent = accountMap.get(account.parentAccountId);
                    if (parent) {
                        parent.subAccounts = parent.subAccounts || [];
                        parent.subAccounts.push(hierarchyAccount);

                        // Add parent reference
                        hierarchyAccount.parentAccount = {
                            id: parent.id,
                            accountCode: parent.accountCode,
                            accountName: parent.accountName,
                        };
                    }
                } else {
                    rootAccounts.push(hierarchyAccount);
                }
            });

            return { hierarchy: rootAccounts, error: null };
        } catch (err: any) {
            console.error('Error building account hierarchy:', err);
            return { hierarchy: [], error: err.message };
        }
    },

    /**
     * Get single account by ID
     */
    async getAccount(accountId: string): Promise<{ account: ChartOfAccount | null; error: string | null }> {
        try {
            const tenantId = this.getTenantId();

            const { data, error } = await supabase
                .from('chart_of_accounts')
                .select('*')
                .eq('id', accountId)
                .eq('tenant_id', tenantId)
                .is('deleted_at', null)
                .single();

            if (error) throw error;

            return { account: data ? this.mapAccount(data) : null, error: null };
        } catch (err: any) {
            console.error('Error fetching account:', err);
            return { account: null, error: err.message };
        }
    },

    /**
     * Get account by code
     */
    async getAccountByCode(accountCode: string): Promise<{ account: ChartOfAccount | null; error: string | null }> {
        try {
            const tenantId = this.getTenantId();

            const { data, error } = await supabase
                .from('chart_of_accounts')
                .select('*')
                .eq('tenant_id', tenantId)
                .eq('account_code', accountCode)
                .is('deleted_at', null)
                .single();

            if (error) throw error;

            return { account: data ? this.mapAccount(data) : null, error: null };
        } catch (err: any) {
            console.error('Error fetching account by code:', err);
            return { account: null, error: err.message };
        }
    },

    /**
     * Create new account
     */
    async createAccount(account: Partial<ChartOfAccount>): Promise<{ account: ChartOfAccount | null; error: string | null }> {
        try {
            const tenantId = this.getTenantId();
            const { data: userData } = await supabase.auth.getUser();

            const { data, error } = await supabase
                .from('chart_of_accounts')
                .insert({
                    tenant_id: tenantId,
                    account_code: account.accountCode,
                    account_name: account.accountName,
                    account_type: account.accountType,
                    account_subtype: account.accountSubtype,
                    parent_account_id: account.parentAccountId,
                    description: account.description,
                    is_active: account.isActive ?? true,
                    is_system_account: account.isSystemAccount ?? false,
                    normal_balance: account.normalBalance,
                    currency: account.currency || 'USD',
                    allow_manual_entries: account.allowManualEntries ?? true,
                    created_by: userData.user?.id,
                })
                .select()
                .single();

            if (error) throw error;

            return { account: this.mapAccount(data), error: null };
        } catch (err: any) {
            console.error('Error creating account:', err);
            return { account: null, error: err.message };
        }
    },

    /**
     * Update account
     */
    async updateAccount(accountId: string, updates: Partial<ChartOfAccount>): Promise<{ account: ChartOfAccount | null; error: string | null }> {
        try {
            const tenantId = this.getTenantId();
            const { data: userData } = await supabase.auth.getUser();

            // Check if system account
            const { data: existing } = await supabase
                .from('chart_of_accounts')
                .select('is_system_account')
                .eq('id', accountId)
                .eq('tenant_id', tenantId)
                .single();

            if (existing?.is_system_account && updates.accountCode) {
                return {
                    account: null,
                    error: 'Cannot change account code of system accounts',
                };
            }

            const updateData: any = {};

            if (updates.accountCode !== undefined) updateData.account_code = updates.accountCode;
            if (updates.accountName !== undefined) updateData.account_name = updates.accountName;
            if (updates.accountType !== undefined) updateData.account_type = updates.accountType;
            if (updates.accountSubtype !== undefined) updateData.account_subtype = updates.accountSubtype;
            if (updates.parentAccountId !== undefined) updateData.parent_account_id = updates.parentAccountId;
            if (updates.description !== undefined) updateData.description = updates.description;
            if (updates.isActive !== undefined) updateData.is_active = updates.isActive;
            if (updates.normalBalance !== undefined) updateData.normal_balance = updates.normalBalance;
            if (updates.allowManualEntries !== undefined) updateData.allow_manual_entries = updates.allowManualEntries;

            updateData.updated_by = userData.user?.id;

            const { data, error } = await supabase
                .from('chart_of_accounts')
                .update(updateData)
                .eq('id', accountId)
                .eq('tenant_id', tenantId)
                .is('deleted_at', null)
                .select()
                .single();

            if (error) throw error;

            return { account: this.mapAccount(data), error: null };
        } catch (err: any) {
            console.error('Error updating account:', err);
            return { account: null, error: err.message };
        }
    },

    /**
     * Delete account (soft delete)
     * System accounts cannot be deleted
     */
    async deleteAccount(accountId: string): Promise<{ error: string | null }> {
        try {
            const tenantId = this.getTenantId();
            const { data: userData } = await supabase.auth.getUser();

            // Check if system account
            const { data: existing } = await supabase
                .from('chart_of_accounts')
                .select('is_system_account, current_balance')
                .eq('id', accountId)
                .eq('tenant_id', tenantId)
                .single();

            if (existing?.is_system_account) {
                return { error: 'Cannot delete system accounts' };
            }

            if (existing?.current_balance !== 0) {
                return { error: 'Cannot delete account with non-zero balance' };
            }

            const { error } = await supabase
                .from('chart_of_accounts')
                .update({
                    deleted_at: new Date().toISOString(),
                    updated_by: userData.user?.id,
                })
                .eq('id', accountId)
                .eq('tenant_id', tenantId);

            if (error) throw error;

            return { error: null };
        } catch (err: any) {
            console.error('Error deleting account:', err);
            return { error: err.message };
        }
    },

    /**
     * Get account balance
     */
    async getAccountBalance(accountId: string, asOfDate?: Date): Promise<{ balance: number; error: string | null }> {
        try {
            const dateStr = asOfDate ? asOfDate.toISOString().split('T')[0] : null;

            const { data, error } = await supabase.rpc('get_account_balance', {
                p_account_id: accountId,
                p_as_of_date: dateStr,
            });

            if (error) throw error;

            return { balance: parseFloat(data || '0'), error: null };
        } catch (err: any) {
            console.error('Error getting account balance:', err);
            return { balance: 0, error: err.message };
        }
    },

    /**
     * Initialize default chart of accounts for new tenant
     */
    async initializeDefaultAccounts(): Promise<{ success: boolean; error: string | null }> {
        try {
            const tenantId = this.getTenantId();

            const { error } = await supabase.rpc('create_default_chart_of_accounts', {
                p_tenant_id: tenantId,
            });

            if (error) throw error;

            return { success: true, error: null };
        } catch (err: any) {
            console.error('Error initializing default accounts:', err);
            return { success: false, error: err.message };
        }
    },

    /**
     * Get accounts by type
     */
    async getAccountsByType(accountType: AccountType): Promise<{ accounts: ChartOfAccount[]; error: string | null }> {
        return this.getAccounts({ accountType, isActive: true });
    },

    /**
     * Map database record to ChartOfAccount interface
     */
    mapAccount(data: any): ChartOfAccount {
        return {
            id: data.id,
            tenantId: data.tenant_id,
            accountCode: data.account_code,
            accountName: data.account_name,
            accountType: data.account_type,
            accountSubtype: data.account_subtype,
            parentAccountId: data.parent_account_id,
            description: data.description,
            isActive: data.is_active,
            isSystemAccount: data.is_system_account,
            normalBalance: data.normal_balance,
            currentBalance: parseFloat(data.current_balance || '0'),
            currency: data.currency,
            allowManualEntries: data.allow_manual_entries,
            createdAt: data.created_at,
            createdBy: data.created_by,
            updatedAt: data.updated_at,
            updatedBy: data.updated_by,
            deletedAt: data.deleted_at,
        };
    },
};
