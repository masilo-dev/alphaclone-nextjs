import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { extractTenantBranding } from '@/lib/tenantBranding';
import { resolveInvoiceSenderName } from '@/lib/invoices/invoiceBranding';

export const dynamic = 'force-dynamic';

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function legacyTokenMatchesInvoiceId(token: string, invoiceId: string): boolean {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    return decoded === invoiceId && isUuid(decoded);
  } catch {
    return false;
  }
}

function mapPublicInvoice(row: Record<string, unknown>, lineItems: Record<string, unknown>[]) {
  const metadata = (row.metadata || {}) as Record<string, unknown>;
  const paymentConfirmation = metadata.payment_confirmation as Record<string, unknown> | undefined;

  return {
    id: row.id,
    invoiceNumber: row.invoice_number,
    issueDate: row.issue_date,
    dueDate: row.due_date,
    status: row.status,
    subtotal: row.subtotal,
    tax_rate: row.tax_rate,
    taxRate: row.tax_rate,
    tax: row.tax,
    discount_amount: row.discount_amount,
    discountAmount: row.discount_amount,
    total: row.total,
    currency: row.currency || 'USD',
    notes: row.notes,
    bankDetails: row.bank_details,
    mobilePaymentDetails: row.mobile_payment_details,
    client_name: row.client_name,
    client_email: row.client_email,
    created_at: row.created_at,
    sent_at: row.sent_at,
    viewed_at: row.viewed_at,
    paid_at: row.paid_at,
    disputed_at: row.disputed_at,
    publicToken: metadata.public_token,
    paymentPendingConfirmation: Boolean(metadata.payment_pending_confirmation),
    paymentConfirmation: paymentConfirmation || null,
    lineItems: lineItems.map((li) => ({
      description: li.description,
      quantity: li.quantity,
      unit_price: li.unit_price,
      rate: li.unit_price,
      line_total: li.amount,
      amount: li.amount,
    })),
  };
}

async function authorizePublicInvoice(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  invoiceId: string,
  token?: string | null
) {
  const { data: invoice, error } = await admin
    .from('business_invoices')
    .select('*')
    .eq('id', invoiceId)
    .maybeSingle();

  if (error || !invoice) {
    return { invoice: null, branding: null, error: 'Invoice not found' as const };
  }

  if (!invoice.is_public) {
    return { invoice: null, branding: null, error: 'Invoice not available publicly' as const };
  }

  const metadata = (invoice.metadata || {}) as Record<string, string>;
  const storedToken = String(metadata.public_token || '').trim();

  if (token) {
    const tokenOk =
      (storedToken && storedToken === token) ||
      legacyTokenMatchesInvoiceId(token, invoiceId);
    if (!tokenOk) {
      return { invoice: null, branding: null, error: 'Invalid invoice link' as const };
    }
  } else if (storedToken) {
    return { invoice: null, branding: null, error: 'Payment token required' as const };
  }

  const { data: lineItems } = await admin
    .from('invoice_line_items')
    .select('*')
    .eq('invoice_id', invoiceId)
    .order('created_at', { ascending: true });

  const [{ data: tenant }, { data: businessSettings }] = await Promise.all([
    admin.from('tenants').select('name, legal_name, settings').eq('id', invoice.tenant_id).maybeSingle(),
    admin.from('business_settings').select('trading_name, business_name, logo_url, brand_color').eq('tenant_id', invoice.tenant_id).maybeSingle(),
  ]);

  const brandingBase = extractTenantBranding(tenant);
  const displayName = resolveInvoiceSenderName(
    { senderName: invoice.sender_name as string | null },
    tenant,
    businessSettings
  );

  return {
    invoice: {
      ...mapPublicInvoice(invoice as Record<string, unknown>, (lineItems || []) as Record<string, unknown>[]),
      senderName: displayName,
      clientName: invoice.client_name,
    },
    branding: {
      ...brandingBase,
      name: displayName,
      logoUrl: businessSettings?.logo_url || brandingBase.logoUrl,
      primaryColor: businessSettings?.brand_color || brandingBase.primaryColor,
    },
    error: null,
  };
}

export async function GET(req: NextRequest) {
  try {
    const invoiceId = req.nextUrl.searchParams.get('id')?.trim() || '';
    const token = req.nextUrl.searchParams.get('token')?.trim() || '';

    if (!invoiceId || !isUuid(invoiceId)) {
      return NextResponse.json({ error: 'Valid invoice id is required' }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const result = await authorizePublicInvoice(admin, invoiceId, token || null);

    if (!result.invoice) {
      const status = result.error === 'Invalid invoice link' ? 401 : 404;
      return NextResponse.json({ error: result.error }, { status });
    }

    return NextResponse.json({
      invoice: result.invoice,
      branding: result.branding,
    });
  } catch (error) {
    console.error('[invoices/public] error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load invoice' },
      { status: 500 }
    );
  }
}
