import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { extractTenantBranding } from '@/lib/tenantBranding';

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get('token');
    const id = req.nextUrl.searchParams.get('id');

    if (!token && !id) {
      return NextResponse.json({ error: 'token or id is required' }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    let query = admin
      .from('business_invoices')
      .select('*, tenant:tenants(name, settings), line_items:invoice_line_items(*)');

    if (token) {
      query = query.eq('metadata->>public_token', token);
    } else {
      query = query.eq('id', id!).eq('is_public', true);
    }

    const { data: invoice, error } = await query.maybeSingle();
    if (error) throw error;
    if (!invoice || !invoice.is_public) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const branding = extractTenantBranding(invoice.tenant as { name?: string; settings?: unknown });
    const metadata = (invoice.metadata || {}) as Record<string, unknown>;

    return NextResponse.json({
      success: true,
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoice_number,
        clientName: invoice.client_name,
        clientEmail: invoice.client_email,
        issueDate: invoice.issue_date,
        dueDate: invoice.due_date,
        status: invoice.status,
        subtotal: invoice.subtotal,
        tax: invoice.tax,
        taxRate: invoice.tax_rate,
        discountAmount: invoice.discount_amount,
        total: invoice.total,
        notes: invoice.notes,
        lineItems: invoice.line_items || [],
        paymentPendingConfirmation: metadata.payment_pending_confirmation === true,
        bankDetails: invoice.bank_details || metadata.bank_details || null,
        mobilePaymentDetails: invoice.mobile_payment_details || metadata.mobile_payment_details || null,
        publicToken: metadata.public_token || null,
      },
      branding,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load invoice' },
      { status: 500 }
    );
  }
}
