import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export type PnLStatement = {
  period: { from: string; to: string; label: string };
  revenue: {
    total: number;
    by_month: { month: string; amount: number }[];
    invoices_paid: number;
    invoices_outstanding: number;
    outstanding_total: number;
  };
  expenses: {
    total: number;
    by_category: { category: string; amount: number; percentage: number }[];
  };
  gross_profit: number;
  net_profit: number;
  profit_margin_percent: number;
  currency: string;
  generated_at: string;
  tenant_id: string;
};

function normalizeMoney(value: unknown): number {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num : 0;
}

function normalizeDate(value: unknown): string | null {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

async function loadExpenseCategoryNames(supabase: ReturnType<typeof createSupabaseAdminClient>, tenantId: string, categoryIds: string[]) {
  if (!categoryIds.length) return new Map<string, string>();

  const { data, error } = await supabase
    .from('expense_categories')
    .select('id, name')
    .eq('tenant_id', tenantId)
    .in('id', categoryIds);

  if (error || !data) {
    return new Map<string, string>();
  }

  return new Map<string, string>((data as Array<{ id: string; name: string }>).map((row) => [row.id, row.name]));
}

export async function generatePnLStatement(
  tenantId: string,
  period: 'monthly' | 'quarterly' | 'yearly' = 'monthly',
  fromDate?: string,
  toDate?: string
): Promise<PnLStatement> {
  const supabase = createSupabaseAdminClient();

  // Resolve date range if not provided
  let from = fromDate;
  let to = toDate;

  if (!from || !to) {
    const now = new Date();
    if (period === 'monthly') {
      from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
    } else if (period === 'quarterly') {
      const quarter = Math.floor(now.getMonth() / 3);
      from = new Date(now.getFullYear(), quarter * 3, 1).toISOString();
      to = new Date(now.getFullYear(), (quarter + 1) * 3, 0, 23, 59, 59).toISOString();
    } else {
      from = new Date(now.getFullYear(), 0, 1).toISOString();
      to = new Date(now.getFullYear(), 11, 31, 23, 59, 59).toISOString();
    }
  }

  const fromIso = from as string;
  const toIso = to as string;

  // 1. Fetch Revenue (Paid Invoices)
  const { data: invoices, error: invError } = await supabase
    .from('business_invoices')
    .select('*')
    .eq('tenant_id', tenantId)
    .gte('created_at', fromIso)
    .lte('created_at', toIso) as { data: any[] | null, error: any };

  if (invError) throw new Error(`Revenue query failed: ${invError.message}`);

  const invoiceRows = (invoices || []) as Array<Record<string, any>>;
  const paidInvoices = invoiceRows.filter((i) => String(i.status || i.payment_status || '').toLowerCase() === 'paid');
  const totalRevenue = paidInvoices.reduce((sum: number, i: any) => sum + normalizeMoney(i.total ?? i.total_amount ?? i.amount), 0);

  const outstandingInvoices = invoiceRows.filter((i) => {
    const status = String(i.status || i.payment_status || '').toLowerCase();
    return ['sent', 'overdue', 'open', 'unpaid', 'pending'].includes(status);
  });
  const outstandingTotal = outstandingInvoices.reduce((sum: number, i: any) => sum + normalizeMoney(i.total ?? i.total_amount ?? i.amount), 0);

  // Group revenue by month
  const revenueByMonthMap = new Map<string, number>();
  paidInvoices.forEach((i: any) => {
    const invoiceDate = normalizeDate(i.created_at || i.issue_date || i.invoice_date || i.date);
    const month = invoiceDate ? invoiceDate.substring(0, 7) : 'unknown';
    revenueByMonthMap.set(month, (revenueByMonthMap.get(month) || 0) + normalizeMoney(i.total ?? i.total_amount ?? i.amount));
  });
  const revenueByMonth = Array.from(revenueByMonthMap.entries())
    .map(([month, amount]) => ({ month, amount: Number(amount.toFixed(2)) }))
    .sort((a, b) => a.month.localeCompare(b.month));

  // 2. Fetch Expenses (Approved)
  const { data: expenses, error: expError } = await supabase
    .from('expenses')
    .select('*')
    .eq('tenant_id', tenantId)
    .gte('date', fromIso.split('T')[0])
    .lte('date', toIso.split('T')[0]) as { data: any[] | null, error: any };

  if (expError) throw new Error(`Expenses query failed: ${expError.message}`);

  const expenseRows = (expenses || []) as Array<Record<string, any>>;
  const categoryIdList = [...new Set(
    expenseRows
      .map((row) => row.category_id)
      .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
  )];
  const categoryNames = await loadExpenseCategoryNames(supabase, tenantId, categoryIdList);

  // Include approved or all if no status exists (though our schema has status)
  const approvedExpenses = expenseRows.filter((e: any) => String(e.status || 'approved').toLowerCase() === 'approved');
  const totalExpenses = approvedExpenses.reduce((sum: number, e: any) => sum + normalizeMoney(e.amount), 0);

  // Group expenses by category
  const expenseByCatMap = new Map<string, number>();
  approvedExpenses.forEach((e: any) => {
    const cat = e.category || categoryNames.get(String(e.category_id || '')) || 'Uncategorized';
    expenseByCatMap.set(cat, (expenseByCatMap.get(cat) || 0) + normalizeMoney(e.amount));
  });
  
  const expenseByCat = Array.from(expenseByCatMap.entries())
    .map(([category, amount]) => ({
      category,
      amount: Number(amount.toFixed(2)),
      percentage: totalExpenses > 0 ? Number(((amount / totalExpenses) * 100).toFixed(1)) : 0
    }))
    .sort((a, b) => b.amount - a.amount);

  // 3. Final Calculations
  const grossProfit = totalRevenue - totalExpenses;
  const netProfit = grossProfit; // Expand for tax/other later
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  return {
    period: { 
      from, 
      to, 
      label: period.charAt(0).toUpperCase() + period.slice(1) 
    },
    revenue: {
      total: Number(totalRevenue.toFixed(2)),
      by_month: revenueByMonth,
      invoices_paid: paidInvoices.length,
      invoices_outstanding: outstandingInvoices.length,
      outstanding_total: Number(outstandingTotal.toFixed(2))
    },
    expenses: {
      total: Number(totalExpenses.toFixed(2)),
      by_category: expenseByCat
    },
    gross_profit: Number(grossProfit.toFixed(2)),
    net_profit: Number(netProfit.toFixed(2)),
    profit_margin_percent: Number(profitMargin.toFixed(1)),
    currency: 'USD', // Default or fetch from tenant settings
    generated_at: new Date().toISOString(),
    tenant_id: tenantId
  };
}
