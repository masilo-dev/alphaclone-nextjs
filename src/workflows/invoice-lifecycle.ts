import { sleep } from 'workflow';
import { businessInvoiceService } from '@/services/businessInvoiceService';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { sendEmailServer } from '@/lib/email/sendEmailServer';
import { invoiceEmailTemplates } from '@/lib/email/invoiceEmailTemplates';
import { getPublicInvoicePaymentUrl } from '@/lib/invoices/publicInvoiceAccess';
import { logInvoiceEvent } from '@/lib/audit/invoiceAuditLogger';
import { generateThemedInvoicePdfBuffer } from '@/lib/documents/themedDocumentPdf';

interface InvoiceLifecycleInput {
  invoiceId: string;
  tenantId: string;
  actorUserId?: string;
  recipients?: string[];
  subject?: string;
  message?: string;
}

export async function invoiceLifecycleWorkflow(input: InvoiceLifecycleInput) {
  "use workflow";

  await generateAndStorePDF(input.invoiceId, input.tenantId);
  await sendInvoiceEmail(input);
  await markInvoiceSent(input);

  await sleep('7d');
  if (await checkPaymentStatus(input.invoiceId, input.tenantId)) return;

  await sendReminder(input.invoiceId, input.tenantId);
  await sleep('7d');
  if (await checkPaymentStatus(input.invoiceId, input.tenantId)) return;

  await escalateOverdue(input.invoiceId, input.tenantId, input.actorUserId);
}

async function loadInvoice(invoiceId: string, tenantId: string) {
  const { invoice, error } = await businessInvoiceService.getInvoiceWithDetails(invoiceId, tenantId);
  if (error || !invoice) throw new Error(`Invoice not found: ${error || invoiceId}`);
  return invoice;
}

