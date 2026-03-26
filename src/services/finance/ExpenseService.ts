/**
 * Expense Service — inspired by Crater (github.com/crater-invoice/crater ⭐7.5k)
 * Handles expense tracking, approval workflow, and GL posting.
 */
import { supabase as defaultSupabase } from '../../lib/supabase';
import { createClient } from '@supabase/supabase-js';
import { ENV } from '@/config/env';

function getSupabase() {
    if (typeof window === 'undefined' && ENV.SUPABASE_SERVICE_ROLE_KEY && ENV.VITE_SUPABASE_URL) {
        return createClient(ENV.VITE_SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY);
    }
    return defaultSupabase;
}

export interface Expense {
    id: string;
    tenant_id: string;
    category_id?: string;
    contact_id?: string;
    company_id?: string;
    expense_number?: string;
    date: string;
    amount: number;
    tax_amount: number;
    total: number;
    currency: string;
    description?: string;
    vendor_name?: string;
    payment_method: string;
    status: 'pending' | 'approved' | 'rejected' | 'reimbursed';
    billable: boolean;
    receipt_url?: string;
    notes?: string;
    journal_entry_id?: string;
    zoho_books_id?: string;
    created_at: string;
    updated_at: string;
    // Joined
    category?: { name: string; color: string; icon: string };
}

export interface CreateExpenseInput {
    category_id?: string;
    contact_id?: string;
    company_id?: string;
    date: string;
    amount: number;
    tax_amount?: number;
    currency?: string;
    description?: string;
    vendor_name?: string;
    payment_method?: string;
    billable?: boolean;
    client_id?: string;
    receipt_url?: string;
    notes?: string;
}

export interface ExpenseFilters {
    status?: string;
    category_id?: string;
    from_date?: string;
    to_date?: string;
    billable?: boolean;
    search?: string;
}

