import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { generateThemedQuotePdfBuffer } from '@/lib/documents/themedDocumentPdf';

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

    const pdfBuffer = await generateThemedQuotePdfBuffer(quote, items || [], quote.tenant);
    const filename = sanitizeFilename(`Quote_${quote.quote_number || token}.pdf`);

    const isDownload = _req.nextUrl.searchParams.get('download') === 'true';
    const disposition = isDownload ? 'attachment' : 'inline';

    return new NextResponse(new Uint8Array(pdfBuffer), {
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
