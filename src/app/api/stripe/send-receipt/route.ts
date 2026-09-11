import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { sendEmailServer } from '@/lib/email/sendEmailServer';
import { businessInvoiceService } from '@/services/businessInvoiceService';
import { AppUrls } from '@/lib/urls';

export const dynamic = 'force-dynamic';
const schema = z.object({ invoiceId: z.string().uuid(), recipientEmail: z.string().email().optional() });

export async function POST(req: NextRequest) {
  try {
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: 'A valid invoice is required' }, { status: 400 });
    const admin = createSupabaseAdminClient();
    const { data: invoice, error } = await admin.from('business_invoices').select('*, tenant:tenant_id(id, name, slug), client:client_id(id, name, email, company, phone)').eq('id', parsed.data.invoiceId).maybeSingle();
    if (error) throw error;
    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    const { user } = await requireTenantAccess(invoice.tenant_id, req);
    if (invoice.status !== 'paid') return NextResponse.json({ error: 'A receipt can only be sent for a paid invoice' }, { status: 409 });
    const to = parsed.data.recipientEmail || invoice.client?.email;
    if (!to) return NextResponse.json({ error: 'The invoice client has no receipt email address' }, { status: 400 });

    const doc = businessInvoiceService.generatePDF(invoice, invoice.tenant, invoice.client);
    const pdfBase64 = Buffer.from(doc.output('arraybuffer')).toString('base64');
    const amount = `${invoice.currency || 'USD'} ${Number(invoice.total || 0).toFixed(2)}`;
    const paidAt = invoice.paid_at || invoice.updated_at || new Date().toISOString();
    const receiptUrl = AppUrls.viewReceipt(invoice.id);
    const dispatch = await sendEmailServer({
      tenantId: invoice.tenant_id,
      userId: user.id,
      to,
      subject: `Payment receipt - ${invoice.invoice_number}`,
      fromName: invoice.tenant?.name || 'AlphaClone',
      templateName: 'invoicePaymentReceipt',
      html: `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#0f172a"><h2 style="color:#059669">Payment confirmed</h2><p>Thank you. This email confirms payment of <strong>${amount}</strong> for invoice <strong>${invoice.invoice_number}</strong>.</p><p>Payment recorded: ${new Date(paidAt).toLocaleDateString('en-GB')}</p><p><a href="${receiptUrl}">View receipt online</a></p><p style="font-size:12px;color:#64748b">A PDF receipt is attached for your records.</p></div>`,
      attachments: [{ filename: `Receipt_${invoice.invoice_number}.pdf`, content: pdfBase64, contentType: 'application/pdf' }],
    });
    if (!dispatch.success) return NextResponse.json({ error: dispatch.error || 'Receipt email delivery failed', code: dispatch.code }, { status: 502 });
    await admin.from('business_automation_events').insert({ tenant_id: invoice.tenant_id, event_type: 'payment_receipt_sent', payload: { invoiceId: invoice.id, recipient: to, provider: dispatch.provider, actorUserId: user.id } });
    return NextResponse.json({ sent: true, provider: dispatch.provider, emailId: dispatch.emailId });
  } catch (error) {
    return routeErrorResponse(error, 'Payment receipt could not be sent', req);
  }
}
