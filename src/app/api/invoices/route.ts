import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { logInvoiceEvent } from '@/lib/audit/invoiceAuditLogger';
import { consumeDailyResourceQuota, releaseDailyResourceQuota } from '@/lib/server/dailyResourceQuota';

const lineItemSchema = z.object({
  description: z.string().trim().min(1).max(2000),
  quantity: z.coerce.number().positive().max(1_000_000),
  rate: z.coerce.number().min(0).max(1_000_000_000),
  amount: z.coerce.number().min(0).max(1_000_000_000).optional(),
});
const schema = z.object({
  tenantId: z.string().uuid(),
  clientId: z.string().uuid().nullable().optional(),
  projectId: z.string().uuid().nullable().optional(),
  invoiceNumber: z.string().trim().max(100).optional(),
  issueDate: z.union([z.string().date(), z.string().datetime()]).optional(),
  dueDate: z.union([z.string().date(), z.string().datetime()]).optional(),
  status: z.enum(['draft', 'sent']).default('draft'),
  subtotal: z.coerce.number().min(0).max(1_000_000_000).default(0),
  taxRate: z.coerce.number().min(0).max(100).default(0),
  tax: z.coerce.number().min(0).max(1_000_000_000).default(0),
  discountAmount: z.coerce.number().min(0).max(1_000_000_000).default(0),
  total: z.coerce.number().min(0).max(1_000_000_000).default(0),
  lineItems: z.array(lineItemSchema).max(500).default([]),
  notes: z.string().max(20_000).nullable().optional(),
  isPublic: z.boolean().default(false),
  senderName: z.string().max(300).nullable().optional(),
  bankDetails: z.string().max(10_000).nullable().optional(),
  mobilePaymentDetails: z.string().max(10_000).nullable().optional(),
  signature: z.union([z.string().max(2_000_000), z.object({ type: z.enum(['draw', 'type']), data: z.string().max(2_000_000) }), z.null()]).optional(),
});

function emptyToNull(value: unknown): unknown {
  return value === '' || value === undefined ? null : value;
}

function normalizeInvoicePayload(raw: unknown) {
  if (!raw || typeof raw !== 'object') return raw;
  const body = { ...(raw as Record<string, unknown>) };
  body.clientId = emptyToNull(body.clientId);
  body.projectId = emptyToNull(body.projectId);
  if (body.dueDate === '') delete body.dueDate;
  if (body.issueDate === '') delete body.issueDate;
  if (!body.mobilePaymentDetails && body.mobileDetails) {
    body.mobilePaymentDetails = body.mobileDetails;
  }
  if (!body.signature && body.signatureType && (body.signature || body.typedSignature)) {
    body.signature = {
      type: body.signatureType,
      data: body.signature || body.typedSignature,
    };
  }
  if (Array.isArray(body.lineItems)) {
    body.lineItems = body.lineItems.filter((item) => {
      if (!item || typeof item !== 'object') return false;
      const row = item as Record<string, unknown>;
      return String(row.description || '').trim().length > 0;
    });
  }
  return body;
}

async function assertReference(admin: ReturnType<typeof createSupabaseAdminClient>, table: 'business_clients' | 'projects', id: string | null | undefined, tenantId: string) {
  if (!id) return;
  const { data, error } = await admin.from(table).select('id').eq('tenant_id', tenantId).eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`${table === 'projects' ? 'Project' : 'Client'} is not in this workspace`);
}

export async function POST(req: NextRequest) {
  let quotaReservation: { tenantId: string; userId: string } | null = null;
  try {
    const parsed = schema.safeParse(normalizeInvoicePayload(await req.json().catch(() => ({}))));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid invoice details', fields: parsed.error.flatten().fieldErrors }, { status: 400 });
    const value = parsed.data;
    const { user, admin } = await requireTenantAccess(value.tenantId, req);
    await Promise.all([assertReference(admin, 'business_clients', value.clientId, value.tenantId), assertReference(admin, 'projects', value.projectId, value.tenantId)]);
    if (value.status !== 'draft') {
      await consumeDailyResourceQuota(value.tenantId, user.id, 'invoices');
      quotaReservation = { tenantId: value.tenantId, userId: user.id };
    }
    const issueDate = (value.issueDate || new Date().toISOString()).slice(0, 10);
    const defaultDue = new Date(`${issueDate}T00:00:00.000Z`); defaultDue.setUTCDate(defaultDue.getUTCDate() + 14);
    const dueDate = (value.dueDate || defaultDue.toISOString()).slice(0, 10);
    const lineSubtotal = value.lineItems.reduce((sum, item) => sum + item.quantity * item.rate, 0);
    const subtotal = value.lineItems.length ? lineSubtotal : value.subtotal;
    const tax = value.tax || subtotal * value.taxRate / 100;
    const total = Math.max(0, value.lineItems.length ? subtotal + tax - value.discountAmount : value.total);
    let invoice: any = null;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const number = value.invoiceNumber || `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
      const { data, error } = await admin.from('business_invoices').insert({
        tenant_id: value.tenantId, client_id: value.clientId || null, project_id: value.projectId || null, invoice_number: number,
        issue_date: issueDate, due_date: dueDate, status: value.status, subtotal, tax_rate: value.taxRate, tax,
        discount_amount: value.discountAmount, total, line_items: value.lineItems, notes: value.notes || null,
        is_public: value.isPublic, sender_name: value.senderName || null, bank_details: value.bankDetails || null,
        mobile_payment_details: value.mobilePaymentDetails || null, signature: value.signature || null,
      }).select('*').single();
      if (!error) { invoice = data; break; }
      if (error.code !== '23505' || value.invoiceNumber || attempt === 5) throw error;
    }
    if (!invoice) throw new Error('Invoice number could not be allocated');
    if (value.lineItems.length) {
      const { error } = await admin.from('invoice_line_items').insert(value.lineItems.map((item) => ({ invoice_id: invoice.id, tenant_id: value.tenantId, description: item.description, quantity: item.quantity, unit_price: item.rate })));
      if (error) { await admin.from('business_invoices').delete().eq('id', invoice.id).eq('tenant_id', value.tenantId); throw error; }
    }
    await logInvoiceEvent({ invoiceId: invoice.id, tenantId: value.tenantId, eventType: 'created', eventData: { status: invoice.status, total: invoice.total }, performedBy: user.id }).catch((error) => console.error('[invoices] create audit failed', error));
    quotaReservation = null;
    return NextResponse.json({ invoice }, { status: 201 });
  } catch (error) {
    if (quotaReservation) await releaseDailyResourceQuota(quotaReservation.tenantId, quotaReservation.userId, 'invoices');
    return routeErrorResponse(error, 'Invoice could not be created', req);
  }
}
