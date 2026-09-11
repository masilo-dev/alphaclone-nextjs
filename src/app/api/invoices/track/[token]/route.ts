import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { logInvoiceEvent } from '@/lib/audit/invoiceAuditLogger';

import { verifyInvoiceTrackToken } from '@/lib/security/signedToken';
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

    // Decode invoice ID from signed token (legacy base64url still accepted)
    const invoiceId = verifyInvoiceTrackToken(token);
    if (!invoiceId) return gifResponse;

    const admin = createSupabaseAdminClient();
    const now = new Date().toISOString();

    const { data: invoice } = await admin
      .from('business_invoices')
      .select('id, tenant_id, status, lifecycle_status, view_count')
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
      updatePayload.lifecycle_status = 'viewed';
      updatePayload.viewed_at = now;
    }

    await admin.from('business_invoices').update(updatePayload).eq('id', invoiceId);

    if (invoice.status === 'sent') {
      await admin.from('invoice_lifecycle_events').insert({
        tenant_id: invoice.tenant_id, invoice_id: invoiceId, event_type: 'status_viewed',
        from_status: invoice.lifecycle_status || invoice.status, to_status: 'viewed', source: 'email_tracking_pixel',
        evidence: { ip_address: ip, user_agent: userAgent, source: 'email_pixel' },
      });
    }

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
