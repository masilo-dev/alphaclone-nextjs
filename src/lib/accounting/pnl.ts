
import { createClient } from '@supabase/supabase-js';
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

  // 1. Fetch Revenue (Paid Invoices)
  const { data: invoices, error: invError } = await supabase
    .from('invoices')
    .select('paid_amount, total_amount, status, created_at')
    .eq('tenant_id', tenantId)
    .gte('created_at', from)
    .lte('created_at', to);

  if (invError) throw new Error(`Revenue query failed: ${invError.message}`);

  const paidInvoices = invoices.filter(i => i.status === 'paid');
  const totalRevenue = paidInvoices.reduce((sum, i) => sum + (Number(i.paid_amount) || 0), 0);
  
  const outstandingInvoices = invoices.filter(i => ['sent', 'overdue'].includes(i.status || ''));
  const outstandingTotal = outstandingInvoices.reduce((sum, i) => sum + (Number(i.total_amount) - (Number(i.paid_amount) || 0)), 0);

  // Group revenue by month
  const revenueByMonthMap = new Map<string, number>();
  paidInvoices.forEach(i => {
    const month = i.created_at.substring(0, 7); // YYYY-MM
    revenueByMonthMap.set(month, (revenueByMonthMap.get(month) || 0) + (Number(i.paid_amount) || 0));
  });
  const revenueByMonth = Array.from(revenueByMonthMap.entries())
    .map(([month, amount]) => ({ month, amount: Number(amount.toFixed(2)) }))
    .sort((a, b) => a.month.localeCompare(b.month));

  // 2. Fetch Expenses (Approved)
  const { data: expenses, error: expError } = await supabase
    .from('expenses')
    .select('amount, status, category, expense_categories(name)')
    .eq('tenant_id', tenantId)
    .gte('date', from.split('T')[0])
    .lte('date', to.split('T')[0]);

  if (expError) throw new Error(`Expenses query failed: ${expError.message}`);

  // Include approved or all if no status exists (though our schema has status)
  const approvedExpenses = expenses.filter(e => e.status === 'approved' || !e.status);
  const totalExpenses = approvedExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  // Group expenses by category
  const expenseByCatMap = new Map<string, number>();
  approvedExpenses.forEach(e => {
    const cat = e.category || e.expense_categories?.name || 'Uncategorized';
    expenseByCatMap.set(cat, (expenseByCatMap.get(cat) || 0) + (Number(e.amount) || 0));
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
