// @ts-nocheck
import { z } from 'zod';
import { registerTool } from '../tool-registry';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { generatePnLStatement } from '@/lib/accounting/pnl';
import { getFinanceOperatingSnapshot, getRevenueSummary } from '@/lib/mcp/financeSnapshot';

registerTool('accounting', {
  name: 'accounting_snapshot',
  description:
    'Human-friendly accounting overview for non-technical users. Summarizes revenue, outstanding invoices, expenses, and profit in plain language.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    period: z.enum(['monthly', 'quarterly', 'yearly']).optional().default('monthly'),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
      period: { type: 'string', enum: ['monthly', 'quarterly', 'yearly'], description: 'Reporting period' },
    },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const pnl = await generatePnLStatement(args.tenant_id, args.period);
    const supabase = createSupabaseAdminClient();

    const [{ count: invoiceCount = 0 }, { count: expenseCount = 0 }, { count: journalCount = 0 }] = await Promise.all([
      supabase.from('business_invoices').select('*', { count: 'exact', head: true }).eq('tenant_id', args.tenant_id),
      supabase.from('expenses').select('*', { count: 'exact', head: true }).eq('tenant_id', args.tenant_id),
      supabase.from('journal_entries').select('*', { count: 'exact', head: true }).eq('tenant_id', args.tenant_id),
    ]);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          period: pnl.period,
          plain_english: {
            revenue: `$${pnl.revenue.total.toLocaleString()} collected in paid invoices`,
            outstanding: `$${pnl.revenue.outstanding_total.toLocaleString()} still outstanding`,
            expenses: `$${pnl.expenses.total.toLocaleString()} in approved expenses`,
            profit: `$${pnl.net_profit.toLocaleString()} net profit`,
            margin: `${pnl.profit_margin_percent}% profit margin`,
          },
          counts: {
            invoices: invoiceCount || 0,
            expenses: expenseCount || 0,
            journal_entries: journalCount || 0,
          },
          pnl,
        }, null, 2),
      }],
    };
  },
});

registerTool('accounting', {
  name: 'get_revenue_summary',
  description:
    'Returns revenue totals, paid vs outstanding split, and per-month breakdown from business_invoices. Use for revenue questions.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    period: z.enum(['monthly', 'quarterly', 'yearly']).optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
      period: { type: 'string', enum: ['monthly', 'quarterly', 'yearly'] },
    },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const payload = await getRevenueSummary(args.tenant_id);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(payload, null, 2),
      }],
    };
  },
});

registerTool('accounting', {
  name: 'get_finance_snapshot',
  description:
    'Return a finance operating snapshot: collected/pending/overdue revenue, payables, reconciliation, and contract status.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
    },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const snapshot = await getFinanceOperatingSnapshot(args.tenant_id);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(snapshot, null, 2),
      }],
    };
  },
});

function bucketReceivableDays(daysPastDue: number): 'current' | '1_30' | '31_60' | '61_90' | 'over_90' {
  if (daysPastDue <= 0) return 'current';
  if (daysPastDue <= 30) return '1_30';
  if (daysPastDue <= 60) return '31_60';
  if (daysPastDue <= 90) return '61_90';
  return 'over_90';
}

registerTool('accounting', {
  name: 'get_accounts_receivable_aging',
  description:
    'Accounts receivable aging report from business_invoices: current, 1-30, 31-60, 61-90, and 90+ day buckets with invoice detail.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
    },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('business_invoices')
      .select('id, invoice_number, total, status, due_date, client_name, client_id, created_at')
      .eq('tenant_id', args.tenant_id)
      .in('status', ['sent', 'overdue', 'draft'])
      .order('due_date', { ascending: true })
      .limit(500);

    if (error) throw error;

    const now = Date.now();
    const buckets = {
      current: { count: 0, total: 0 },
      days_1_30: { count: 0, total: 0 },
      days_31_60: { count: 0, total: 0 },
      days_61_90: { count: 0, total: 0 },
      over_90: { count: 0, total: 0 },
    };
    const invoices: Array<Record<string, unknown>> = [];

    for (const row of data || []) {
      const amount = Number(row.total) || 0;
      const dueMs = row.due_date ? new Date(row.due_date).getTime() : now;
      const daysPast = Math.max(0, Math.floor((now - dueMs) / 86400000));
      const bucket = bucketReceivableDays(daysPast);
      const key =
        bucket === 'current'
          ? 'current'
          : bucket === '1_30'
            ? 'days_1_30'
            : bucket === '31_60'
              ? 'days_31_60'
              : bucket === '61_90'
                ? 'days_61_90'
                : 'over_90';
      buckets[key].count += 1;
      buckets[key].total += amount;
      invoices.push({
        id: row.id,
        invoice_number: row.invoice_number,
        client_name: row.client_name,
        status: row.status,
        amount,
        due_date: row.due_date,
        days_past_due: daysPast,
        bucket: key,
      });
    }

    const totalOutstanding = Object.values(buckets).reduce((sum, b) => sum + b.total, 0);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ buckets, total_outstanding: totalOutstanding, invoices }, null, 2),
      }],
    };
  },
});

registerTool('accounting', {
  name: 'get_accounts_payable_aging',
  description:
    'Accounts payable aging from open vendor bills: current and overdue buckets with bill detail.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
    },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('vendor_bills')
      .select('id, vendor_name, total_amount, amount_paid, status, due_date')
      .eq('tenant_id', args.tenant_id)
      .in('status', ['open', 'partial', 'overdue'])
      .order('due_date', { ascending: true })
      .limit(200);

    if (error) throw error;

    const now = Date.now();
    const buckets = {
      current: { count: 0, total: 0 },
      days_1_30: { count: 0, total: 0 },
      days_31_60: { count: 0, total: 0 },
      days_61_90: { count: 0, total: 0 },
      over_90: { count: 0, total: 0 },
    };
    const bills: Array<Record<string, unknown>> = [];

    for (const row of data || []) {
      const owed = Math.max(0, Number(row.total_amount) - Number(row.amount_paid || 0));
      const dueMs = row.due_date ? new Date(row.due_date).getTime() : now;
      const daysPast = Math.max(0, Math.floor((now - dueMs) / 86400000));
      const bucket = bucketReceivableDays(daysPast);
      const key =
        bucket === 'current'
          ? 'current'
          : bucket === '1_30'
            ? 'days_1_30'
            : bucket === '31_60'
              ? 'days_31_60'
              : bucket === '61_90'
                ? 'days_61_90'
                : 'over_90';
      buckets[key].count += 1;
      buckets[key].total += owed;
      bills.push({
        id: row.id,
        vendor_name: row.vendor_name,
        status: row.status,
        amount_owed: owed,
        due_date: row.due_date,
        days_past_due: daysPast,
        bucket: key,
      });
    }

    const totalPayable = Object.values(buckets).reduce((sum, b) => sum + b.total, 0);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ buckets, total_payable: totalPayable, bills }, null, 2),
      }],
    };
  },
});
