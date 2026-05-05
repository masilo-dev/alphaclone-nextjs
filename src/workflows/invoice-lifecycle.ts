import { sleep } from 'workflow';
import { businessInvoiceService } from '@/services/businessInvoiceService';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

/**
 * Invoice Lifecycle Workflow
 * Handles PDF generation, sending, reminders, and overdue escalation.
 */
export async function invoiceLifecycleWorkflow({ invoiceId, tenantId }: { invoiceId: string; tenantId: string }) {
  "use workflow";
  
  const supabase = createSupabaseAdminClient();
  await supabase.rpc('set_tenant_context', { tenant_id: tenantId });

  // 1. Generate PDF
  const pdf = await generatePDF(invoiceId);

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
  const { invoice, error } = await businessInvoiceService.getInvoiceWithDetails(invoiceId);
  if (error || !invoice) throw new Error(`Invoice not found: ${error}`);
  
  const tenant = invoice.tenant;
  const client = invoice.client;
  
  // generatePDF returns the doc object. In a real environment we would save it to storage.
  const doc = businessInvoiceService.generatePDF(invoice, tenant, client);
  console.log(`PDF generated for invoice ${invoice.invoice_number || invoice.invoiceNumber}`);
  return { success: true };
}

async function sendEmail(invoiceId: string, tenantId: string) {
  "use step";
  const { invoice, error } = await businessInvoiceService.getInvoiceWithDetails(invoiceId);
  if (error || !invoice) throw new Error(`Invoice not found: ${error}`);
  
  if (invoice.client?.email) {
    const { emailHelpers } = await import('@/services/email/emailService');
    await emailHelpers.sendInvoicePaid(
        invoice.client.email, 
        invoice.invoice_number || invoice.invoiceNumber, 
        (invoice.total || 0).toString(), 
        `https://alphaclone.tech/invoice/${invoiceId}`
    );
  }
}

async function updateCRMStatus(invoiceId: string, tenantId: string) {
  "use step";
  const supabase = createSupabaseAdminClient();
  await supabase.rpc('set_tenant_context', { tenant_id: tenantId });
  console.log(`Updating CRM status for invoice ${invoiceId}`);
  await supabase.from('invoices').update({ status: 'sent' }).eq('id', invoiceId);
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
  console.log(`Sending payment reminder for invoice ${invoiceId}`);
}

async function escalateOverdue(invoiceId: string, tenantId: string) {
  "use step";
  const supabase = createSupabaseAdminClient();
  await supabase.rpc('set_tenant_context', { tenant_id: tenantId });
  await supabase.from('invoices').update({ status: 'overdue' }).eq('id', invoiceId);
  console.log(`Invoice ${invoiceId} escalated to overdue`);
}
