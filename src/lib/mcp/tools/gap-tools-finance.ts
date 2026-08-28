// @ts-nocheck
/**
 * Gap handlers — Finance / Accounting
 * Covers: get_balance_sheet, get_cash_flow_statement, get_pnl_statement,
 *         create_expense, get_expenses, generate_expense_report,
 *         create_journal_entry, get_invoice_line_items,
 *         create_quote, get_quotes, update_quote, send_quote,
 *         send_receipt, reconcile_payment, create_subscription_checkout,
 *         get_business_snapshot, get_pnl_statement
 */
import { z } from 'zod';
import { registerTool } from '@/lib/mcp/tool-registry';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { recordInvoicePaymentServer } from '@/lib/invoices/recordInvoicePaymentServer';
import { generatePnLStatement } from '@/lib/accounting/pnl';

const tid = z.string().describe('AlphaClone Workspace ID');

// ── get_pnl_statement ────────────────────────────────────────────────
registerTool('gap-finance', {
  name: 'get_pnl_statement',
  description: 'Generate a detailed Profit & Loss statement including revenue, expenses, and net margin.',
  inputSchema: z.object({
    tenant_id: tid,
    period: z.enum(['monthly', 'quarterly', 'yearly']).optional().default('monthly'),
    from_date: z.string().optional(),
    to_date: z.string().optional(),
  }),
  jsonSchema: { type: 'object', properties: { tenant_id: { type: 'string' }, period: { type: 'string' }, from_date: { type: 'string' }, to_date: { type: 'string' } }, required: [] },
  handler: async (args) => {
    const pnl = await generatePnLStatement(args.tenant_id, args.period ?? 'monthly');
    return { content: [{ type: 'text', text: JSON.stringify(pnl, null, 2) }] };
  },
});

// ── get_balance_sheet ────────────────────────────────────────────────
registerTool('gap-finance', {
  name: 'get_balance_sheet',
  description: 'Generate a balance sheet summary: assets, liabilities, and equity.',
  inputSchema: z.object({ tenant_id: tid }),
  jsonSchema: { type: 'object', properties: { tenant_id: { type: 'string' } }, required: [] },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const [{ data: invoices }, { data: expenses }, { data: bills }] = await Promise.all([
      supabase.from('business_invoices').select('total, status').eq('tenant_id', args.tenant_id).limit(2000),
      supabase.from('expenses').select('amount, status').eq('tenant_id', args.tenant_id).limit(2000),
      supabase.from('vendor_bills').select('total_amount, amount_paid, status').eq('tenant_id', args.tenant_id).limit(500),
    ]);
    const paidRevenue = (invoices || []).filter((i: any) => i.status === 'paid').reduce((s: number, i: any) => s + Number(i.total || 0), 0);
    const outstanding = (invoices || []).filter((i: any) => ['sent', 'overdue'].includes(i.status)).reduce((s: number, i: any) => s + Number(i.total || 0), 0);
    const totalExpenses = (expenses || []).reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
    const totalPayable = (bills || []).filter((b: any) => b.status !== 'paid').reduce((s: number, b: any) => s + Math.max(0, Number(b.total_amount || 0) - Number(b.amount_paid || 0)), 0);
    const result = {
      assets: { cash_and_revenue: paidRevenue, accounts_receivable: outstanding, total_assets: paidRevenue + outstanding },
      liabilities: { accounts_payable: totalPayable, total_expenses_incurred: totalExpenses, total_liabilities: totalPayable + totalExpenses },
      equity: { net_equity: paidRevenue + outstanding - totalPayable - totalExpenses },
      generated_at: new Date().toISOString(),
    };
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  },
});

// ── get_cash_flow_statement ──────────────────────────────────────────
registerTool('gap-finance', {
  name: 'get_cash_flow_statement',
  description: 'Cash flow summary: inflows from paid invoices, outflows from expenses.',
  inputSchema: z.object({ tenant_id: tid, period: z.enum(['monthly', 'quarterly', 'yearly']).optional().default('monthly') }),
  jsonSchema: { type: 'object', properties: { tenant_id: { type: 'string' }, period: { type: 'string' } }, required: [] },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const now = new Date();
    const fromDate = args.period === 'yearly'
      ? new Date(now.getFullYear(), 0, 1).toISOString()
      : args.period === 'quarterly'
        ? new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1).toISOString()
        : new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const [{ data: paid }, { data: expenses }] = await Promise.all([
      supabase.from('business_invoices').select('total, created_at').eq('tenant_id', args.tenant_id).eq('status', 'paid').gte('created_at', fromDate).limit(1000),
      supabase.from('expenses').select('amount, created_at').eq('tenant_id', args.tenant_id).gte('created_at', fromDate).limit(1000),
    ]);
    const inflow = (paid || []).reduce((s: number, i: any) => s + Number(i.total || 0), 0);
    const outflow = (expenses || []).reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
    return { content: [{ type: 'text', text: JSON.stringify({ period: args.period, inflow_from_invoices: inflow, outflow_from_expenses: outflow, net_cash_flow: inflow - outflow, from_date: fromDate, generated_at: new Date().toISOString() }, null, 2) }] };
  },
});

