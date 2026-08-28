import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { notifyTenantOwners } from '@/lib/notifyTenantOwners';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token = String(body.token || '').trim();
    const reference = String(body.reference || '').trim();
    const note = String(body.note || '').trim();
    const payerName = String(body.payerName || body.payer_name || 'Client').trim();

    if (!token) {
      return NextResponse.json({ error: 'token is required' }, { status: 400 });
    }
    if (!reference) {
      return NextResponse.json({ error: 'Payment reference is required' }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const { data: invoice, error } = await admin
      .from('business_invoices')
      .select('id, tenant_id, invoice_number, status, metadata, client_name')
      .eq('metadata->>public_token', token)
      .eq('is_public', true)
      .maybeSingle();

    if (error || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    if (invoice.status === 'paid') {
      return NextResponse.json({ success: true, alreadyPaid: true });
    }

    const metadata = (invoice.metadata || {}) as Record<string, unknown>;
    await admin
      .from('business_invoices')
      .update({
        metadata: {
          ...metadata,
          payment_pending_confirmation: true,
          payment_confirmation: {
            reference,
            note,
            payerName,
            submittedAt: new Date().toISOString(),
          },
        },
      })
      .eq('id', invoice.id);

    const { error: automationError } = await admin.from('business_automation_events').insert({
      tenant_id: invoice.tenant_id,
      event_type: 'invoice_payment_pending_review',
      payload: {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoice_number,
        reference,
        note,
        payerName,
        submittedAt: new Date().toISOString(),
      },
    });
    if (automationError) {
      console.warn('[confirm-payment] automation event skipped', automationError.message);
    }

    const origin = req.nextUrl.origin;
    await notifyTenantOwners({
      tenantId: invoice.tenant_id,
      type: 'invoice',
      title: `Payment submitted: ${invoice.invoice_number}`,
      message: `${payerName} reported payment for invoice ${invoice.invoice_number}. Reference: ${reference}${note ? ` — ${note}` : ''}`,
      link: `${origin}/dashboard/accounting`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to confirm payment' },
      { status: 500 }
    );
  }
}
