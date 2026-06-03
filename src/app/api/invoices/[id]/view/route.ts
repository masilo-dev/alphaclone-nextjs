import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { logInvoiceEvent } from '@/lib/audit/invoiceAuditLogger';

// 1x1 transparent GIF (used when this endpoint also acts as pixel)
const TRANSPARENT_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: invoiceId } = await context.params;
    if (!invoiceId) {
      return NextResponse.json({ error: 'Invoice ID required' }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const now = new Date().toISOString();

    // Fetch invoice to get tenantId and current status
    const { data: invoice, error: fetchError } = await admin
      .from('business_invoices')
      .select('id, tenant_id, status, view_count')
      .eq('id', invoiceId)
      .single();

    if (fetchError || !invoice) {
      // Return 200 silently — don't expose invoice existence to public
      return new NextResponse(TRANSPARENT_GIF, {
        status: 200,
        headers: { 'Content-Type': 'image/gif', 'Cache-Control': 'no-store' },
      });
    }

    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      'unknown';
    const userAgent = req.headers.get('user-agent') || '';

    // Log to invoice_views
    await admin.from('invoice_views').insert({
      invoice_id: invoiceId,
      tenant_id: invoice.tenant_id,
      viewed_at: now,
      ip_address: ip,
      user_agent: userAgent,
      source: 'page_load',
    });

    // Increment view count and update viewed_at
    const newViewCount = (invoice.view_count ?? 0) + 1;
    const updatePayload: Record<string, any> = {
      view_count: newViewCount,
      updated_at: now,
    };

    // Transition status sent → viewed (only once)
    if (invoice.status === 'sent') {
      updatePayload.status = 'viewed';
      updatePayload.viewed_at = now;
    } else if (!invoice.viewed_at) {
      updatePayload.viewed_at = now;
    }

    await admin
      .from('business_invoices')
      .update(updatePayload)
      .eq('id', invoiceId);

    // Audit log
    await logInvoiceEvent({
      invoiceId,
      tenantId: invoice.tenant_id,
      eventType: 'viewed',
      eventData: {
        ip_address: ip,
        user_agent: userAgent,
        source: 'page_load',
        view_count: newViewCount,
        status_changed_to: invoice.status === 'sent' ? 'viewed' : undefined,
      },
      performedBy: 'system',
    });

    return NextResponse.json({ success: true, viewCount: newViewCount });
  } catch (err) {
    console.error('[invoices/view] error:', err);
    return NextResponse.json({ success: false }, { status: 200 }); // Silent fail
  }
}
