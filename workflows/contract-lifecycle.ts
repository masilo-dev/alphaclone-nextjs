import { workflow, step, start } from 'workflow';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { invoiceLifecycleWorkflow } from './invoice-lifecycle';

/**
 * Contract Lifecycle Workflow
 * Orchestrates signature flow, project activation, and initial invoicing.
 */
export const contractLifecycleWorkflow = workflow(async ({ contractId, tenantId }: { contractId: string; tenantId: string }) => {
  const supabase = createSupabaseAdminClient();
  await supabase.rpc('set_tenant_context', { tenant_id: tenantId });

  // 1. Send for Signature
  await step('send-for-signature', async () => {
    // Logic to send signature link via DocuSign/HelloSign/etc.
    console.log(`Sending contract ${contractId} for signature`);
    await supabase.from('contracts').update({ status: 'sent' }).eq('id', contractId);
  });

  // 2. Wait for signature (simulated as immediate for now or logic to poll)
  // In a real scenario, this might wait for a webhook
  
  // 3. Activate Project
  const project = await step('activate-project', async () => {
    const { data: contract } = await supabase.from('contracts').select('*').eq('id', contractId).single();
    if (contract?.status !== 'signed') {
       // For demo/stub purposes, we'll assume it gets signed
       await supabase.from('contracts').update({ status: 'signed' }).eq('id', contractId);
    }
    
    // Create project from contract
    const { data: project } = await supabase.from('projects').insert({
      tenant_id: tenantId,
      name: `Project: ${contract?.title || 'Untitled'}`,
      contract_id: contractId,
      status: 'active'
    }).select().single();
    
    return project;
  });

  // 4. Create Default Tasks
  await step('create-default-tasks', async () => {
    if (!project) return;
    const defaultTasks = [
      { project_id: project.id, title: 'Kickoff Meeting', status: 'todo' },
      { project_id: project.id, title: 'Requirements Gathering', status: 'todo' }
    ];
    await supabase.from('tasks').insert(defaultTasks.map(t => ({ ...t, tenant_id: tenantId })));
  });

  // 5. Generate Initial Invoice
  const invoice = await step('generate-invoice', async () => {
    const { data: invoice } = await supabase.from('invoices').insert({
      tenant_id: tenantId,
      project_id: project?.id,
      amount: 1000, // Placeholder
      status: 'draft'
    }).select().single();
    return invoice;
  });

  // 6. Notify Team
  await step('notify-team', async () => {
    console.log(`Notifying team about new project ${project?.id}`);
  });

  // 7. Start Invoice Workflow
  if (invoice) {
    await start(invoiceLifecycleWorkflow, { invoiceId: invoice.id, tenantId });
  }
});
