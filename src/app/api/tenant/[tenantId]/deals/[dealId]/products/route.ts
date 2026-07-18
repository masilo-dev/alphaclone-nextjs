import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

const schema = z.object({ productName: z.string().trim().min(1).max(250), description: z.string().trim().max(2000).optional(), quantity: z.coerce.number().positive().max(1_000_000), unitPrice: z.coerce.number().min(0).max(1_000_000_000), discountPercent: z.coerce.number().min(0).max(100).default(0), taxPercent: z.coerce.number().min(0).max(100).default(0) });

async function assertDeal(admin: ReturnType<typeof createSupabaseAdminClient>, tenantId: string, dealId: string) {
  const { data, error } = await admin.from('deals').select('id').eq('id', dealId).eq('tenant_id', tenantId).maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function GET(req: NextRequest, context: { params: Promise<{ tenantId: string; dealId: string }> }) {
  try { const { tenantId, dealId } = await context.params; await requireTenantAccess(tenantId, req); const admin = createSupabaseAdminClient(); if (!await assertDeal(admin, tenantId, dealId)) return NextResponse.json({ error: 'Deal not found' }, { status: 404 }); const { data, error } = await admin.from('deal_products').select('*').eq('deal_id', dealId).order('created_at'); if (error) throw error; return NextResponse.json({ products: data || [] }); } catch (error) { return routeErrorResponse(error, 'Deal products could not be loaded', req); }
}

export async function POST(req: NextRequest, context: { params: Promise<{ tenantId: string; dealId: string }> }) {
  try { const { tenantId, dealId } = await context.params; const { user } = await requireTenantAccess(tenantId, req); const parsed = schema.safeParse(await req.json().catch(() => ({}))); if (!parsed.success) return NextResponse.json({ error: 'Invalid deal product' }, { status: 400 }); const admin = createSupabaseAdminClient(); if (!await assertDeal(admin, tenantId, dealId)) return NextResponse.json({ error: 'Deal not found' }, { status: 404 }); const value = parsed.data; const { data, error } = await admin.from('deal_products').insert({ deal_id: dealId, product_name: value.productName, description: value.description || null, quantity: value.quantity, unit_price: value.unitPrice, discount_percent: value.discountPercent, tax_percent: value.taxPercent }).select('*').single(); if (error) throw error; await admin.from('business_automation_events').insert({ tenant_id: tenantId, event_type: 'deal_product_added', payload: { dealId, productId: data.id, actorUserId: user.id } }); return NextResponse.json({ product: data }, { status: 201 }); } catch (error) { return routeErrorResponse(error, 'Deal product could not be added', req); }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ tenantId: string; dealId: string }> }) {
  try { const { tenantId, dealId } = await context.params; const { user } = await requireTenantAccess(tenantId, req); const productId = req.nextUrl.searchParams.get('productId'); if (!productId || !z.string().uuid().safeParse(productId).success) return NextResponse.json({ error: 'Valid productId is required' }, { status: 400 }); const admin = createSupabaseAdminClient(); if (!await assertDeal(admin, tenantId, dealId)) return NextResponse.json({ error: 'Deal not found' }, { status: 404 }); const { data, error } = await admin.from('deal_products').delete().eq('id', productId).eq('deal_id', dealId).select('id').maybeSingle(); if (error) throw error; if (!data) return NextResponse.json({ error: 'Product not found' }, { status: 404 }); await admin.from('business_automation_events').insert({ tenant_id: tenantId, event_type: 'deal_product_deleted', payload: { dealId, productId, actorUserId: user.id } }); return NextResponse.json({ success: true }); } catch (error) { return routeErrorResponse(error, 'Deal product could not be deleted', req); }
}
