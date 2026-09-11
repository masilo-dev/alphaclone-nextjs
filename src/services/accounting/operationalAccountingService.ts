import { supabase } from '../../lib/supabase';

export interface OperationalFinancials {
  invoiceRevenue: number;
  paidRevenue: number;
  allTimePaidRevenue: number;
  allTimeAvailableCash: number;
  receiptExpenses: number;
  pendingInvoices: number;
  recentInvoiceActivity: Array<{
    id: string;
    date: string;
    description: string;
    amount: number;
    type: 'income';
  }>;
}

/**
 * Fallback financial stats from operational tables when the general ledger has no journal entries yet.
 * Most workspaces create invoices/receipts before chart-of-accounts posting is complete.
 */
export async function getOperationalFinancials(
  tenantId: string,
  startDate: string,
  endDate: string
): Promise<OperationalFinancials> {
  const [{ data: invoices }, { data: receipts }, { data: allInvoices }, { data: allReceipts }] = await Promise.all([
    supabase
      .from('business_invoices')
      .select('id, total, status, issue_date, invoice_number, client_name')
      .eq('tenant_id', tenantId)
      .gte('issue_date', startDate)
      .lte('issue_date', endDate),
    supabase
      .from('business_receipts')
      .select('id, amount, receipt_date, description, status')
      .eq('tenant_id', tenantId)
      .gte('receipt_date', startDate)
      .lte('receipt_date', endDate),
    supabase
      .from('business_invoices')
      .select('total, status')
      .eq('tenant_id', tenantId),
    supabase
      .from('business_receipts')
      .select('amount, status')
      .eq('tenant_id', tenantId),
  ]);

  const rows = (invoices || []) as Array<{
    id: string;
    total: number | null;
    status: string | null;
    issue_date: string | null;
    invoice_number: string | null;
    client_name: string | null;
  }>;
  const paidRevenue = rows
    .filter((i) => i.status === 'paid')
    .reduce((sum: number, i) => sum + Number(i.total || 0), 0);
  const invoiceRevenue = rows
    .filter((i) => ['paid', 'sent', 'overdue'].includes(String(i.status)))
    .reduce((sum: number, i) => sum + Number(i.total || 0), 0);

  const allTimePaidRevenue = ((allInvoices || []) as Array<{ total: number | null; status: string | null }>)
    .filter((i) => i.status === 'paid')
    .reduce((sum: number, i) => sum + Number(i.total || 0), 0);

  const allTimeReceiptExpenses = ((allReceipts || []) as Array<{ amount: number | null; status: string | null }>)
    .filter((r) => r.status !== 'void')
    .reduce((sum: number, r) => sum + Number(r.amount || 0), 0);

  const allTimeAvailableCash = allTimePaidRevenue - allTimeReceiptExpenses;

  const { data: pendingRows } = await supabase
    .from('business_invoices')
    .select('total')
    .eq('tenant_id', tenantId)
    .in('status', ['draft', 'sent', 'overdue']);

  const pendingInvoices = ((pendingRows || []) as Array<{ total: number | null }>).reduce(
    (sum: number, i) => sum + Number(i.total || 0),
    0
  );

  const receiptRows = (receipts || []) as Array<{ amount: number | null; status: string | null }>;
  const receiptExpenses = receiptRows
    .filter((r) => r.status !== 'void')
    .reduce((sum: number, r) => sum + Number(r.amount || 0), 0);

  const recentInvoiceActivity = rows
    .slice(0, 8)
    .map((inv) => ({
      id: inv.id,
      date: inv.issue_date || startDate,
      description: inv.invoice_number
        ? `Invoice ${inv.invoice_number}${inv.client_name ? ` — ${inv.client_name}` : ''}`
        : inv.client_name
          ? `Invoice — ${inv.client_name}`
          : 'Invoice',
      amount: Number(inv.total || 0),
      type: 'income' as const,
    }));

  return {
    invoiceRevenue,
    paidRevenue,
    allTimePaidRevenue,
    allTimeAvailableCash,
    receiptExpenses,
    pendingInvoices,
    recentInvoiceActivity,
  };
}

