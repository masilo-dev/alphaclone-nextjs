import { NextRequest, NextResponse } from 'next/server';
<<<<<<< HEAD
import crypto from 'crypto';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import {
  buildQuoteDocumentInput,
} from '@/lib/documents/documentBuilders';
import { generateThemedQuotePdfBuffer } from '@/lib/documents/themedDocumentPdf';
=======
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
>>>>>>> origin/main

export async function POST(req: NextRequest) {
  try {
    const { tenantId, quoteId, recipients, subject, message } = await req.json();
    if (!tenantId || !quoteId || !recipients) {
      return NextResponse.json({ error: 'tenantId, quoteId, and recipients are required' }, { status: 400 });
    }
<<<<<<< HEAD
    const { user, admin: supabase } = await requireTenantAccess(tenantId);
    const { data: quote, error } = await supabase
      .from('quotes')
      .select('*, tenant:tenants(*)')
=======
    const { user } = await requireTenantAccess(tenantId);

    const supabase = createSupabaseAdminClient();
    const { data: quote, error } = await supabase
      .from('quotes')
      .select('*')
>>>>>>> origin/main
      .eq('id', quoteId)
      .eq('tenant_id', tenantId)
      .single();
    if (error || !quote) return NextResponse.json({ error: 'Quote not found' }, { status: 404 });

    const { data: items } = await supabase
      .from('quote_items')
      .select('*')
      .eq('quote_id', quoteId)
      .order('item_order', { ascending: true });

<<<<<<< HEAD
    const publicToken =
        (quote.metadata as Record<string, string> | null)?.public_token || crypto.randomUUID();
    const responseLink = `${req.nextUrl.origin}/quote/${publicToken}`;

    // Resolve tenant sender so quotes go out from the business email, not platform default.
    const { data: integrationRows } = await supabase
        .from('integrations')
        .select('type, config')
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id)
        .eq('enabled', true);
    let fromName = String(user.user_metadata?.full_name || user.email?.split('@')[0] || '').trim();
    let fromEmail = String(user.email || '').trim();
    for (const row of integrationRows || []) {
        const cfg = (row.config || {}) as Record<string, unknown>;
        if (cfg.fromName || cfg.from_name) fromName = String(cfg.fromName || cfg.from_name).trim();
        if (cfg.fromEmail || cfg.from_email) fromEmail = String(cfg.fromEmail || cfg.from_email).trim();
    }

    const quoteMeta = (quote.metadata || {}) as Record<string, unknown>;
    const clientEmail =
        (quote as { client_email?: string }).client_email ||
        (quoteMeta.client_email as string | undefined);

    const pdfBuffer = await generateThemedQuotePdfBuffer(quote, items || [], quote.tenant);
    const emailBody = [
      message || `Please find attached quote ${quote.quote_number}.`,
      '',
      `Review and respond online: ${responseLink}`,
    ].join('\n');

=======
    const pdfBuffer = await renderQuotePdfBuffer(quote, items || []);
>>>>>>> origin/main
    const emailResponse = await fetch(`${req.nextUrl.origin}/api/email/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-api-key': process.env.INTERNAL_API_KEY || '',
      },
      body: JSON.stringify({
        tenantId,
        userId: user.id,
<<<<<<< HEAD
        fromName: fromName || undefined,
        fromEmail: fromEmail || undefined,
        to: recipients,
        subject: subject || `Quote ${quote.quote_number}`,
        text: emailBody,
        html: `
          <p>${message || `Please find attached quote ${quote.quote_number}.`}</p>
          <p><a href="${responseLink}" style="display:inline-block;padding:12px 24px;background:#0d9488;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;">Review &amp; Respond</a></p>
          <p style="color:#64748b;font-size:12px;">Or copy this link: ${responseLink}</p>
        `,
=======
        to: recipients,
        subject: subject || `Quote ${quote.quote_number}`,
        text: message || `Please find attached quote ${quote.quote_number}.`,
>>>>>>> origin/main
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
<<<<<<< HEAD
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        metadata: {
          ...(quote.metadata || {}),
          public_token: publicToken,
          ...(clientEmail ? { client_email: clientEmail } : {}),
        },
      })
      .eq('id', quoteId)
      .eq('tenant_id', tenantId);

    return NextResponse.json({ success: true, message: 'Quote sent successfully', responseLink });
=======
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', quoteId)
      .eq('tenant_id', tenantId);

    return NextResponse.json({ success: true, message: 'Quote sent successfully' });
>>>>>>> origin/main
  } catch (error) {
    console.error('[quotes/send] error:', error);
    return routeErrorResponse(error, 'Failed to send quote', req);
  }
}

