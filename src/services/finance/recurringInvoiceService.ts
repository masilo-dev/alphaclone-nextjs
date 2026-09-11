import 'server-only';

import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { getPublicInvoicePaymentUrl } from '@/lib/invoices/publicInvoiceAccess';
import { sendEmailServer } from '@/lib/email/sendEmailServer';
import { invoiceEmailTemplates } from '@/lib/email/invoiceEmailTemplates';

export type RecurringFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export type RecurringLineItem = {
  description: string;
  quantity: number;
  rate: number;
};

export type RecurringInvoiceProfile = {
  id: string;
  tenantId: string;
  clientId?: string | null;
  clientName: string;
  clientEmail?: string | null;
  amount: number;
  frequency: RecurringFrequency;
  startDate: string;
  endDate?: string | null;
  description?: string | null;
  lineItems: RecurringLineItem[];
  taxRate: number;
  paymentTermsDays: number;
  autoSend: boolean;
  active: boolean;
  lastGenerated?: string | null;
  createdAt: string;
};

function mapRow(row: Record<string, unknown>): RecurringInvoiceProfile {
  const lineItems = Array.isArray(row.line_items) ? row.line_items : [];
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    clientId: row.client_id ? String(row.client_id) : null,
    clientName: String(row.client_name ?? ''),
    clientEmail: row.client_email ? String(row.client_email) : null,
    amount: Number(row.amount || 0),
    frequency: row.frequency as RecurringFrequency,
    startDate: String(row.start_date ?? ''),
    endDate: row.end_date ? String(row.end_date) : null,
    description: row.description ? String(row.description) : null,
    lineItems: lineItems.map((li: Record<string, unknown>) => ({
      description: String(li.description || ''),
      quantity: Number(li.quantity || 1),
      rate: Number(li.rate || 0),
    })),
    taxRate: Number(row.tax_rate || 0),
    paymentTermsDays: Number(row.payment_terms_days || 14),
    autoSend: row.auto_send !== false,
    active: row.active !== false,
    lastGenerated: row.last_generated ? String(row.last_generated) : null,
    createdAt: String(row.created_at ?? ''),
  };
}

function isDifferentDay(a: Date, b: Date): boolean {
  return a.toDateString() !== b.toDateString();
}

function isDifferentWeek(a: Date, b: Date): boolean {
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  return b.getTime() - a.getTime() >= weekMs;
}

function isDifferentMonth(a: Date, b: Date): boolean {
  return a.getMonth() !== b.getMonth() || a.getFullYear() !== b.getFullYear();
}

function isDifferentYear(a: Date, b: Date): boolean {
  return a.getFullYear() !== b.getFullYear();
}

export function shouldGenerateRecurring(profile: RecurringInvoiceProfile, today: Date): boolean {
  const start = new Date(profile.startDate);
  if (start > today) return false;
  if (profile.endDate && new Date(profile.endDate) < today) return false;

  const last = profile.lastGenerated ? new Date(profile.lastGenerated) : null;
  switch (profile.frequency) {
    case 'daily':
      return !last || isDifferentDay(last, today);
    case 'weekly':
      return !last || isDifferentWeek(last, today);
    case 'monthly':
      return !last || isDifferentMonth(last, today);
    case 'yearly':
      return !last || isDifferentYear(last, today);
    default:
      return false;
  }
}

function computeTotals(lineItems: RecurringLineItem[], taxRate: number) {
  const subtotal = lineItems.reduce(
    (sum, li) => sum + Math.round(Number(li.quantity || 0) * Number(li.rate || 0) * 100) / 100,
    0
  );
  const tax = Math.round(subtotal * (taxRate / 100) * 100) / 100;
  return { subtotal, tax, total: Math.round((subtotal + tax) * 100) / 100 };
}

export async function listRecurringProfiles(
  admin: SupabaseClient,
  tenantId: string
): Promise<RecurringInvoiceProfile[]> {
  const { data, error } = await admin
    .from('recurring_invoices')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((row) => mapRow(row as Record<string, unknown>));
}

export async function createRecurringProfile(
  admin: SupabaseClient,
  tenantId: string,
  input: Omit<RecurringInvoiceProfile, 'id' | 'tenantId' | 'createdAt' | 'lastGenerated'>
): Promise<RecurringInvoiceProfile> {
  const lineItems =
    input.lineItems?.length > 0
      ? input.lineItems
      : [{ description: input.description || 'Recurring services', quantity: 1, rate: input.amount }];
  const { subtotal, tax, total } = computeTotals(lineItems, input.taxRate);

  const { data, error } = await admin
    .from('recurring_invoices')
    .insert({
      tenant_id: tenantId,
      client_id: input.clientId || null,
      client_name: input.clientName,
      client_email: input.clientEmail || null,
      amount: total || input.amount,
      frequency: input.frequency,
      start_date: input.startDate,
      end_date: input.endDate || null,
      description: input.description || null,
      line_items: lineItems,
      tax_rate: input.taxRate,
      payment_terms_days: input.paymentTermsDays,
      auto_send: input.autoSend,
      active: input.active !== false,
    })
    .select('*')
    .single();

  if (error || !data) throw error || new Error('Failed to create recurring profile');
  return mapRow(data as Record<string, unknown>);
}

