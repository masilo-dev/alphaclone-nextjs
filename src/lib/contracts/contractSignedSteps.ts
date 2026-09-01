/**
 * Shared contract-signed flow for Workflow SDK and Bonnie durable runtime.
 * Canonical order: contract signed → invoice → project + tasks.
 */

import crypto from 'crypto';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { queueInvoiceSend } from '@/lib/invoices/durableInvoiceRouter';
import { validateDailyResourceQuota } from '@/lib/server/dailyResourceQuota';
import {
  closeDealFromContractSign,
  resolveBusinessClientIdForParty,
  resolveContractDealId,
} from '@/lib/contracts/contractCoherenceServer';

export type ContractSignedFlowInput = {
  tenantId: string;
  contractId: string;
  actorUserId?: string;
};

export type ContractSignedFlowResult = {
  contract_id: string;
  invoice_id?: string;
  project_id?: string;
  invoice_queued?: boolean;
};

async function generateInvoiceStep(contractId: string, tenantId: string) {
  const supabase = createSupabaseAdminClient();
  await supabase.rpc('set_tenant_context', { tenant_id: tenantId });
  const { data: contract, error: contractError } = await supabase
    .from('contracts')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', contractId)
    .single();
  if (contractError) throw contractError;
  if (!contract) return null;

  let { data: existingInvoice } = await supabase
    .from('business_invoices')
    .select('id, project_id, status')
    .eq('tenant_id', tenantId)
    .eq('contract_id', contractId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!existingInvoice) {
    const legacy = await supabase
      .from('business_invoices')
      .select('id, project_id, status')
      .eq('tenant_id', tenantId)
      .contains('metadata', { contract_id: contractId })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    existingInvoice = legacy.data;
  }
  if (existingInvoice?.id) {
    return { ...existingInvoice, shouldSend: false };
  }

  const amount = Number(contract.value ?? contract.total_amount ?? contract.payment_amount ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const publicToken = crypto.randomUUID();

  const { data: invoice, error: invoiceError } = await supabase
    .from('business_invoices')
    .insert({
      tenant_id: tenantId,
      client_id: contract.client_id || null,
      project_id: contract.project_id || null,
      contract_id: contractId,
      invoice_number: `INV-${Date.now().toString(36).toUpperCase()}`,
      issue_date: new Date().toISOString().slice(0, 10),
      due_date: dueDate,
      status: 'draft',
      lifecycle_status: 'draft',
      subtotal: amount,
      tax_rate: 0,
      tax: 0,
      discount_amount: 0,
      total: amount,
      amount_paid: 0,
      balance_due: amount,
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

async function connectInvoiceToContractStep(
  contractId: string,
  invoiceId: string,
  projectId: string | null,
  tenantId: string
) {
  const supabase = createSupabaseAdminClient();
  const { data: invoice, error: invoiceError } = await supabase
    .from('business_invoices')
    .select('total,currency')
    .eq('tenant_id', tenantId)
    .eq('id', invoiceId)
    .maybeSingle();
  if (invoiceError) throw invoiceError;
  await supabase.from('revenue_lifecycle_links').upsert(
    {
      tenant_id: tenantId,
      source_type: 'contract',
      source_id: contractId,
      target_type: 'invoice',
      target_id: invoiceId,
      relationship: 'billed_by',
    },
    { onConflict: 'tenant_id,source_type,source_id,target_type,target_id,relationship' }
  );
  if (projectId) {
    await Promise.all([
      supabase.from('revenue_lifecycle_links').upsert(
        {
          tenant_id: tenantId,
          source_type: 'contract',
          source_id: contractId,
          target_type: 'project',
          target_id: projectId,
          relationship: 'provisions',
        },
        { onConflict: 'tenant_id,source_type,source_id,target_type,target_id,relationship' }
      ),
      supabase.from('revenue_lifecycle_links').upsert(
        {
          tenant_id: tenantId,
          source_type: 'invoice',
          source_id: invoiceId,
          target_type: 'project',
          target_id: projectId,
          relationship: 'funds',
        },
        { onConflict: 'tenant_id,source_type,source_id,target_type,target_id,relationship' }
      ),
    ]);
  }
  const { data: milestones, error: milestoneError } = await supabase
    .from('contract_milestones')
    .select('id,title,due_at')
    .eq('tenant_id', tenantId)
    .eq('contract_id', contractId)
    .order('due_at');
  if (milestoneError) throw milestoneError;
  if (milestones?.length) {
    const total = Number(invoice?.total || 0);
    const share = Math.round((total / milestones.length) * 100) / 100;
    const { error: scheduleError } = await supabase.from('invoice_payment_schedules').upsert(
      milestones.map((milestone: { id: string; title: string; due_at: string }, index: number) => ({
        tenant_id: tenantId,
        invoice_id: invoiceId,
        contract_id: contractId,
        contract_milestone_id: milestone.id,
        sequence_number: index + 1,
        label: milestone.title,
        amount: index === milestones.length - 1 ? Math.round((total - share * index) * 100) / 100 : share,
        currency_code: invoice?.currency || 'USD',
        due_date: String(milestone.due_at).slice(0, 10),
        status: 'scheduled',
      })),
      { onConflict: 'tenant_id,invoice_id,sequence_number' }
    );
    if (scheduleError) throw scheduleError;
  }
}

async function kickoffProjectStep(contractId: string, tenantId: string) {
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
  const ownerName: string | null = null;

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
    const now = new Date().toISOString();
    const activate = !contract.start_date || new Date(contract.start_date).getTime() <= Date.now();
    await supabase
      .from('contracts')
      .update({
        project_id: project.id,
        ...(activate ? { lifecycle_status: 'active', status: 'active', activated_at: now } : {}),
        updated_at: now,
      })
      .eq('tenant_id', tenantId)
      .eq('id', contractId);
    if (activate && !['active', 'expiring', 'renewed'].includes(String(contract.lifecycle_status || contract.status))) {
      await supabase.from('contract_lifecycle_events').insert({
        tenant_id: tenantId,
        contract_id: contractId,
        from_status: contract.lifecycle_status || contract.status || 'signed',
        to_status: 'active',
        source: 'contract_signed_workflow',
        reason: 'Delivery project started from signed contract',
        evidence: { project_id: project.id },
      });
    }
    if (dealId) {
      await supabase
        .from('deals')
        .update({ project_id: project.id, updated_at: new Date().toISOString() })
        .eq('id', dealId);
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
  const supabase = createSupabaseAdminClient();
  await supabase.rpc('set_tenant_context', { tenant_id: tenantId });
  const defaultTasks = [
    { project_id: projectId, title: 'Kickoff Meeting', status: 'todo' },
    { project_id: projectId, title: 'Requirements Gathering', status: 'todo' },
  ];
  await supabase.from('tasks').insert(defaultTasks.map((t) => ({ ...t, tenant_id: tenantId })));
}

async function sendWelcomePackageStep(projectId: string, tenantId: string) {
  console.log(`[contract-signed] Welcome package queued for project ${projectId} (tenant ${tenantId})`);
}

async function syncDealStatusStep(contractId: string, tenantId: string) {
  const supabase = createSupabaseAdminClient();
  await supabase.rpc('set_tenant_context', { tenant_id: tenantId });
  const { data: contract } = await supabase
    .from('contracts')
    .select('metadata, project_id, client_id, deal_id')
    .eq('id', contractId)
    .single();
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
    }
  }
}

export async function runContractSignedFlow(
  input: ContractSignedFlowInput
): Promise<ContractSignedFlowResult> {
  const { tenantId, contractId, actorUserId } = input;
  if (!contractId) throw new Error('missing_contract_id');

  const invoice = await generateInvoiceStep(contractId, tenantId);

  let invoiceQueued = false;
  if (invoice?.id && invoice.shouldSend && actorUserId) {
    await validateDailyResourceQuota(tenantId, actorUserId, 'invoices');
    await queueInvoiceSend({
      tenantId,
      userId: actorUserId,
      invoiceId: invoice.id,
    });
    invoiceQueued = true;
  }

  const project = await kickoffProjectStep(contractId, tenantId);

  if (invoice?.id) {
    await connectInvoiceToContractStep(contractId, invoice.id, project?.id || null, tenantId);
  }

  if (project) {
    await createDefaultTasksStep(project.id, tenantId);
    await sendWelcomePackageStep(project.id, tenantId);
  }

  await syncDealStatusStep(contractId, tenantId);

  return {
    contract_id: contractId,
    invoice_id: invoice?.id,
    project_id: project?.id,
    invoice_queued: invoiceQueued,
  };
}