export const expenseService = {
    // ──────────────────────────────────────
    // EXPENSES
    // ──────────────────────────────────────

    async getExpenses(tenantId: string, filters: ExpenseFilters = {}): Promise<Expense[]> {
        const supabase = getSupabase();
        let query = supabase
            .from('expenses')
            .select('*, expense_categories(name, color, icon, account_code)')
            .eq('tenant_id', tenantId)
            .order('date', { ascending: false });

        if (filters.status)      query = query.eq('status', filters.status);
        if (filters.category_id) query = query.eq('category_id', filters.category_id);
        if (filters.from_date)   query = query.gte('date', filters.from_date);
        if (filters.to_date)     query = query.lte('date', filters.to_date);
        if (filters.billable !== undefined) query = query.eq('billable', filters.billable);

        const { data, error } = await query;
        if (error) throw new Error(error.message);
        return (data ?? []) as Expense[];
    },

    async getExpense(tenantId: string, expenseId: string): Promise<Expense | null> {
        const supabase = getSupabase();
        const { data, error } = await supabase
            .from('expenses')
            .select('*, expense_categories(name, color, icon, account_code)')
            .eq('id', expenseId)
            .eq('tenant_id', tenantId)
            .maybeSingle();
        if (error) throw new Error(error.message);
        return data as Expense | null;
    },

    async createExpense(tenantId: string, userId: string, input: CreateExpenseInput): Promise<Expense> {
        const supabase = getSupabase();

        // Generate expense number
        const { data: numData } = await supabase
            .rpc('generate_expense_number', { p_tenant_id: tenantId });

        const { data, error } = await supabase
            .from('expenses')
            .insert({
                tenant_id: tenantId,
                created_by: userId,
                expense_number: numData,
                tax_amount: input.tax_amount ?? 0,
                currency: input.currency ?? 'USD',
                payment_method: input.payment_method ?? 'card',
                billable: input.billable ?? false,
                status: 'pending',
                ...input,
            })
            .select('*, expense_categories(name, color, icon)')
            .single();

        if (error) throw new Error(error.message);
        return data as Expense;
    },

    async updateExpense(tenantId: string, expenseId: string, updates: Partial<CreateExpenseInput>): Promise<Expense> {
        const supabase = getSupabase();

        // Cannot edit approved/reimbursed expenses
        const current = await this.getExpense(tenantId, expenseId);
        if (!current) throw new Error('Expense not found');
        if (['approved', 'reimbursed'].includes(current.status)) {
            throw new Error('Cannot edit an approved expense. Create a new one instead.');
        }

        const { data, error } = await supabase
            .from('expenses')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', expenseId)
            .eq('tenant_id', tenantId)
            .select('*')
            .single();

        if (error) throw new Error(error.message);
        return data as Expense;
    },

    async deleteExpense(tenantId: string, expenseId: string): Promise<void> {
        const supabase = getSupabase();
        const current = await this.getExpense(tenantId, expenseId);
        if (!current) throw new Error('Expense not found');
        if (current.status !== 'pending') {
            throw new Error(`Cannot delete a ${current.status} expense.`);
        }

        const { error } = await supabase
            .from('expenses')
            .delete()
            .eq('id', expenseId)
            .eq('tenant_id', tenantId);

        if (error) throw new Error(error.message);
    },

    async approveExpense(tenantId: string, expenseId: string, approverId: string): Promise<Expense> {
        const supabase = getSupabase();
        const { data, error } = await supabase
            .from('expenses')
            .update({
                status: 'approved',
                approved_by: approverId,
                approved_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq('id', expenseId)
            .eq('tenant_id', tenantId)
            .select('*')
            .single();

        if (error) throw new Error(error.message);
        return data as Expense;
    },

    async rejectExpense(tenantId: string, expenseId: string, reason?: string): Promise<Expense> {
        const supabase = getSupabase();
        const { data, error } = await supabase
            .from('expenses')
            .update({
                status: 'rejected',
                notes: reason ?? null,
                updated_at: new Date().toISOString(),
            })
            .eq('id', expenseId)
            .eq('tenant_id', tenantId)
            .select('*')
            .single();

        if (error) throw new Error(error.message);
        return data as Expense;
    },

    // ──────────────────────────────────────
    // EXPENSE CATEGORIES
    // ──────────────────────────────────────

    async getCategories(tenantId: string) {
        const supabase = getSupabase();
        const { data, error } = await supabase
            .from('expense_categories')
            .select('*')
            .eq('tenant_id', tenantId)
            .eq('is_active', true)
            .order('name');
        if (error) throw new Error(error.message);
        return data ?? [];
    },

    async createCategory(tenantId: string, category: { name: string; description?: string; account_code?: string; color?: string; icon?: string }) {
        const supabase = getSupabase();
        const { data, error } = await supabase
            .from('expense_categories')
            .insert({ tenant_id: tenantId, ...category })
            .select('*')
            .single();
        if (error) throw new Error(error.message);
        return data;
    },

    async seedDefaultCategories(tenantId: string): Promise<void> {
        const defaults = [
            { name: 'Advertising & Marketing', account_code: '6100', color: '#f59e0b', icon: 'megaphone' },
            { name: 'Software & Subscriptions', account_code: '6200', color: '#6366f1', icon: 'computer' },
            { name: 'Office Supplies',          account_code: '6300', color: '#10b981', icon: 'briefcase' },
            { name: 'Travel & Transportation',  account_code: '6400', color: '#3b82f6', icon: 'car' },
            { name: 'Meals & Entertainment',    account_code: '6500', color: '#f97316', icon: 'utensils' },
            { name: 'Utilities',                account_code: '6600', color: '#84cc16', icon: 'zap' },
            { name: 'Professional Services',    account_code: '6700', color: '#8b5cf6', icon: 'users' },
            { name: 'Insurance',                account_code: '6800', color: '#ec4899', icon: 'shield' },
            { name: 'Bank Charges',             account_code: '6900', color: '#ef4444', icon: 'credit-card' },
            { name: 'Miscellaneous',            account_code: '6999', color: '#6b7280', icon: 'more-horizontal' },
        ];

        const supabase = getSupabase();
        for (const cat of defaults) {
            await supabase
                .from('expense_categories')
                .upsert({ tenant_id: tenantId, ...cat }, { onConflict: 'tenant_id,name', ignoreDuplicates: true });
        }
    },

    // ──────────────────────────────────────
    // SUMMARY / ANALYTICS
    // ──────────────────────────────────────

    async getExpenseSummary(tenantId: string, year: number): Promise<{
        total: number;
        by_category: { name: string; total: number; count: number }[];
        by_month: { month: string; total: number }[];
        pending_count: number;
    }> {
        const supabase = getSupabase();
        const from = `${year}-01-01`;
        const to   = `${year}-12-31`;

        const { data } = await supabase
            .from('expenses')
            .select('amount, tax_amount, status, date, expense_categories(name)')
            .eq('tenant_id', tenantId)
            .gte('date', from)
            .lte('date', to);

        type RawExpense = { amount: number | null; tax_amount: number | null; status: string | null; date: string | null; expense_categories: unknown };
        const expenses = (data ?? []) as RawExpense[];
        const approved = expenses.filter((e: RawExpense) => e.status !== 'rejected');

        const total = approved.reduce((sum: number, e: RawExpense) => sum + (e.amount || 0) + (e.tax_amount || 0), 0);
        const pending_count = expenses.filter((e: RawExpense) => e.status === 'pending').length;

        // Group by category
        const catMap = new Map<string, { total: number; count: number }>();
        for (const e of approved as RawExpense[]) {
            const name = (e.expense_categories as any)?.name || 'Uncategorized';
            const prev = catMap.get(name) || { total: 0, count: 0 };
            catMap.set(name, { total: prev.total + (e.amount || 0), count: prev.count + 1 });
        }
        const by_category = Array.from(catMap.entries())
            .map(([name, v]) => ({ name, ...v }))
            .sort((a, b) => b.total - a.total);

        // Group by month
        const monthMap = new Map<string, number>();
        for (const e of approved) {
            const m = e.date?.slice(0, 7); // YYYY-MM
            if (m) monthMap.set(m, (monthMap.get(m) || 0) + (e.amount || 0));
        }
        const by_month = Array.from(monthMap.entries())
            .map(([month, total]) => ({ month, total }))
            .sort((a, b) => a.month.localeCompare(b.month));

        return { total, by_category, by_month, pending_count };
    },
};
