import { workflow, step } from 'workflow';
import { businessInvoiceService } from '@/services/businessInvoiceService';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

/**
 * Invoice Lifecycle Workflow
 * Handles PDF generation, sending, reminders, and overdue escalation.
 */
export const invoiceLifecycleWorkflow = workflow(async ({ invoiceId, tenantId }: { invoiceId: string; tenantId: string }) => {
  const supabase = createSupabaseAdminClient();
  await supabase.rpc('set_tenant_context', { tenant_id: tenantId });

  // 1. Generate PDF
  const pdf = await step('generate-pdf', async () => {
    const { data, error } = await businessInvoiceService.generatePDF(invoiceId);
    if (error) throw new Error(`PDF generation failed: ${error}`);
    return data;
  });

  // 2. Send via Provider
  await step('send-email', async () => {
    const { error } = await businessInvoiceService.sendInvoice(invoiceId, tenantId);
    if (error) throw new Error(`Email delivery failed: ${error}`);
  });

  // 3. Update CRM Status
  await step('update-crm-status', async () => {
    // Stub: Implement CRM update logic
    console.log(`Updating CRM status for invoice ${invoiceId}`);
    await supabase.from('invoices').update({ status: 'sent' }).eq('id', invoiceId);
  });

  // 4. Wait for payment (polled check or just wait 7 days for reminder)
  const isPaid = await step('check-payment-status', async () => {
    const { data: invoice } = await supabase.from('invoices').select('status').eq('id', invoiceId).single();
    return invoice?.status === 'paid';
  });

  if (!isPaid) {
    // 5. Send Reminder after 7 days
    await step('send-reminder', async () => {
      // Stub: Send reminder email
      console.log(`Sending payment reminder for invoice ${invoiceId}`);
    }, { wait: '7d' });

    // 6. Escalate to overdue after another 7 days
    await step('escalate-overdue', async () => {
      await supabase.from('invoices').update({ status: 'overdue' }).eq('id', invoiceId);
      console.log(`Invoice ${invoiceId} escalated to overdue`);
    }, { wait: '7d' });
  }
});
