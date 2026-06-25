import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { generateInvoicePDF } from '@/utils/pdfGenerator';

function sanitizeFilename(input: string): string {
  return String(input || 'invoice').replace(/[^a-zA-Z0-9._-]/g, '_');
}

async function loadInvoice(admin: ReturnType<typeof createSupabaseAdminClient>, id: string, tenantId?: string) {
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

    const admin = createSupabaseAdminClient();

    if (tenantId) {
      await requireTenantAccess(tenantId);
    } else if (publicToken) {
      const { data: byMetadata } = await admin
        .from('business_invoices')
        .select('*, tenant:tenants(*)')
        .eq('id', id)
        .eq('metadata->>public_token', publicToken)
        .maybeSingle();

      if (!byMetadata) {
        try {
          const decodedId = Buffer.from(publicToken, 'base64url').toString('utf8');
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          if (decodedId !== id || !uuidRegex.test(decodedId)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
          }
        } catch {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
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
      .from('invoice_items')
      .select('*')
      .eq('invoice_id', invoice.id)
      .order('created_at', { ascending: true });

    const doc = generateInvoicePDF(
      {
        id: invoice.id,
        invoiceNumber: invoice.invoice_number,
        status: invoice.status,
        subtotal: Number(invoice.subtotal || 0),
        taxRate: Number(invoice.tax_rate || 0),
        tax: Number(invoice.tax || 0),
        discountAmount: Number(invoice.discount_amount || 0),
        total: Number(invoice.total || 0),
        currency: invoice.currency || 'USD',
        dueDate: invoice.due_date || undefined,
        issueDate: invoice.issue_date || undefined,
        notes: invoice.notes || undefined,
        createdAt: invoice.created_at,
        updatedAt: invoice.updated_at,
      } as any,
      (items || []).map((item: any) => ({
        id: item.id,
        invoiceId: item.invoice_id,
        description: item.description,
        quantity: Number(item.quantity || 0),
        rate: Number(item.rate || 0),
        amount: Number(item.amount || 0),
      })),
      invoice.tenant as any
    );

    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
    const filename = sanitizeFilename(`Invoice_${invoice.invoice_number || id}.pdf`);

    const isDownload = searchParams.get('download') === 'true';
    const disposition = isDownload ? 'attachment' : 'inline';

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${disposition}; filename="${filename}"`,
      },
    });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to generate PDF', req);
  }
}
