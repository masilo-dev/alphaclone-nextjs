import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

export type UnbilledExpense = {
  id: string;
  expenseNumber: string;
  date: string;
  description: string;
  vendorName: string;
  total: number;
  currency: string;
};

export async function listUnbilledExpenses(
  admin: SupabaseClient,
  tenantId: string,
  clientId: string
): Promise<UnbilledExpense[]> {
  const { data, error } = await admin
    .from('expenses')
    .select('id, expense_number, date, description, vendor_name, total, currency')
    .eq('tenant_id', tenantId)
    .eq('client_id', clientId)
    .eq('billable', true)
    .is('invoice_id', null)
    .order('date', { ascending: false });

  if (error) throw error;

  return (data || []).map((row) => ({
    id: row.id,
    expenseNumber: row.expense_number || row.id.slice(0, 8),
    date: row.date,
    description: row.description || row.vendor_name || 'Billable expense',
    vendorName: row.vendor_name || '',
    total: Number(row.total || 0),
    currency: row.currency || 'USD',
  }));
}

export async function attachExpensesToInvoice(
  admin: SupabaseClient,
  tenantId: string,
  invoiceId: string,
  expenseIds: string[]
): Promise<{ attached: number; lineTotal: number }> {
  if (!expenseIds.length) return { attached: 0, lineTotal: 0 };

  const { data: expenses, error: fetchError } = await admin
    .from('expenses')
    .select('*')
    .eq('tenant_id', tenantId)
    .in('id', expenseIds)
    .eq('billable', true)
    .is('invoice_id', null);

  if (fetchError) throw fetchError;
  if (!expenses?.length) return { attached: 0, lineTotal: 0 };

  const { data: invoice, error: invoiceError } = await admin
    .from('business_invoices')
    .select('id, subtotal, tax, tax_rate, total, status')
    .eq('id', invoiceId)
    .eq('tenant_id', tenantId)
    .single();

  if (invoiceError || !invoice) throw invoiceError || new Error('Invoice not found');
  if (['paid', 'void', 'cancelled'].includes(String(invoice.status))) {
    throw new Error('Cannot attach expenses to a closed invoice');
  }

  let lineTotal = 0;
  const now = new Date().toISOString();

  for (const exp of expenses) {
    const amount = Number(exp.total || exp.amount || 0);
    lineTotal += amount;

    await admin.from('invoice_line_items').insert({
      invoice_id: invoiceId,
      tenant_id: tenantId,
      description: `Expense: ${exp.description || exp.vendor_name || exp.expense_number || 'Billable'}`,
      quantity: 1,
      unit_price: amount,
      amount,
    });

    await admin
      .from('expenses')
      .update({ invoice_id: invoiceId, invoiced_at: now, updated_at: now })
      .eq('id', exp.id)
      .eq('tenant_id', tenantId);
  }

  const newSubtotal = Number(invoice.subtotal || 0) + lineTotal;
  const taxRate = Number(invoice.tax_rate || 0);
  const newTax = Math.round(newSubtotal * (taxRate / 100) * 100) / 100;
  const newTotal = Math.round((newSubtotal + newTax) * 100) / 100;

  await admin
    .from('business_invoices')
    .update({
      subtotal: newSubtotal,
      tax: newTax,
      total: newTotal,
      updated_at: now,
    })
    .eq('id', invoiceId)
    .eq('tenant_id', tenantId);

  return { attached: expenses.length, lineTotal };
}
