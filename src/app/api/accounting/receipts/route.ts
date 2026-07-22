import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { consumeDailyResourceQuota, releaseDailyResourceQuota } from '@/lib/server/dailyResourceQuota';

const schema = z.object({
  tenantId: z.string().uuid(), receiptDate: z.string().date(), description: z.string().trim().min(1).max(10_000),
  amount: z.coerce.number().positive().max(1_000_000_000), category: z.string().max(200).nullable().optional(),
  vendor: z.string().max(300).nullable().optional(), status: z.literal('pending').default('pending'),
  paymentMethod: z.string().max(100).nullable().optional(), accountId: z.string().uuid().nullable().optional(),
  assetAccountId: z.string().uuid().nullable().optional(), imageUrl: z.string().url().max(5000).nullable().optional(),
  rawAiData: z.record(z.string(), z.unknown()).default({}),
});

export async function GET(req: NextRequest) {
  try {
    const tenantId = req.nextUrl.searchParams.get('tenantId');
    if (!tenantId || !z.string().uuid().safeParse(tenantId).success) {
      return NextResponse.json({ error: 'Valid tenantId required' }, { status: 400 });
    }
    const { admin } = await requireTenantAccess(tenantId, req);
    const { data, error } = await admin.from('business_receipts').select('*').eq('tenant_id', tenantId).order('receipt_date', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ receipts: data || [] });
  } catch (error) {
    return routeErrorResponse(error, 'Expense receipts could not be loaded', req);
  }
}

export async function POST(req: NextRequest) {
  let reservation: { tenantId: string; userId: string } | null = null;
  try {
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid receipt details', fields: parsed.error.flatten().fieldErrors }, { status: 400 });
    const value = parsed.data;
    const { user } = await requireTenantAccess(value.tenantId, req);
    await consumeDailyResourceQuota(value.tenantId, user.id, 'receipts');
    reservation = { tenantId: value.tenantId, userId: user.id };
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.from('business_receipts').insert({
      tenant_id: value.tenantId, receipt_date: value.receiptDate, description: value.description, amount: value.amount,
      category: value.category || null, vendor: value.vendor || null, status: value.status, payment_method: value.paymentMethod || null,
      account_id: value.accountId || null, asset_account_id: value.assetAccountId || null, image_url: value.imageUrl || null,
      raw_ai_data: { ...value.rawAiData, createdBy: user.id }, paid_at: null,
    }).select('*').single();
    if (error) throw error;
    reservation = null;
    const { error: eventError } = await admin.from('business_automation_events').insert({ tenant_id: value.tenantId, event_type: 'receipt_created', payload: { receiptId: data.id, amount: data.amount, actorUserId: user.id } });
    if (eventError) console.error('[receipts] event failed', eventError);
    return NextResponse.json({ receipt: data }, { status: 201 });
  } catch (error) {
    if (reservation) await releaseDailyResourceQuota(reservation.tenantId, reservation.userId, 'receipts');
    return routeErrorResponse(error, 'Receipt could not be created', req);
  }
}
