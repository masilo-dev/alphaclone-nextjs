import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

const baseItemFields = z.object({ productName: z.string().trim().min(1).max(300), description: z.string().max(3000).optional(), quantity: z.coerce.number().positive().max(1_000_000), unitPrice: z.coerce.number().min(0).max(1_000_000_000), discountPercent: z.coerce.number().min(0).max(100), taxPercent: z.coerce.number().min(0).max(100) });
const itemFields = baseItemFields.extend({ discountPercent: baseItemFields.shape.discountPercent.default(0), taxPercent: baseItemFields.shape.taxPercent.default(0) });
const updateSchema = baseItemFields.partial().extend({ itemId: z.string().uuid() });

async function mutate(req: NextRequest, context: { params: Promise<{ tenantId: string; quoteId: string }> }, operation: 'create' | 'update' | 'delete') {
  const { tenantId, quoteId } = await context.params;
  await requireTenantAccess(tenantId, req);
  if (!z.string().uuid().safeParse(quoteId).success) return NextResponse.json({ error: 'Valid quote ID is required' }, { status: 400 });
  const admin = createSupabaseAdminClient();
  const [{ data: quote, error: quoteError }, { data: rows, error: itemError }] = await Promise.all([
    admin.from('quotes').select('*').eq('tenant_id', tenantId).eq('id', quoteId).maybeSingle(),
    admin.from('quote_items').select('*').eq('tenant_id', tenantId).eq('quote_id', quoteId).order('item_order'),
  ]);
  if (quoteError) throw quoteError;
  if (itemError) throw itemError;
  if (!quote) return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
  let items = [...(rows || [])];
  let targetId: string | null = null;
  if (operation === 'create') {
    const parsed = itemFields.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid quote item', fields: parsed.error.flatten().fieldErrors }, { status: 400 });
    targetId = crypto.randomUUID();
    items.push({ id: targetId, product_name: parsed.data.productName, description: parsed.data.description || '', quantity: parsed.data.quantity, unit_price: parsed.data.unitPrice, discount_percent: parsed.data.discountPercent, tax_percent: parsed.data.taxPercent });
  } else if (operation === 'update') {
    const parsed = updateSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid quote item update' }, { status: 400 });
    targetId = parsed.data.itemId;
    const index = items.findIndex((item) => item.id === targetId);
    if (index < 0) return NextResponse.json({ error: 'Quote item not found' }, { status: 404 });
    const value = parsed.data;
    items[index] = { ...items[index], product_name: value.productName ?? items[index].product_name, description: value.description ?? items[index].description, quantity: value.quantity ?? items[index].quantity, unit_price: value.unitPrice ?? items[index].unit_price, discount_percent: value.discountPercent ?? items[index].discount_percent, tax_percent: value.taxPercent ?? items[index].tax_percent };
  } else {
    targetId = req.nextUrl.searchParams.get('itemId');
    if (!targetId || !z.string().uuid().safeParse(targetId).success) return NextResponse.json({ error: 'Valid itemId is required' }, { status: 400 });
    if (!items.some((item) => item.id === targetId)) return NextResponse.json({ error: 'Quote item not found' }, { status: 404 });
    items = items.filter((item) => item.id !== targetId);
  }
  let subtotal = 0, discountAmount = 0, taxAmount = 0;
  const normalized = items.map((item, index) => {
    const base = Number(item.quantity) * Number(item.unit_price); const discount = base * Number(item.discount_percent || 0) / 100; const tax = (base - discount) * Number(item.tax_percent || 0) / 100;
    subtotal += base; discountAmount += discount; taxAmount += tax;
    return { id: item.id, product_name: item.product_name, description: item.description || '', quantity: Number(item.quantity), unit_price: Number(item.unit_price), discount_percent: Number(item.discount_percent || 0), tax_percent: Number(item.tax_percent || 0), line_total: base - discount + tax, item_order: index + 1 };
  });
  const { error } = await admin.rpc('update_tenant_quote_atomic', { p_tenant_id: tenantId, p_quote_id: quoteId, p_header: { name: quote.name, status: quote.status, valid_until: quote.valid_until || '', notes: quote.notes || '', terms_and_conditions: quote.terms_and_conditions || '', currency: quote.currency, subtotal, discount_amount: discountAmount, tax_amount: taxAmount, total_amount: subtotal - discountAmount + taxAmount }, p_items: normalized });
  if (error) throw error;
  return NextResponse.json({ success: true, item: operation === 'delete' ? null : normalized.find((item) => item.id === targetId) || null });
}

export async function POST(req: NextRequest, context: { params: Promise<{ tenantId: string; quoteId: string }> }) { try { return await mutate(req, context, 'create'); } catch (error) { return routeErrorResponse(error, 'Quote item could not be added', req); } }
export async function PATCH(req: NextRequest, context: { params: Promise<{ tenantId: string; quoteId: string }> }) { try { return await mutate(req, context, 'update'); } catch (error) { return routeErrorResponse(error, 'Quote item could not be updated', req); } }
export async function DELETE(req: NextRequest, context: { params: Promise<{ tenantId: string; quoteId: string }> }) { try { return await mutate(req, context, 'delete'); } catch (error) { return routeErrorResponse(error, 'Quote item could not be deleted', req); } }