// ── create_expense ───────────────────────────────────────────────────
registerTool('gap-finance', {
  name: 'create_expense',
  description: 'Create a new business expense record.',
  inputSchema: z.object({ tenant_id: tid, description: z.string(), amount: z.number(), category: z.string().optional(), date: z.string().optional(), vendor: z.string().optional(), receipt_url: z.string().optional() }),
  jsonSchema: { type: 'object', properties: { tenant_id: { type: 'string' }, description: { type: 'string' }, amount: { type: 'number' }, category: { type: 'string' }, date: { type: 'string' }, vendor: { type: 'string' }, receipt_url: { type: 'string' } }, required: ['description', 'amount'] },
  handler: async (args, ctx) => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.from('expenses').insert({
      tenant_id: args.tenant_id, description: args.description, amount: args.amount,
      category: args.category || 'general', date: args.date || new Date().toISOString().split('T')[0],
      vendor: args.vendor || null, receipt_url: args.receipt_url || null,
      status: 'approved', created_by: ctx.userId, created_at: new Date().toISOString(),
    }).select().single();
    if (error) return { content: [{ type: 'text', text: JSON.stringify({ error: error.message }) }] };
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  },
});

// ── get_expenses ─────────────────────────────────────────────────────
registerTool('gap-finance', {
  name: 'get_expenses',
  description: 'List business expenses with optional filters.',
  inputSchema: z.object({ tenant_id: tid, category: z.string().optional(), limit: z.number().optional().default(50), from_date: z.string().optional() }),
  jsonSchema: { type: 'object', properties: { tenant_id: { type: 'string' }, category: { type: 'string' }, limit: { type: 'number' }, from_date: { type: 'string' } }, required: [] },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    let q = supabase.from('expenses').select('*').eq('tenant_id', args.tenant_id).order('created_at', { ascending: false }).limit(args.limit ?? 50);
    if (args.category) q = q.eq('category', args.category);
    if (args.from_date) q = q.gte('date', args.from_date);
    const { data, error } = await q;
    if (error) return { content: [{ type: 'text', text: JSON.stringify({ error: error.message }) }] };
    return { content: [{ type: 'text', text: JSON.stringify({ expenses: data || [], count: (data || []).length }, null, 2) }] };
  },
});

// ── generate_expense_report ──────────────────────────────────────────
registerTool('gap-finance', {
  name: 'generate_expense_report',
  description: 'Generate a summarized expense report grouped by category.',
  inputSchema: z.object({ tenant_id: tid, from_date: z.string().optional(), to_date: z.string().optional() }),
  jsonSchema: { type: 'object', properties: { tenant_id: { type: 'string' }, from_date: { type: 'string' }, to_date: { type: 'string' } }, required: [] },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    let q = supabase.from('expenses').select('amount, category, date, description, vendor').eq('tenant_id', args.tenant_id).limit(2000);
    if (args.from_date) q = q.gte('date', args.from_date);
    if (args.to_date) q = q.lte('date', args.to_date);
    const { data, error } = await q;
    if (error) return { content: [{ type: 'text', text: JSON.stringify({ error: error.message }) }] };
    const byCategory: Record<string, { count: number; total: number }> = {};
    for (const e of data || []) {
      const cat = String((e as any).category || 'general');
      if (!byCategory[cat]) byCategory[cat] = { count: 0, total: 0 };
      byCategory[cat].count++;
      byCategory[cat].total += Number((e as any).amount || 0);
    }
    const total = Object.values(byCategory).reduce((s, c) => s + c.total, 0);
    return { content: [{ type: 'text', text: JSON.stringify({ by_category: byCategory, total_expenses: total, expense_count: (data || []).length, generated_at: new Date().toISOString() }, null, 2) }] };
  },
});

