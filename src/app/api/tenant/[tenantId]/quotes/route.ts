import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { requireTenantAccess, requireTenantRole, routeErrorResponse } from '@/lib/apiAuth';

const itemSchema = z.object({
  id: z.string().uuid().optional(),
  productName: z.string().trim().min(1).max(300),
  description: z.string().trim().max(3000).optional(),
  quantity: z.coerce.number().positive().max(1_000_000),
  unitPrice: z.coerce.number().min(0).max(1_000_000_000),
  discountPercent: z.coerce.number().min(0).max(100).default(0),
  taxPercent: z.coerce.number().min(0).max(100).default(0),
  itemOrder: z.coerce.number().int().positive().optional(),
});
const createSchema = z.object({
  name: z.string().trim().min(1).max(300),
  email: z.string().email().max(320).optional(),
  currency: z.string().length(3).default('USD'),
  amount: z.coerce.number().min(0).max(1_000_000_000).default(0),
  contactId: z.string().uuid().optional(),
  dealId: z.string().uuid().optional(),
  templateId: z.string().uuid().optional(),
  validForDays: z.coerce.number().int().min(1).max(365).default(30),
  notes: z.string().max(10_000).optional(),
  termsAndConditions: z.string().max(30_000).optional(),
});
const updateSchema = z.object({
  quoteId: z.string().uuid(),
  name: z.string().trim().min(1).max(300),
  status: z.enum(['draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired', 'converted']),
  validUntil: z.string().date().nullable().optional(),
  notes: z.string().max(10_000).default(''),
  termsAndConditions: z.string().max(30_000).default(''),
  currency: z.string().length(3),
  items: z.array(itemSchema).max(200),
});

function totals(items: z.infer<typeof itemSchema>[]) {
  let subtotal = 0, discountAmount = 0, taxAmount = 0;
  for (const item of items) {
    const base = item.quantity * item.unitPrice;
    const discount = base * item.discountPercent / 100;
    subtotal += base;
    discountAmount += discount;
    taxAmount += (base - discount) * item.taxPercent / 100;
  }
  return { subtotal, discount_amount: discountAmount, tax_amount: taxAmount, total_amount: subtotal - discountAmount + taxAmount };
}

export async function POST(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await context.params;
    const { user } = await requireTenantAccess(tenantId, req);
    const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid quote details', fields: parsed.error.flatten().fieldErrors }, { status: 400 });
    const validUntil = new Date(); validUntil.setDate(validUntil.getDate() + parsed.data.validForDays);
    const initialItems = parsed.data.amount > 0 ? [{ productName: parsed.data.name, quantity: 1, unitPrice: parsed.data.amount, discountPercent: 0, taxPercent: 0, itemOrder: 1 }] : [];
    const admin = createSupabaseAdminClient();
    for (const [table, id, label] of [['contacts', parsed.data.contactId, 'Contact'], ['deals', parsed.data.dealId, 'Deal'], ['quote_templates', parsed.data.templateId, 'Quote template']] as const) {
      if (!id) continue;
      const { data, error } = await admin.from(table).select('id').eq('tenant_id', tenantId).eq('id', id).maybeSingle();
      if (error) throw error;
      if (!data) return NextResponse.json({ error: `${label} is not in this workspace` }, { status: 422 });
    }
    const { data: quote, error } = await admin.from('quotes').insert({
      tenant_id: tenantId, created_by: user.id, name: parsed.data.name,
      currency: parsed.data.currency.toUpperCase(), valid_until: validUntil.toISOString().slice(0, 10),
      contact_id: parsed.data.contactId || null, deal_id: parsed.data.dealId || null, template_id: parsed.data.templateId || null,
      notes: parsed.data.notes || (parsed.data.email ? `Recipient: ${parsed.data.email}` : null),
      terms_and_conditions: parsed.data.termsAndConditions || null,
      metadata: parsed.data.email ? { client_email: parsed.data.email } : {},
      ...totals(initialItems),
    }).select('*').single();
    if (error) throw error;
    if (initialItems.length) {
      const { error: itemError } = await admin.from('quote_items').insert(initialItems.map((item) => ({
        tenant_id: tenantId, quote_id: quote.id, product_name: item.productName, description: 'Professional services', quantity: item.quantity,
        unit_price: item.unitPrice, discount_percent: 0, tax_percent: 0, line_total: item.unitPrice, item_order: 1,
      })));
      if (itemError) { await admin.from('quotes').delete().eq('id', quote.id).eq('tenant_id', tenantId); throw itemError; }
    }
    await admin.from('business_automation_events').insert({ tenant_id: tenantId, event_type: 'quote_created', payload: { quoteId: quote.id, actorUserId: user.id } });
    return NextResponse.json({ quote }, { status: 201 });
  } catch (error) { return routeErrorResponse(error, 'Quote could not be created', req); }
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await context.params;
    const { user } = await requireTenantAccess(tenantId, req);
    const parsed = updateSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid quote update', fields: parsed.error.flatten().fieldErrors }, { status: 400 });
    const admin = createSupabaseAdminClient();
    const { data: existing } = await admin.from('quotes').select('id').eq('tenant_id', tenantId).eq('id', parsed.data.quoteId).maybeSingle();
    if (!existing) return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    const items = parsed.data.items.map((item, index) => ({ ...item, itemOrder: index + 1 }));
    const quoteTotals = totals(items);
    const itemRows = items.map((item) => {
      const base = item.quantity * item.unitPrice;
      const lineTotal = (base * (1 - item.discountPercent / 100)) * (1 + item.taxPercent / 100);
      return { id: item.id, product_name: item.productName, description: item.description || '', quantity: item.quantity, unit_price: item.unitPrice, discount_percent: item.discountPercent, tax_percent: item.taxPercent, line_total: lineTotal, item_order: item.itemOrder };
    });
    const { error: quoteError } = await admin.rpc('update_tenant_quote_atomic', {
      p_tenant_id: tenantId,
      p_quote_id: parsed.data.quoteId,
      p_header: { name: parsed.data.name, status: parsed.data.status, valid_until: parsed.data.validUntil || '', notes: parsed.data.notes, terms_and_conditions: parsed.data.termsAndConditions, currency: parsed.data.currency, ...quoteTotals },
      p_items: itemRows,
    });
    if (quoteError) throw quoteError;
    await admin.from('business_automation_events').insert({ tenant_id: tenantId, event_type: 'quote_updated', payload: { quoteId: parsed.data.quoteId, actorUserId: user.id } });
    return NextResponse.json({ success: true });
  } catch (error) { return routeErrorResponse(error, 'Quote could not be updated', req); }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await context.params;
    const { user } = await requireTenantRole(tenantId, ['owner', 'admin', 'tenant_admin', 'super_admin'], req);
    const quoteId = req.nextUrl.searchParams.get('quoteId') || '';
    if (!z.string().uuid().safeParse(quoteId).success) return NextResponse.json({ error: 'Valid quoteId required' }, { status: 400 });
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.from('quotes').delete().eq('tenant_id', tenantId).eq('id', quoteId).select('id').maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    await admin.from('business_automation_events').insert({ tenant_id: tenantId, event_type: 'quote_deleted', payload: { quoteId, actorUserId: user.id } });
    return NextResponse.json({ success: true });
  } catch (error) { return routeErrorResponse(error, 'Quote could not be deleted', req); }
}
