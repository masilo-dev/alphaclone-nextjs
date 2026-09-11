import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveSupabaseAdminClient } from '@/lib/supabase-admin';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { generateThemedInvoicePdfBuffer } from '@/lib/documents/themedDocumentPdf';

function sanitizeFilename(input: string): string {
  return String(input || 'invoice').replace(/[^a-zA-Z0-9._-]/g, '_');
}

async function loadInvoice(admin: SupabaseClient, id: string, tenantId?: string) {
  let query = admin
    .from('business_invoices')
    .select('*, tenant:tenants(*)')
    .eq('id', id);

  if (tenantId) {
    query = query.eq('tenant_id', tenantId);
  }

  return query.maybeSingle();
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { searchParams } = req.nextUrl;
    const tenantId = searchParams.get('tenantId');
    const publicToken = searchParams.get('token');

    let admin: SupabaseClient;

    if (tenantId) {
      ({ admin } = await requireTenantAccess(tenantId, req));
    } else if (publicToken) {
      admin = await resolveSupabaseAdminClient();
      const { data: byMetadata } = await admin
        .from('business_invoices')
        .select('*, tenant:tenants(*)')
        .eq('id', id)
        .eq('metadata->>public_token', publicToken)
        .eq('is_public', true)
        .maybeSingle();

      if (!byMetadata) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    } else {
      return NextResponse.json(
        { error: 'tenantId or token query param required', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const { data: invoice, error } = await loadInvoice(admin, id, tenantId || undefined);

    if (error || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const { data: items } = await admin
      .from('invoice_line_items')
      .select('*')
      .eq('invoice_id', invoice.id)
      .order('created_at', { ascending: true });

    let client: { name?: string; email?: string } | undefined;
    if (invoice.client_id) {
      const { data: clientRow } = await admin
        .from('business_clients')
        .select('name, email')
        .eq('id', invoice.client_id)
        .maybeSingle();
      if (clientRow) client = { name: clientRow.name, email: clientRow.email };
    }

    const pdfBuffer = await generateThemedInvoicePdfBuffer(
      invoice,
      items || [],
      invoice.tenant,
      client
    );
    const filename = sanitizeFilename(`Invoice_${invoice.invoice_number || id}.pdf`);

    const isDownload = searchParams.get('download') === 'true';
    const disposition = isDownload ? 'attachment' : 'inline';

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${disposition}; filename="${filename}"`,
      },
    });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to generate PDF', req);
  }
}
