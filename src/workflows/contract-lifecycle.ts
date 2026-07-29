<<<<<<< HEAD
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

/**
 * Contract Lifecycle Workflow — send for signature only.
 * After signature: invoice → project (contractSignedWorkflow in contract-flows.ts).
 */
export async function contractLifecycleWorkflow({ contractId, tenantId }: { contractId: string; tenantId: string }) {
  "use workflow";

  const supabase = createSupabaseAdminClient();
  await supabase.rpc('set_tenant_context', { tenant_id: tenantId });

  await sendForSignature(contractId, tenantId);
=======
import { start } from 'workflow/api';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { invoiceLifecycleWorkflow } from './invoice-lifecycle';

/**
 * Contract Lifecycle Workflow
 * Orchestrates signature flow, project activation, and initial invoicing.
 */
export async function contractLifecycleWorkflow({ contractId, tenantId }: { contractId: string; tenantId: string }) {
  "use workflow";
  
  const supabase = createSupabaseAdminClient();
  await supabase.rpc('set_tenant_context', { tenant_id: tenantId });

  // 1. Send for Signature
  await sendForSignature(contractId, tenantId);

  // 2. Activate Project
  const project = await activateProject(contractId, tenantId);

  // 3. Create Default Tasks
  if (project) {
    await createDefaultTasks(project.id, tenantId);
  }

  // 4. Generate Initial Invoice
  const invoice = await generateInvoice(project?.id, tenantId);

  // 5. Notify Team
  await notifyTeam(project?.id);

  // 6. Start Invoice Workflow
  if (invoice) {
    await start(invoiceLifecycleWorkflow, [{ invoiceId: invoice.id, tenantId }]);
  }
>>>>>>> origin/main
}

async function sendForSignature(contractId: string, tenantId: string) {
  "use step";
  const supabase = createSupabaseAdminClient();
  await supabase.rpc('set_tenant_context', { tenant_id: tenantId });
<<<<<<< HEAD
  console.log(`[contract-lifecycle] Sending contract ${contractId} for signature`);
  await supabase.from('contracts').update({ status: 'sent' }).eq('id', contractId);
}
=======
  console.log(`Sending contract ${contractId} for signature`);
  await supabase.from('contracts').update({ status: 'sent' }).eq('id', contractId);
}

async function activateProject(contractId: string, tenantId: string) {
  "use step";
  const supabase = createSupabaseAdminClient();
  await supabase.rpc('set_tenant_context', { tenant_id: tenantId });
  const { data: contract } = await supabase.from('contracts').select('*').eq('id', contractId).single();
  
  if (contract?.status !== 'signed') {
     await supabase.from('contracts').update({ status: 'signed' }).eq('id', contractId);
  }
  
  const { data: project } = await supabase.from('projects').insert({
    tenant_id: tenantId,
    name: `Project: ${contract?.title || 'Untitled'}`,
    contract_id: contractId,
    status: 'active'
  }).select().single();
  
  return project;
}

async function createDefaultTasks(projectId: string, tenantId: string) {
  "use step";
  const supabase = createSupabaseAdminClient();
  await supabase.rpc('set_tenant_context', { tenant_id: tenantId });
  const defaultTasks = [
    { project_id: projectId, title: 'Kickoff Meeting', status: 'todo' },
    { project_id: projectId, title: 'Requirements Gathering', status: 'todo' }
  ];
  await supabase.from('tasks').insert(defaultTasks.map(t => ({ ...t, tenant_id: tenantId })));
}

async function generateInvoice(projectId: string | undefined, tenantId: string) {
  "use step";
  const supabase = createSupabaseAdminClient();
  await supabase.rpc('set_tenant_context', { tenant_id: tenantId });
  const { data: invoice } = await supabase.from('invoices').insert({
    tenant_id: tenantId,
    project_id: projectId,
    amount: 1000,
    status: 'draft'
  }).select().single();
  return invoice;
}

async function notifyTeam(projectId: string | undefined) {
  "use step";
  console.log(`Notifying team about new project ${projectId}`);
}
>>>>>>> origin/main
