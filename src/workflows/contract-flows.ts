<<<<<<< HEAD
import { start } from 'workflow/api';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { invoiceLifecycleWorkflow } from './invoice-lifecycle';
import crypto from 'crypto';
import { consumeDailyResourceQuota, releaseDailyResourceQuota } from '@/lib/server/dailyResourceQuota';
import {
  closeDealFromContractSign,
  resolveBusinessClientIdForParty,
  resolveContractDealId,
} from '@/lib/contracts/contractCoherenceServer';

/**
 * Contract Signed Workflow
 * Canonical order: contract signed → invoice → project + tasks.
 */
export async function contractSignedWorkflow({ tenantId, payload }: { tenantId: string; payload: Record<string, unknown> }) {
  "use workflow";

  const contractId = String(payload.contractId || '');
  if (!contractId) return;

  const invoice = await generateInvoiceStep(contractId, tenantId);

  const actorUserId = typeof payload.actorUserId === 'string' ? payload.actorUserId : undefined;
  if (invoice?.id && invoice.shouldSend && actorUserId) {
    await consumeDailyResourceQuota(tenantId, actorUserId, 'invoices');
    try {
      await start(invoiceLifecycleWorkflow, [{ invoiceId: invoice.id, tenantId, actorUserId }]);
    } catch (error) {
      await releaseDailyResourceQuota(tenantId, actorUserId, 'invoices');
      throw error;
    }
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
  const { data: contract, error: contractError } = await supabase.from('contracts').select('*').eq('tenant_id', tenantId).eq('id', contractId).single();
  if (contractError) throw contractError;
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
    return { ...existingInvoice, shouldSend: false };
  }

  const amount = Number(contract.payment_amount || 0);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const publicToken = crypto.randomUUID();

  const { data: invoice, error: invoiceError } = await supabase
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
        deal_id: resolveContractDealId(contract),
      },
      notes: `---METADATA---${JSON.stringify({ contract_id: contractId, deal_id: resolveContractDealId(contract) })}---METADATA---`,
    })
    .select()
    .single();
  if (invoiceError) throw invoiceError;

  if (invoice?.id) {
    const { error: itemError } = await supabase.from('invoice_line_items').insert({
      invoice_id: invoice.id,
      tenant_id: tenantId,
      description: contract.title || 'Services per contract',
      quantity: 1,
      unit_price: amount,
      amount,
    });
    if (itemError) {
      await supabase.from('business_invoices').delete().eq('tenant_id', tenantId).eq('id', invoice.id);
      throw itemError;
    }
  }

  return invoice ? { ...invoice, shouldSend: true } : null;
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

  const dealId = resolveContractDealId(contract);
  let clientId = contract.client_id || null;
  let ownerId: string | null = null;
  let ownerName: string | null = null;

  if (dealId) {
    const { data: deal } = await supabase
      .from('deals')
      .select('contact_id, owner_id, name')
      .eq('id', dealId)
      .maybeSingle();
    ownerId = deal?.owner_id || null;
    clientId = clientId || deal?.contact_id || null;
  }

  const businessClientId = await resolveBusinessClientIdForParty(supabase, tenantId, clientId);

  const { data: project } = await supabase
    .from('projects')
    .insert({
      tenant_id: tenantId,
      name: `Project: ${contract?.title || 'Signed Project'}`,
      contract_id: contractId,
      deal_id: dealId || null,
      client_id: businessClientId,
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
=======
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

/**
 * Contract Signed Workflow
 * Triggered when a contract status changes to 'signed'.
 */
export async function contractSignedWorkflow({ tenantId, payload }: { tenantId: string, payload: any }) {
  "use workflow";
  
  const { contractId } = payload;

  // 1. Kickoff Project Automation
  const project = await kickoffProjectStep(contractId, tenantId);

  // 2. Notify Client (Welcome Package)
  if (project) {
    await sendWelcomePackageStep(project.id, tenantId);
  }

  // 3. Mark Deal as Closed Won (if not already)
  await syncDealStatusStep(contractId, tenantId);
}

async function kickoffProjectStep(contractId: string, tenantId: string) {
  "use step";
  const supabase = createSupabaseAdminClient();
  const { data: contract } = await supabase.from('contracts').select('*').eq('id', contractId).single();
  
  const { data: project } = await supabase.from('projects').insert({
    tenant_id: tenantId,
    name: `Project: ${contract?.title || 'Signed Project'}`,
    contract_id: contractId,
    status: 'active'
  }).select().single();
  
  return project;
}

async function sendWelcomePackageStep(projectId: string, tenantId: string) {
  "use step";
  console.log(`[Automation] Sending welcome package for project ${projectId}`);
>>>>>>> origin/main
}

async function syncDealStatusStep(contractId: string, tenantId: string) {
  "use step";
  const supabase = createSupabaseAdminClient();
<<<<<<< HEAD
  await supabase.rpc('set_tenant_context', { tenant_id: tenantId });
  const { data: contract } = await supabase.from('contracts').select('metadata, project_id, client_id, deal_id').eq('id', contractId).single();
  const dealId = contract ? resolveContractDealId(contract) : null;

  if (dealId) {
    await closeDealFromContractSign(supabase, tenantId, {
      dealId,
      partyId: contract?.client_id,
    });
    return;
  }

  if (contract?.project_id) {
    const { data: project } = await supabase.from('projects').select('deal_id').eq('id', contract.project_id).single();
    if (project?.deal_id) {
      await closeDealFromContractSign(supabase, tenantId, { dealId: project.deal_id });
=======
  const { data: contract } = await supabase.from('contracts').select('project_id').eq('id', contractId).single();
  
  if (contract?.project_id) {
    const { data: project } = await supabase.from('projects').select('deal_id').eq('id', contract.project_id).single();
    if (project?.deal_id) {
       await supabase.from('deals').update({ stage: 'closed_won' }).eq('id', project.deal_id);
>>>>>>> origin/main
    }
  }
}
