// @ts-nocheck
import { z } from 'zod';
import { registerTool } from '../tool-registry';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { generatePnLStatement } from '@/lib/accounting/pnl';

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
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('business_invoices')
      .select('total, status, created_at, client_id, invoice_number')
      .eq('tenant_id', args.tenant_id)
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
      content: [{
        type: 'text',
        text: JSON.stringify({
          total_invoices: rows.length,
          total_paid: paid,
          total_outstanding: outstanding,
          currency: 'USD',
          by_month: byMonth,
        }, null, 2),
      }],
    };
  },
});
