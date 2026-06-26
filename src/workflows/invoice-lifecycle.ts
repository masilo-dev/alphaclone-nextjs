import { sleep } from 'workflow';
import { businessInvoiceService } from '@/services/businessInvoiceService';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { sendEmailServer } from '@/lib/email/sendEmailServer';
import { invoiceEmailTemplates } from '@/lib/email/invoiceEmailTemplates';
import { AppUrls } from '@/lib/urls';

/**
 * Invoice Lifecycle Workflow
 * Handles PDF generation, sending, reminders, and overdue escalation.
 */
export async function invoiceLifecycleWorkflow({ invoiceId, tenantId }: { invoiceId: string; tenantId: string }) {
  "use workflow";
  
  const supabase = createSupabaseAdminClient();
  await supabase.rpc('set_tenant_context', { tenant_id: tenantId });

  // 1. Generate PDF
  await generatePDF(invoiceId);

  // 2. Send via Provider
  await sendEmail(invoiceId, tenantId);

  // 3. Update CRM Status
  await updateCRMStatus(invoiceId, tenantId);

  // 4. Wait for payment (polled check or just wait 7 days for reminder)
  const isPaid = await checkPaymentStatus(invoiceId, tenantId);

  if (!isPaid) {
    // 5. Send Reminder after 7 days
    await sleep('7d');
    await sendReminder(invoiceId, tenantId);

    // 6. Escalate to overdue after another 7 days
    await sleep('7d');
    await escalateOverdue(invoiceId, tenantId);
  }
}

async function generatePDF(invoiceId: string) {
  "use step";
  console.log(`[invoice-lifecycle] Step 1 generate_pdf start: ${invoiceId}`);
  const { invoice, error } = await businessInvoiceService.getInvoiceWithDetails(invoiceId);
  if (error || !invoice) throw new Error(`Invoice not found: ${error}`);
  
  const tenant = invoice.tenant;
  const client = invoice.client;
  
  // generatePDF returns the doc object. In a real environment we would save it to storage.
  const doc = businessInvoiceService.generatePDF(invoice, tenant, client);
  const pdfBase64 = Buffer.from(doc.output('arraybuffer')).toString('base64');
  console.log(`[invoice-lifecycle] Step 1 generate_pdf complete: ${invoice.invoice_number || invoice.invoiceNumber}`);
  return { success: true, pdfBase64 };
}

async function sendEmail(invoiceId: string, tenantId: string) {
  "use step";
  console.log(`[invoice-lifecycle] Step 2 send_email start: ${invoiceId}`);
  const { invoice, error } = await businessInvoiceService.getInvoiceWithDetails(invoiceId);
  if (error || !invoice) throw new Error(`Invoice not found: ${error}`);

  if (!invoice.client?.email) {
    throw new Error(`Invoice ${invoiceId} has no client email`);
  }

  const doc = businessInvoiceService.generatePDF(invoice, invoice.tenant, invoice.client);
  const pdfBase64 = Buffer.from(doc.output('arraybuffer')).toString('base64');
  const invoiceNumber = invoice.invoice_number || invoice.invoiceNumber;
  const actionUrl = AppUrls.payInvoice(invoiceId);
  const result = await sendEmailServer({
    tenantId,
    to: invoice.client.email,
    subject: `Invoice ${invoiceNumber}`,
    html: invoiceEmailTemplates.invoiceSent({
      recipientName: invoice.client?.name || 'Valued Client',
      recipientEmail: invoice.client.email,
      tenantId,
      invoiceNumber,
      amount: invoice.total || invoice.total_amount || 0,
      currency: invoice.currency || 'USD',
      dueDate: invoice.due_date,
      actionUrl,
      workspaceName: invoice.tenant?.name || 'AlphaClone Systems',
      notes: invoice.notes || undefined,
    }),
    attachments: [{
      filename: `Invoice_${invoiceNumber}.pdf`,
      content: pdfBase64,
      content_type: 'application/pdf',
    }],
    templateName: 'invoiceLifecycleSent',
    skipFooter: true,
  });
  if (!result.success) {
    throw new Error(`Invoice email dispatch failed: ${result.error}`);
  }
  console.log(`[invoice-lifecycle] Step 2 send_email complete via ${result.provider}: ${invoiceId}`);
  return { success: true, provider: result.provider, emailId: result.emailId };
}

