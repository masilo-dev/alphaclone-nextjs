import { start } from 'workflow/api';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { invoiceLifecycleWorkflow } from './invoice-lifecycle';
import crypto from 'crypto';

/**
 * Contract Signed Workflow
 * Canonical order: contract signed → invoice → project + tasks.
 */
export async function contractSignedWorkflow({ tenantId, payload }: { tenantId: string; payload: Record<string, unknown> }) {
  "use workflow";

  const contractId = String(payload.contractId || '');
  if (!contractId) return;

  const invoice = await generateInvoiceStep(contractId, tenantId);

  if (invoice?.id) {
    await start(invoiceLifecycleWorkflow, [{ invoiceId: invoice.id, tenantId }]);
  }

  const project = await kickoffProjectStep(contractId, tenantId);

  if (project) {
    await createDefaultTasksStep(project.id, tenantId);
    await sendWelcomePackageStep(project.id, tenantId);
  }

  await syncDealStatusStep(contractId, tenantId);
}

async function generateInvoiceStep(contractId: string, tenantId: string) {
  "use step";
  const supabase = createSupabaseAdminClient();
  await supabase.rpc('set_tenant_context', { tenant_id: tenantId });
  const { data: contract } = await supabase.from('contracts').select('*').eq('id', contractId).single();
  if (!contract) return null;

  const { data: existingInvoice } = await supabase
    .from('business_invoices')
    .select('id, project_id, status')
    .eq('tenant_id', tenantId)
    .contains('metadata', { contract_id: contractId })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingInvoice?.id) {
    return existingInvoice;
  }

  const amount = Number(contract.payment_amount || 0) || 1000;
  const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const publicToken = crypto.randomUUID();

  const { data: invoice } = await supabase
    .from('business_invoices')
    .insert({
      tenant_id: tenantId,
      client_id: contract.client_id || null,
      project_id: contract.project_id || null,
      invoice_number: `INV-${Date.now().toString(36).toUpperCase()}`,
      issue_date: new Date().toISOString().slice(0, 10),
      due_date: dueDate,
      status: 'draft',
      subtotal: amount,
      tax_rate: 0,
      tax: 0,
      discount_amount: 0,
      total: amount,
      is_public: true,
      metadata: {
        public_token: publicToken,
        contract_id: contractId,
        deal_id: contract.metadata?.deal_id,
      },
      notes: `---METADATA---${JSON.stringify({ contract_id: contractId, deal_id: contract.metadata?.deal_id })}---METADATA---`,
    })
    .select()
    .single();

  if (invoice?.id) {
    await supabase.from('invoice_line_items').insert({
      invoice_id: invoice.id,
      tenant_id: tenantId,
      description: contract.title || 'Services per contract',
      quantity: 1,
      unit_price: amount,
      amount,
    });
  }

  return invoice;
}

async function kickoffProjectStep(contractId: string, tenantId: string) {
  "use step";
  const supabase = createSupabaseAdminClient();
  await supabase.rpc('set_tenant_context', { tenant_id: tenantId });
  const { data: contract } = await supabase.from('contracts').select('*').eq('id', contractId).single();
  if (!contract) return null;

  if (contract.project_id) {
    const { data: existingProject } = await supabase
      .from('projects')
      .select('*')
      .eq('id', contract.project_id)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (existingProject?.id) {
      return existingProject;
    }
  }

  const dealId = contract?.metadata?.deal_id;
  let clientId = contract.client_id || null;
  let ownerId: string | null = null;
  let ownerName: string | null = null;

  if (dealId) {
    const { data: deal } = await supabase
      .from('deals')
      .select('contact_id, owner_id, name')
      .eq('id', dealId)
      .maybeSingle();
    clientId = clientId || deal?.contact_id || null;
    ownerId = deal?.owner_id || null;
  }

  const { data: project } = await supabase
    .from('projects')
    .insert({
      tenant_id: tenantId,
      name: `Project: ${contract?.title || 'Signed Project'}`,
      contract_id: contractId,
      deal_id: dealId || null,
      client_id: clientId,
      owner_id: ownerId,
      owner_name: ownerName,
      category: 'Client Delivery',
      current_stage: 'Initiation',
      status: 'Active',
      progress: 0,
      contract_status: 'Signed',
      auto_invoice_enabled: true,
    })
    .select()
    .single();

  if (project) {
    await supabase.from('contracts').update({ project_id: project.id }).eq('id', contractId);
    if (dealId) {
      await supabase.from('deals').update({ project_id: project.id, updated_at: new Date().toISOString() }).eq('id', dealId);
    }
    await supabase
      .from('business_invoices')
      .update({ project_id: project.id, updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .contains('metadata', { contract_id: contractId });
  }

  return project;
}

async function createDefaultTasksStep(projectId: string, tenantId: string) {
  "use step";
  const supabase = createSupabaseAdminClient();
  await supabase.rpc('set_tenant_context', { tenant_id: tenantId });
  const defaultTasks = [
    { project_id: projectId, title: 'Kickoff Meeting', status: 'todo' },
    { project_id: projectId, title: 'Requirements Gathering', status: 'todo' },
  ];
  await supabase.from('tasks').insert(defaultTasks.map((t) => ({ ...t, tenant_id: tenantId })));
}

async function sendWelcomePackageStep(projectId: string, tenantId: string) {
  "use step";
  console.log(`[contract-flows] Welcome package queued for project ${projectId} (tenant ${tenantId})`);
}

async function syncDealStatusStep(contractId: string, tenantId: string) {
  "use step";
  const supabase = createSupabaseAdminClient();
  await supabase.rpc('set_tenant_context', { tenant_id: tenantId });
  const { data: contract } = await supabase.from('contracts').select('metadata, project_id').eq('id', contractId).single();
  const dealId = contract?.metadata?.deal_id;

  if (dealId) {
    await supabase.from('deals').update({ stage: 'closed_won', updated_at: new Date().toISOString() }).eq('id', dealId);
    return;
  }

  if (contract?.project_id) {
    const { data: project } = await supabase.from('projects').select('deal_id').eq('id', contract.project_id).single();
    if (project?.deal_id) {
      await supabase.from('deals').update({ stage: 'closed_won', updated_at: new Date().toISOString() }).eq('id', project.deal_id);
    }
  }
}
