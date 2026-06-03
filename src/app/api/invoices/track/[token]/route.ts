import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { logInvoiceEvent } from '@/lib/audit/invoiceAuditLogger';

// 1×1 transparent GIF binary
const TRANSPARENT_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

/**
 * Tracking pixel endpoint embedded in invoice emails.
 * Token = base64url(invoiceId) — simple obfuscation.
 * Returns a 1×1 transparent GIF regardless of outcome.
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const gifResponse = new NextResponse(TRANSPARENT_GIF, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
    },
  });

  try {
    const { token } = await context.params;
    if (!token) return gifResponse;

    // Decode invoice ID from base64url token
    let invoiceId: string;
    try {
      invoiceId = Buffer.from(token, 'base64url').toString('utf8');
    } catch {
      // Invalid token — return pixel silently
      return gifResponse;
    }

    // Validate it looks like a UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(invoiceId)) return gifResponse;

    const admin = createSupabaseAdminClient();
    const now = new Date().toISOString();

    const { data: invoice } = await admin
      .from('business_invoices')
      .select('id, tenant_id, status, view_count')
      .eq('id', invoiceId)
      .single();

    if (!invoice) return gifResponse;

    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      'unknown';
    const userAgent = req.headers.get('user-agent') || '';

    // Log view
    await admin.from('invoice_views').insert({
      invoice_id: invoiceId,
      tenant_id: invoice.tenant_id,
      viewed_at: now,
      ip_address: ip,
      user_agent: userAgent,
      source: 'email_pixel',
    });

    const newViewCount = (invoice.view_count ?? 0) + 1;
    const updatePayload: Record<string, any> = {
      view_count: newViewCount,
      updated_at: now,
    };

    if (invoice.status === 'sent') {
      updatePayload.status = 'viewed';
      updatePayload.viewed_at = now;
    }

    await admin.from('business_invoices').update(updatePayload).eq('id', invoiceId);

    await logInvoiceEvent({
      invoiceId,
      tenantId: invoice.tenant_id,
      eventType: 'viewed',
      eventData: {
        ip_address: ip,
        user_agent: userAgent,
        source: 'email_pixel',
        view_count: newViewCount,
        status_changed_to: invoice.status === 'sent' ? 'viewed' : undefined,
      },
      performedBy: 'system',
    });
  } catch (err) {
    console.error('[invoices/track] error:', err);
    // Always return the pixel — never expose errors
  }

  return gifResponse;
}
