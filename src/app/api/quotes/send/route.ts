import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { BrowserManager } from '@/lib/scraper/browserManager';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';

async function renderQuotePdfBuffer(quote: any, items: any[]): Promise<Buffer> {
  const rows = items.map((item) => {
    const qty = Number(item.quantity || 0);
    const rate = Number(item.unit_price || 0);
    const total = Number(item.line_total || qty * rate);
    return `<tr>
      <td>${item.product_name || 'Item'}</td>
      <td>${item.description || ''}</td>
      <td style="text-align:right;">${qty}</td>
      <td style="text-align:right;">${rate.toFixed(2)}</td>
      <td style="text-align:right;">${total.toFixed(2)}</td>
    </tr>`;
  }).join('');

  const html = `
  <html>
    <head>
      <meta charset="UTF-8" />
      <style>
        body { font-family: Arial, sans-serif; color: #0f172a; }
        .header { border-bottom: 2px solid #0f172a; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th, td { border: 1px solid #d1d5db; padding: 8px; font-size: 12px; }
        th { background: #f8fafc; text-align: left; }
        .totals { margin-top: 20px; text-align: right; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Quote ${quote.quote_number}</h1>
        <p>${quote.name || ''}</p>
        <p>Valid Until: ${quote.valid_until || '-'}</p>
      </div>
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th>Description</th>
            <th style="text-align:right;">Qty</th>
            <th style="text-align:right;">Unit Price</th>
            <th style="text-align:right;">Total</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p class="totals">Total: ${Number(quote.total_amount || 0).toFixed(2)} ${quote.currency || 'USD'}</p>
    </body>
  </html>`;

  const { page, close } = await BrowserManager.createPage();
  try {
    await page.setContent(html, { waitUntil: 'networkidle', timeout: 30000 });
    await page.emulateMedia({ media: 'print' });
    const pdf = await page.pdf({
      format: 'Letter',
      printBackground: true,
      margin: { top: '25.4mm', right: '25.4mm', bottom: '25.4mm', left: '25.4mm' },
    });
    return Buffer.from(pdf);
  } finally {
    await close().catch(() => undefined);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { tenantId, quoteId, recipients, subject, message } = await req.json();
    if (!tenantId || !quoteId || !recipients) {
      return NextResponse.json({ error: 'tenantId, quoteId, and recipients are required' }, { status: 400 });
    }
    const { user } = await requireTenantAccess(tenantId);

    const supabase = createSupabaseAdminClient();
    const { data: quote, error } = await supabase
      .from('quotes')
      .select('*')
      .eq('id', quoteId)
      .eq('tenant_id', tenantId)
      .single();
    if (error || !quote) return NextResponse.json({ error: 'Quote not found' }, { status: 404 });

    const { data: items } = await supabase
      .from('quote_items')
      .select('*')
      .eq('quote_id', quoteId)
      .order('item_order', { ascending: true });

    const pdfBuffer = await renderQuotePdfBuffer(quote, items || []);
    const emailResponse = await fetch(`${req.nextUrl.origin}/api/email/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-api-key': process.env.INTERNAL_API_KEY || '',
      },
      body: JSON.stringify({
        tenantId,
        userId: user.id,
        to: recipients,
        subject: subject || `Quote ${quote.quote_number}`,
        text: message || `Please find attached quote ${quote.quote_number}.`,
        attachments: [{
          filename: `Quote_${quote.quote_number}.pdf`,
          content: pdfBuffer.toString('base64'),
          contentType: 'application/pdf',
        }],
      }),
    });

    if (!emailResponse.ok) {
      const payload = await emailResponse.json().catch(() => ({}));
      return NextResponse.json({ error: payload?.error || 'Failed to send quote email' }, { status: 502 });
    }

    await supabase
      .from('quotes')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', quoteId)
      .eq('tenant_id', tenantId);

    return NextResponse.json({ success: true, message: 'Quote sent successfully' });
  } catch (error) {
    console.error('[quotes/send] error:', error);
    return routeErrorResponse(error, 'Failed to send quote', req);
  }
}

