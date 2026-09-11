import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { sendEmailServer } from '@/lib/email/sendEmailServer';

type ReminderMetadata = {
  clientEmail?: string;
  clientName?: string;
};

function parseInvoiceMetadata(notes: unknown): ReminderMetadata {
  if (typeof notes !== 'string' || !notes.trim()) return {};
  const match = notes.match(/---METADATA---([\s\S]*?)---METADATA---/);
  if (!match?.[1]) return {};
  try {
    return JSON.parse(match[1]) as ReminderMetadata;
  } catch {
    return {};
  }
}

export async function POST(req: NextRequest) {
  try {
    const { tenantId, invoiceId, recipientEmail, subject, message } = await req.json();
    if (!tenantId || !invoiceId) {
      return NextResponse.json({ error: 'tenantId and invoiceId are required' }, { status: 400 });
    }

    const { user, admin } = await requireTenantAccess(tenantId);

    const { data: invoice, error: invoiceError } = await admin
      .from('business_invoices')
      .select('id, tenant_id, client_id, invoice_number, total, currency, due_date, status, notes, reminder_count')
      .eq('id', invoiceId)
      .eq('tenant_id', tenantId)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const metadata = parseInvoiceMetadata(invoice.notes);
    let resolvedRecipient = String(recipientEmail || '').trim();

    if (!resolvedRecipient && invoice.client_id) {
      const { data: client } = await admin
        .from('business_clients')
        .select('email,name')
        .eq('id', invoice.client_id)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      resolvedRecipient = String(client?.email || '').trim();
    }

    if (!resolvedRecipient && metadata.clientEmail) {
      resolvedRecipient = metadata.clientEmail.trim();
    }

    if (!resolvedRecipient) {
      return NextResponse.json({ error: 'Client email is missing for this invoice' }, { status: 400 });
    }

    const bodyText = message || `This is a payment reminder for invoice ${invoice.invoice_number}, due on ${invoice.due_date}.`;
    const result = await sendEmailServer({
      tenantId,
      userId: user.id,
      to: resolvedRecipient,
      subject: subject || `Payment reminder: Invoice ${invoice.invoice_number}`,
      html: `<div style="font-family:sans-serif;padding:24px;color:#333;max-width:560px;"><p>${bodyText}</p></div>`,
      message: bodyText,
      isPlatformNotification: true,
      templateName: 'invoiceReminder',
      initiationSource: 'api.invoices.reminder',
      relatedRecord: { type: 'invoice', id: invoice.id },
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to send reminder email', code: result.code },
        { status: 502 },
      );
    }

    const nowIso = new Date().toISOString();
    await admin.from('invoice_reminders').insert({
      tenant_id: tenantId,
      invoice_id: invoice.id,
      reminder_type: 'manual_follow_up',
      sent_to: resolvedRecipient,
      status: 'sent',
      metadata: {
        invoiceNumber: invoice.invoice_number,
        source: 'manual_ui',
        sentBy: user.id,
        createdAt: nowIso,
      },
    });

    await admin
      .from('business_invoices')
      .update({
        reminder_count: Number(invoice.reminder_count || 0) + 1,
        last_reminder_at: nowIso,
        updated_at: nowIso,
      })
      .eq('id', invoice.id)
      .eq('tenant_id', tenantId);

    return NextResponse.json({ success: true, message: 'Reminder sent successfully', provider: result.provider });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to send invoice reminder', req);
  }
}