async function updateCRMStatus(invoiceId: string, tenantId: string) {
  "use step";
  const supabase = createSupabaseAdminClient();
  await supabase.rpc('set_tenant_context', { tenant_id: tenantId });
  console.log(`[invoice-lifecycle] Step 3 update_status start: ${invoiceId}`);
  await supabase.from('invoices').update({ status: 'sent' }).eq('id', invoiceId);
  await supabase.from('business_invoices').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', invoiceId);
  console.log(`[invoice-lifecycle] Step 3 update_status complete: ${invoiceId}`);
}

async function checkPaymentStatus(invoiceId: string, tenantId: string) {
  "use step";
  const supabase = createSupabaseAdminClient();
  await supabase.rpc('set_tenant_context', { tenant_id: tenantId });
  const { data: invoice } = await supabase.from('invoices').select('status').eq('id', invoiceId).single();
  return invoice?.status === 'paid';
}

async function sendReminder(invoiceId: string, tenantId: string) {
  "use step";
  console.log(`[invoice-lifecycle] Step 4 reminder start: ${invoiceId}`);
  const { invoice, error } = await businessInvoiceService.getInvoiceWithDetails(invoiceId);
  if (error || !invoice) throw new Error(`Invoice not found: ${error}`);
  if (!invoice.client?.email) throw new Error(`Invoice ${invoiceId} has no client email for reminder`);
  const invoiceNumber = invoice.invoice_number || invoice.invoiceNumber;
  const result = await sendEmailServer({
    tenantId,
    to: invoice.client.email,
    subject: `Reminder: Invoice ${invoiceNumber}`,
    html: invoiceEmailTemplates.invoiceSent({
      recipientName: invoice.client?.name || 'Valued Client',
      recipientEmail: invoice.client.email,
      tenantId,
      invoiceNumber,
      amount: invoice.total || invoice.total_amount || 0,
      currency: invoice.currency || 'USD',
      dueDate: invoice.due_date,
      actionUrl: AppUrls.payInvoice(invoiceId),
      workspaceName: invoice.tenant?.name || 'AlphaClone Systems',
      notes: 'Friendly reminder that this invoice is still awaiting payment.',
    }),
    templateName: 'invoiceLifecycleReminder',
    skipFooter: true,
  });
  if (!result.success) throw new Error(`Invoice reminder failed: ${result.error}`);
  console.log(`[invoice-lifecycle] Step 4 reminder complete via ${result.provider}: ${invoiceId}`);
}

async function escalateOverdue(invoiceId: string, tenantId: string) {
  "use step";
  const supabase = createSupabaseAdminClient();
  await supabase.rpc('set_tenant_context', { tenant_id: tenantId });
  console.log(`[invoice-lifecycle] Step 5 overdue start: ${invoiceId}`);
  const { invoice, error } = await businessInvoiceService.getInvoiceWithDetails(invoiceId);
  if (error || !invoice) throw new Error(`Invoice not found: ${error}`);
  await supabase.from('invoices').update({ status: 'overdue' }).eq('id', invoiceId);
  await supabase.from('business_invoices').update({ status: 'overdue', updated_at: new Date().toISOString() }).eq('id', invoiceId);
  if (!invoice.client?.email) throw new Error(`Invoice ${invoiceId} has no client email for overdue notice`);
  const invoiceNumber = invoice.invoice_number || invoice.invoiceNumber;
  const result = await sendEmailServer({
    tenantId,
    to: invoice.client.email,
    subject: `Overdue: Invoice ${invoiceNumber}`,
    html: invoiceEmailTemplates.invoiceOverdue({
      recipientName: invoice.client?.name || 'Valued Client',
      recipientEmail: invoice.client.email,
      tenantId,
      invoiceNumber,
      amount: invoice.total || invoice.total_amount || 0,
      currency: invoice.currency || 'USD',
      dueDate: invoice.due_date,
      actionUrl: AppUrls.payInvoice(invoiceId),
      workspaceName: invoice.tenant?.name || 'AlphaClone Systems',
    }),
    templateName: 'invoiceLifecycleOverdue',
    skipFooter: true,
  });
  if (!result.success) throw new Error(`Invoice overdue email failed: ${result.error}`);
  console.log(`[invoice-lifecycle] Step 5 overdue complete via ${result.provider}: ${invoiceId}`);
}