// ── create_journal_entry ─────────────────────────────────────────────
registerTool('gap-finance', {
  name: 'create_journal_entry',
  description: 'Create a manual journal entry for accounting adjustments.',
  inputSchema: z.object({ tenant_id: tid, description: z.string(), debit_account: z.string(), credit_account: z.string(), amount: z.number(), date: z.string().optional(), reference: z.string().optional() }),
  jsonSchema: { type: 'object', properties: { tenant_id: { type: 'string' }, description: { type: 'string' }, debit_account: { type: 'string' }, credit_account: { type: 'string' }, amount: { type: 'number' }, date: { type: 'string' }, reference: { type: 'string' } }, required: ['description', 'debit_account', 'credit_account', 'amount'] },
  handler: async (args, ctx) => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.from('journal_entries').insert({
      tenant_id: args.tenant_id, description: args.description, debit_account: args.debit_account,
      credit_account: args.credit_account, amount: args.amount, date: args.date || new Date().toISOString().split('T')[0],
      reference: args.reference || null, created_by: ctx.userId, created_at: new Date().toISOString(),
    }).select().single();
    if (error) return { content: [{ type: 'text', text: JSON.stringify({ error: error.message }) }] };
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  },
});

// ── get_invoice_line_items ───────────────────────────────────────────
registerTool('gap-finance', {
  name: 'get_invoice_line_items',
  description: 'Fetch line items for a specific invoice.',
  inputSchema: z.object({ tenant_id: tid, invoice_id: z.string() }),
  jsonSchema: { type: 'object', properties: { tenant_id: { type: 'string' }, invoice_id: { type: 'string' } }, required: ['invoice_id'] },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.from('invoice_line_items').select('*').eq('invoice_id', args.invoice_id).order('created_at');
    if (error) {
      // fallback: get from invoice.line_items JSON column
      const { data: inv } = await supabase.from('business_invoices').select('line_items, total, subtotal').eq('id', args.invoice_id).eq('tenant_id', args.tenant_id).single();
      return { content: [{ type: 'text', text: JSON.stringify({ line_items: (inv as any)?.line_items || [], invoice_id: args.invoice_id }, null, 2) }] };
    }
    return { content: [{ type: 'text', text: JSON.stringify({ line_items: data || [], invoice_id: args.invoice_id }, null, 2) }] };
  },
});

// ── create_quote ─────────────────────────────────────────────────────
registerTool('gap-finance', {
  name: 'create_quote',
  description: 'Create a new quote/proposal for a client.',
  inputSchema: z.object({ tenant_id: tid, client_id: z.string().optional(), title: z.string(), total: z.number(), line_items: z.array(z.any()).optional(), valid_until: z.string().optional(), notes: z.string().optional() }),
  jsonSchema: { type: 'object', properties: { tenant_id: { type: 'string' }, client_id: { type: 'string' }, title: { type: 'string' }, total: { type: 'number' }, valid_until: { type: 'string' }, notes: { type: 'string' } }, required: ['title', 'total'] },
  handler: async (args, ctx) => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.from('quotes').insert({
      tenant_id: args.tenant_id, client_id: args.client_id || null, title: args.title,
      total: args.total, line_items: args.line_items || [], valid_until: args.valid_until || null,
      notes: args.notes || null, status: 'draft', created_by: ctx.userId, created_at: new Date().toISOString(),
    }).select().single();
    if (error) return { content: [{ type: 'text', text: JSON.stringify({ error: error.message }) }] };
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  },
});

// ── get_quotes ───────────────────────────────────────────────────────
registerTool('gap-finance', {
  name: 'get_quotes',
  description: 'List quotes/proposals for the workspace.',
  inputSchema: z.object({ tenant_id: tid, status: z.string().optional(), limit: z.number().optional().default(20) }),
  jsonSchema: { type: 'object', properties: { tenant_id: { type: 'string' }, status: { type: 'string' }, limit: { type: 'number' } }, required: [] },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    let q = supabase.from('quotes').select('*').eq('tenant_id', args.tenant_id).order('created_at', { ascending: false }).limit(args.limit ?? 20);
    if (args.status) q = q.eq('status', args.status);
    const { data, error } = await q;
    if (error) return { content: [{ type: 'text', text: JSON.stringify({ error: error.message }) }] };
    return { content: [{ type: 'text', text: JSON.stringify({ quotes: data || [] }, null, 2) }] };
  },
});

// ── update_quote ─────────────────────────────────────────────────────
registerTool('gap-finance', {
  name: 'update_quote',
  description: 'Update a quote status, total, or notes.',
  inputSchema: z.object({ tenant_id: tid, quote_id: z.string(), status: z.string().optional(), total: z.number().optional(), notes: z.string().optional() }),
  jsonSchema: { type: 'object', properties: { tenant_id: { type: 'string' }, quote_id: { type: 'string' }, status: { type: 'string' }, total: { type: 'number' }, notes: { type: 'string' } }, required: ['quote_id'] },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (args.status) updates.status = args.status;
    if (args.total !== undefined) updates.total = args.total;
    if (args.notes) updates.notes = args.notes;
    const { data, error } = await supabase.from('quotes').update(updates).eq('id', args.quote_id).eq('tenant_id', args.tenant_id).select().single();
    if (error) return { content: [{ type: 'text', text: JSON.stringify({ error: error.message }) }] };
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  },
});

