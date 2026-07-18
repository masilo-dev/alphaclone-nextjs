import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { stripe } from '@/lib/stripe';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { requireAuthenticatedUser, routeErrorResponse } from '@/lib/apiAuth';

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireAuthenticatedUser(req);
    const { invoiceId } = z.object({ invoiceId: z.string().uuid() }).parse(await req.json());
    const admin = createSupabaseAdminClient();
    const { data: invoice, error } = await admin.from('invoices').select('id,tenant_id,user_id,amount,currency,status,description').eq('id', invoiceId).single();
    if (error || !invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    const { data: membership } = await admin.from('tenant_users').select('user_id').eq('tenant_id', invoice.tenant_id).eq('user_id', user.id).maybeSingle();
    if (invoice.user_id !== user.id && !membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (invoice.status === 'paid') return NextResponse.json({ error: 'Invoice is already paid' }, { status: 409 });
    const amount = Math.round(Number(invoice.amount) * 100);
    if (!Number.isSafeInteger(amount) || amount < 50) return NextResponse.json({ error: 'Invoice amount is invalid' }, { status: 422 });

    const origin = req.nextUrl.origin;
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: String(invoice.currency || 'usd').toLowerCase(),
          product_data: { name: `Invoice ${invoice.id.slice(0, 8).toUpperCase()}`, description: invoice.description || 'Invoice payment' },
          unit_amount: amount,
        },
        quantity: 1,
      }],
      success_url: `${origin}/dashboard?payment=success`,
      cancel_url: `${origin}/dashboard?payment=cancelled`,
      metadata: { type: 'legacy_invoice', invoiceId: invoice.id, tenantId: invoice.tenant_id },
    }, { idempotencyKey: `legacy-invoice-checkout-${invoice.id}-${Math.floor(Date.now() / 3_600_000)}` });
    return NextResponse.json({ url: session.url });
  } catch (error) {
    return routeErrorResponse(error, 'Secure invoice checkout is unavailable', req);
  }
}
