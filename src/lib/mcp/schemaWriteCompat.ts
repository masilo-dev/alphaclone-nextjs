import type { SupabaseClient } from '@supabase/supabase-js';
import { isMissingColumnError } from '@/lib/mcp/schemaCompat';
import { resolveContactIdForParty } from '@/lib/contracts/contractCoherenceServer';

export async function resolveContactIdForClientArg(
  supabase: SupabaseClient,
  tenantId: string,
  clientOrContactId?: string | null,
): Promise<string | null> {
  if (!clientOrContactId) return null;
  return resolveContactIdForParty(supabase, tenantId, clientOrContactId);
}

export type TaskInsertInput = {
  tenant_id: string;
  title: string;
  description?: string | null;
  due_date?: string | null;
  priority?: string | null;
  assigned_to?: string | null;
  project_id?: string | null;
  client_id?: string | null;
  created_by: string;
};

/** Insert task using canonical columns (related_to_contact, not client_id). */
export async function insertTaskSchemaCompat(
  supabase: SupabaseClient,
  input: TaskInsertInput,
) {
  const now = new Date().toISOString();
  const contactId = await resolveContactIdForClientArg(supabase, input.tenant_id, input.client_id);
  const metadata: Record<string, unknown> = {};
  if (input.client_id && !contactId) metadata.client_id = input.client_id;

  const payload: Record<string, unknown> = {
    tenant_id: input.tenant_id,
    title: input.title,
    description: input.description ?? null,
    due_date: input.due_date ?? null,
    priority: input.priority || 'medium',
    assigned_to: input.assigned_to ?? null,
    project_id: input.project_id ?? null,
    related_to_contact: contactId,
    status: 'todo',
    created_by: input.created_by,
    created_at: now,
    updated_at: now,
    ...(Object.keys(metadata).length ? { metadata } : {}),
  };

  let result = await supabase.from('tasks').insert(payload).select('*').single();
  if (result.error && isMissingColumnError(result.error)) {
    const { updated_at: _u, ...fallback } = payload;
    result = await supabase.from('tasks').insert(fallback).select('*').single();
  }
  return result;
}

export type QuoteInsertInput = {
  tenant_id: string;
  title: string;
  total: number;
  client_id?: string | null;
  line_items?: Array<Record<string, unknown>>;
  valid_until?: string | null;
  notes?: string | null;
  created_by: string;
};

function mapQuoteLineItem(item: Record<string, unknown>, index: number) {
  const qty = Number(item.quantity ?? item.qty ?? 1) || 1;
  const unit = Number(item.unit_price ?? item.price ?? item.amount ?? 0) || 0;
  return {
    item_order: index + 1,
    product_name: String(item.name ?? item.product_name ?? item.description ?? `Item ${index + 1}`),
    description: String(item.description ?? item.name ?? ''),
    quantity: qty,
    unit_price: unit,
    line_total: Number(item.line_total ?? item.total ?? qty * unit) || qty * unit,
    metadata: item,
  };
}

/** Insert quote + quote_items using production schema (name, contact_id, total_amount). */
export async function insertQuoteSchemaCompat(
  supabase: SupabaseClient,
  input: QuoteInsertInput,
) {
  const contactId = await resolveContactIdForClientArg(supabase, input.tenant_id, input.client_id);
  const quoteNumber = `Q-${Date.now().toString().slice(-8)}`;
  const lineItems = (input.line_items || []).map(mapQuoteLineItem);
  const subtotal = lineItems.length
    ? lineItems.reduce((sum, row) => sum + Number(row.line_total || 0), 0)
    : input.total;

  const { data, error } = await supabase
    .from('quotes')
    .insert({
      tenant_id: input.tenant_id,
      quote_number: quoteNumber,
      name: input.title,
      contact_id: contactId,
      subtotal,
      total_amount: subtotal,
      notes: input.notes ?? null,
      valid_until: input.valid_until?.slice(0, 10) ?? null,
      status: 'draft',
      created_by: input.created_by,
      metadata: lineItems.length ? { line_items: lineItems } : {},
    })
    .select('*')
    .single();

  if (error || !data?.id) return { data, error };

  if (lineItems.length) {
    const rows = lineItems.map((row) => ({
      tenant_id: input.tenant_id,
      quote_id: data.id,
      ...row,
    }));
    await supabase.from('quote_items').insert(rows);
  }

  return { data: { ...data, line_items: lineItems }, error: null };
}

export type InvoiceInsertInput = {
  tenant_id: string;
  client_id: string;
  amount: number;
  status?: string;
  due_date?: string;
  issue_date?: string;
  currency_code?: string;
  bank_name?: string | null;
  account_number?: string | null;
  branch_code?: string | null;
  swift_code?: string | null;
  payment_reference?: string | null;
  bank_details?: string | null;
};

/** Insert invoice without writing generated total_amount column. */
export async function insertBusinessInvoiceSchemaCompat(
  supabase: SupabaseClient,
  input: InvoiceInsertInput,
) {
  const issueDate = input.issue_date?.slice(0, 10) || new Date().toISOString().slice(0, 10);
  const dueDate =
    input.due_date?.slice(0, 10) ||
    new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const payload: Record<string, unknown> = {
    tenant_id: input.tenant_id,
    client_id: input.client_id,
    total: input.amount,
    subtotal: input.amount,
    status: input.status || 'draft',
    due_date: dueDate,
    issue_date: issueDate,
    invoice_number: `INV-${Date.now().toString().slice(-8)}`,
    currency_code: input.currency_code || 'USD',
    bank_name: input.bank_name ?? null,
    account_number: input.account_number ?? null,
    branch_code: input.branch_code ?? null,
    swift_code: input.swift_code ?? null,
    payment_reference: input.payment_reference ?? null,
    bank_details: input.bank_details ?? null,
  };

  return supabase.from('business_invoices').insert(payload).select('*').single();
}
