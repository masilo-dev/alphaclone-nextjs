// @ts-nocheck
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

async function safeQuery<T>(fn: () => Promise<{ data: T | null; error: unknown }>) {
  try {
    return await fn();
  } catch {
    return { data: null, error: null };
  }
}

export async function getRevenueSummary(tenantId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('business_invoices')
    .select('total, status, created_at, client_id, invoice_number')
    .eq('tenant_id', tenantId)
    .limit(500);

  if (error) throw error;

  const rows = data ?? [];
  const paid = rows
    .filter((i) => i.status === 'paid')
    .reduce((s, i) => s + (Number(i.total) || 0), 0);
  const outstanding = rows
    .filter((i) => i.status !== 'paid')
    .reduce((s, i) => s + (Number(i.total) || 0), 0);

  const byMonth: Record<string, { paid: number; outstanding: number; invoice_count: number }> = {};
  for (const inv of rows) {
    const t = Number(inv.total) || 0;
    const isPaid = inv.status === 'paid';
    const created = inv.created_at ? new Date(inv.created_at) : new Date();
    const monthKey = `${created.getUTCFullYear()}-${String(created.getUTCMonth() + 1).padStart(2, '0')}`;
    if (!byMonth[monthKey]) {
      byMonth[monthKey] = { paid: 0, outstanding: 0, invoice_count: 0 };
    }
    byMonth[monthKey].invoice_count += 1;
    if (isPaid) byMonth[monthKey].paid += t;
    else byMonth[monthKey].outstanding += t;
  }

  return {
    total_invoices: rows.length,
    total_paid: paid,
    total_outstanding: outstanding,
    currency: 'USD',
    by_month: byMonth,
  };
}

export async function getFinanceOperatingSnapshot(tenantId: string) {
  const supabase = createSupabaseAdminClient();

  const [
    invoiceResult,
    billResult,
    reconcileResult,
    contractApprovalResult,
    contractTemplateResult,
  ] = await Promise.all([
    safeQuery(() =>
      supabase
        .from('business_invoices')
        .select('id, status, total, due_date, created_at')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(200)
    ),
    safeQuery(() =>
      supabase
        .from('vendor_bills')
        .select('id, status, total_amount, amount_paid, due_date')
        .eq('tenant_id', tenantId)
        .in('status', ['open', 'partial', 'overdue'])
        .limit(100)
    ),
    safeQuery(() =>
      supabase
        .from('bank_reconciliation_sessions')
        .select('id, status, statement_end_date, statement_ending_balance')
        .eq('tenant_id', tenantId)
        .in('status', ['draft', 'in_progress'])
        .limit(10)
    ),
    safeQuery(() =>
      supabase
        .from('contract_approvals')
        .select('id, status, created_at')
        .eq('tenant_id', tenantId)
        .eq('status', 'pending')
        .limit(20)
    ),
    safeQuery(() =>
      supabase
        .from('contract_templates')
        .select('id, name, category, is_active')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .limit(20)
    ),
  ]);

  const invoices = invoiceResult.data || [];
  const paidRevenue = invoices
    .filter((i) => i.status === 'paid')
    .reduce((sum, i) => sum + Number(i.total || 0), 0);
  const pendingRevenue = invoices
    .filter((i) => ['sent', 'draft'].includes(String(i.status)))
    .reduce((sum, i) => sum + Number(i.total || 0), 0);
  const overdueRevenue = invoices
    .filter((i) => i.status === 'overdue')
    .reduce((sum, i) => sum + Number(i.total || 0), 0);

  const openBills = billResult.data || [];
  const openBillsTotal = openBills.reduce(
    (sum, b) => sum + Number(b.total_amount || 0) - Number(b.amount_paid || 0),
    0
  );

  return {
    revenue: {
      collected: paidRevenue,
      pending: pendingRevenue,
      overdue: overdueRevenue,
      invoices_total: invoices.length,
      invoices_paid: invoices.filter((i) => i.status === 'paid').length,
      invoices_pending: invoices.filter((i) => i.status === 'sent').length,
      invoices_overdue: invoices.filter((i) => i.status === 'overdue').length,
      invoices_draft: invoices.filter((i) => i.status === 'draft').length,
    },
    payables: {
      open_bills_count: openBills.length,
      open_bills_total: openBillsTotal,
      bills: openBills.map((b) => ({
        id: b.id,
        status: b.status,
        owed: Number(b.total_amount || 0) - Number(b.amount_paid || 0),
        due_date: b.due_date,
      })),
    },
    reconciliation: {
      unreconciled_sessions: (reconcileResult.data || []).length,
      sessions: reconcileResult.data || [],
    },
    contracts: {
      pending_approvals: (contractApprovalResult.data || []).length,
      active_templates: (contractTemplateResult.data || []).length,
      templates: (contractTemplateResult.data || []).map((t) => ({
        id: t.id,
        name: t.name,
        category: t.category,
      })),
    },
    generated_at: new Date().toISOString(),
  };
}