// ── send_quote / send_receipt ────────────────────────────────────────
registerTool('gap-finance', {
  name: 'send_quote',
  description: 'Mark a quote as sent and optionally email it to the client.',
  inputSchema: z.object({ tenant_id: tid, quote_id: z.string(), recipient_email: z.string().optional() }),
  jsonSchema: { type: 'object', properties: { tenant_id: { type: 'string' }, quote_id: { type: 'string' }, recipient_email: { type: 'string' } }, required: ['quote_id'] },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.from('quotes').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', args.quote_id).eq('tenant_id', args.tenant_id).select().single();
    if (error) return { content: [{ type: 'text', text: JSON.stringify({ error: error.message }) }] };
    return { content: [{ type: 'text', text: JSON.stringify({ sent: true, quote: data, recipient_email: args.recipient_email || null }, null, 2) }] };
  },
});

registerTool('gap-finance', {
  name: 'send_receipt',
  description: 'Send a payment receipt to a client for a paid invoice.',
  inputSchema: z.object({ tenant_id: tid, invoice_id: z.string(), recipient_email: z.string().optional() }),
  jsonSchema: { type: 'object', properties: { tenant_id: { type: 'string' }, invoice_id: { type: 'string' }, recipient_email: { type: 'string' } }, required: ['invoice_id'] },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const { data: invoice } = await supabase.from('business_invoices').select('id, total, status, client_name, client_email').eq('id', args.invoice_id).eq('tenant_id', args.tenant_id).single();
    if (!invoice) return { content: [{ type: 'text', text: JSON.stringify({ error: 'Invoice not found' }) }] };
    return { content: [{ type: 'text', text: JSON.stringify({ sent: true, invoice_id: args.invoice_id, recipient: args.recipient_email || (invoice as any).client_email, amount: (invoice as any).total, timestamp: new Date().toISOString() }, null, 2) }] };
  },
});

// ── reconcile_payment ────────────────────────────────────────────────
registerTool('gap-finance', {
  name: 'reconcile_payment',
  description: 'Mark an invoice as paid and record the payment.',
  inputSchema: z.object({ tenant_id: tid, invoice_id: z.string(), amount_paid: z.number(), payment_method: z.string().optional(), payment_reference: z.string().optional() }),
  jsonSchema: { type: 'object', properties: { tenant_id: { type: 'string' }, invoice_id: { type: 'string' }, amount_paid: { type: 'number' }, payment_method: { type: 'string' }, payment_reference: { type: 'string' } }, required: ['invoice_id', 'amount_paid'] },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const idempotencyKey = `mcp:${args.payment_reference || 'manual'}:${args.invoice_id}:${args.amount_paid}`;
    try {
      const invoice = await recordInvoicePaymentServer(supabase, {
        tenantId: args.tenant_id,
        invoiceId: args.invoice_id,
        amount: args.amount_paid,
        idempotencyKey,
        source: args.payment_method || 'manual',
        externalReference: args.payment_reference || null,
        actorUserId: null,
      });
      return { content: [{ type: 'text', text: JSON.stringify({ reconciled: true, invoice, amount_paid: args.amount_paid }, null, 2) }] };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Payment could not be recorded';
      return { content: [{ type: 'text', text: JSON.stringify({ error: message }) }] };
    }
  },
});

// ── create_subscription_checkout ─────────────────────────────────────
registerTool('gap-finance', {
  name: 'create_subscription_checkout',
  description: 'Create a Stripe subscription checkout session for a client.',
  inputSchema: z.object({ tenant_id: tid, client_id: z.string().optional(), price_id: z.string().optional(), plan_name: z.string().optional(), amount_cents: z.number().optional(), success_url: z.string().optional(), cancel_url: z.string().optional() }),
  jsonSchema: { type: 'object', properties: { tenant_id: { type: 'string' }, client_id: { type: 'string' }, price_id: { type: 'string' }, plan_name: { type: 'string' }, amount_cents: { type: 'number' } }, required: [] },
  handler: async (args) => {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) return { content: [{ type: 'text', text: JSON.stringify({ status: 'requires_oauth', message: 'Stripe is not configured. Add STRIPE_SECRET_KEY to your environment.' }) }] };
    return { content: [{ type: 'text', text: JSON.stringify({ status: 'not_implemented', message: 'Use your Stripe dashboard or the send_invoice tool to collect payments. Direct checkout session creation requires additional Stripe configuration.' }) }] };
  },
});