export async function updateRecurringProfile(
  admin: SupabaseClient,
  tenantId: string,
  id: string,
  updates: Partial<Omit<RecurringInvoiceProfile, 'id' | 'tenantId' | 'createdAt'>>
): Promise<void> {
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.clientId !== undefined) payload.client_id = updates.clientId;
  if (updates.clientName !== undefined) payload.client_name = updates.clientName;
  if (updates.clientEmail !== undefined) payload.client_email = updates.clientEmail;
  if (updates.frequency !== undefined) payload.frequency = updates.frequency;
  if (updates.startDate !== undefined) payload.start_date = updates.startDate;
  if (updates.endDate !== undefined) payload.end_date = updates.endDate;
  if (updates.description !== undefined) payload.description = updates.description;
  if (updates.lineItems !== undefined) payload.line_items = updates.lineItems;
  if (updates.taxRate !== undefined) payload.tax_rate = updates.taxRate;
  if (updates.paymentTermsDays !== undefined) payload.payment_terms_days = updates.paymentTermsDays;
  if (updates.autoSend !== undefined) payload.auto_send = updates.autoSend;
  if (updates.active !== undefined) payload.active = updates.active;
  if (updates.amount !== undefined) payload.amount = updates.amount;

  const { error } = await admin
    .from('recurring_invoices')
    .update(payload)
    .eq('id', id)
    .eq('tenant_id', tenantId);
  if (error) throw error;
}

export async function deleteRecurringProfile(
  admin: SupabaseClient,
  tenantId: string,
  id: string
): Promise<void> {
  const { error } = await admin
    .from('recurring_invoices')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId);
  if (error) throw error;
}

export async function listGeneratedInvoices(
  admin: SupabaseClient,
  tenantId: string,
  recurringConfigId: string
) {
  const { data, error } = await admin
    .from('business_invoices')
    .select('id, invoice_number, status, total, issue_date, due_date, created_at')
    .eq('tenant_id', tenantId)
    .eq('recurring_config_id', recurringConfigId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function generateFromRecurringProfile(
  admin: SupabaseClient,
  profile: RecurringInvoiceProfile
): Promise<{ invoiceId: string }> {
  const lineItems =
    profile.lineItems.length > 0
      ? profile.lineItems
      : [{ description: profile.description || 'Recurring services', quantity: 1, rate: profile.amount }];
  const { subtotal, tax, total } = computeTotals(lineItems, profile.taxRate);
  const issueDate = new Date();
  const dueDate = new Date(issueDate);
  dueDate.setDate(dueDate.getDate() + profile.paymentTermsDays);
  const publicToken = crypto.randomUUID();
  const invoiceNumber = `INV-${Date.now().toString(36).toUpperCase()}`;

  const { data: invoice, error } = await admin
    .from('business_invoices')
    .insert({
      tenant_id: profile.tenantId,
      client_id: profile.clientId || null,
      client_name: profile.clientName,
      client_email: profile.clientEmail || null,
      invoice_number: invoiceNumber,
      issue_date: issueDate.toISOString().slice(0, 10),
      due_date: dueDate.toISOString().slice(0, 10),
      status: profile.autoSend ? 'sent' : 'draft',
      subtotal,
      tax_rate: profile.taxRate,
      tax,
      discount_amount: 0,
      total,
      is_public: true,
      recurring_config_id: profile.id,
      sent_at: profile.autoSend ? new Date().toISOString() : null,
      metadata: { public_token: publicToken, recurring_profile_id: profile.id },
      notes: profile.description || `Recurring invoice (${profile.frequency})`,
    })
    .select('id')
    .single();

  if (error || !invoice) throw error || new Error('Failed to create invoice');

  await admin.from('invoice_line_items').insert(
    lineItems.map((li) => ({
      invoice_id: invoice.id,
      tenant_id: profile.tenantId,
      description: li.description,
      quantity: li.quantity,
      unit_price: li.rate,
      amount: Math.round(li.quantity * li.rate * 100) / 100,
    }))
  );

  await admin
    .from('recurring_invoices')
    .update({ last_generated: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', profile.id);

  if (profile.autoSend && profile.clientEmail) {
    const payUrl = await getPublicInvoicePaymentUrl(admin, invoice.id, profile.tenantId);
    const { data: tenant } = await admin.from('tenants').select('name').eq('id', profile.tenantId).single();
    await sendEmailServer({
      tenantId: profile.tenantId,
      to: profile.clientEmail,
      subject: `Invoice ${invoiceNumber}`,
      html: invoiceEmailTemplates.invoiceSent({
        recipientName: profile.clientName,
        recipientEmail: profile.clientEmail,
        tenantId: profile.tenantId,
        invoiceNumber,
        amount: total,
        currency: 'USD',
        dueDate: dueDate.toISOString().slice(0, 10),
        actionUrl: payUrl,
        workspaceName: tenant?.name || 'AlphaClone Systems',
      }),
      skipFooter: true,
    });
  }

  return { invoiceId: invoice.id };
}

export async function processDueRecurringInvoices(): Promise<{
  processed: number;
  errors: string[];
}> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from('recurring_invoices').select('*').eq('active', true);
  if (error) throw error;

  const today = new Date();
  let processed = 0;
  const errors: string[] = [];

  for (const row of data || []) {
    const profile = mapRow(row as Record<string, unknown>);
    try {
      if (shouldGenerateRecurring(profile, today)) {
        await generateFromRecurringProfile(admin, profile);
        processed += 1;
      }
    } catch (err) {
      errors.push(`${profile.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { processed, errors };
}
