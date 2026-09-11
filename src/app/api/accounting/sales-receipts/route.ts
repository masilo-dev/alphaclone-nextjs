import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { validateDailyResourceQuota, recordDailyResourceQuota } from '@/lib/server/dailyResourceQuota';

const itemSchema = z.object({
  description: z.string().trim().min(1).max(1000),
  quantity: z.coerce.number().positive().max(1_000_000),
  unitPrice: z.coerce.number().min(0).max(1_000_000_000),
});

const schema = z.object({
  tenantId: z.string().uuid(),
  receiptNumber: z.string().trim().min(1).max(100),
  receiptDate: z.string().date(),
  clientName: z.string().trim().min(1).max(300),
  clientEmail: z.string().email().nullable().optional(),
  paymentMethod: z.string().trim().min(1).max(100),
  items: z.array(itemSchema).min(1).max(200),
  discountAmount: z.coerce.number().min(0).max(1_000_000_000).default(0),
  taxRate: z.coerce.number().min(0).max(100).default(0),
  currency: z.string().trim().length(3).default('USD'),
  notes: z.string().trim().max(10_000).nullable().optional(),
  receivedBy: z.string().trim().max(300).nullable().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid sales receipt details', fields: parsed.error.flatten().fieldErrors }, { status: 400 });
    }
    const value = parsed.data;
    const { user } = await requireTenantAccess(value.tenantId, req);
    const items = value.items.map((item) => ({
      ...item,
      amount: Math.round(item.quantity * item.unitPrice * 100) / 100,
    }));
    const subtotal = Math.round(items.reduce((sum, item) => sum + item.amount, 0) * 100) / 100;
    if (value.discountAmount > subtotal) {
      return NextResponse.json({ error: 'Discount cannot exceed the subtotal' }, { status: 400 });
    }
    const taxable = subtotal - value.discountAmount;
    const tax = Math.round(taxable * value.taxRate) / 100;
    const total = Math.round((taxable + tax) * 100) / 100;
    if (total <= 0) return NextResponse.json({ error: 'Receipt total must be greater than zero' }, { status: 400 });

    await validateDailyResourceQuota(value.tenantId, user.id, 'receipts');
    const admin = createSupabaseAdminClient();
    const { data: rows, error } = await admin.rpc('create_posted_sales_receipt', {
      p_tenant_id: value.tenantId,
      p_receipt_number: value.receiptNumber,
      p_receipt_date: value.receiptDate,
      p_client_name: value.clientName,
      p_client_email: value.clientEmail || '',
      p_payment_method: value.paymentMethod,
      p_subtotal: subtotal,
      p_discount_amount: value.discountAmount,
      p_tax_rate: value.taxRate,
      p_tax: tax,
      p_total: total,
      p_currency: value.currency.toUpperCase(),
      p_notes: value.notes || '',
      p_received_by: value.receivedBy || '',
      p_items: items,
      p_actor_user_id: user.id,
    });
    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'This receipt number already exists' }, { status: 409 });
      }
      throw error;
    }
    const receipt = Array.isArray(rows) ? rows[0] : rows;
    if (!receipt) throw new Error('Sales receipt was not created');
    await recordDailyResourceQuota(value.tenantId, user.id, 'receipts', 1, `sales-receipt:${receipt.id}`);
    return NextResponse.json({ receipt, items }, { status: 201 });
  } catch (error) {
    return routeErrorResponse(error, 'Sales receipt could not be finalized', req);
  }
}
