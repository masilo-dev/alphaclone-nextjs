import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { generateInvoicePDF } from '@/utils/pdfGenerator';

function sanitizeFilename(input: string): string {
  return String(input || 'invoice').replace(/[^a-zA-Z0-9._-]/g, '_');
}

export async function GET(_req: NextRequest, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params;
    const admin = createSupabaseAdminClient();

    const { data: invoice, error } = await admin
      .from('business_invoices')
      .select('*, tenant:tenants(*)')
      .eq('id', token)
      .maybeSingle();

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
    const filename = sanitizeFilename(`Invoice_${invoice.invoice_number || token}.pdf`);

    const isDownload = _req.nextUrl.searchParams.get('download') === 'true';
    const disposition = isDownload ? 'attachment' : 'inline';

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${disposition}; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('[api/invoices/pdf] failed:', error);
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
  }
}