async function generateAndStorePDF(invoiceId: string, tenantId: string) {
  "use step";
  const invoice = await loadInvoice(invoiceId, tenantId);
  const admin = createSupabaseAdminClient();

  const { data: items, error: itemsError } = await admin
    .from('invoice_line_items')
    .select('*')
    .eq('invoice_id', invoiceId)
    .order('created_at', { ascending: true });
  if (itemsError) throw itemsError;

  const { data: tenant, error: tenantError } = await admin
    .from('tenants')
    .select('name, logo_url, settings')
    .eq('id', tenantId)
    .maybeSingle();
  if (tenantError) throw tenantError;

  const pdf = await generateThemedInvoicePdfBuffer(
    invoice,
    items || [],
    tenant,
    invoice.client
      ? { name: invoice.client.name, email: invoice.client.email }
      : undefined
  );
  const storagePath = `${tenantId}/${invoiceId}/invoice.pdf`;

  const { error: uploadError } = await admin.storage
    .from('invoice-documents')
    .upload(storagePath, pdf, { contentType: 'application/pdf', upsert: true });
  if (uploadError) throw new Error(`Invoice PDF could not be stored: ${uploadError.message}`);

  const { error: updateError } = await admin
    .from('business_invoices')
    .update({ pdf_storage_path: storagePath, pdf_generated_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('id', invoiceId);
  if (updateError) {
    await admin.storage.from('invoice-documents').remove([storagePath]).catch(() => undefined);
    throw updateError;
  }

  return { storagePath };
}

async function sendInvoiceEmail(input: InvoiceLifecycleInput) {
  "use step";
  const invoice = await loadInvoice(input.invoiceId, input.tenantId);
  const recipients = input.recipients?.length ? input.recipients : [invoice.client?.email].filter(Boolean);
  if (!recipients.length) throw new Error(`Invoice ${input.invoiceId} has no recipient email`);
  if (!invoice.pdf_storage_path) throw new Error('Invoice PDF has not been generated');

  const admin = createSupabaseAdminClient();
  const { data: storedPdf, error: downloadError } = await admin.storage
    .from('invoice-documents')
    .download(invoice.pdf_storage_path);
  if (downloadError || !storedPdf) throw new Error(`Stored invoice PDF could not be loaded: ${downloadError?.message || 'not found'}`);

  const invoiceNumber = invoice.invoice_number || invoice.invoiceNumber;
  const actionUrl = await getPublicInvoicePaymentUrl(admin, input.invoiceId, input.tenantId);
  const result = await sendEmailServer({
    tenantId: input.tenantId,
    userId: input.actorUserId,
    to: recipients,
    subject: input.subject || `Invoice ${invoiceNumber}`,
    html: invoiceEmailTemplates.invoiceSent({
      recipientName: invoice.client?.name || 'Valued Client',
      recipientEmail: recipients[0],
      tenantId: input.tenantId,
      invoiceNumber,
      amount: invoice.total || invoice.total_amount || 0,
      currency: invoice.currency || 'USD',
      dueDate: invoice.due_date,
      actionUrl,
      workspaceName: invoice.tenant?.name || 'AlphaClone Systems',
      notes: input.message || invoice.notes || undefined,
    }),
    attachments: [{
      filename: `Invoice_${invoiceNumber}.pdf`,
      content: Buffer.from(await storedPdf.arrayBuffer()).toString('base64'),
      contentType: 'application/pdf',
    }],
    templateName: 'invoiceLifecycleSent',
    skipFooter: true,
  });
  if (!result.success) throw new Error(`Invoice email dispatch failed: ${result.error}`);

  const now = new Date().toISOString();
  const { error: deliveryError } = await admin.from('invoice_delivery_log').insert(
    recipients.map((email) => ({
      invoice_id: input.invoiceId,
      tenant_id: input.tenantId,
      sent_at: now,
      delivered_at: null,
      sent_to_email: email,
      email_provider: result.provider,
      provider_msg_id: result.emailId || null,
      delivery_status: 'PENDING',
    }))
  );
  if (deliveryError) throw deliveryError;

  return { provider: result.provider, emailId: result.emailId };
}

async function markInvoiceSent(input: InvoiceLifecycleInput) {
  "use step";
  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const { data: invoice, error } = await admin
    .from('business_invoices')
    .update({ status: 'sent', lifecycle_status: 'sent', sent_at: now, is_public: true, updated_at: now })
    .eq('tenant_id', input.tenantId)
    .eq('id', input.invoiceId)
    .in('status', ['draft', 'approved', 'sent'])
    .select('id,invoice_number,status')
    .maybeSingle();
  if (error) throw error;
  if (!invoice) {
    const { data: current, error: currentError } = await admin
      .from('business_invoices')
      .select('status')
      .eq('tenant_id', input.tenantId)
      .eq('id', input.invoiceId)
      .maybeSingle();
    if (currentError) throw currentError;
    if (!current || !['paid', 'partially_paid', 'viewed', 'overdue'].includes(current.status)) {
      throw new Error('Invoice could not transition to sent');
    }
    return;
  }

  const [auditResult, eventResult, lifecycleResult] = await Promise.allSettled([
    logInvoiceEvent({
      invoiceId: input.invoiceId,
      tenantId: input.tenantId,
      eventType: 'sent',
      eventData: { invoiceNumber: invoice.invoice_number },
      performedBy: input.actorUserId || 'system',
    }),
    admin.from('business_automation_events').insert({
      tenant_id: input.tenantId,
      event_type: 'invoice_sent',
      payload: { invoiceId: input.invoiceId, invoiceNumber: invoice.invoice_number, actorUserId: input.actorUserId || null },
    }).then(({ error: eventError }: { error: Error | null }) => { if (eventError) throw eventError; }),
    admin.from('invoice_lifecycle_events').insert({
      tenant_id: input.tenantId,
      invoice_id: input.invoiceId,
      event_type: 'status_sent',
      from_status: 'draft',
      to_status: 'sent',
      actor_user_id: input.actorUserId || null,
      source: 'invoice_lifecycle_workflow',
      evidence: { delivery_state: 'provider_accepted_unverified' },
    }).then(({ error: lifecycleError }: { error: Error | null }) => { if (lifecycleError) throw lifecycleError; }),
  ]);
  if (auditResult.status === 'rejected') console.error('[invoice-lifecycle] sent audit failed', auditResult.reason);
  if (eventResult.status === 'rejected') console.error('[invoice-lifecycle] sent event failed', eventResult.reason);
  if (lifecycleResult.status === 'rejected') console.error('[invoice-lifecycle] lifecycle event failed', lifecycleResult.reason);
}

async function checkPaymentStatus(invoiceId: string, tenantId: string) {
  "use step";
  const admin = createSupabaseAdminClient();
  const { data: invoice, error } = await admin
    .from('business_invoices')
    .select('status')
    .eq('tenant_id', tenantId)
    .eq('id', invoiceId)
    .single();
  if (error) throw error;
  return invoice.status === 'paid' || invoice.status === 'void' || invoice.status === 'cancelled';
}

async function sendReminder(invoiceId: string, tenantId: string) {
  "use step";
  const invoice = await loadInvoice(invoiceId, tenantId);
  if (!invoice.client?.email) throw new Error(`Invoice ${invoiceId} has no client email for reminder`);
  const invoiceNumber = invoice.invoice_number || invoice.invoiceNumber;
  const admin = createSupabaseAdminClient();
  const actionUrl = await getPublicInvoicePaymentUrl(admin, invoiceId, tenantId);
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
      actionUrl,
      workspaceName: invoice.tenant?.name || 'AlphaClone Systems',
      notes: 'Friendly reminder that this invoice is still awaiting payment.',
    }),
    templateName: 'invoiceLifecycleReminder',
    skipFooter: true,
  });
  if (!result.success) throw new Error(`Invoice reminder failed: ${result.error}`);
}

async function escalateOverdue(invoiceId: string, tenantId: string, actorUserId?: string) {
  "use step";
  const invoice = await loadInvoice(invoiceId, tenantId);
  if (!invoice.client?.email) throw new Error(`Invoice ${invoiceId} has no client email for overdue notice`);
  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const { data: updated, error: statusError } = await admin
    .from('business_invoices')
    .update({ status: 'overdue', lifecycle_status: 'overdue', updated_at: now })
    .eq('tenant_id', tenantId)
    .eq('id', invoiceId)
    .in('status', ['sent', 'viewed', 'partially_paid'])
    .select('id')
    .maybeSingle();
  if (statusError) throw statusError;
  if (!updated) return;

  const invoiceNumber = invoice.invoice_number || invoice.invoiceNumber;
  const actionUrl = await getPublicInvoicePaymentUrl(admin, invoiceId, tenantId);
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
      actionUrl,
      workspaceName: invoice.tenant?.name || 'AlphaClone Systems',
    }),
    templateName: 'invoiceLifecycleOverdue',
    skipFooter: true,
  });
  if (!result.success) throw new Error(`Invoice overdue email failed: ${result.error}`);

  await Promise.allSettled([
    logInvoiceEvent({
      invoiceId,
      tenantId,
      eventType: 'status_changed',
      eventData: { invoiceNumber },
      performedBy: actorUserId || 'system',
    }),
    admin.from('business_automation_events').insert({
      tenant_id: tenantId,
      event_type: 'invoice_overdue',
      payload: { invoiceId, invoiceNumber },
    }),
  ]);
}
