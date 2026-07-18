import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

const paymentSchema = z.object({
  tenantId: z.string().uuid(),
  action: z.literal('pay'),
  assetAccountId: z.string().uuid(),
});

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const tenantId = req.nextUrl.searchParams.get('tenantId');
    if (!tenantId || !z.string().uuid().safeParse(tenantId).success || !z.string().uuid().safeParse(id).success) {
      return NextResponse.json({ error: 'Valid tenant and receipt IDs are required' }, { status: 400 });
    }
    await requireTenantAccess(tenantId, req);
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.from('business_receipts').select('*').eq('tenant_id', tenantId).eq('id', id).maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Expense receipt not found' }, { status: 404 });
    return NextResponse.json({ receipt: data });
  } catch (error) {
    return routeErrorResponse(error, 'Expense receipt could not be loaded', req);
  }
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: 'Valid receipt ID required' }, { status: 400 });
    const parsed = paymentSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: 'Valid tenant and payment account are required' }, { status: 400 });
    const { tenantId, assetAccountId } = parsed.data;
    const { user } = await requireTenantAccess(tenantId, req);
    const admin = createSupabaseAdminClient();
    const { data: rows, error } = await admin.rpc('pay_business_receipt', {
      p_tenant_id: tenantId,
      p_receipt_id: id,
      p_asset_account_id: assetAccountId,
      p_actor_user_id: user.id,
    });
    if (error) {
      if (/not found/i.test(error.message)) return NextResponse.json({ error: 'Expense receipt not found' }, { status: 404 });
      if (/cannot be paid|select a valid/i.test(error.message)) return NextResponse.json({ error: error.message }, { status: 409 });
      throw error;
    }
    const receipt = Array.isArray(rows) ? rows[0] : rows;
    return NextResponse.json({ receipt });
  } catch (error) {
    return routeErrorResponse(error, 'Expense receipt could not be paid', req);
  }
}
