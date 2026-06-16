import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { generateQuotePDF } from '@/utils/pdfGenerator';

function sanitizeFilename(input: string): string {
  return String(input || 'quote').replace(/[^a-zA-Z0-9._-]/g, '_');
}

export async function GET(_req: NextRequest, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params;
    const admin = createSupabaseAdminClient();

    const { data: quote, error } = await admin
      .from('quotes')
      .select('*, tenant:tenants(*)')
      .eq('metadata->>public_token', token)
      .maybeSingle();

    if (error || !quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }

    const { data: items } = await admin
      .from('quote_items')
      .select('*')
      .eq('quote_id', quote.id)
      .order('item_order', { ascending: true });

    const doc = generateQuotePDF(
      {
        id: quote.id,
        quoteNumber: quote.quote_number,
        name: quote.name,
        status: quote.status,
        subtotal: Number(quote.subtotal || 0),
        discountAmount: Number(quote.discount_amount || 0),
        discountPercent: Number(quote.discount_percent || 0),
        taxAmount: Number(quote.tax_amount || 0),
        taxPercent: Number(quote.tax_percent || 0),
        totalAmount: Number(quote.total_amount || 0),
        currency: quote.currency || 'USD',
        validUntil: quote.valid_until || undefined,
        notes: quote.notes || undefined,
        termsAndConditions: quote.terms_and_conditions || undefined,
        signatureUrl: quote.signature_url || undefined,
        acceptedAt: quote.accepted_at || undefined,
        createdAt: quote.created_at,
        updatedAt: quote.updated_at,
      } as any,
      (items || []).map((item: any) => ({
        id: item.id,
        quoteId: item.quote_id,
        itemOrder: item.item_order,
        productName: item.product_name,
        description: item.description,
        quantity: Number(item.quantity || 0),
        unitPrice: Number(item.unit_price || 0),
        discountPercent: Number(item.discount_percent || 0),
        taxPercent: Number(item.tax_percent || 0),
        lineTotal: Number(item.line_total || 0),
        createdAt: item.created_at,
      })),
      quote.tenant as any
    );

    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
    const filename = sanitizeFilename(`Quote_${quote.quote_number || token}.pdf`);

    const isDownload = _req.nextUrl.searchParams.get('download') === 'true';
    const disposition = isDownload ? 'attachment' : 'inline';

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${disposition}; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('[api/quotes/pdf] failed:', error);
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
  }
}
