import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { BrowserManager } from '@/lib/scraper/browserManager';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { start } from 'workflow/api';
import { invoiceLifecycleWorkflow } from '@/workflows/invoice-lifecycle';
import { logInvoiceEvent } from '@/lib/audit/invoiceAuditLogger';

async function renderInvoicePdf(invoice: any): Promise<Buffer> {
  const items = Array.isArray(invoice.items) ? invoice.items : [];
  const rows = items.map((item: any) => {
    const qty = Number(item.quantity || 0);
    const unit = Number(item.unitPrice || 0);
    const total = qty * unit;
    return `<tr>
      <td>${item.description || item.name || 'Line Item'}</td>
      <td style="text-align:right;">${qty}</td>
      <td style="text-align:right;">${unit.toFixed(2)}</td>
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
        .total { margin-top: 16px; text-align: right; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Invoice ${invoice.invoice_number}</h1>
        <p>Due Date: ${invoice.due_date || '-'}</p>
      </div>
      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th style="text-align:right;">Qty</th>
            <th style="text-align:right;">Unit Price</th>
            <th style="text-align:right;">Amount</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p class="total">Total: ${Number(invoice.total || 0).toFixed(2)} ${invoice.currency || 'USD'}</p>
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
    const { tenantId, invoiceId, recipients, subject, message } = await req.json();
    if (!tenantId || !invoiceId || !recipients) {
      return NextResponse.json({ error: 'tenantId, invoiceId, and recipients are required' }, { status: 400 });
    }
    const { user } = await requireTenantAccess(tenantId);

    const supabase = createSupabaseAdminClient();
    const { data: invoice, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .eq('tenant_id', tenantId)
      .single();
    if (error || !invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

    const pdf = await renderInvoicePdf(invoice);

    // Build tracking pixel URL (base64url encoded invoice ID)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
    const trackingToken = Buffer.from(invoiceId).toString('base64url');
    const trackingPixelUrl = `${appUrl}/api/invoices/track/${trackingToken}`;

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
        subject: subject || `Invoice ${invoice.invoice_number}`,
        text: message || `Please find attached invoice ${invoice.invoice_number}.`,
        attachments: [{
          filename: `Invoice_${invoice.invoice_number}.pdf`,
          content: pdf.toString('base64'),
          contentType: 'application/pdf',
        }],
      }),
    });

    const emailPayload = await emailResponse.json().catch(() => ({}));
    if (!emailResponse.ok) {
      return NextResponse.json({ error: emailPayload?.error || 'Failed to send invoice email' }, { status: 502 });
    }

    const now = new Date().toISOString();
    const recipientEmail = Array.isArray(recipients) ? recipients[0] : String(recipients);
    const emailProvider = String(emailPayload?.provider || 'tenant-default');

    // Update invoice sent_at + delivery_status
    await supabase
      .from('invoices')
      .update({
        status: 'sent',
        sent_at: now,
        updated_at: now,
        delivery_status: 'DELIVERED',
      })
      .eq('id', invoiceId)
      .eq('tenant_id', tenantId);

    // Create delivery log entry for e-delivery proof
    await supabase.from('invoice_delivery_log').insert({
      invoice_id: invoiceId,
      tenant_id: tenantId,
      sent_at: now,
      delivered_at: now,
      sent_to_email: recipientEmail,
      email_provider: emailProvider,
      delivery_status: 'DELIVERED',
    });

    // Audit log
    await logInvoiceEvent({
      invoiceId,
      tenantId,
      eventType: 'sent',
      eventData: {
        recipients,
        invoice_number: invoice.invoice_number,
        tracking_pixel_url: trackingPixelUrl,
      },
      performedBy: user.id,
    });

    const { runId } = await start(invoiceLifecycleWorkflow, [{ invoiceId, tenantId }]);

    return NextResponse.json({ 
      success: true, 
      message: 'Invoice sent successfully',
      runId,
      trackingPixelUrl,
    });
  } catch (error) {
    console.error('[invoices/send] error:', error);
    return routeErrorResponse(error, 'Failed to send invoice', req);
  }
}
