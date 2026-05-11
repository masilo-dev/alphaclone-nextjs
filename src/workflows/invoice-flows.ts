import { createSupabaseAdminClient } from '@/lib/supabase-admin';

/**
 * Invoice Overdue Workflow
 * Triggered when an invoice passes its due date.
 */
export async function invoiceOverdueWorkflow({ tenantId, payload }: { tenantId: string, payload: any }) {
  "use workflow";
  
  const { invoiceId } = payload;

  // 1. Send Transactional Reminder Email
  await sendReminderEmailStep(invoiceId, tenantId);

  // 2. Update Lead/Client Status to 'at_risk' or 'delinquent'
  await updateClientStatusStep(invoiceId, tenantId);

  // 3. Create Follow-up Task for Billing
  await createBillingTaskStep(invoiceId, tenantId);
}

async function sendReminderEmailStep(invoiceId: string, tenantId: string) {
  "use step";
  const supabase = createSupabaseAdminClient();
  const { data: invoice } = await supabase.from('invoices').select('*, clients(*)').eq('id', invoiceId).single();
  
  if (invoice?.clients?.email) {
    // In a real app, call your email service here
    console.log(`[Email] Sending overdue reminder to ${invoice.clients.email} for invoice ${invoice.invoice_number}`);
    
    await supabase.from('lead_outreach_log').insert({
      tenant_id: tenantId,
      lead_email: invoice.clients.email,
      subject: `Overdue Payment: ${invoice.invoice_number}`,
      status: 'sent',
      provider: 'system_automation'
    });
  }
}

async function updateClientStatusStep(invoiceId: string, tenantId: string) {
  "use step";
  const supabase = createSupabaseAdminClient();
  const { data: invoice } = await supabase.from('invoices').select('client_id').eq('id', invoiceId).single();
  
  if (invoice?.client_id) {
    await supabase.from('leads').update({ 
      status: 'at_risk',
      notes: 'Automatically marked at_risk due to overdue invoice.'
    }).eq('id', invoice.client_id);
  }
}

async function createBillingTaskStep(invoiceId: string, tenantId: string) {
  "use step";
  const supabase = createSupabaseAdminClient();
  const { data: invoice } = await supabase.from('invoices').select('invoice_number').eq('id', invoiceId).single();

  await supabase.from('tasks').insert({
    tenant_id: tenantId,
    title: `Follow up on Overdue Invoice ${invoice?.invoice_number}`,
    priority: 'high',
    status: 'todo',
    tags: ['billing', 'automated']
  });
}
