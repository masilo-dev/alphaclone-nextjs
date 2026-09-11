import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { runProjectAutomationEvent } from '@/lib/projects/projectAutomationService';

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
 * Invoice/payment received workflow.
 * Re-evaluates the configured project kickoff policy against database truth.
 * This does not create a second project flow: the automation service delegates
 * eligible kickoff to the canonical contract-signed invoice/project workflow.
 */
export async function invoicePaidWorkflow({
  tenantId,
  payload,
  eventId,
}: {
  tenantId: string;
  payload: any;
  eventId?: string;
}) {
  "use workflow";
  await evaluatePaidInvoiceForProjectStep(tenantId, payload, eventId);
}

async function evaluatePaidInvoiceForProjectStep(
  tenantId: string,
  payload: any,
  eventId?: string,
) {
  "use step";
  const supabase = createSupabaseAdminClient();
  const invoiceId = String(payload?.invoiceId || payload?.payment?.invoiceId || '');
  const payloadContractId = String(payload?.contractId || '');

  let contractId = payloadContractId || null;
  if (!contractId && invoiceId) {
    const { data: invoice, error } = await supabase
      .from('business_invoices')
      .select('contract_id, metadata')
      .eq('tenant_id', tenantId)
      .eq('id', invoiceId)
      .maybeSingle();
    if (error) throw error;
    contractId = invoice?.contract_id || (invoice?.metadata as any)?.contract_id || null;
  }

  if (!contractId) return { status: 'skipped', reason: 'no_contract_link' };

  return runProjectAutomationEvent({
    tenantId,
    contractId,
    trigger: 'payment.received',
    actorUserId: typeof payload?.actorUserId === 'string' ? payload.actorUserId : undefined,
    correlationId: eventId,
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
