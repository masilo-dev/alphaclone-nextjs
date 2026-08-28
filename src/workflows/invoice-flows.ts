import { createSupabaseAdminClient } from '@/lib/supabase-admin';

/**
 * Invoice Created Workflow
 * Triggered when a new invoice is created or sent.
 */
export async function invoiceCreatedWorkflow({ tenantId, payload }: { tenantId: string; payload: any }) {
  "use workflow";
  await notifyInvoiceCreatedStep(tenantId, payload);
}

async function notifyInvoiceCreatedStep(tenantId: string, payload: any) {
  "use step";
  const supabase = createSupabaseAdminClient();
  const invoiceId = payload?.invoiceId;
  if (!invoiceId) return;

  const { data: invoice } = await supabase
    .from('business_invoices')
    .select('invoice_number, total, client_id')
    .eq('id', invoiceId)
    .maybeSingle();

  await supabase.from('notifications').insert({
    tenant_id: tenantId,
    title: 'Invoice created',
    message: `Invoice ${invoice?.invoice_number || invoiceId} was created${invoice?.total ? ` for $${invoice.total}` : ''}.`,
    type: 'info',
    metadata: { invoiceId, clientId: invoice?.client_id || null },
  });
}

/**
 * Invoice Overdue Workflow
 * Triggered when an invoice passes its due date.
 */
export async function invoiceOverdueWorkflow({ tenantId, payload }: { tenantId: string, payload: any }) {
  "use workflow";
  
  const { invoiceId } = payload;

  await sendReminderEmailStep(invoiceId, tenantId);
  await updateClientStatusStep(invoiceId, tenantId);
  await createBillingTaskStep(invoiceId, tenantId);
}

async function sendReminderEmailStep(invoiceId: string, tenantId: string) {
  "use step";
  const supabase = createSupabaseAdminClient();
  const { data: invoice } = await supabase
    .from('business_invoices')
    .select('invoice_number, client_id, business_clients:client_id(email, name)')
    .eq('id', invoiceId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  
  const clientEmail = (invoice as any)?.business_clients?.email;
  if (clientEmail) {
    console.log(`[Email] Sending overdue reminder to ${clientEmail} for invoice ${invoice?.invoice_number}`);
    
    await supabase.from('lead_outreach_log').insert({
      tenant_id: tenantId,
      lead_email: clientEmail,
      subject: `Overdue Payment: ${invoice?.invoice_number}`,
      status: 'sent',
      provider: 'system_automation'
    });
  }
}

async function updateClientStatusStep(invoiceId: string, tenantId: string) {
  "use step";
  const supabase = createSupabaseAdminClient();
  const { data: invoice } = await supabase
    .from('business_invoices')
    .select('client_id')
    .eq('id', invoiceId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  
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
  const { data: invoice } = await supabase
    .from('business_invoices')
    .select('invoice_number')
    .eq('id', invoiceId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  await supabase.from('tasks').insert({
    tenant_id: tenantId,
    title: `Follow up on Overdue Invoice ${invoice?.invoice_number}`,
    priority: 'high',
    status: 'todo',
    tags: ['billing', 'automated']
  });
}
